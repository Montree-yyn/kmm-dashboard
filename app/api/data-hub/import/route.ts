import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { bookingTransactions, companyUsers, dataImportHistory, stockTransactions } from "../../../../db/schema";
import { COMPANY_ID, TENANT_ID, type CompanyRole } from "../../../../lib/company-management/types";
import { isCompanyRole } from "../../../../lib/company-management/permissions";
import {
  assertStatementWithinD1Budget,
  chunkRowsForD1,
  countBoundParameters,
  executeAtomicD1Batch,
} from "../../../../lib/data-hub/d1-batching";
import { AuthError, verifyFirebaseRequest } from "../../../../lib/server/firebase-auth";
import { canonicalModelName } from "../../../../lib/dashboard/model-normalization";

export const dynamic = "force-dynamic";
const WRITE_ROLES = new Set<CompanyRole>(["super_admin", "company_admin", "manager"]);
type Module = "sales" | "booking" | "stock";

export async function GET(request: Request) {
  try {
    const context = await getContext(request);
    const history = await context.db.select().from(dataImportHistory).where(eq(dataImportHistory.companyId, COMPANY_ID)).orderBy(desc(dataImportHistory.importedAt)).limit(100);
    const latest = new Map<string, (typeof history)[number]>();
    history.forEach((item) => { if (!latest.has(item.module)) latest.set(item.module, item); });
    return Response.json({ history: history.map(toHistory), statuses: ["sales", "booking", "stock"].map((module) => ({ module, lastUpdate: latest.get(module)?.importedAt ?? null, status: latest.get(module)?.status ?? "not_updated" })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleError(error); }
}

export async function POST(request: Request) {
  let context: Awaited<ReturnType<typeof getContext>> | null = null;
  let payload: { module?: Module; filename?: string; year?: number; month?: number; businessWeek?: number | null; rows?: Record<string, unknown>[]; validation?: { warningCells?: number } } = {};
  try {
    context = await getContext(request);
    if (!WRITE_ROLES.has(context.role)) return json({ error: "Your role is read-only for imports." }, 403);
    const db = context.db;
    payload = await request.json();
    const importModule = payload.module;
    const year = Number(payload.year);
    const month = Number(payload.month);
    if (!importModule || !["sales", "booking", "stock"].includes(importModule) || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return json({ error: "Module, year and month are required." }, 400);
    if (!payload.rows?.length || payload.rows.length > 50_000) return json({ error: "The import must contain between 1 and 50,000 rows." }, 400);
    const importId = crypto.randomUUID();
    const common = { tenantId: TENANT_ID, companyId: COMPANY_ID, importId, importYear: year, importMonth: month, businessWeek: payload.businessWeek ?? null, createdBy: context.user.id };
    const statements: Array<Parameters<typeof db.batch>[0][number]> = [];
    if (importModule === "booking") {
      const rows = payload.rows.map((row, index) => {
        if (!row.booking_date || !row.booking_no) throw new Error(`Row ${index + 2} is not valid for Booking import.`);
        const bookingDate = String(row.booking_date);
        const date = new Date(`${bookingDate}T00:00:00`);
        return { id: crypto.randomUUID(), ...common, bookingDate, bookingNo: String(row.booking_no), bookingNumber: nullableText(row.booking_number ?? row.booking_no), branch: textValue(row.branch ?? row.branch_name ?? row.branch_code), customer: textValue(row.customer ?? row.customer_name), product: textValue(row.product ?? row.product_type ?? row.product_model), status: textValue(row.status ?? row.booking_status), bookingYear: integerValue(row.booking_year) ?? (Number.isNaN(date.getTime()) ? null : date.getFullYear()), bookingMonth: integerValue(row.booking_month) ?? (Number.isNaN(date.getTime()) ? null : date.getMonth() + 1), branchCode: nullableText(row.branch_code), branchName: nullableText(row.branch_name), salespersonCode: nullableText(row.salesperson_code), salespersonName: nullableText(row.salesperson_name), productType: nullableText(row.product_type), productModel: nullableText(canonicalModelName(row.product_model ?? row.model)), customerName: nullableText(row.customer_name ?? row.customer), bookingPrice: nullableText(row.booking_price), depositAmount: nullableText(row.deposit_amount), bookingStatus: nullableText(row.booking_status ?? row.status), purchaseStatus: nullableText(row.purchase_status) };
      });
      const deleteStatement = db.delete(bookingTransactions).where(and(eq(bookingTransactions.companyId, COMPANY_ID), eq(bookingTransactions.importYear, year), eq(bookingTransactions.importMonth, month)));
      const boundParametersPerRow = countBoundParameters(db.insert(bookingTransactions).values(rows[0]));
      const { chunks } = chunkRowsForD1(rows, boundParametersPerRow);
      assertStatementWithinD1Budget(deleteStatement);
      statements.push(deleteStatement);
      chunks.forEach((chunk) => {
        const insertStatement = db.insert(bookingTransactions).values(chunk);
        assertStatementWithinD1Budget(insertStatement);
        statements.push(insertStatement);
      });
    } else if (importModule === "stock") {
      const rows = payload.rows.map((row, index) => {
        const quantity = Number(String(row.quantity ?? "").replaceAll(",", ""));
        if (!row.as_of_date || (!row.branch && !row.branch_name && !row.branch_code) || (!row.product && !row.product_type && !row.product_model) || !Number.isFinite(quantity)) throw new Error(`Row ${index + 2} is not valid for Stock import.`);
        const stockDate = String(row.stock_date ?? row.as_of_date);
        const snapshotDate = nullableText(row.snapshot_date);
        const explicitAge = integerValue(row.stock_age_days);
        const stockAgeDays = explicitAge ?? calculateAgeDays(stockDate, snapshotDate);
        return { id: crypto.randomUUID(), ...common, asOfDate: String(row.as_of_date), branch: textValue(row.branch ?? row.branch_name ?? row.branch_code), product: textValue(row.product ?? row.product_type ?? row.product_model), quantity, stockDate, branchCode: nullableText(row.branch_code), branchName: nullableText(row.branch_name), productType: nullableText(row.product_type), productGroup: nullableText(row.product_group), productModel: nullableText(canonicalModelName(row.product_model ?? row.model)), kmmFlag: integerValue(row.kmm_flag), msrp: nullableText(row.msrp), stockStatus: nullableText(row.stock_status ?? row.status), stockNumber: nullableText(row.stock_number), serialNumber: nullableText(row.serial_number), engineNumber: nullableText(row.engine_number), chassisNumber: nullableText(row.chassis_number), stockAgeDays, snapshotDate };
      });
      const deleteStatement = db.delete(stockTransactions).where(and(eq(stockTransactions.companyId, COMPANY_ID), eq(stockTransactions.importYear, year), eq(stockTransactions.importMonth, month)));
      const boundParametersPerRow = countBoundParameters(db.insert(stockTransactions).values(rows[0]));
      const { chunks } = chunkRowsForD1(rows, boundParametersPerRow);
      assertStatementWithinD1Budget(deleteStatement);
      statements.push(deleteStatement);
      chunks.forEach((chunk) => {
        const insertStatement = db.insert(stockTransactions).values(chunk);
        assertStatementWithinD1Budget(insertStatement);
        statements.push(insertStatement);
      });
    } else {
      return json({ error: "Sales imports continue through the existing Sales import API." }, 400);
    }
    const history = { id: importId, tenantId: TENANT_ID, companyId: COMPANY_ID, module: importModule, importYear: year, importMonth: month, filename: payload.filename ?? `${importModule}-import.xlsx`, status: "success", totalRows: payload.rows.length, validRows: payload.rows.length, warningRows: payload.validation?.warningCells ?? 0, errorRows: 0, durationMs: 0, importedBy: context.user.email || context.user.id, importedAt: new Date().toISOString() };
    const historyStatement = db.insert(dataImportHistory).values(history);
    assertStatementWithinD1Budget(historyStatement);
    statements.push(historyStatement);
    await executeAtomicD1Batch(statements, (batch) => db.batch(batch));
    return json({ ok: true, module: importModule, importId, importedRows: payload.rows.length, refreshRequired: true, history: toHistory(history) });
  } catch (error) {
    if (context && payload.module) {
      try { await context.db.insert(dataImportHistory).values({ id: crypto.randomUUID(), tenantId: TENANT_ID, companyId: COMPANY_ID, module: payload.module, importYear: Number(payload.year) || 0, importMonth: Number(payload.month) || 0, filename: payload.filename ?? `${payload.module}-import.xlsx`, status: "failed", totalRows: payload.rows?.length ?? 0, validRows: 0, warningRows: 0, errorRows: 1, durationMs: 0, importedBy: context.user.email || context.user.id, importedAt: new Date().toISOString() }); } catch { /* Preserve the original import error. */ }
    }
    return handleError(error);
  }
}

async function getContext(request: Request) {
  const user = await verifyFirebaseRequest(request);
  const db = await getDb();
  const [existing] = await db.select({ role: companyUsers.role }).from(companyUsers).where(and(eq(companyUsers.companyId, COMPANY_ID), eq(companyUsers.userId, user.id), eq(companyUsers.status, "active"))).limit(1);
  const role = existing && isCompanyRole(existing.role) ? existing.role : "viewer";
  return { db, user, role };
}
function toHistory(row: { id: string; filename: string; module: string; importedAt: string; importedBy: string; totalRows: number; validRows: number; warningRows: number; errorRows: number; status: string }) { return { id: row.id, filename: row.filename, module: row.module, importedAt: row.importedAt, importedBy: row.importedBy, rows: row.totalRows, success: row.validRows, warning: row.warningRows, error: row.errorRows, status: row.status === "success" ? "success" : "failed", durationMs: 0, rollbackAvailable: false }; }
function json(value: unknown, status = 200) { return Response.json(value, { status, headers: { "Cache-Control": "no-store" } }); }
function handleError(error: unknown) { const status = error instanceof AuthError ? error.status : error instanceof Error && /valid|required|Row/.test(error.message) ? 400 : 500; return json({ error: error instanceof Error ? error.message : "Unexpected Data Hub import error." }, status); }
function nullableText(value: unknown) { const text = String(value ?? "").trim(); return text ? text : null; }
function textValue(value: unknown) { return nullableText(value) ?? ""; }
function integerValue(value: unknown) { const number = Number(value); return Number.isInteger(number) ? number : null; }
function calculateAgeDays(stockDate: string, snapshotDate: string | null) { if (!snapshotDate) return null; const stock = new Date(`${stockDate}T00:00:00`); const snapshot = new Date(`${snapshotDate}T00:00:00`); if (Number.isNaN(stock.getTime()) || Number.isNaN(snapshot.getTime())) return null; return Math.max(0, Math.floor((snapshot.getTime() - stock.getTime()) / 86_400_000)); }
