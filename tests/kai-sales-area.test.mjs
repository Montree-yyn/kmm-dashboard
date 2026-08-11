import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const { aggregateHeatmapSalesAreas } = await tsImport("../lib/marketing/sales-area-service.ts", import.meta.url);

test("KAI Sales Area aggregation follows the Heatmap Township geography rules", () => {
  const result = aggregateHeatmapSalesAreas([
    { date: "2023-01-02", stateRegion: "MON", township: "Thaton", productType: "01-TT", finalReceived: 100 },
    { date: "2024-02-03", stateRegion: "MON", township: "Thaton", productType: "02-CH", finalReceived: 200 },
    { date: "2025-03-04", stateRegion: "MON", township: "Bilin", productType: "06-IM", finalReceived: 300 },
    { date: "2026-06-29", stateRegion: "MON", township: "Bilin", productType: "03-TP", finalReceived: 400 },
    { date: "2027-01-01", stateRegion: "MON", township: "Thaton", productType: "01-TT", finalReceived: 500 },
  ], { start: "2023-01-01", end: "2026-12-31" });

  assert.deepEqual(result.areas.map((row) => [row.township, row.units, row.salesValue]), [
    ["Thaton", 2, 300],
    ["Bilin", 1, 400],
  ]);
  assert.equal(result.coverageStart, "2023-01-02");
  assert.equal(result.coverageEnd, "2026-06-29");
  assert.equal(result.unresolvedUnits, 0);
});
