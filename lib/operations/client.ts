import { auth } from "../firebase";
import type { BookingAdapterRow, OperationalBusiness, StockAdapterRow } from "./types";
import { getOperationalBusiness } from "./business-service";
import { adaptBookingRow, adaptStockRow } from "./adapters";

export type LiveOperationalData = { booking: BookingAdapterRow[]; stock: StockAdapterRow[]; business: OperationalBusiness };

export async function loadLiveOperationalData(options: { allowFallback?: boolean } = {}): Promise<LiveOperationalData> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Your secure session has expired. Sign in again to load live operational data.");
    const response = await fetch(`/api/operations?ts=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load live operational data (${response.status}).`);
    return response.json() as Promise<LiveOperationalData>;
  } catch (error) {
    if (options.allowFallback === false) throw error;
    // The legacy static payload is a non-production, opt-in QA fallback only.
    // A production D1 failure must remain visible to the operator.
    if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_OPERATIONS_LOCAL_FALLBACK !== "true") throw error;
    const fallback = await fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!fallback.ok) throw error;
    const data = await fallback.json() as { booking: BookingAdapterRow[]; stock: StockAdapterRow[] };
    const booking = data.booking.map((row) => adaptBookingRow(row as unknown as Record<string, unknown>));
    const stock = data.stock.map((row) => adaptStockRow(row as unknown as Record<string, unknown>));
    return { booking, stock, business: getOperationalBusiness(booking, stock) };
  }
}
