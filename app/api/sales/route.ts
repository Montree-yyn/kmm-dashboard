import { AuthError } from "../../../lib/server/firebase-auth";
import { toCanonicalSalesRow, toLegacySalesRow } from "../../../lib/sales/compatibility-adapter";
import { getBranchSummary, getMonthlyTrend, getProductSummary, getSalesKpis, getSalespersonSummary, getTargetAvailability, getWeeklyTrend } from "../../../lib/sales/business-service";
import { listSalespeople, listSalespersonIdentityAliases, listSalesTransactions } from "../../../lib/sales/repository";
import { CompanyAccessError, requireCompanyContext } from "../../../lib/server/company-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await requireCompanyContext(request, {
      permission: "view",
      allowLegacyKmmRead: true,
    });
    const companyId = context.id;
    const [transactionRows, employeeRows, identityAliasRows] = await Promise.all([
      listSalesTransactions(companyId),
      listSalespeople(companyId),
      listSalespersonIdentityAliases(companyId),
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
      company: { id: context.id, code: context.code, name: context.name },
      meta: { sourceUpdatedAt: new Date().toISOString(), sources: ["Cloudflare D1 · sales_transactions"] },
      plan: { year: null, months: [], units: [] },
      sales: canonicalRows.map(toLegacySalesRow),
      employees: activeEmployees,
      salespersonIdentityAliases: identityAliasRows,
      employeeMasterAvailable: employeeRows.length > 0,
      business: { all: kpis, grossProfitAvailable: kpis.grossProfitAvailable, branchSummary: getBranchSummary(canonicalRows), salespersonSummary: getSalespersonSummary(canonicalRows), productSummary: getProductSummary(canonicalRows), weeklyTrend: getWeeklyTrend(canonicalRows), monthlyTrend: getMonthlyTrend(canonicalRows), target: getTargetAvailability({}, null) },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthError || error instanceof CompanyAccessError ? error.status : 500;
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load Sales data." }, { status });
  }
}
