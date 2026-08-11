import townshipMaster from "../../data/master-townships.json";
import { isEngineUnitProduct, salesProductGroup, salesTransactionQuantity } from "../sales/business-service";
import { resolveSalesGeography } from "./township-geography";

type HeatmapSalesRow = {
  date: string;
  stateRegion: string;
  township: string;
  productType: string;
  quantity?: number;
  finalReceived: number | null;
};

type HeatmapPayload = { sales?: HeatmapSalesRow[] };

export type SalesAreaMetric = {
  canonicalLocationId: string;
  township: string;
  stateRegion: string;
  units: number;
  salesValue: number;
};

export type SalesAreaAnnualMetric = Omit<SalesAreaMetric, "units" | "salesValue"> & {
  yearly: Array<{ year: number; units: number; salesValue: number }>;
};

const master = townshipMaster as Array<{
  township_id: string;
  township: string;
  state_region: string;
}>;
const boundaryIds = new Set(master.map((row) => row.township_id));
const townshipById = new Map(master.map((row) => [row.township_id, row]));

export function aggregateHeatmapSalesAreas(
  rows: readonly HeatmapSalesRow[],
  scope: { start: string; end: string; product?: string | null },
) {
  const metrics = new Map<string, SalesAreaMetric>();
  const annualMetrics = new Map<string, SalesAreaAnnualMetric>();
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;
  let unresolvedUnits = 0;
  let trendUnresolvedUnits = 0;

  const startYear = Number(scope.start.slice(0, 4));
  const endYear = Number(scope.end.slice(0, 4));
  const years = Array.from({ length: Math.max(endYear - startYear + 1, 0) }, (_, index) => startYear + index);

  for (const row of rows) {
    const date = String(row.date ?? "").slice(0, 10);
    if (!date || date < scope.start || date > scope.end) continue;
    if (!isEngineUnitProduct(row)) continue;
    if (scope.product && salesProductGroup(row) !== scope.product) continue;
    if (coverageStart === null) coverageStart = date;
    else if (date.localeCompare(coverageStart) < 0) coverageStart = date;
    if (coverageEnd === null) coverageEnd = date;
    else if (date.localeCompare(coverageEnd) > 0) coverageEnd = date;
  }

  const samePeriodThrough = coverageEnd && Number(coverageEnd.slice(0, 4)) === endYear
    ? coverageEnd.slice(5, 10)
    : "12-31";

  for (const row of rows) {
    const date = String(row.date ?? "").slice(0, 10);
    if (!date || date < scope.start || date > scope.end) continue;
    if (!isEngineUnitProduct(row)) continue;
    if (scope.product && salesProductGroup(row) !== scope.product) continue;

    const units = salesTransactionQuantity(row);
    const resolved = resolveSalesGeography(row.stateRegion, row.township, boundaryIds);
    if (!resolved.canonicalLocationId) {
      unresolvedUnits += units;
      if (date.slice(5, 10) <= samePeriodThrough) trendUnresolvedUnits += units;
      continue;
    }

    const canonical = townshipById.get(resolved.canonicalLocationId);
    if (!canonical) {
      unresolvedUnits += units;
      continue;
    }
    const current = metrics.get(resolved.canonicalLocationId) ?? {
      canonicalLocationId: resolved.canonicalLocationId,
      township: canonical.township,
      stateRegion: canonical.state_region,
      units: 0,
      salesValue: 0,
    };
    current.units += units;
    current.salesValue += Number(row.finalReceived ?? 0);
    metrics.set(resolved.canonicalLocationId, current);

    if (date.slice(5, 10) <= samePeriodThrough) {
      const annual = annualMetrics.get(resolved.canonicalLocationId) ?? {
        canonicalLocationId: resolved.canonicalLocationId,
        township: canonical.township,
        stateRegion: canonical.state_region,
        yearly: years.map((year) => ({ year, units: 0, salesValue: 0 })),
      };
      const yearMetric = annual.yearly.find((item) => item.year === Number(date.slice(0, 4)));
      if (yearMetric) {
        yearMetric.units += units;
        yearMetric.salesValue += Number(row.finalReceived ?? 0);
      }
      annualMetrics.set(resolved.canonicalLocationId, annual);
    }
  }

  return {
    areas: [...metrics.values()],
    coverageStart,
    coverageEnd,
    unresolvedUnits,
    annualAreas: [...annualMetrics.values()],
    samePeriodThrough,
    trendUnresolvedUnits,
  };
}

export async function getHeatmapSalesAreaAggregate(
  scope: { start: string; end: string; product?: string | null },
) {
  const { env } = await import("cloudflare:workers");
  const assets = (env as Record<string, unknown>).ASSETS as Fetcher | undefined;
  if (!assets) throw new Error("Cloudflare ASSETS binding is unavailable for Sales Heatmap data.");
  const response = await assets.fetch(new Request("https://kmm-assets.internal/dashboard-data.json"));
  if (!response.ok) throw new Error(`Unable to load Sales Heatmap data (${response.status}).`);
  const payload = await response.json() as HeatmapPayload;
  return aggregateHeatmapSalesAreas(payload.sales ?? [], scope);
}
