import { filterByProductGroups } from "../dashboard/product-groups";
import type { SalesBusinessRow, SalesFilterInput, SalesKpis, SalesSummary } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const ENGINE_UNIT_PRODUCT_GROUPS = ["TT", "CH", "EX", "TP"] as const;

type SalesProductGroup = (typeof ENGINE_UNIT_PRODUCT_GROUPS)[number] | "MAX" | "IM" | "IMO" | "OT" | "Other";

// These are the exact TYPE values confirmed in the real KMM CPI data. Bare
// group codes remain supported for the existing simple workbook/JSON format.
// Model text must never participate in Sales classification: for example,
// MITSU model "ATTRAGE" contains "TT" but is not an engine-unit transaction.
const SALES_PRODUCT_TYPE_GROUPS: Readonly<Record<string, Exclude<SalesProductGroup, "Other">>> = {
  TT: "TT",
  "01-TT": "TT",
  CH: "CH",
  "02-CH": "CH",
  TP: "TP",
  "03-TP": "TP",
  EX: "EX",
  "04-EX": "EX",
  MAX: "MAX",
  IM: "IM",
  "06-IM": "IM",
  IMO: "IMO",
  "07-IMO": "IMO",
  OT: "OT",
  "08-OT": "OT",
};

// Expense is outside this Sprint's approved KPI change. Retain its existing
// product scope while Sales Value and GP move to the approved all-row scope.
const LEGACY_UNIT_PRODUCTS = ["TT", "CH", "EX", "TP", "MAX"];
const LEGACY_VALUE_PRODUCTS = [...LEGACY_UNIT_PRODUCTS, "IM", "IMO", "OT"];

export function salesProductGroup(rowOrType: Pick<SalesBusinessRow, "productType"> | string): SalesProductGroup {
  const value = typeof rowOrType === "string" ? rowOrType : rowOrType.productType;
  return SALES_PRODUCT_TYPE_GROUPS[value.trim().toUpperCase()] ?? "Other";
}

export function isEngineUnitProduct(rowOrType: Pick<SalesBusinessRow, "productType"> | string) {
  return (ENGINE_UNIT_PRODUCT_GROUPS as readonly string[]).includes(salesProductGroup(rowOrType));
}

export function salesTransactionQuantity(row: Pick<SalesBusinessRow, "quantity">) {
  if (typeof row.quantity === "number" && Number.isFinite(row.quantity)) return row.quantity;
  // The legacy JSON adapter predates an explicit quantity field and represents
  // one sold machine per transaction row. Current D1 rows never use this path.
  return 1;
}

export function getEngineUnitSalesRows<T extends Pick<SalesBusinessRow, "productType">>(rows: readonly T[]) {
  return rows.filter(isEngineUnitProduct);
}

export function getSalesUnit(rows: readonly Pick<SalesBusinessRow, "productType" | "quantity">[]) {
  return getEngineUnitSalesRows(rows).reduce((total, row) => total + salesTransactionQuantity(row), 0);
}

function completeMetricSum(rows: readonly SalesBusinessRow[], selector: (row: SalesBusinessRow) => number | null) {
  if (!rows.length) return null;
  const values = rows.map(selector);
  return values.every((value): value is number => value !== null)
    ? values.reduce((total, value) => total + value, 0)
    : null;
}

export function selectedSalesYears(filters: SalesFilterInput) { return (filters.year ?? []).map(Number).filter(Number.isFinite); }
export function selectedSalesMonths(filters: SalesFilterInput) { return (filters.month ?? []).map((month) => typeof month === "number" ? month : MONTHS.indexOf(month) + 1).filter((month) => month > 0); }
export function selectedSalesProductGroups(filters: SalesFilterInput) { const values = filters.productGroup ?? []; return !values.length || values.includes("All Products") ? [] : values; }

export function salesRowMatches(row: Pick<SalesBusinessRow, "year" | "month" | "branch" | "salesperson" | "productType">, filters: SalesFilterInput = {}) {
  const years = selectedSalesYears(filters);
  const months = selectedSalesMonths(filters);
  const groups = selectedSalesProductGroups(filters);
  if (years.length && (!row.year || !years.includes(row.year))) return false;
  if (months.length && (!row.month || !months.includes(row.month))) return false;
  if (filters.branch?.length && !filters.branch.includes(row.branch)) return false;
  if (filters.salesperson?.length && !filters.salesperson.includes(row.salesperson)) return false;
  if (groups.length && !groups.includes(salesProductGroup(row))) return false;
  return true;
}

export function filterSalesRows<T extends SalesBusinessRow>(rows: readonly T[], filters: SalesFilterInput = {}) { return rows.filter((row) => salesRowMatches(row, filters)); }

