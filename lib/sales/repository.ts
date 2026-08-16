import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getOperationsDb } from "../../db";
import { salesTransactions, salespersonIdentityAliases, salespersonMaster } from "../../db/schema";
import { selectedSalesMonths, selectedSalesYears } from "./business-service";
import type { SalesFilterInput } from "./types";

export async function listSalesTransactions(companyId: string) {
  const db = await getOperationsDb();
  return db.select().from(salesTransactions).where(eq(salesTransactions.companyId, companyId)).orderBy(asc(salesTransactions.saleDate));
}

export async function listSalespeople(companyId: string) {
  const db = await getOperationsDb();
  return db
    .select({
      employeeCode: salespersonMaster.employeeCode,
      salespersonCode: salespersonMaster.salespersonCode,
      salespersonName: salespersonMaster.salespersonName,
      status: salespersonMaster.status,
    })
    .from(salespersonMaster)
    .where(eq(salespersonMaster.companyId, companyId));
}

export async function listSalespersonIdentityAliases(companyId: string) {
  const db = await getOperationsDb();
  return db
    .select({
      sourceSalespersonCode: salespersonIdentityAliases.sourceSalespersonCode,
      sourceEmployeeCode: salespersonIdentityAliases.sourceEmployeeCode,
      sourceSalespersonName: salespersonIdentityAliases.sourceSalespersonName,
      sourceBranch: salespersonIdentityAliases.sourceBranch,
      canonicalEmployeeCode: salespersonIdentityAliases.canonicalEmployeeCode,
      canonicalSalespersonCode: salespersonIdentityAliases.canonicalSalespersonCode,
    })
    .from(salespersonIdentityAliases)
    .where(eq(salespersonIdentityAliases.companyId, companyId));
}

function salesScope(companyId: string, filters: SalesFilterInput = {}) {
  const years = selectedSalesYears(filters);
  const months = selectedSalesMonths(filters);
  const year = sql<number>`coalesce(cast(strftime('%Y', ${salesTransactions.saleDate}) as integer), ${salesTransactions.importYear})`;
  const month = sql<number>`coalesce(cast(strftime('%m', ${salesTransactions.saleDate}) as integer), ${salesTransactions.importMonth})`;
  const salesperson = sql<string>`coalesce(${salesTransactions.salespersonName}, ${salesTransactions.salespersonCode}, '')`;
  return {
    year,
    month,
    salesperson,
    where: and(
      eq(salesTransactions.companyId, companyId),
      years.length ? inArray(year, years) : undefined,
      months.length ? inArray(month, months) : undefined,
      filters.branch?.length ? inArray(salesTransactions.branch, filters.branch) : undefined,
      filters.salesperson?.length ? inArray(salesperson, filters.salesperson) : undefined,
    ),
  };
}

/**
 * Aggregated Sales grain for the executive dashboard. It deliberately keeps
 * every filterable dimension while D1, rather than the Worker, performs the
 * row scan and numeric aggregation.
 */
export async function listSalesDashboardBuckets(companyId: string, filters: SalesFilterInput = {}) {
  const db = await getOperationsDb();
  const { year, month, salesperson, where } = salesScope(companyId, filters);
  const finalReceived = sql<number | null>`case when sum(case when ${salesTransactions.finalReceived} is null or trim(${salesTransactions.finalReceived}) = '' then 1 else 0 end) > 0 then null else sum(cast(${salesTransactions.finalReceived} as real)) end`;
  const gp1 = sql<number | null>`case when sum(case when ${salesTransactions.gp1} is null or trim(${salesTransactions.gp1}) = '' then 1 else 0 end) > 0 then null else sum(cast(${salesTransactions.gp1} as real)) end`;
  const expense = sql<number | null>`case when sum(case when ${salesTransactions.expense} is null or trim(${salesTransactions.expense}) = '' then 1 else 0 end) > 0 then null else sum(cast(${salesTransactions.expense} as real)) end`;
  return db.select({
    year,
    month,
    branch: salesTransactions.branch,
    salesperson,
    productType: salesTransactions.productType,
    sourceRows: sql<number>`count(*)`,
    quantity: sql<number>`sum(${salesTransactions.quantity})`,
    finalReceived,
    gp1,
    expense,
  })
    .from(salesTransactions)
    .where(where)
    .groupBy(year, month, salesTransactions.branch, salesperson, salesTransactions.productType)
    .orderBy(asc(year), asc(month));
}

export async function listSalesDashboardFilterOptions(companyId: string) {
  const db = await getOperationsDb();
  const year = sql<number>`coalesce(cast(strftime('%Y', ${salesTransactions.saleDate}) as integer), ${salesTransactions.importYear})`;
  const salesperson = sql<string>`coalesce(${salesTransactions.salespersonName}, ${salesTransactions.salespersonCode}, '')`;
  return db.select({
    year,
    branch: salesTransactions.branch,
    salesperson,
  })
    .from(salesTransactions)
    .where(eq(salesTransactions.companyId, companyId))
    .groupBy(year, salesTransactions.branch, salesperson)
    .orderBy(desc(year), asc(salesTransactions.branch), asc(salesperson));
}

export async function listRecentSalesDashboardRows(companyId: string, filters: SalesFilterInput = {}) {
  const db = await getOperationsDb();
  const { salesperson, where } = salesScope(companyId, filters);
  return db.select({
    date: salesTransactions.saleDate,
    branch: salesTransactions.branch,
    salesperson,
    productType: salesTransactions.productType,
    model: salesTransactions.model,
  })
    .from(salesTransactions)
    .where(where)
    .orderBy(desc(salesTransactions.saleDate))
    .limit(6);
}
