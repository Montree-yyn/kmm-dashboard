import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Dashboard operational KPIs are API-only and explicitly reject local fallbacks", async () => {
  const [dashboard, salesClient, operationsClient] = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("lib/sales/client.ts"),
    read("lib/operations/client.ts"),
  ]);

  assert.match(dashboard, /loadLiveSalesData\(\{ allowFallback: false \}\)/);
  assert.match(dashboard, /loadLiveOperationalData\(\{ allowFallback: false \}\)/);
  assert.doesNotMatch(dashboard, /dashboard-data\.json/);
  assert.doesNotMatch(dashboard, /allowLegacyDashboardFallback/);
  assert.match(dashboard, /<ErrorState message=\{error\} onRetry=\{loadDashboardData\}/);
  assert.match(salesClient, /if \(options\.allowFallback === false\) throw new Error\(`Unable to load live D1 Sales data/);
  assert.match(operationsClient, /if \(options\.allowFallback === false\) throw error/);
});

test("legacy static data fingerprints cannot be operational Dashboard values", async () => {
  const [dataText, stockSelectors] = await Promise.all([
    read("public/dashboard-data.json"),
    tsImport("../lib/dashboard/stock-selectors.ts", import.meta.url),
  ]);
  const data = JSON.parse(dataText);
  // The legacy dashboard classifier inspected TYPE and model text. Its one
  // blank-TYPE Tractor row accounts for the exact retired 1,712 KPI.
  const engineTypes = new Set(["TT", "CH", "EX", "TP", "01-TT", "02-CH", "03-TP", "04-EX"]);
  const staticSalesUnit = data.sales.reduce((total, row) => (
    engineTypes.has(String(row.productType ?? "").trim().toUpperCase())
      || /(?:TT|CH|EX|TP)/.test(String(row.model ?? "").toUpperCase())
      ? total + (Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : 1)
      : total
  ), 0);

  assert.equal(staticSalesUnit, 1712);
  assert.equal(stockSelectors.getStockUnit(data.stock), 75);
  assert.notEqual(staticSalesUnit, 43);
  assert.notEqual(stockSelectors.getStockUnit(data.stock), 90);
});
