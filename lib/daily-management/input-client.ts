import { auth } from "../firebase";
import type { DailyManagementInputSnapshot } from "./input-storage";
import { resolveActiveCompanyId } from "../company-context/client-store";

type InputResponse = {
  source: "d1";
  revision: number;
  snapshot: DailyManagementInputSnapshot;
  error?: string;
};

async function authorizationHeader() {
  await auth.authStateReady();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  return { Authorization: `Bearer ${token}` };
}

export async function loadDailyManagementInput(mode: "draft" | "published", options: { date?: string; branch?: string; companyId?: string } = {}) {
  const search = new URLSearchParams({ mode, ts: String(Date.now()) });
  if (options.date) search.set("date", options.date);
  if (options.branch) search.set("branch", options.branch);
  const companyId = resolveActiveCompanyId(options.companyId);
  if (companyId) search.set("companyId", companyId);
  const response = await fetch(`/api/daily-management/input?${search}`, {
    headers: await authorizationHeader(),
    cache: "no-store",
  });
  const payload = await response.json() as InputResponse;
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(payload.error ?? `โหลดข้อมูลไม่สำเร็จ (${response.status})`);
  return payload.snapshot;
}

export async function persistDailyManagementInput(snapshot: DailyManagementInputSnapshot, mode: "draft" | "publish", companyId?: string) {
  const search = new URLSearchParams();
  const resolvedCompanyId = resolveActiveCompanyId(companyId);
  if (resolvedCompanyId) search.set("companyId", resolvedCompanyId);
  const endpoint = search.size ? `/api/daily-management/input?${search}` : "/api/daily-management/input";
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...await authorizationHeader() },
    body: JSON.stringify({ mode, snapshot }),
  });
  const payload = await response.json() as InputResponse;
  if (!response.ok) throw new Error(payload.error ?? `บันทึกข้อมูลไม่สำเร็จ (${response.status})`);
  return payload.snapshot;
}
