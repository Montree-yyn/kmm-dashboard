import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const salesBusiness = await tsImport("../lib/sales/business-service.ts", import.meta.url);
const dashboardSummary = await tsImport("../lib/sales/dashboard-summary-service.ts", import.meta.url);

function businessRow({
  type,
  quantity = 1,
  value,
  gp,
  branch = "KMM01",
  salesperson = "Alice",
  year = 2026,
  month = 1,
  model = "MODEL",
}) {
  return {
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    year,
    month,
    branch,
    salesperson,
    productType: type,
    model,
    quantity,
    finalReceived: value,
    gp1: gp,
    expense: null,
  };
}

async function importTypeScriptModule(path) {
  const source = await read(path);
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("D1 repository, shared business service, API, and page adapters are connected", async () => {
  const [repository, service, api, dashboard, sales, organization, marketing, client] = await Promise.all([
    read("lib/sales/repository.ts"), read("lib/sales/business-service.ts"), read("app/api/sales/route.ts"), read("components/dashboard/dashboard-page.tsx"), read("components/sales/sales-page.tsx"), read("components/team/sales-organization-page.tsx"), read("components/marketing/marketing-intelligence-page.tsx"), read("lib/sales/client.ts"),
  ]);
  assert.match(repository, /salesTransactions/);
  assert.match(repository, /listSalespeople/);
  assert.match(repository, /listSalesDashboardBuckets/);
  assert.match(repository, /groupBy\(year, month/);
  assert.match(service, /getSalesKpis/);
  assert.match(service, /getMonthlyTrend/);
  assert.match(service, /getWeeklyTrend/);
  assert.match(api, /listSalesTransactions/);
  assert.match(api, /toLegacySalesRow/);
  assert.match(api, /employeeMasterAvailable/);
  assert.match(api, /listSalesDashboardBuckets/);
  assert.match(api, /listRecentSalesDashboardRows/);
  assert.match(api, /getLatestCompanyMonthlyTargetPlan/);
  assert.match(api, /Cloudflare D1 · business_targets/);
  assert.match(dashboard, /loadLiveSalesDashboardSummary/);
  assert.match(dashboard, /salesSummary\.branchSummary/);
  assert.match(dashboard, /salesSummary\.trendRows/);
  assert.match(sales, /loadLiveSalesData/);
  assert.match(sales, /getProductSummary/);
  assert.match(organization, /getSalesKpis/);
  assert.match(organization, /loadLiveSalesData/);
  assert.match(organization, /allowFallback: false/);
  assert.match(marketing, /isEngineUnitProduct/);
  assert.match(marketing, /salesTransactionQuantity/);
  assert.match(client, /process\.env\.NODE_ENV === "production"/);
  assert.doesNotMatch(client, /NEXT_PUBLIC_SALES_LOCAL_FALLBACK/);
});

test("canonical D1 fields and null GP behavior are preserved by the adapter", async () => {
  const [schema, migration, adapter] = await Promise.all([read("db/schema.ts"), read("drizzle/0003_groovy_talisman.sql"), importTypeScriptModule("lib/sales/compatibility-adapter.ts")]);
  for (const field of ["productType", "model", "finalReceived", "netReceived", "gp1", "expense", "salespersonCode", "salespersonName"]) assert.match(schema, new RegExp(field));
  for (const field of ["product_type", "final_received", "gp1", "salesperson_code", "salesperson_name"]) assert.match(migration, new RegExp(field));
  const row = adapter.toCanonicalSalesRow({ id: "1", saleDate: "2026-08-01", importYear: 2026, importMonth: 8, branch: "KMM01", modelCode: "M1", employeeCode: "E1", quantity: 1, saleAmount: "10", productType: "TT", model: "M1", finalReceived: null, netReceived: null, gp1: null, expense: null, salespersonCode: null, salespersonName: null });
  assert.equal(row.gp1, null);
  assert.equal(row.salesperson, "");
  assert.equal(adapter.toLegacySalesRow(row).gp1, null);
  assert.equal(adapter.toLegacySalesRow(row).quantity, 1);
});

test("approved KMM Sales Unit, Value, and GP rules have exact parity", () => {
  const rows = [
    businessRow({ type: "TT", value: 100, gp: 10 }),
    businessRow({ type: "CH", value: 200, gp: 20 }),
    businessRow({ type: "IM", value: 50, gp: 5 }),
    businessRow({ type: "OT", value: 25, gp: 3 }),
  ];
  const kpis = salesBusiness.getSalesKpis(rows);
  assert.equal(kpis.salesUnit, 2);
  assert.equal(kpis.salesValue, 375);
  assert.equal(kpis.grossProfit, 38);
});

test("dashboard-summary view is compact and retains Sales KPI parity", async () => {
  const api = await read("app/api/sales/route.ts");
  const rows = [
    businessRow({ type: "TT", quantity: 2, value: 100, gp: 10, year: 2026, month: 1, branch: "KMM01", salesperson: "Alice" }),
    businessRow({ type: "CH", quantity: 3, value: 200, gp: 20, year: 2025, month: 1, branch: "KMM02", salesperson: "Bob" }),
  ];
  const summary = dashboardSummary.getSalesDashboardSummary(rows, { year: ["2026"] });
  assert.match(api, /view === "dashboard-summary"/);
  assert.match(api, /getSalesDashboardSummary/);
  assert.equal(summary.rowCount, 2);
  assert.deepEqual(summary.kpis, salesBusiness.getSalesKpis(rows, { year: ["2026"] }));
  assert.deepEqual(summary.previousYearKpis, salesBusiness.getSalesKpis(rows, { year: [2025] }));
  assert.deepEqual(summary.filters.year, ["2026", "2025"]);
  assert.equal(summary.monthlyTrend.length, 12);
  assert.equal(summary.monthlyTrend[0].salesUnit, 5);
  assert.deepEqual(summary.trendRows.map((row) => [row.year, row.month, row.salesUnit]), [[2025, 1, 3], [2026, 1, 2]]);
  assert.equal(summary.sparklines.salesUnit[0], 2);
  assert.equal(summary.recentSales.length, 1);
});

test("all and only TT/CH/EX/TP quantities count while every valid row contributes Value and GP", () => {
  const rows = [
    businessRow({ type: "01-TT", quantity: 2, value: 100, gp: 10, branch: "KMM01", salesperson: "Alice" }),
    businessRow({ type: "02-CH", quantity: 3, value: 200, gp: 20, branch: "KMM01", salesperson: "Alice" }),
    businessRow({ type: "04-EX", quantity: 4, value: 300, gp: 30, branch: "KMM02", salesperson: "Bob", month: 2 }),
    businessRow({ type: "03-TP", quantity: 5, value: 400, gp: 40, branch: "KMM02", salesperson: "Bob", month: 2 }),
    businessRow({ type: "06-IM", quantity: 20, value: 500, gp: 50 }),
    businessRow({ type: "07-IMO", quantity: 30, value: 600, gp: 60, branch: "KMM02", salesperson: "Bob", month: 2 }),
    businessRow({ type: "08-OT", quantity: 40, value: 700, gp: 70, branch: "KMM02", salesperson: "Bob", month: 2 }),
    businessRow({ type: "MAX", quantity: 50, value: 800, gp: 80, branch: "KMM03", salesperson: "Cara" }),
    businessRow({ type: "05-TX", quantity: 60, value: 900, gp: 90, branch: "KMM03", salesperson: "Cara" }),
    businessRow({ type: "MITSU", quantity: 70, value: 1000, gp: 100, branch: "KMM03", salesperson: "Cara", model: "MITSUBISHI (ATTRAGE CVT GLS)" }),
  ];

  assert.deepEqual(
    ["TT", "CH", "EX", "TP", "IM", "IMO", "OT"].map((type) => salesBusiness.salesProductGroup(type)),
    ["TT", "CH", "EX", "TP", "IM", "IMO", "OT"],
  );
  assert.deepEqual(
    ["TT", "CH", "EX", "TP", "IM", "IMO", "OT", "MAX", "05-TX", "MITSU"].map((type) => salesBusiness.isEngineUnitProduct(type)),
    [true, true, true, true, false, false, false, false, false, false],
  );
  assert.equal(salesBusiness.salesProductGroup(rows.at(-1)), "Other");

  const kpis = salesBusiness.getSalesKpis(rows);
  assert.equal(kpis.salesUnit, 14);
  assert.equal(kpis.salesValue, 5500);
  assert.equal(kpis.grossProfit, 550);
  assert.equal(salesBusiness.getSalesAsp(rows), 4600 / 6);

  assert.deepEqual(salesBusiness.getBranchSummary(rows).map(({ label, value }) => [label, value]), [["KMM02", 9], ["KMM01", 5]]);
  assert.deepEqual(salesBusiness.getSalespersonSummary(rows).map(({ label, value }) => [label, value]), [["Bob", 9], ["Alice", 5]]);
  assert.deepEqual(salesBusiness.getProductSummary(rows).map(({ label, value }) => [label, value]), [["TP", 5], ["EX", 4], ["CH", 3], ["TT", 2]]);

  const monthly = salesBusiness.getMonthlyTrend(rows);
  assert.deepEqual(
    { unit: monthly[0].salesUnit, value: monthly[0].salesValue, gp: monthly[0].grossProfit },
    { unit: 5, value: 3500, gp: 350 },
  );
  assert.deepEqual(
    { unit: monthly[1].salesUnit, value: monthly[1].salesValue, gp: monthly[1].grossProfit },
    { unit: 9, value: 2000, gp: 200 },
  );
  assert.deepEqual(
    { unit: monthly[2].salesUnit, value: monthly[2].salesValue, gp: monthly[2].grossProfit },
    { unit: 0, value: null, gp: null },
  );
});

test("prior-year Sales comparisons use the same shared rules", () => {
  const rows = [
    businessRow({ type: "TT", quantity: 2, value: 100, gp: 10, year: 2026 }),
    businessRow({ type: "CH", quantity: 3, value: 200, gp: 20, year: 2026 }),
    businessRow({ type: "IM", quantity: 9, value: 500, gp: 50, year: 2026 }),
    businessRow({ type: "TT", quantity: 1, value: 40, gp: 4, year: 2025 }),
    businessRow({ type: "OT", quantity: 9, value: 60, gp: 6, year: 2025 }),
  ];
  assert.deepEqual(salesBusiness.getSalesKpis(rows, { year: [2026], month: [1] }), {
    salesUnit: 5,
    salesValue: 800,
    grossProfit: 80,
    grossProfitAvailable: true,
    expense: null,
  });
  assert.deepEqual(salesBusiness.getSalesKpis(rows, { year: [2025], month: [1] }), {
    salesUnit: 1,
    salesValue: 100,
    grossProfit: 10,
    grossProfitAvailable: true,
    expense: null,
  });
});

test("Dashboard Sales KPI scope keeps an explicit 2026 August selection separate from all historical August rows", () => {
  const rows = [
    businessRow({ type: "TT", value: 100, gp: 10, year: 2025, month: 8 }),
    businessRow({ type: "CH", value: 200, gp: 20, year: 2024, month: 8 }),
    businessRow({ type: "TT", value: 300, gp: 30, year: 2026, month: 7 }),
  ];

  // Dashboard passes its current filter state directly to the canonical Sales
  // service. A month-only filter is intentionally historical; the current
  // year must be selected for a current-month KPI scope.
  assert.deepEqual(salesBusiness.getSalesKpis(rows, { month: ["Aug"] }), {
    salesUnit: 2,
    salesValue: 300,
    grossProfit: 30,
    grossProfitAvailable: true,
    expense: null,
  });

  const august2026 = salesBusiness.getSalesKpis(rows, {
    year: ["2026"],
    month: ["Aug"],
    branch: [],
    salesperson: [],
  });
  assert.equal(august2026.salesUnit, 0);
  assert.equal(august2026.salesValue ?? 0, 0);
  assert.equal(august2026.grossProfit ?? 0, 0);
  assert.equal(august2026.grossProfitAvailable, false);

  const july2026 = salesBusiness.getSalesKpis(rows, { year: ["2026"], month: ["Jul"] });
  assert.deepEqual(july2026, {
    salesUnit: 1,
    salesValue: 300,
    grossProfit: 30,
    grossProfitAvailable: true,
    expense: null,
  });
});

test("Sales invoice scope is a non-unique lookup while the transaction id remains primary", async () => {
  const [schema, migration] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0008_sales_invoice_lookup.sql"),
  ]);
  assert.match(schema, /id: text\("id"\)\.primaryKey\(\)/);
  assert.match(schema, /index\("sales_scope_invoice_idx"\)/);
  assert.doesNotMatch(schema, /uniqueIndex\("sales_scope_invoice_unique"\)/);
  assert.match(migration, /DROP INDEX `sales_scope_invoice_unique`/);
  assert.match(migration, /CREATE INDEX `sales_scope_invoice_idx` ON `sales_transactions` \(`company_id`,`import_year`,`import_month`,`invoice_no`\)/);
  assert.doesNotMatch(migration, /CREATE UNIQUE INDEX|DROP TABLE|CREATE TABLE/);
});

test("refresh event is wired and approved company targets stay unavailable for granular scopes", async () => {
  const [service, dashboard, sales, business] = await Promise.all([read("lib/data-hub/import-service.ts"), read("components/dashboard/dashboard-page.tsx"), read("components/sales/sales-page.tsx"), read("lib/sales/business-service.ts")]);
  assert.match(service, /kmm:sales-imported/);
  assert.match(dashboard, /kmm:sales-imported/);
  assert.match(sales, /kmm:sales-imported/);
  assert.match(sales, /hasCompanyTarget/);
  assert.match(sales, /hasCompanyTarget \? "company" : null/);
  assert.match(business, /Target achievement is unavailable/);
  assert.match(business, /grossProfitAvailable/);
});

test("Sales import preserves mapped salesperson identity when master data has no match", async () => {
  const route = await read("app/api/data-hub/sales/route.ts");
  assert.match(route, /salespersonCode: master\?\.salespersonCode \?\? \(salespersonCode \|\| null\)/);
  assert.match(route, /salespersonName: master\?\.salespersonName \?\? \(salespersonName \|\| null\)/);
  assert.doesNotMatch(route, /salespersonName: master\?\.salespersonName \?\? null/);
});
