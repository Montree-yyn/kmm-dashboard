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
    /const totalGpPercent = totalGp !== null && totalSalesValue !== 0 \? \(totalGp \/ totalSalesValue\) \* 100 : null/,
  );
  assert.match(page, /const avgSalesPerPerson = people\.length \? totalSalesValue \/ people\.length : null/);

  for (const title of [
    "Active Salespeople",
    "Total Sales",
    "Total GP",
    "Avg GP %",
    "Avg Sales / Person",
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

test("Team Summary replaces duplicate showroom reporting sections", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  assert.match(page, /function TeamSummary/);
  assert.match(page, /Showroom performance overview for the selected period/);
  assert.match(page, /function BranchTrendChart/);
  assert.match(page, /function ShowroomManager/);
  assert.doesNotMatch(page, /Showroom Performance/);
  assert.doesNotMatch(page, /Showroom Ranking/);
  assert.doesNotMatch(page, /Top Performer/);
  assert.doesNotMatch(page, /Bottom Performer/);
  assert.match(page, /onSelect=\{\(person\) => setSelectedPersonId\(person\.id\)\}/);
  assert.match(page, /setSelectedPersonId\(person\.id\)/);
  assert.match(page, /selectedPerson = people\.find/);
});

test("Team Summary uses filtered showroom sales, GP, trend, and safe manager data", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  assert.match(page, /const branchMetrics = useMemo\(\(\) => branchDefinitions\.map/);
  assert.match(page, /const salesRows = activeSales\.filter\(\(row\) => row\.branch === branch\.code\)/);
  assert.match(page, /filter\(\(branch\) => !filters\.branch\.length \|\| filters\.branch\.includes\(branch\.code\)\)/);
  assert.match(page, /trend: getBranchTrend\(salesRows\)/);
  assert.match(page, /bookingPerPerson/);
  assert.match(page, /manager: null/);
  assert.match(page, /manager\?\.name \?\? "N\/A"/);
  assert.match(page, /Sales \/ Person/);
  assert.match(page, /Booking \/ Person/);
  assert.doesNotMatch(page, /<ShowroomMetric label="Commission"/);
  assert.doesNotMatch(page, /item\.achievement/);
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
  assert.match(page, /<PageHeader/);
  assert.match(page, /data-enterprise-page-header="team"/);
  assert.match(page, /Selected period/);
  assert.match(header, /h-\[72px\]/);
  assert.match(page, /max-w-\[1600px\]/);
  assert.match(page, /aria-busy="true"/);
  assert.match(page, /aria-live="assertive"/);
  assert.match(page, /focus-visible:ring-2/);
  assert.match(shell, /motion-reduce:transition-none/);
});

test("Table and Cards share the filtered ranked dataset without a second data request", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  assert.match(page, /const rankedPeople = useMemo\(\(\) => rankPeople\(people, rankBy\)/);
  assert.match(page, /<TopSalespeople\s+ranked=\{rankedPeople\}/);
  assert.match(page, /view === "cards"/);
  assert.match(page, /ranked\.map\(\(person\) => <SalespersonCard/);
  assert.match(page, /ranked\.map\(\(person\) => \{ const commissionOfGp/);
  assert.equal((page.match(/loadLiveSalesData\(\{ allowFallback: false, companyId \}\)/g) ?? []).length, 1);
});

test("Employee Detail is a local drawer over filtered rows with safe empty states", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  assert.match(page, /function EmployeeDetailDrawer/);
  assert.match(page, /role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(page, /selectedRows = selectedRankedPerson \? activeSales\.filter/);
  assert.match(page, /Monthly Sales Trend/);
  assert.match(page, /aria-label="Sales trend metric"/);
  assert.match(page, /Commission % of Sales/);
  assert.match(page, /Commission \/ GP/);
  assert.match(page, /Recent Sales \(Top 5\)/);
  assert.match(page, /Sales trend data is not available for this view/);
  assert.match(page, /Recent sales data is not available for this view/);
});

test("Photo schema remains unmodified and the UI uses initials when unavailable", async () => {
  const [schema, page] = await Promise.all([
    read("db/schema.ts"),
    read("components/team/sales-organization-page.tsx"),
  ]);

  assert.doesNotMatch(schema, /photo_url/);
  assert.match(page, /function initials/);
  assert.match(page, /photo placeholder/);
});

test("Salesperson target is not inferred from company target", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  assert.match(page, /target: null/);
  assert.match(page, /achievement: null/);
  assert.doesNotMatch(page, /perPersonTarget/);
});

test("Team V3 cards follow the mockup hierarchy and open the drawer from the whole card", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  assert.match(page, /function SalespersonCard/);
  assert.match(page, /<Badge variant=\{person\.status === "active" \? "success" : "outline"\}/);
  assert.match(page, /Showroom · \{person\.branch \|\| "—"\}/);
  assert.match(page, /<Avatar name=\{person\.name\} large \/>/);
  assert.match(page, /aria-label=\{`Open \$\{person\.name\} employee detail`\}/);
  assert.doesNotMatch(page, /View Detail/);
  assert.match(page, /sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4/);
});

test("Team final polish keeps ranking cards dense, icon-led, and N/A-free", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  assert.match(page, /function CardMetric/);
  assert.match(page, /displayValue = value === "N\/A" \? "—" : value/);
  assert.match(page, /size-24 bg-\[var\(--brand-50\)\]/);
  assert.match(page, /min-h-\[300px\].*cursor-pointer/);
  assert.match(page, /BarChart3/);
  assert.match(page, /BadgeDollarSign/);
  assert.match(page, /CircleDollarSign/);
  assert.match(page, /Percent/);
  assert.match(page, /Current employees only · Select a row or card for detail/);
  assert.match(page, /UsersRound/);
  assert.match(page, /CalendarDays/);
  assert.match(page, /\{person\.position && <p/);
});

test("Employee drawer uses the polished KPI grid and responsive width without changing its data source", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  assert.match(page, /function DrawerMetric/);
  assert.match(page, /max-w-\[28rem\]/);
  assert.match(page, /grid-cols-2 gap-2\.5 sm:grid-cols-3/);
  assert.match(page, /selectedRows = selectedRankedPerson \? activeSales\.filter/);
  assert.match(page, /flex h-32 items-end/);
  assert.match(page, /min-w-\[380px\]/);
});

test("Photo upload surfaces are honest and write-disabled while PHOTO_SCHEMA_MISSING", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  assert.match(page, /function BulkPhotoImportButton/);
  assert.match(page, /Bulk Import Photos/);
  assert.match(page, /Upload Photo/);
  assert.match(page, /PHOTO_SCHEMA_MISSING/);
  assert.match(page, /disabled aria-describedby="photo-schema-missing"/);
  assert.doesNotMatch(page, /photo_url.*insert|insert.*photo_url/i);
});

test("Employee drawer exposes only verified profile fields and safe target states", async () => {
  const page = await read("components/team/sales-organization-page.tsx");

  for (const label of ["Employee ID", "Employee Code", "Salesperson Code", "Position", "Showroom", "Branch", "Territory", "Phone", "Email", "Joined Date", "Status", "Target Unit", "Achievement"]) {
    assert.match(page, new RegExp(label.replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&")));
  }
  assert.match(page, /\["Employee ID", "N\/A"\]/);
  assert.match(page, /label="Target Unit" value=\{person\.target === null \? "N\/A"/);
  assert.match(page, /label="Achievement" value=\{person\.achievement === null \? "N\/A"/);
});
