import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Sales route preserves authentication and the existing page component", async () => {
  const [route, shell] = await Promise.all([
    read("app/sales/page.tsx"),
    read("components/layout/global-app-shell.tsx"),
  ]);
  assert.match(shell, /<AuthGate>/);
  assert.match(route, /<SalesPerformancePage\s*\/>/);
});

test("Sales business data and KPI calculations remain source-backed", async () => {
  const page = await read("components/sales/sales-page.tsx");
  assert.match(page, /fetch\(`\/dashboard-data\.json\?ts=\$\{Date\.now\(\)\}`/);
  assert.match(page, /const salesValue = businessKpis\.salesValue/);
  assert.match(page, /const grossProfit = businessKpis\.grossProfit/);
  assert.match(
    page,
    /const achievement =[\s\S]*?\(businessKpis\.salesUnit \/ salesTarget\) \* 100/,
  );
  assert.match(
    page,
    /const asp = getSalesAsp\(data\?\.sales \?\? \[\], filters\)/,
  );
});

test("Sales page follows the Golden Reference shell and KPI hierarchy", async () => {
  const [page, kpiCard] = await Promise.all([
    read("components/sales/sales-page.tsx"),
    read("components/design-system/kpi-card.tsx"),
  ]);
  assert.match(
    page,
    /kmm-sales-page min-h-\[calc\(100vh-72px\)\] bg-\[var\(--surface-canvas\)\]/,
  );
  assert.match(page, /<h1[\s\S]*?id="sales-title"/);
  assert.match(page, /import \{ KpiCard \}/);
  assert.match(page, /<KpiCard[\s\S]*?variant="executive"/);
  assert.doesNotMatch(page, /function SalesExecutiveKpiCard/);
  assert.match(kpiCard, /kmm-tabular whitespace-nowrap text-\[32px\]/);
  assert.match(
    page,
    /Sales KPIs[\s\S]*?xl:grid-cols-\[repeat\(5,minmax\(0,1fr\)\)\]/,
  );
});

test("Sales filters retain all dimensions with accessible 44px controls", async () => {
  const [page, controls] = await Promise.all([
    read("components/sales/sales-page.tsx"),
    read("components/design-system/data-controls.tsx"),
  ]);
  for (const label of [
    "Year",
    "Month",
    "Branch",
    "Salesperson",
    "Product Group",
  ]) {
    assert.match(
      page,
      new RegExp(`MultiSelectFilter[\\s\\S]*?label="${label}"`),
    );
  }
  assert.match(controls, /aria-label=\{`\$\{label\} filter`\}/);
  assert.match(controls, /className="flex h-11 w-full/);
  assert.match(page, /2xl:grid-cols-5/);
});

test("Sales charts and rankings preserve their existing data inputs", async () => {
  const page = await read("components/sales/sales-page.tsx");
  assert.match(
    page,
    /<ExecutiveSalesTrend[\s\S]*?sales=\{data\.sales\}[\s\S]*?filters=\{filters\}[\s\S]*?plan=\{data\.plan\}/,
  );
  assert.match(page, /<BarChart[\s\S]*?data=\{byBranch\}/);
  assert.match(page, /<BarChart[\s\S]*?data=\{peopleGroups\}/);
  assert.match(page, /<BarChart[\s\S]*?data=\{byProduct\}/);
  assert.match(page, /<BarChart[\s\S]*?data=\{modelGroups\}/);
});

test("Sales transaction table preserves columns, sorting, and contained scrolling", async () => {
  const page = await read("components/sales/sales-page.tsx");
  for (const label of [
    "Date",
    "Branch",
    "Salesperson",
    "Product Group",
    "Model",
    "Quantity",
    "Sales Value",
    "Gross Profit",
  ]) {
    assert.match(page, new RegExp(`>\\s*${label}\\s*<|header\\("${label}"`));
  }
  // Invoice, Customer, and Status remain in the export contract but are not
  // rendered as empty table columns when the source does not provide them.
  assert.match(page, /"Invoice"/);
  assert.match(page, /"Customer"/);
  assert.match(page, /"Status"/);
  assert.match(page, /function changeSort/);
  assert.match(page, /overflow-x-auto/);
  assert.match(page, /pageSize = 10/);
});
