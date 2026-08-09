import { AuthError, verifyFirebaseRequest } from "../../../lib/server/firebase-auth";
import { listBookingTransactions, listStockTransactions } from "../../../lib/operations/repository";
import { adaptBookingRow, adaptStockRow } from "../../../lib/operations/adapters";
import { getOperationalBusiness } from "../../../lib/operations/business-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await verifyFirebaseRequest(request);
    const [bookingRows, stockRows] = await Promise.all([listBookingTransactions(), listStockTransactions()]);
    const booking = bookingRows.map((row) => adaptBookingRow(row as unknown as Record<string, unknown>));
    const stock = stockRows.map((row) => adaptStockRow(row as unknown as Record<string, unknown>));
    return Response.json({ booking, stock, business: getOperationalBusiness(booking, stock) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load operational data." }, { status });
  }
}
