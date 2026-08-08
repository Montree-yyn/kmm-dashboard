import { AuthError, verifyFirebaseRequest } from "../../../lib/server/firebase-auth";
import { COMPANY_ID } from "../../../lib/company-management/types";
import { toCanonicalSalesRow, toLegacySalesRow } from "../../../lib/sales/compatibility-adapter";
import { getBranchSummary, getMonthlyTrend, getProductSummary, getSalesKpis, getSalespersonSummary, getTargetAvailability, getWeeklyTrend } from "../../../lib/sales/business-service";
import { listSalespeople, listSalesTransactions } from "../../../lib/sales/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await verifyFirebaseRequest(request);
    const companyId = new URL(request.url).searchParams.get("companyId") || COMPANY_ID;
    const [transactionRows, employeeRows] = await Promise.all([
      listSalesTransactions(companyId),
      listSalespeople(companyId),
    ]);
    const canonicalRows = transactionRows.map(toCanonicalSalesRow);
    const activeEmployees = employeeRows
      .filter((row) => row.status === "active")
      .map(({ employeeCode, salespersonCode, salespersonName }) => ({
        employeeCode,
        salespersonCode,
        salespersonName,
      }));
    const kpis = getSalesKpis(canonicalRows);
    return Response.json({
      source: "d1",
      meta: { sourceUpdatedAt: new Date().toISOString(), sources: ["Cloudflare D1 · sales_transactions"] },
      plan: { year: null, months: [], units: [] },
      sales: canonicalRows.map(toLegacySalesRow),
      employees: activeEmployees,
      employeeMasterAvailable: employeeRows.length > 0,
      business: { all: kpis, grossProfitAvailable: kpis.grossProfitAvailable, branchSummary: getBranchSummary(canonicalRows), salespersonSummary: getSalespersonSummary(canonicalRows), productSummary: getProductSummary(canonicalRows), weeklyTrend: getWeeklyTrend(canonicalRows), monthlyTrend: getMonthlyTrend(canonicalRows), target: getTargetAvailability({}, null) },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load Sales data." }, { status });
  }
}
