import {
  filterSalesRows,
  getBranchSummary,
  getMonthlyTrend,
  getProductSummary,
  getSalesKpis,
  getSalespersonSummary,
  getTargetAvailability,
  getWeeklyTrend,
  selectedSalesYears,
} from "./business-service";
import type { SalesBusinessRow, SalesFilterInput } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type SalesDashboardSummary = {
  filters: {
    year: string[];
    month: string[];
    branch: string[];
    salesperson: string[];
  };
  kpis: ReturnType<typeof getSalesKpis>;
  previousYearKpis: ReturnType<typeof getSalesKpis> | null;
  monthlyTrend: ReturnType<typeof getMonthlyTrend>;
  trendRows: Array<{ year: number | null; month: number | null; salesUnit: number; salesValue: number | null; grossProfit: number | null }>;
  sparklines: { salesUnit: number[]; salesValue: number[]; grossProfit: number[] };
  branchSummary: ReturnType<typeof getBranchSummary>;
  salespersonSummary: ReturnType<typeof getSalespersonSummary>;
  productSummary: ReturnType<typeof getProductSummary>;
  weeklyTrend: ReturnType<typeof getWeeklyTrend>;
  target: ReturnType<typeof getTargetAvailability>;
  rowCount: number;
  recentSales: Array<{ date: string; branch: string; salesperson: string; productType: string; model: string }>;
};

export type SalesDashboardSummaryOptions = {
  availableFilters?: SalesDashboardSummary["filters"];
  recentSales?: SalesDashboardSummary["recentSales"];
  rowCount?: number;
};

export function getSalesDashboardFilterOptions(rows: readonly SalesBusinessRow[]) {
  const years = new Set<string>();
  const branches = new Set<string>();
  const salespeople = new Set<string>();
  rows.forEach((row) => {
    if (row.year) years.add(String(row.year));
    if (row.branch) branches.add(row.branch);
    if (row.salesperson) salespeople.add(row.salesperson);
  });
  return {
    year: Array.from(years).sort((left, right) => Number(right) - Number(left)),
    month: [...MONTHS],
    branch: Array.from(branches).sort(),
    salesperson: Array.from(salespeople).sort(),
  };
}

/**
 * The compact contract used by dashboards that render aggregates rather than
 * transaction detail. Keep all metric calculations in business-service so
 * raw and summary views remain numerically identical.
 */
export function getSalesDashboardSummary(
  rows: readonly SalesBusinessRow[],
  filters: SalesFilterInput = {},
  options: SalesDashboardSummaryOptions = {},
): SalesDashboardSummary {
  const years = selectedSalesYears(filters);
  const comparisonFilters: SalesFilterInput = years.length === 1
    ? { ...filters, year: [years[0] - 1] }
    : {};
  const scopedTrendFilters: SalesFilterInput = {
    ...filters,
    year: [],
    month: [],
  };
  const byMonth = new Map<string, SalesBusinessRow[]>();
  filterSalesRows(rows, scopedTrendFilters).forEach((row) => {
    if (!row.year || !row.month) return;
    const key = `${row.year}-${row.month}`;
    byMonth.set(key, [...(byMonth.get(key) ?? []), row]);
  });
  const trendRows = Array.from(byMonth, ([key, monthRows]) => {
    const [year, month] = key.split("-").map(Number);
    const kpis = getSalesKpis(monthRows);
    return { year, month, salesUnit: kpis.salesUnit, salesValue: kpis.salesValue, grossProfit: kpis.grossProfit };
  }).sort((left, right) => left.year - right.year || left.month - right.month);
  const sparkline = years.length === 1
    ? getMonthlyTrend(rows, { ...filters, year: [years[0]], month: [] })
    : [];

  return {
    filters: options.availableFilters ?? getSalesDashboardFilterOptions(rows),
    kpis: getSalesKpis(rows, filters),
    previousYearKpis: years.length === 1
      ? getSalesKpis(rows, comparisonFilters)
      : null,
    monthlyTrend: getMonthlyTrend(rows, scopedTrendFilters),
    trendRows,
    sparklines: {
      salesUnit: sparkline.map((row) => row.salesUnit),
      salesValue: sparkline.map((row) => row.salesValue ?? 0),
      grossProfit: sparkline.every((row) => row.grossProfit !== null)
        ? sparkline.map((row) => row.grossProfit ?? 0)
        : [],
    },
    branchSummary: getBranchSummary(rows, filters),
    salespersonSummary: getSalespersonSummary(rows, filters),
    productSummary: getProductSummary(rows, filters),
    weeklyTrend: getWeeklyTrend(rows, filters),
    target: getTargetAvailability(filters, null),
    rowCount: options.rowCount ?? rows.length,
    recentSales: options.recentSales ?? filterSalesRows(rows, filters)
      .map((row) => ({ date: row.date, branch: row.branch, salesperson: row.salesperson, productType: row.productType, model: row.model ?? "" }))
      .filter((row) => row.date)
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 6),
  };
}

