import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const salesBusiness = await tsImport("../lib/sales/business-service.ts", import.meta.url);

test("Sales Organization route preserves authentication and the existing page", async () => {
  const [route, shell] = await Promise.all([
    read("app/team/page.tsx"),
    read("components/layout/global-app-shell.tsx"),
  ]);

  assert.match(shell, /<AuthGate>/);
  assert.match(route, /<SalesOrganizationPage\s*\/>/);
});

test("organization branches follow the active Company Master and retain employee rules", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  assert.match(page, /selectedCompany\?\.branches/);
  assert.match(page, /const branchDefinitions = useMemo/);
  assert.match(page, /operationalShowroomForBranch/);
  assert.doesNotMatch(page, /\{ code: "KMM01", name: "Hpa-an" \}/);
  assert.match(page, /normalizeEmployeeBaseName/);
  assert.match(page, /isInactiveEmployeeName/);
  assert.match(page, /isCurrentEmployee/);
  assert.match(page, /const inactiveNames = useMemo/);
  assert.match(page, /const people = useMemo/);
  assert.match(page, /const branchMetrics = useMemo/);
});

test("Sales Organization KPIs preserve their existing calculations", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  assert.match(page, /loadLiveSalesData\(\{ allowFallback: false, companyId \}\)/);
  assert.match(page, /loadLiveOperationalData\(\{ allowFallback: false, companyId \}\)/);
  assert.match(page, /kmm:sales-imported/);
  assert.doesNotMatch(page, /dashboard-data\.json/);
  assert.match(page, /const activeKpis = getSalesKpis\(activeSales\)/);
  assert.match(page, /const totalSalesValue = activeKpis\.salesValue/);
  assert.match(page, /const totalGp = activeKpis\.grossProfit/);
  assert.match(
    page,
    /const totalAchievement = totalTarget \? \(activeKpis\.salesUnit \/ totalTarget\) \* 100 : null/,
  );
  assert.match(
    page,
    /const totalGpPercent = totalSalesValue \? \(totalGp \/ totalSalesValue\) \* 100 : null/,
  );
  assert.match(page, /const bestShowroom = branchMetrics\.find/);
  assert.match(page, /const bestSalesperson = people\[0\]/);

  for (const title of [
    "Active Salespeople",
    "Showroom Achievement",
    "Total Sales",
    "Total GP",
    "Best Showroom",
    "Best Salesperson",
  ]) {
    assert.match(page, new RegExp(`title="${title}"`));
  }
});

test("live Team parity uses the shared Sales rules for replacement data and every filter dimension", () => {
  const row = ({ type, value, gp, branch, salesperson, month }) => ({
    date: `2026-${String(month).padStart(2, "0")}-01`,
    year: 2026,
    month,
    branch,
    salesperson,
    productType: type,
    model: "MODEL",
    quantity: 1,
    finalReceived: value,
    gp1: gp,
    expense: null,
  });
  const latest = [
    row({ type: "TT", value: 100, gp: 10, branch: "KMM01", salesperson: "Alice", month: 1 }),
    row({ type: "IM", value: 50, gp: 5, branch: "KMM01", salesperson: "Alice", month: 1 }),
    row({ type: "CH", value: 200, gp: 20, branch: "KMM02", salesperson: "Bob", month: 2 }),
    row({ type: "OT", value: 25, gp: 3, branch: "KMM02", salesperson: "Bob", month: 2 }),
  ];
  const scoped = latest.filter((item) => salesBusiness.salesRowMatches(item, {
    year: [2026],
    month: ["Jan"],
    branch: ["KMM01"],
    salesperson: ["Alice"],
  }));
  assert.deepEqual(salesBusiness.getSalesKpis(scoped), {
    salesUnit: 1,
    salesValue: 150,
    grossProfit: 15,
    grossProfitAvailable: true,
    expense: null,
  });
  assert.deepEqual(
    salesBusiness.getBranchSummary(latest).map(({ label, value }) => [label, value]),
    [["KMM01", 1], ["KMM02", 1]],
  );
  assert.deepEqual(
    salesBusiness.getSalespersonSummary(latest).map(({ label, value }) => [label, value]),
    [["Alice", 1], ["Bob", 1]],
  );
  // A replacement is represented by the latest active array only; old rows are
  // intentionally not concatenated into Team calculations.
  const replaced = [row({ type: "EX", value: 300, gp: 30, branch: "KMM03", salesperson: "Cara", month: 3 })];
  assert.equal(salesBusiness.getSalesKpis(replaced).salesUnit, 1);
  assert.equal(salesBusiness.getSalesKpis(replaced).salesValue, 300);
  assert.equal(salesBusiness.getSalesKpis(replaced).grossProfit, 30);
});

