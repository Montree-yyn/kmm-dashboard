import { getFilteredCurrentStockRows, getOperationalBusiness } from "./business-service";
import { normalizeProductType, STOCK_UNIT_PRODUCTS } from "../dashboard/stock-selectors";
import type { OperationalFilters, StockAdapterRow } from "./types";

const AGE_BANDS = ["0–30", "31–60", "61–90", ">90"] as const;

function ageBand(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  if (value <= 30) return "0–30";
  if (value <= 60) return "31–60";
  if (value <= 90) return "61–90";
  return ">90";
}

export type StockDashboardSummary = {
  filters: { year: string[]; month: string[]; branch: string[]; salesperson: string[] };
  kpis: ReturnType<typeof getOperationalBusiness>["stock"];
  health: { healthy: number; watch: number; critical: number };
  agingRisk: Array<{ label: string; values: number[] }>;
};

export function getStockDashboardSummary(rows: StockAdapterRow[], filters: OperationalFilters, availableFilters: StockDashboardSummary["filters"]): StockDashboardSummary {
  const currentRows = getFilteredCurrentStockRows(rows, filters);
  const unitRows = currentRows.filter((row) => STOCK_UNIT_PRODUCTS.includes(normalizeProductType(row) as typeof STOCK_UNIT_PRODUCTS[number]));
  const health = { healthy: 0, watch: 0, critical: 0 };
  unitRows.forEach((row) => {
    const age = row.ageDays ?? -1;
    if (age > 90) health.critical += 1;
    else if (age <= 30 && age >= 0) health.healthy += 1;
    else health.watch += 1;
  });
  return {
    filters: availableFilters,
    kpis: getOperationalBusiness([], rows, filters).stock,
    health,
    agingRisk: STOCK_UNIT_PRODUCTS.map((product) => ({
      label: product,
      values: AGE_BANDS.map((band) => unitRows.filter((row) => normalizeProductType(row) === product && ageBand(row.ageDays ?? null) === band).length),
    })).filter((item) => item.values.some(Boolean)),
  };
}

