import { AuthError } from "../../../lib/server/firebase-auth";
import { toCanonicalSalesRow, toLegacySalesRow } from "../../../lib/sales/compatibility-adapter";
import { getBranchSummary, getMonthlyTrend, getProductSummary, getSalesKpis, getSalespersonSummary, getTargetAvailability, getWeeklyTrend } from "../../../lib/sales/business-service";
import { getSalesDashboardFilterOptions, getSalesDashboardSummary } from "../../../lib/sales/dashboard-summary-service";
import { listRecentSalesDashboardRows, listSalesDashboardBuckets, listSalesDashboardFilterOptions, listSalespeople, listSalespersonIdentityAliases, listSalesTransactions } from "../../../lib/sales/repository";
import { CompanyAccessError, requireCompanyContext } from "../../../lib/server/company-context";

export const dynamic = "force-dynamic";

function requestFilters(request: Request) {
  const search = new URL(request.url).searchParams;
  const values = (name: string) => search.getAll(name)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    year: values("year"),
    month: values("month"),
    branch: values("branch"),
    salesperson: values("salesperson"),
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireCompanyContext(request, {
      permission: "view",
      allowLegacyKmmRead: true,
    });
    const companyId = context.id;
    const view = new URL(request.url).searchParams.get("view");
    if (view === "dashboard-summary") {
      const filters = requestFilters(request);
      const [buckets, optionRows, recentRows] = await Promise.all([
        listSalesDashboardBuckets(companyId, filters),
        listSalesDashboardFilterOptions(companyId),
        listRecentSalesDashboardRows(companyId, filters),
      ]);
      const summaryRows = buckets.map((row) => ({
        date: "",
        year: row.year,
        month: row.month,
        branch: row.branch,
        salesperson: row.salesperson,
        productType: row.productType ?? "",
        quantity: Number(row.quantity ?? 0),
        finalReceived: row.finalReceived === null ? null : Number(row.finalReceived),
        gp1: row.gp1 === null ? null : Number(row.gp1),
        expense: row.expense === null ? null : Number(row.expense),
      }));
      const optionSourceRows = optionRows.map((row) => ({
        date: "",
        year: row.year,
        month: null,
        branch: row.branch,
        salesperson: row.salesperson,
        productType: "",
        finalReceived: null,
        gp1: null,
        expense: null,
      }));
      return Response.json({
        source: "d1",
        company: { id: context.id, code: context.code, name: context.name },
        meta: { sourceUpdatedAt: new Date().toISOString(), sources: ["Cloudflare D1 · sales_transactions"] },
        summary: getSalesDashboardSummary(summaryRows, filters, {
          availableFilters: getSalesDashboardFilterOptions(optionSourceRows),
          rowCount: buckets.reduce((total, row) => total + Number(row.sourceRows ?? 0), 0),
          recentSales: recentRows.map((row) => ({
            date: row.date.slice(0, 10),
            branch: row.branch,
            salesperson: row.salesperson,
            productType: row.productType ?? "",
            model: row.model ?? "",
          })),
        }),
      }, { headers: { "Cache-Control": "no-store" } });
    }
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
