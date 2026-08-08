import { auth } from "../firebase";
import type { BookingAdapterRow, OperationalBusiness, StockAdapterRow } from "./types";
import { getOperationalBusiness } from "./business-service";

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
    if (process.env.NEXT_PUBLIC_OPERATIONS_LOCAL_FALLBACK !== "true") throw error;
    const fallback = await fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!fallback.ok) throw error;
    const data = await fallback.json() as { booking: BookingAdapterRow[]; stock: StockAdapterRow[] };
    return { booking: data.booking, stock: data.stock, business: getOperationalBusiness(data.booking as unknown as Record<string, unknown>[], data.stock as unknown as Record<string, unknown>[]) };
  }
}
