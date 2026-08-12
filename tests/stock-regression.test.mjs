import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Stock route preserves authentication and the existing page component", async () => {
  const [route, shell] = await Promise.all([
    read("app/stock/page.tsx"),
    read("components/layout/global-app-shell.tsx"),
  ]);
  assert.match(shell, /<AuthGate>/);
  assert.match(route, /<StockIntelligencePage\s*\/>/);
});

test("Stock KPIs remain backed by the existing selectors and calculations", async () => {
  const page = await read("components/stock/stock-intelligence-page.tsx");

  assert.match(page, /fetch\("\/dashboard-data\.json"\)/);
  assert.match(page, /getCurrentStockRows\(/);
  assert.match(page, /const unitRows = getStockUnitRows\(rows\)/);
  assert.match(page, /const valueRows = getStockValueRows\(rows\)/);
  assert.match(page, /const stockValue = getStockValue\(rows\)/);
  assert.match(page, /const averageStockAge = getAverageStockAge\(rows\)/);
  assert.match(page, /const aged = getAgedStock\(rows\)/);
  assert.match(
    page,
    /booking\.length[\s\S]*?\(unitRows\.length \/ booking\.length\)\.toFixed\(1\)/,
  );

  for (const title of [
    "stockUnit",
    "stockValue",
    "averageStockAge",
    "agedStock",
    "stockCoverage",
  ]) {
    assert.match(page, new RegExp(`title=\\{t\\("metric\\.${title}"\\)\\}`));
  }
});

test("Stock uses the shared executive KPI presentation without local duplication", async () => {
  const [page, kpiCard] = await Promise.all([
    read("components/stock/stock-intelligence-page.tsx"),
    read("components/design-system/kpi-card.tsx"),
  ]);

  assert.match(page, /import \{ KpiCard \}/);
  assert.match(page, /<KpiCard[\s\S]*?variant="executive"/);
  assert.doesNotMatch(page, /function StockExecutiveKpiCard/);
  assert.doesNotMatch(page, /data-kpi-zone=/);
  assert.match(kpiCard, /grid-rows-\[24px_48px_40px_14px\]/);
  assert.match(kpiCard, /flex-nowrap items-baseline/);
  assert.match(kpiCard, /kmm-tabular whitespace-nowrap text-\[32px\]/);
});

test("Stock product definitions and model inputs feed the V3.4 comparison and aging charts", async () => {
  const page = await read("components/stock/stock-intelligence-page.tsx");

  assert.match(
    page,
    /const UNIT_PRODUCTS = PRODUCT_GROUPS\.UNIT_PRODUCTS as readonly string\[\]/,
  );
  assert.match(page, /getStockByProduct\(rows\)/);
  assert.match(page, /UNIT_PRODUCTS\.includes\(item\.product\)/);
  assert.match(page, /const modelMap = new Map<string, Stock\[\]>\(\)/);
  assert.match(page, /\.sort\(\(a, b\) => b\.count - a\.count\)/);
  assert.match(page, /title=\{t\("chart\.stockProductAnalysisTitle"\)\}/);
  assert.match(page, /title=\{t\("chart\.agedModelTitle"\)\}/);
  assert.match(page, /title=\{t\("chart\.stockAgingMatrixTitle"\)\}/);
  assert.match(page, /<PairedBarChart/);
  assert.match(page, /<PercentStackedBar/);
  assert.match(page, /<LollipopChart/);
  assert.match(page, /<HeatmapMatrix/);
  assert.match(page, /observedStockPeriods < 8/);
  assert.match(page, /t\("stock\.trendWithheld"\)/);
  assert.match(page, /item\.count \/ unitRows\.length/);
  assert.doesNotMatch(page, /item\.count \/ rows\.length/);
  assert.doesNotMatch(page, /<PremiumTrendChart/);
});

test("Stock does not fabricate purchase plan or received metrics absent from its source", async () => {
  const page = await read("components/stock/stock-intelligence-page.tsx");

  assert.doesNotMatch(page, /title="Purchase Plan"/);
  assert.doesNotMatch(page, /title="Received"/);
  assert.doesNotMatch(page, /data\.plan/);
});

test("Stock filters preserve all dimensions and accessible 44px controls", async () => {
  const [page, controls] = await Promise.all([
    read("components/stock/stock-intelligence-page.tsx"),
    read("components/design-system/data-controls.tsx"),
  ]);

  for (const key of [
    "year",
    "month",
    "branch",
    "productType",
  ]) {
    assert.match(page, new RegExp(`label=\\{t\\("filter\\.${key}"\\)\\}`));
  }
  assert.match(controls, /aria-label=\{`\$\{t\("common\.filters"\)\}: \$\{label\}`\}/);
  assert.match(controls, /aria-haspopup="listbox"/);
  assert.match(controls, /if \(event\.key === "Escape"\) setOpen\(false\)/);
  assert.match(controls, /className="flex h-11 w-full/);
  assert.match(page, /setFilters\(initial\)/);
});

test("Stock detail preserves search, sorting, pagination, export, and columns", async () => {
  const page = await read("components/stock/stock-intelligence-page.tsx");

  for (const column of [
    "Branch",
    "Date In",
    "Days In Stock",
    "Product Type",
    "Model",
    "Serial Number",
    "MSRP",
    "Booking Status",
    "Aging Group",
    "Risk Status",
  ]) {
    assert.match(page, new RegExp(`"${column}"`));
  }
  assert.match(page, /Math\.ceil\(table\.length \/ 10\)/);
  assert.match(page, /sort === "age"/);
  assert.match(page, /sort === "value"/);
  assert.match(page, /link\.download = `\$\{companyCode\.toLowerCase\(\)\}-stock-detail\.csv`/);
  assert.match(page, /max-h-\[480px\] overflow-auto/);
  assert.match(page, /aria-label="Previous stock detail page"/);
  assert.match(page, /aria-label="Next stock detail page"/);
});

test("Stock page follows the Golden Reference shell and responsive containment", async () => {
  const page = await read("components/stock/stock-intelligence-page.tsx");

  assert.match(
    page,
    /kmm-stock-page min-h-\[calc\(100vh-72px\)\] bg-\[var\(--surface-canvas\)\]/,
  );
  assert.match(page, /<h1[\s\S]*?id="stock-title"/);
  assert.match(page, /aria-label="Stock KPIs"/);
  assert.match(
    page,
    /Stock KPIs[\s\S]*?xl:grid-cols-\[repeat\(5,minmax\(0,1fr\)\)\]/,
  );
  assert.match(page, /aria-busy="true"/);
  assert.match(page, /aria-live="assertive"/);
  assert.match(page, /max-h-\[480px\] overflow-auto/);
  assert.doesNotMatch(page, /min-w-\[720px\]/);
  assert.match(page, /focus-visible:ring-2/);
  assert.match(page, /<HeatmapMatrix/);
});