test("Team employee and showroom mapping use live master metadata and canonical aliases", async () => {
  const [page, repository, api, client] = await Promise.all([
    read("components/team/sales-organization-page.tsx"),
    read("lib/sales/repository.ts"),
    read("app/api/sales/route.ts"),
    read("lib/sales/client.ts"),
  ]);
  assert.match(page, /employeeMasterAvailable/);
  assert.match(page, /makeEmployeeDirectory/);
  assert.match(page, /isCurrentLiveEmployee/);
  assert.match(page, /canonicalBranch/);
  assert.match(repository, /salespersonMaster/);
  assert.match(repository, /listSalespeople/);
  assert.match(api, /employeeMasterAvailable/);
  assert.match(api, /status === "active"/);
  assert.match(client, /allowFallback\?: boolean/);
});

test("Sales Organization uses only the shared executive KPI presentation", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  assert.match(page, /import \{ KpiCard \}/);
  assert.match(page, /<KpiCard[\s\S]*?variant="executive"/);
  assert.doesNotMatch(page, /function (?:Team|SalesOrganization)?KpiCard/);
  assert.doesNotMatch(page, /data-kpi-zone=/);
});

test("filters retain all dimensions, actions, and accessible geometry", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  for (const label of ["Year", "Month", "Showroom", "Salesperson"]) {
    assert.match(page, new RegExp(`label="${label}"`));
  }
  assert.match(page, /aria-label=\{`\$\{label\} filter`\}/);
  assert.match(page, /aria-haspopup="listbox"/);
  assert.match(page, /if \(event\.key === "Escape"\) setOpen\(false\)/);
  assert.match(page, /className="flex h-11 w-full/);
  assert.match(page, /setFilters\(defaultFilters\)/);
  assert.match(page, /onRefresh=\{loadData\}/);
  assert.match(page, /exportPeople\(people, companyCode\)/);
});

test("reporting views, branch grouping, and employee links remain present", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  for (const section of [
    "Showroom Performance",
    "Showroom Ranking",
    "Team Summary",
    "Top Salespeople",
    "Employee Detail",
  ]) {
    assert.match(page, new RegExp(section));
  }
  assert.match(page, /Top Performer/);
  assert.match(page, /Bottom Performer/);
  assert.match(page, /onSelect\(person\)/);
  assert.match(page, /setSelectedPersonId\(person\.id\)/);
  assert.match(page, /selectedPerson = people\.find/);
});

test("ranking and detail retain columns, metrics, and keyboard selection", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  for (const label of [
    "Sales Unit",
    "Sales Value",
    "GP Value",
    "GP %",
    "Commission",
    "Commission % of Sales",
    "Commission / GP",
    "Monthly Sales Trend",
  ]) {
    assert.match(page, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(page, /tabIndex=\{0\}/);
  assert.match(page, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(page, /aria-label=\{`View \$\{person\.name\} details`\}/);
  assert.match(page, /overflow-x-auto/);
  assert.match(page, /kmm-tabular/);
});

test("Sales Organization follows the Golden Reference shell and states", async () => {
  const [page, shell, header] = await Promise.all([
    read("components/team/sales-organization-page.tsx"),
    read("components/layout/global-app-shell.tsx"),
    read("components/layout/global-header.tsx"),
  ]);

  assert.match(
    page,
    /kmm-sales-organization-page min-h-\[calc\(100vh-72px\)\] bg-\[var\(--surface-canvas\)\]/,
  );
  assert.match(page, /id="sales-organization-title"/);
  assert.match(header, /h-\[72px\]/);
  assert.match(page, /max-w-\[1600px\]/);
  assert.match(page, /aria-busy="true"/);
  assert.match(page, /aria-live="assertive"/);
  assert.match(page, /focus-visible:ring-2/);
  assert.match(shell, /motion-reduce:transition-none/);
});
