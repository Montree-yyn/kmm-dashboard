import { AuthError } from "../../../lib/server/firebase-auth";
import { listBookingDashboardBuckets, listBookingDashboardFilterOptions, listBookingTransactions, listRecentBookingDashboardRows, listStockTransactions } from "../../../lib/operations/repository";
import { adaptBookingRow, adaptStockRow } from "../../../lib/operations/adapters";
import { getOperationalBusiness } from "../../../lib/operations/business-service";
import { asOfDate } from "../../../lib/operations/as-of";
import { CompanyAccessError, requireCompanyContext } from "../../../lib/server/company-context";
import { getBookingDashboardSummary } from "../../../lib/operations/booking-dashboard-summary-service";
import { getStockDashboardSummary } from "../../../lib/operations/stock-dashboard-summary-service";

export const dynamic = "force-dynamic";

function requestFilters(request: Request) {
  const search = new URL(request.url).searchParams;
  const values = (name: string) => search.getAll(name).flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
  return { year: values("year"), month: values("month"), branch: values("branch"), salesperson: values("salesperson") };
}

export async function GET(request: Request) {
  try {
    const context = await requireCompanyContext(request, {
      permission: "view",
      allowLegacyKmmRead: true,
    });
    const view = new URL(request.url).searchParams.get("view");
    if (view === "dashboard-summary") {
      const filters = requestFilters(request);
      const [buckets, optionRows, recentBookings, stockRows] = await Promise.all([
        listBookingDashboardBuckets(context.id, filters),
        listBookingDashboardFilterOptions(context.id),
        listRecentBookingDashboardRows(context.id, filters),
        listStockTransactions(context.id),
      ]);
      const stock = stockRows.map((row) => adaptStockRow(row as unknown as Record<string, unknown>));
      const options = {
        year: Array.from(new Set(optionRows.map((row) => row.year).filter((year): year is number => year !== null).map(String))).sort((left, right) => Number(right) - Number(left)),
        month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        branch: Array.from(new Set(optionRows.map((row) => row.branch).filter(Boolean))).sort(),
        salesperson: Array.from(new Set(optionRows.map((row) => row.salesperson).filter(Boolean))).sort(),
      };
      const asOf = new Intl.DateTimeFormat("en-CA", { timeZone: context.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const stockOptions = {
        year: Array.from(new Set(stock.map((row) => row.year).filter((year): year is number => year !== null).map(String))).sort((left, right) => Number(right) - Number(left)),
        month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        branch: Array.from(new Set(stock.map((row) => row.branch).filter(Boolean))).sort(),
        salesperson: Array.from(new Set(stock.map((row) => row.salesperson).filter(Boolean))).sort(),
      };
      return Response.json({
        company: { id: context.id, code: context.code, name: context.name },
        asOf,
        bookingSummary: getBookingDashboardSummary(
          buckets.map((row) => ({ ...row, year: row.year ?? null, month: row.month ?? null, purchaseStatus: row.purchaseStatus ?? "", status: row.status ?? "", count: Number(row.count), value: Number(row.value), deposit: Number(row.deposit) })),
          filters,
          options,
          recentBookings.map((row) => ({ date: row.date.slice(0, 10), branch: row.branch, salesperson: row.salesperson, productType: row.productType, model: row.model ?? "", status: row.status })),
        ),
        stockSummary: getStockDashboardSummary(stock, filters, stockOptions),
      }, { headers: { "Cache-Control": "no-store" } });
    }
    const [bookingRows, stockRows] = await Promise.all([
      listBookingTransactions(context.id),
      listStockTransactions(context.id),
    ]);
    const booking = bookingRows.map((row) => adaptBookingRow(row as unknown as Record<string, unknown>));
    const stock = stockRows.map((row) => adaptStockRow(row as unknown as Record<string, unknown>));
    // "Business today" in the company's own timezone (e.g. Asia/Bangkok), so
    // booking age is measured against the date the operator sees, not UTC.
    const asOf = new Intl.DateTimeFormat("en-CA", {
      timeZone: context.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return Response.json({
      company: { id: context.id, code: context.code, name: context.name },
      asOf,
      booking,
      stock,
      business: getOperationalBusiness(booking, stock, {}, { asOf: asOfDate(asOf) }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthError || error instanceof CompanyAccessError ? error.status : 500;
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load operational data." }, { status });
  }
}
