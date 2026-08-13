import { auth } from "../firebase";
import { canonicalModelName } from "../dashboard/model-normalization";
import { resolveActiveCompanyId } from "../company-context/client-store";
import { COMPANY_ID } from "../company-management/types";

export type LiveSalesPayload = {
  source: "d1" | "local-fallback";
  meta: { sourceUpdatedAt: string; sources: string[] };
  plan: { year: number; months: string[]; units: number[] };
  sales: Array<{ date: string; year: number; month: number | null; branch: string; salesperson: string; salespersonCode?: string | null; salespersonName?: string | null; employeeCode?: string; productType: string; model: string; quantity?: number; finalReceived: number | null; netReceived: number | null; gp1: number | null; expense: number | null; commission: number | null }>;
  employees?: Array<{ employeeCode: string; salespersonCode: string; salespersonName: string }>;
  employeeMasterAvailable?: boolean;
  business?: { all: { salesUnit: number; salesValue: number | null; grossProfit: number | null; grossProfitAvailable: boolean; expense: number | null }; grossProfitAvailable: boolean };
};

export async function loadLiveSalesData(options: { allowFallback?: boolean; companyId?: string } = {}): Promise<LiveSalesPayload> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Your secure session has expired. Sign in again.");
  const search = new URLSearchParams({ ts: String(Date.now()) });
  const companyId = resolveActiveCompanyId(options.companyId);
  if (companyId) search.set("companyId", companyId);
  const response = await fetch(`/api/sales?${search}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (response.ok) return await response.json() as LiveSalesPayload;
  if (options.allowFallback === false) throw new Error(`Unable to load live D1 Sales data (${response.status}).`);
  if (companyId && companyId !== COMPANY_ID) {
    throw new Error(`Unable to load live D1 Sales data (${response.status}).`);
  }
  // Production must never combine a failed operational response with the
  // packaged legacy dataset. That dataset is retained only for local QA and
  // rollback of the prior static deployment.
  if (process.env.NODE_ENV === "production") throw new Error(`Unable to load live D1 Sales data (${response.status}).`);
  const fallback = await fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" });
  if (!fallback.ok) throw new Error(`Unable to load Sales fallback (${fallback.status}).`);
  const data = await fallback.json() as LiveSalesPayload;
  return { ...data, source: "local-fallback", sales: data.sales.map((row) => ({ ...row, model: canonicalModelName(row.model) })), meta: { ...data.meta, sources: [...data.meta.sources, "Local QA fallback"] } };
}
