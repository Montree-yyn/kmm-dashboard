import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Dashboard V3.4 assigns distinct chart families to distinct business questions", async () => {
  const dashboard = await read("components/dashboard/dashboard-page.tsx");

  assert.match(dashboard, /title=\{t\("chart\.salesTrendTitle"\)\}/);
  assert.match(dashboard, /title=\{t\("chart\.bookingLifecycleTitle"\)\}[\s\S]*?<StackedColumnChart/);
  assert.match(dashboard, /title=\{t\("chart\.stockVsBookingTitle"\)\}[\s\S]*?<PairedBarChart/);
  assert.match(dashboard, /title=\{t\("chart\.productMixTitle"\)\}[\s\S]*?<PercentStackedBar/);
  assert.match(dashboard, /title=\{t\("chart\.agingRiskTitle"\)\}[\s\S]*?<HeatmapMatrix/);
  assert.doesNotMatch(dashboard, /function QuickActions|<QuickActions/);
  assert.doesNotMatch(dashboard, /title="Booking Trend"/);
  assert.doesNotMatch(dashboard, /title="Stock Trend"/);
});

test("Stock V3.4 gates sparse history and keeps current comparison source-backed", async () => {
  const stock = await read("components/stock/stock-intelligence-page.tsx");

  assert.match(stock, /const observedStockPeriods = new Set/);
  assert.match(stock, /observedStockPeriods < 8/);
  assert.match(stock, /t\("stock\.trendWithheld"\)/);
  assert.match(stock, /left: item\.booking[\s\S]*?right: item\.stock/);
  assert.match(stock, /<PairedBarChart/);
  assert.match(stock, /<HeatmapMatrix/);
  assert.doesNotMatch(stock, /<PremiumTrendChart/);
});

test("Booking lifecycle uses observed source statuses rather than invented stages", async () => {
  const { buildMonthlyLifecycle } = await tsImport(
    "../components/common/charts/chartData.ts",
    import.meta.url,
  );
  const result = buildMonthlyLifecycle([
    { year: 2026, month: 1, status: "Open" },
    { year: 2026, month: 1, status: "Delivered" },
    { year: 2026, month: 2, status: "Cancelled" },
    { year: 2026, month: 2, status: "Open" },
  ]);

  assert.deepEqual(result.labels, ["Jan", "Feb"]);
  assert.deepEqual(
    result.series.map((series) => series.label).sort(),
    ["Cancelled", "Delivered", "Open"],
  );
  assert.deepEqual(result.series.find((series) => series.label === "Open").values, [1, 1]);
  assert.equal(result.series.find((series) => series.label === "Delivered").color, "#35363A");
  assert.equal(result.series.find((series) => series.label === "Cancelled").color, "#9B948A");
  assert.equal(result.series.find((series) => series.label === "Open").color, "#F56600");
  assert.equal(result.series.some((series) => series.label === "Finance Approved"), false);
});

test("Sales V3.4 keeps the sales trend and varies target, concentration, mix, and model views", async () => {
  const sales = await read("components/sales/sales-page.tsx");

  assert.match(sales, /<ExecutiveSalesTrend/);
  assert.match(sales, /<BulletChart/);
  assert.match(sales, /<CumulativeRankChart[\s\S]*?items=\{peopleGroups\}/);
  assert.match(sales, /<PercentStackedBar/);
  assert.match(sales, /<LollipopChart[\s\S]*?items=\{modelGroups\}/);
});

test("V3.4 chart primitives and Sales trend expose mobile-native evidence", async () => {
  const [charts, trend] = await Promise.all([
    read("components/common/charts/AnalyticalCharts.tsx"),
    read("components/common/charts/StandardLineChart.tsx"),
  ]);

  for (const component of [
    "StackedColumnChart",
    "PairedBarChart",
    "PercentStackedBar",
    "HeatmapMatrix",
    "LollipopChart",
    "CumulativeRankChart",
    "BulletChart",
  ]) {
    assert.match(charts, new RegExp(`export function ${component}`));
  }
  assert.match(charts, /role="img"/);
  assert.match(charts, /shortageLabel = "Shortage"/);
  assert.doesNotMatch(charts, /export function DumbbellChart/);
  assert.doesNotMatch(charts, /min-w-\[680px\]|min-w-\[720px\]/);
  assert.match(trend, /const mobileStart = Math\.max\(shownLabels\.length - 6, 0\)/);
  assert.match(trend, /className="mt-4 sm:hidden"/);
  assert.match(trend, /hidden overflow-x-auto sm:block/);
  assert.doesNotMatch(trend, /Scroll the chart horizontally/);
});
