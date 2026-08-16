import { auth } from "../firebase";
import type { BookingAdapterRow, OperationalBusiness, StockAdapterRow } from "./types";
import { getOperationalBusiness } from "./business-service";
import { asOfDate } from "./as-of";
import { adaptBookingRow, adaptStockRow } from "./adapters";
import { resolveActiveCompanyId } from "../company-context/client-store";
import { COMPANY_ID } from "../company-management/types";
import { clientDataLayer } from "../client-data-layer";
import type { BookingDashboardSummary } from "./booking-dashboard-summary-service";
import type { StockDashboardSummary } from "./stock-dashboard-summary-service";

export type LiveOperationalData = { booking: BookingAdapterRow[]; stock: StockAdapterRow[]; business: OperationalBusiness; asOf: string };
export type LiveOperationalDashboardSummary = { bookingSummary: BookingDashboardSummary; stockSummary: StockDashboardSummary; asOf: string };

export async function loadLiveOperationalData(options: { allowFallback?: boolean; companyId?: string; force?: boolean } = {}): Promise<LiveOperationalData> {
  const companyId = resolveActiveCompanyId(options.companyId);
  return clientDataLayer.request(
    `operations:${companyId ?? "default"}`,
    () => fetchLiveOperationalData(options, companyId),
    { force: options.force },
  );
}

export async function loadLiveOperationalDashboardSummary(options: {
  companyId?: string;
  force?: boolean;
  filters?: { year?: string[]; month?: string[]; branch?: string[]; salesperson?: string[] };
} = {}): Promise<LiveOperationalDashboardSummary> {
  const companyId = resolveActiveCompanyId(options.companyId);
  const suffix = JSON.stringify(options.filters ?? {});
  return clientDataLayer.request(
    `operations-dashboard-summary:${companyId ?? "default"}:${suffix}`,
    () => fetchLiveOperationalDashboardSummary(options, companyId),
    { force: options.force },
  );
}

async function fetchLiveOperationalDashboardSummary(
  options: { filters?: { year?: string[]; month?: string[]; branch?: string[]; salesperson?: string[] } },
  companyId: string | undefined,
): Promise<LiveOperationalDashboardSummary> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Your secure session has expired. Sign in again to load live operational data.");
  const search = new URLSearchParams({ view: "dashboard-summary", ts: String(Date.now()) });
  if (companyId) search.set("companyId", companyId);
  for (const [name, values] of Object.entries(options.filters ?? {})) values?.forEach((value) => search.append(name, value));
  const response = await fetch(`/api/operations?${search}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load live operational Dashboard summary (${response.status}).`);
  return response.json() as Promise<LiveOperationalDashboardSummary>;
}

async function fetchLiveOperationalData(options: { allowFallback?: boolean; companyId?: string }, companyId: string | undefined): Promise<LiveOperationalData> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Your secure session has expired. Sign in again to load live operational data.");
    const search = new URLSearchParams({ ts: String(Date.now()) });
    if (companyId) search.set("companyId", companyId);
    const response = await fetch(`/api/operations?${search}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load live operational data (${response.status}).`);
    return response.json() as Promise<LiveOperationalData>;
  } catch (error) {
    if (options.allowFallback === false) throw error;
    if (companyId && companyId !== COMPANY_ID) throw error;
    // The legacy static payload is a non-production, opt-in QA fallback only.
    // A production D1 failure must remain visible to the operator.
    if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_OPERATIONS_LOCAL_FALLBACK !== "true") throw error;
    const fallback = await fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!fallback.ok) throw error;
    const data = await fallback.json() as { booking: BookingAdapterRow[]; stock: StockAdapterRow[]; meta?: { sourceUpdatedAt?: string } };
    const booking = data.booking.map((row) => adaptBookingRow(row as unknown as Record<string, unknown>));
    const stock = data.stock.map((row) => adaptStockRow(row as unknown as Record<string, unknown>));
    // Local QA fallback only: measure age against the packaged snapshot date
    // when available, otherwise the evaluation-time date. Never a frozen value.
    const asOf = data.meta?.sourceUpdatedAt ? new Date(data.meta.sourceUpdatedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    return { booking, stock, asOf, business: getOperationalBusiness(booking, stock, {}, { asOf: asOfDate(asOf) }) };
  }
}
