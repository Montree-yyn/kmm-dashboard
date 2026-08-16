import { auth } from "../firebase";
import { canonicalModelName } from "../dashboard/model-normalization";
import { resolveActiveCompanyId } from "../company-context/client-store";
import { COMPANY_ID } from "../company-management/types";
import { clientDataLayer } from "../client-data-layer";
import type { SalesDashboardSummary } from "./dashboard-summary-service";

export type LiveSalesPayload = {
  source: "d1" | "local-fallback";
  meta: { sourceUpdatedAt: string; sources: string[] };
  plan: { year: number; months: string[]; units: number[] };
  sales: Array<{ date: string; year: number; month: number | null; branch: string; salesperson: string; salespersonCode?: string | null; salespersonName?: string | null; employeeCode?: string; productType: string; model: string; quantity?: number; finalReceived: number | null; netReceived: number | null; gp1: number | null; expense: number | null; commission: number | null }>;
  employees?: Array<{ employeeCode: string; salespersonCode: string; salespersonName: string }>;
  salespersonIdentityAliases?: Array<{ sourceSalespersonCode?: string | null; sourceEmployeeCode?: string | null; sourceSalespersonName: string; sourceBranch: string; canonicalEmployeeCode: string; canonicalSalespersonCode: string }>;
  employeeMasterAvailable?: boolean;
  business?: { all: { salesUnit: number; salesValue: number | null; grossProfit: number | null; grossProfitAvailable: boolean; expense: number | null }; grossProfitAvailable: boolean };
};

export type LiveSalesDashboardSummaryPayload = {
  source: "d1";
  meta: { sourceUpdatedAt: string; sources: string[] };
  summary: SalesDashboardSummary;
};

export async function loadLiveSalesData(options: { allowFallback?: boolean; companyId?: string; force?: boolean } = {}): Promise<LiveSalesPayload> {
  const companyId = resolveActiveCompanyId(options.companyId);
  return clientDataLayer.request(
    `sales:${companyId ?? "default"}`,
    () => fetchLiveSalesData(options, companyId),
    { force: options.force },
  );
}

export async function loadLiveSalesDashboardSummary(options: {
  companyId?: string;
  force?: boolean;
  filters?: { year?: string[]; month?: string[]; branch?: string[]; salesperson?: string[] };
} = {}): Promise<LiveSalesDashboardSummaryPayload> {
  const companyId = resolveActiveCompanyId(options.companyId);
  const suffix = JSON.stringify(options.filters ?? {});
  return clientDataLayer.request(
    `sales-dashboard-summary:${companyId ?? "default"}:${suffix}`,
    () => fetchLiveSalesDashboardSummary(options, companyId),
    { force: options.force },
  );
}

async function fetchLiveSalesDashboardSummary(
  options: { filters?: { year?: string[]; month?: string[]; branch?: string[]; salesperson?: string[] } },
  companyId: string | undefined,
): Promise<LiveSalesDashboardSummaryPayload> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Your secure session has expired. Sign in again.");
  const search = new URLSearchParams({ view: "dashboard-summary", ts: String(Date.now()) });
  if (companyId) search.set("companyId", companyId);
  for (const [name, values] of Object.entries(options.filters ?? {})) {
    values?.forEach((value) => search.append(name, value));
  }
  const response = await fetch(`/api/sales?${search}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load live D1 Sales summary (${response.status}).`);
  return response.json() as Promise<LiveSalesDashboardSummaryPayload>;
}

async function fetchLiveSalesData(options: { allowFallback?: boolean; companyId?: string }, companyId: string | undefined): Promise<LiveSalesPayload> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Your secure session has expired. Sign in again.");
  const search = new URLSearchParams({ ts: String(Date.now()) });
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
