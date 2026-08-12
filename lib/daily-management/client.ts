import { auth } from "../firebase";
import type { DailyManagementPayload } from "./types";
import { resolveActiveCompanyId } from "../company-context/client-store";

export async function loadDailyManagementReport(options: {
  date?: string;
  branch?: string;
  companyId?: string;
} = {}): Promise<DailyManagementPayload> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Your secure session has expired. Sign in again.");
  const search = new URLSearchParams({ ts: String(Date.now()) });
  if (options.date) search.set("date", options.date);
  if (options.branch) search.set("branch", options.branch);
  const companyId = resolveActiveCompanyId(options.companyId);
  if (companyId) search.set("companyId", companyId);
  const response = await fetch(`/api/daily-management?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json() as DailyManagementPayload & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Unable to load Daily Management Report (${response.status}).`);
  return payload;
}
