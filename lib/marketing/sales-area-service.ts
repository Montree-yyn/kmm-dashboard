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
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;
  let unresolvedUnits = 0;

  for (const row of rows) {
    const date = String(row.date ?? "").slice(0, 10);
    if (!date || date < scope.start || date > scope.end) continue;
    if (!isEngineUnitProduct(row)) continue;
    if (scope.product && salesProductGroup(row) !== scope.product) continue;

    if (coverageStart === null) coverageStart = date;
    else if (date.localeCompare(coverageStart) < 0) coverageStart = date;
    if (coverageEnd === null) coverageEnd = date;
    else if (date.localeCompare(coverageEnd) > 0) coverageEnd = date;
    const units = salesTransactionQuantity(row);
    const resolved = resolveSalesGeography(row.stateRegion, row.township, boundaryIds);
    if (!resolved.canonicalLocationId) {
      unresolvedUnits += units;
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
  }

  return {
    areas: [...metrics.values()],
    coverageStart,
    coverageEnd,
    unresolvedUnits,
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
