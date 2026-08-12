import { AuthError } from "../../../lib/server/firebase-auth";
import { listBookingTransactions, listStockTransactions } from "../../../lib/operations/repository";
import { adaptBookingRow, adaptStockRow } from "../../../lib/operations/adapters";
import { getOperationalBusiness } from "../../../lib/operations/business-service";
import { CompanyAccessError, requireCompanyContext } from "../../../lib/server/company-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await requireCompanyContext(request, {
      permission: "view",
      allowLegacyKmmRead: true,
    });
    const [bookingRows, stockRows] = await Promise.all([
      listBookingTransactions(context.id),
      listStockTransactions(context.id),
    ]);
    const booking = bookingRows.map((row) => adaptBookingRow(row as unknown as Record<string, unknown>));
    const stock = stockRows.map((row) => adaptStockRow(row as unknown as Record<string, unknown>));
    return Response.json({
      company: { id: context.id, code: context.code, name: context.name },
      booking,
      stock,
      business: getOperationalBusiness(booking, stock),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthError || error instanceof CompanyAccessError ? error.status : 500;
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load operational data." }, { status });
  }
}
