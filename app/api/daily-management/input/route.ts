import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { dailyManagementInputs } from "../../../../db/schema";
import { COMPANY_ID, TENANT_ID } from "../../../../lib/company-management/types";
import type { DailyManagementInputSnapshot } from "../../../../lib/daily-management/input-storage";
import { AuthError, verifyFirebaseRequest } from "../../../../lib/server/firebase-auth";

export const dynamic = "force-dynamic";

type SaveMode = "draft" | "publish";

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function nonNegativeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function normalizeSnapshot(value: unknown): DailyManagementInputSnapshot {
  if (!value || typeof value !== "object") throw new InputError("ข้อมูลฟอร์มไม่ถูกต้อง");
  const input = value as Partial<DailyManagementInputSnapshot>;
  const reportDate = cleanText(input.reportDate, 10);
  const branch = cleanText(input.branch, 80);
  const preparedBy = cleanText(input.preparedBy, 120);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) throw new InputError("กรุณาเลือกวันที่รายงาน");
  if (!branch) throw new InputError("กรุณาเลือกสาขา");
  if (!preparedBy) throw new InputError("กรุณาระบุผู้จัดทำ");

  const actions = Array.isArray(input.actions) ? input.actions.slice(0, 20).map((item) => ({
    title: cleanText(item?.title, 180),
    detail: cleanText(item?.detail, 500),
    owner: cleanText(item?.owner, 120),
    nextStep: cleanText(item?.nextStep, 120),
    priority: item?.priority === "critical" || item?.priority === "attention" ? item.priority : "warning" as const,
  })) : [];
  if (actions.some((item) => !item.title || !item.owner)) throw new InputError("Action ต้องมีหัวข้อและผู้รับผิดชอบ");

  return {
    version: 1,
    reportDate,
    branch,
    preparedBy,
    target: {
      mtdTarget: nonNegativeNumber(input.target?.mtdTarget),
      expectedPace: nonNegativeNumber(input.target?.expectedPace),
    },
    bookingLifecycle: {
      waitApprove: nonNegativeNumber(input.bookingLifecycle?.waitApprove),
      waitDelivery: nonNegativeNumber(input.bookingLifecycle?.waitDelivery),
      deliveredToday: nonNegativeNumber(input.bookingLifecycle?.deliveredToday),
      cancelUnits: nonNegativeNumber(input.bookingLifecycle?.cancelUnits),
      cancelReason: cleanText(input.bookingLifecycle?.cancelReason, 300),
    },
    actions,
    notes: {
      situation: cleanText(input.notes?.situation, 3000),
      decision: cleanText(input.notes?.decision, 3000),
      tomorrowFocus: cleanText(input.notes?.tomorrowFocus, 3000),
    },
    savedAt: null,
    publishedAt: null,
  };
}

function parseSnapshot(payload: string | null, savedAt: string, publishedAt: string | null) {
  if (!payload) return null;
  const snapshot = JSON.parse(payload) as DailyManagementInputSnapshot;
  return { ...snapshot, savedAt, publishedAt };
}

export async function GET(request: Request) {
  try {
    await verifyFirebaseRequest(request);
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") === "published" ? "published" : "draft";
    const reportDate = url.searchParams.get("date");
    const branch = url.searchParams.get("branch");
    const db = await getDb();
    const filters = [eq(dailyManagementInputs.companyId, COMPANY_ID)];
    if (reportDate) filters.push(eq(dailyManagementInputs.reportDate, reportDate));
    if (branch) filters.push(eq(dailyManagementInputs.branch, branch));
    const [row] = await db.select().from(dailyManagementInputs)
      .where(and(...filters))
      .orderBy(desc(mode === "published" ? dailyManagementInputs.publishedAt : dailyManagementInputs.updatedAt))
      .limit(1);
    const snapshot = row ? parseSnapshot(
      mode === "published" ? row.publishedPayload : row.draftPayload,
      row.savedAt,
      row.publishedAt,
    ) : null;
    if (!snapshot) return Response.json({ error: "ยังไม่มีข้อมูลที่บันทึกไว้" }, { status: 404 });
    return Response.json({ source: "d1", revision: row.revision, snapshot }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await verifyFirebaseRequest(request);
    const body = await request.json() as { mode?: SaveMode; snapshot?: unknown };
    const mode: SaveMode = body.mode === "publish" ? "publish" : "draft";
    const snapshot = normalizeSnapshot(body.snapshot);
    const db = await getDb();
    const [existing] = await db.select().from(dailyManagementInputs).where(and(
      eq(dailyManagementInputs.companyId, COMPANY_ID),
      eq(dailyManagementInputs.reportDate, snapshot.reportDate),
      eq(dailyManagementInputs.branch, snapshot.branch),
    )).limit(1);
    const now = new Date().toISOString();
    const savedSnapshot = { ...snapshot, savedAt: now, publishedAt: mode === "publish" ? now : existing?.publishedAt ?? null };
    const draftPayload = JSON.stringify(savedSnapshot);
    const publishedPayload = mode === "publish" ? draftPayload : existing?.publishedPayload ?? null;
    const values = {
      id: existing?.id ?? crypto.randomUUID(),
      tenantId: TENANT_ID,
      companyId: COMPANY_ID,
      reportDate: snapshot.reportDate,
      branch: snapshot.branch,
      draftPayload,
      publishedPayload,
      revision: (existing?.revision ?? 0) + 1,
      savedAt: now,
      publishedAt: mode === "publish" ? now : existing?.publishedAt ?? null,
      createdBy: existing?.createdBy ?? user.id,
      updatedAt: now,
      updatedBy: user.id,
    };
    await db.insert(dailyManagementInputs).values(values).onConflictDoUpdate({
      target: [dailyManagementInputs.companyId, dailyManagementInputs.reportDate, dailyManagementInputs.branch],
      set: {
        draftPayload: values.draftPayload,
        publishedPayload: values.publishedPayload,
        revision: values.revision,
        savedAt: values.savedAt,
        publishedAt: values.publishedAt,
        updatedAt: values.updatedAt,
        updatedBy: values.updatedBy,
      },
    });
    return Response.json({ source: "d1", mode, revision: values.revision, snapshot: savedSnapshot }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

class InputError extends Error {}

function errorResponse(error: unknown) {
  const status = error instanceof AuthError ? error.status : error instanceof InputError ? 400 : 500;
  return Response.json({ error: error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้" }, { status, headers: { "Cache-Control": "no-store" } });
}
