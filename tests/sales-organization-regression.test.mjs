import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Sales Organization route preserves authentication and the existing page", async () => {
  const [route, shell] = await Promise.all([
    read("app/team/page.tsx"),
    read("components/layout/global-app-shell.tsx"),
  ]);

  assert.match(shell, /<AuthGate>/);
  assert.match(route, /<SalesOrganizationPage\s*\/>/);
});

test("organization branches and active employee rules remain unchanged", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  for (const branch of [
    '{ code: "KMM01", name: "Hpa-an" }',
    '{ code: "KMM02", name: "Mawlamyine" }',
    '{ code: "KMM03", name: "Tharyarwaddy" }',
  ]) {
    assert.ok(page.includes(branch));
  }
  assert.match(page, /normalizeEmployeeBaseName/);
  assert.match(page, /isInactiveEmployeeName/);
  assert.match(page, /isCurrentEmployee/);
  assert.match(page, /const inactiveNames = useMemo/);
  assert.match(page, /const people = useMemo/);
  assert.match(page, /const branchMetrics = useMemo/);
});

test("Sales Organization KPIs preserve their existing calculations", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  assert.match(page, /fetch\(`\/dashboard-data\.json\?ts=\$\{Date\.now\(\)\}`/);
  assert.match(page, /const totalSalesValue = sum\(activeValueRows/);
  assert.match(page, /const totalGp = sum\(activeValueRows/);
  assert.match(
    page,
    /const totalAchievement = totalTarget \? \(activeUnitRows\.length \/ totalTarget\) \* 100 : null/,
  );
  assert.match(
    page,
    /const totalGpPercent = totalSalesValue \? \(totalGp \/ totalSalesValue\) \* 100 : null/,
  );
  assert.match(page, /const bestShowroom = \[\.\.\.branchMetrics\]\.sort/);
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
  assert.match(page, /exportPeople\(people\)/);
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
  assert.match(page, /setSelectedName\(person\.name\)/);
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
