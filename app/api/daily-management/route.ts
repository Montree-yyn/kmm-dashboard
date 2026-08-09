import { listBookingTransactions, listStockTransactions } from "../../../lib/operations/repository";
import { adaptBookingRow, adaptStockRow } from "../../../lib/operations/adapters";
import { listSalesTransactions } from "../../../lib/sales/repository";
import { toCanonicalSalesRow } from "../../../lib/sales/compatibility-adapter";
import { buildDailyManagementSnapshot } from "../../../lib/daily-management/business-service";
import { AuthError, verifyFirebaseRequest } from "../../../lib/server/firebase-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await verifyFirebaseRequest(request);
    const url = new URL(request.url);
    const [salesRows, bookingRows, stockRows] = await Promise.all([
      listSalesTransactions(),
      listBookingTransactions(),
      listStockTransactions(),
    ]);
    const snapshot = buildDailyManagementSnapshot({
      sales: salesRows.map(toCanonicalSalesRow),
      booking: bookingRows.map((row) => adaptBookingRow(row as unknown as Record<string, unknown>)),
      stock: stockRows.map((row) => adaptStockRow(row as unknown as Record<string, unknown>)),
    }, {
      asOfDate: url.searchParams.get("date"),
      branch: url.searchParams.get("branch"),
    });
    return Response.json({
      source: "d1",
      generatedAt: new Date().toISOString(),
      snapshot,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return Response.json({
      error: error instanceof Error ? error.message : "Unable to load Daily Management Report.",
    }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