export function getSalesKpis(rows: readonly SalesBusinessRow[], filters: SalesFilterInput = {}): SalesKpis {
  const filtered = filterSalesRows(rows, filters);
  const expenseRows = filterByProductGroups(filtered, LEGACY_VALUE_PRODUCTS);
  return {
    salesUnit: getSalesUnit(filtered),
    // Approved KMM rule: Sales Value and GP include every valid Sales row.
    salesValue: completeMetricSum(filtered, (row) => row.finalReceived),
    grossProfit: completeMetricSum(filtered, (row) => row.gp1),
    grossProfitAvailable: filtered.length > 0 && filtered.every((row) => row.gp1 !== null),
    expense: completeMetricSum(expenseRows, (row) => row.expense),
  };
}

/**
 * Preserve the existing ASP contract while its business definition is under
 * review. Unlike Sales Unit, this denominator remains the legacy qualifying
 * transaction-row count, and its numerator remains the legacy value scope.
 */
export function getSalesAsp(rows: readonly SalesBusinessRow[], filters: SalesFilterInput = {}) {
  const filtered = filterSalesRows(rows, filters);
  const legacyUnitRows = filterByProductGroups(filtered, LEGACY_UNIT_PRODUCTS);
  const legacyValueRows = filterByProductGroups(filtered, LEGACY_VALUE_PRODUCTS);
  const legacySalesValue = completeMetricSum(legacyValueRows, (row) => row.finalReceived);
  return legacyUnitRows.length && legacySalesValue !== null
    ? legacySalesValue / legacyUnitRows.length
    : null;
}

function getUnitSummary(rows: readonly SalesBusinessRow[], labelFor: (row: SalesBusinessRow) => string): SalesSummary {
  const engineRows = getEngineUnitSalesRows(rows);
  return Array.from(new Set(engineRows.map(labelFor).filter(Boolean)))
    .map((label) => ({ label, value: getSalesUnit(engineRows.filter((row) => labelFor(row) === label)), available: true }))
    .sort((a, b) => b.value - a.value);
}

export function getBranchSummary(rows: readonly SalesBusinessRow[], filters: SalesFilterInput = {}): SalesSummary {
  return getUnitSummary(filterSalesRows(rows, filters), (row) => row.branch);
}

export function getSalespersonSummary(rows: readonly SalesBusinessRow[], filters: SalesFilterInput = {}): SalesSummary {
  return getUnitSummary(filterSalesRows(rows, filters), (row) => row.salesperson);
}

export function getProductSummary(rows: readonly SalesBusinessRow[], filters: SalesFilterInput = {}): SalesSummary {
  const filtered = filterSalesRows(rows, filters);
  return ENGINE_UNIT_PRODUCT_GROUPS.map((label) => ({
    label,
    value: getSalesUnit(filtered.filter((row) => salesProductGroup(row) === label)),
    available: true,
  })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
}

export function getModelSummary(rows: readonly SalesBusinessRow[], filters: SalesFilterInput = {}): SalesSummary {
  return getUnitSummary(filterSalesRows(rows, filters), (row) => row.model || "N/A");
}

export function getMonthlyTrend(rows: readonly SalesBusinessRow[], filters: SalesFilterInput = {}) {
  return Array.from({ length: 12 }, (_, index) => {
    const monthRows = filterSalesRows(rows, { ...filters, month: [index + 1] });
    const kpis = getSalesKpis(monthRows);
    return { month: index + 1, label: MONTHS[index], salesUnit: kpis.salesUnit, salesValue: kpis.salesValue, grossProfit: kpis.grossProfit };
  });
}

export function getWeeklyTrend(rows: readonly SalesBusinessRow[], filters: SalesFilterInput = {}) {
  const grouped = new Map<string, SalesBusinessRow[]>();
  filterSalesRows(rows, filters).forEach((row) => { const date = new Date(`${row.date}T00:00:00`); if (Number.isNaN(date.getTime())) return; const key = `${date.getFullYear()}-W${String(Math.ceil((date.getDate() + date.getDay()) / 7)).padStart(2, "0")}`; grouped.set(key, [...(grouped.get(key) ?? []), row]); });
  return Array.from(grouped, ([week, weekRows]) => ({ week, ...getSalesKpis(weekRows) })).sort((a, b) => a.week.localeCompare(b.week));
}

export function getTargetAvailability(filters: SalesFilterInput, targetGranularity: "company" | "branch" | "salesperson" | "product" | null = null) {
  const hasDimensionFilter = Boolean(filters.branch?.length || filters.salesperson?.length || selectedSalesProductGroups(filters).length);
  if (!targetGranularity) return { available: false, reason: "Target data is not available in Sprint 2.2." };
  if (hasDimensionFilter && targetGranularity === "company") return { available: false, reason: "Target achievement is unavailable for the selected dimension filters." };
  return { available: true, reason: null };
}
