import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("approved pages share the Golden Reference shell tokens", async () => {
  const [dashboard, marketing, sales, shell] = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("components/marketing/marketing-intelligence-page.tsx"),
    read("components/sales/sales-page.tsx"),
    read("components/layout/global-app-shell.tsx"),
  ]);

  for (const page of [dashboard, marketing, sales]) {
    assert.match(page, /bg-\[var\(--surface-canvas\)\]/);
    assert.match(page, /text-\[var\(--text-primary\)\]/);
    assert.doesNotMatch(page, /bg-\[#EF4444\]/);
  }
  assert.match(shell, /data-global-app-shell/);
});

test("Dashboard and Sales use the same executive page hierarchy", async () => {
  const [dashboard, sales] = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("components/sales/sales-page.tsx"),
  ]);

  for (const page of [dashboard, sales]) {
    assert.match(page, /min-h-\[calc\(100vh-72px\)\]/);
    assert.match(page, /max-w-\[1600px\]/);
    assert.match(page, /p-4 sm:p-5 xl:p-6/);
    assert.match(page, /mb-2 h-1 w-8 rounded-full bg-\[var\(--brand-500\)\]/);
    assert.match(page, /text-\[28px\].*sm:text-\[30px\]/);
    assert.match(page, /repeat\(5,minmax\(0,1fr\)\)/);
  }
});

test("all operational pages use the shared filter presentation", async () => {
  const [filterBar, controls, dashboard, sales, booking, stock] = await Promise.all([
    read("components/design-system/filter-bar.tsx"),
    read("components/design-system/data-controls.tsx"),
    read("components/dashboard/dashboard-page.tsx"),
    read("components/sales/sales-page.tsx"),
    read("components/booking/booking-intelligence-page.tsx"),
    read("components/stock/stock-intelligence-page.tsx"),
  ]);

  assert.match(filterBar, /summary\?: ReactNode/);
  assert.match(filterBar, /filterGridClassName\?: string/);
  assert.match(controls, /export function MultiSelectFilter/);
  assert.match(controls, /aria-haspopup="listbox"/);
  assert.match(controls, /role="listbox"/);
  assert.match(controls, /event\.key === "Escape"/);
  assert.match(controls, /pointerdown/);
  assert.match(controls, /flex h-11 w-full/);
  assert.match(controls, /focus-visible:ring-4/);
  assert.match(controls, /allValues\?: string\[\]/);
  assert.match(controls, /resolvedAllLabel/);
  assert.match(controls, /onChange\(allValues\)/);
  assert.doesNotMatch(controls, /Search year|Search product type|placeholder=\{`Search/);
  assert.match(controls, /activeSelectionCount/);

  for (const page of [dashboard, sales, booking, stock]) {
    assert.match(page, /import \{ FilterBar \}/);
    assert.match(page, /import \{ MultiSelectFilter \}/);
    assert.doesNotMatch(page, /ActiveFilterSummary/);
    assert.doesNotMatch(page, /function (MultiSelectFilter|ActiveFilterSummary|Select|MultiSelect)\(/);
  }
});

test("shared filter presentation preserves page-specific selection contracts", async () => {
  const [dashboard, sales, booking, stock, controls] = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("components/sales/sales-page.tsx"),
    read("components/booking/booking-intelligence-page.tsx"),
    read("components/stock/stock-intelligence-page.tsx"),
    read("components/design-system/data-controls.tsx"),
  ]);

  assert.match(dashboard, /function updateFilter\(key: FilterKey, values: string\[\]\)/);
  assert.match(sales, /key === "branch"/);
  assert.match(sales, /salesperson: \[\]/);
  assert.match(sales, /getNextValues=\{\(option, current\) =>/);
  assert.match(sales, /return next\.length \? next : \["All Products"\]/);
  assert.match(booking, /onChange=\{\(v\) => update\("year", v\)\}/);
  assert.match(stock, /onChange=\{\(values\) => update\("year", values\)\}/);
  assert.match(controls, /clearValues\?: Partial<Record<Key, string\[\]>>/);
});

test("shared states, freshness, and responsive table primitives expose accessible contracts", async () => {
  const [freshness, status, error, loading, empty, table, chart, booking, button, tableCard, filterBar] = await Promise.all([
    read("components/design-system/freshness-indicator.tsx"),
    read("components/design-system/status-message.tsx"),
    read("components/design-system/error-state.tsx"),
    read("components/design-system/loading-skeleton.tsx"),
    read("components/design-system/empty-state.tsx"),
    read("components/design-system/responsive-data-table.tsx"),
    read("components/design-system/chart-card.tsx"),
    read("components/booking/booking-intelligence-page.tsx"),
    read("components/ui/button.tsx"),
    read("components/design-system/table-card.tsx"),
    read("components/design-system/filter-bar.tsx"),
  ]);

  assert.match(freshness, /t\("common\.viewRefreshed"\)/);
  assert.match(freshness, /RelativeTimeFormat/);
  assert.match(status, /status: StatusMessageKind/);
  assert.match(status, /aria-live=\{role === "alert" \? "assertive" : "polite"\}/);
  assert.match(error, /StatusMessage/);
  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /data-loading-variant/);
  assert.match(empty, /role="status"/);
  assert.match(empty, /action\?: ReactNode/);
  assert.match(table, /overflow-x-auto/);
  assert.match(table, /tabIndex=\{0\}/);
  assert.match(booking, /ResponsiveDataTable/);
  assert.match(booking, /ariaLabel="Booking detail table"/);
  assert.match(chart, /toolbar\?: ReactNode/);
  assert.match(chart, /role="region"/);
  assert.match(chart, /data-card-state/);
  assert.match(button, /loading\?: boolean/);
  assert.match(button, /aria-busy=\{loading \|\| undefined\}/);
  assert.match(tableCard, /onRetry\?: \(\) => void/);
  assert.match(tableCard, /aria-labelledby=\{titleId\}/);
  assert.match(filterBar, /role="region"/);
  assert.match(filterBar, /data-filter-bar/);
});

test("Dashboard and Sales analytics share card and chart contracts", async () => {
  const [dashboard, sales, kpiCard] = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("components/sales/sales-page.tsx"),
    read("components/design-system/kpi-card.tsx"),
  ]);

  for (const page of [dashboard, sales]) {
    assert.match(page, /import \{ KpiCard \}/);
    assert.match(page, /<KpiCard[\s\S]*?variant="executive"/);
    assert.match(page, /\[&>header_button\]:!h-11/);
    assert.match(page, /\[&>header_select\]:!h-11/);
    assert.match(page, /aria-live="assertive"/);
  }
  assert.match(kpiCard, /min-h-\[160px\]/);
  assert.match(kpiCard, /shadow-\[var\(--shadow-card\)\]/);
  assert.match(kpiCard, /hover:shadow-\[var\(--shadow-hover\)\]/);
});

test("project charts preserve the approved color conditions", async () => {
  const [theme, globals, dashboard, stock, booking, chartData] = await Promise.all([
    read("components/common/charts/chartTheme.ts"),
    read("app/globals.css"),
    read("components/dashboard/dashboard-page.tsx"),
    read("components/stock/stock-intelligence-page.tsx"),
    read("components/booking/booking-intelligence-page.tsx"),
    read("components/common/charts/chartData.ts"),
  ]);

  assert.match(theme, /current: "#F97316"/);
  assert.match(theme, /previous: "#FBBF24"/);
  assert.match(theme, /older: \["#FFD54F", "#FFE082", "#FFECB3"\]/);
  assert.match(theme, /target: "#9CA3AF"/);
  assert.match(globals, /--chart-current: #f56600/);
  assert.match(globals, /--chart-previous: #f7a35c/);
  assert.match(globals, /--chart-neutral: #86868b/);
  assert.match(globals, /--chart-ink: #35363a/);
  assert.match(globals, /--chart-warm-gray: #9b948a/);
  for (const page of [dashboard, stock]) {
    assert.match(page, /TT: "#F56600"[\s\S]*?CH: "#35363A"[\s\S]*?EX: "#86868B"[\s\S]*?TP: "#B6B7BA"[\s\S]*?MAX: "#245487"/);
  }
  assert.match(booking, /businessStatusColor\(item\.label, index\)/);
  assert.match(chartData, /status === "delivered"[\s\S]*?#35363A[\s\S]*?status === "cancelled"[\s\S]*?#9B948A[\s\S]*?status === "open"[\s\S]*?#F56600/);
});

test("Sprint 4 page refinement keeps an executive hierarchy without changing data contracts", async () => {
  const [dashboard, sales, booking, stock] = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("components/sales/sales-page.tsx"),
    read("components/booking/booking-intelligence-page.tsx"),
    read("components/stock/stock-intelligence-page.tsx"),
  ]);

  assert.match(dashboard, /aria-labelledby="dashboard-primary-trend"/);
  assert.match(dashboard, /t\("section\.salesTrajectory"\)/);
  assert.match(dashboard, /t\("section\.rankingsMix"\)/);
  assert.match(dashboard, /height=\{460\}/);

  assert.match(sales, /t\("section\.salesTrajectory"\)/);
  assert.match(sales, /t\("section\.rankingsMix"\)/);
  assert.match(sales, /t\("section\.transactions"\)/);
  assert.match(sales, /<ResponsiveDataTable/);
  assert.match(sales, /ariaLabel="Sales transaction table"/);

  assert.match(booking, /aria-labelledby="booking-observed-pipeline"/);
  assert.match(booking, /t\("filter\.bookingStatus"\)/);
  assert.match(booking, /t\("chart\.branchBookingRiskTitle"\)/);
  assert.doesNotMatch(booking, /Not supplied by source/);
  assert.match(booking, /aria-labelledby="booking-secondary-analysis"/);

  assert.match(stock, /aria-labelledby="stock-risk-overview"/);
  assert.match(stock, /aria-labelledby="stock-coverage-analysis"/);
  assert.match(stock, /aria-label="Stock age legend"/);
  assert.match(stock, /t\("chart\.stockVsBookingTitle"\)/);
  assert.match(stock, /branchCards\.map/);
  assert.match(stock, /aria-labelledby="stock-secondary-analysis"/);

  for (const page of [dashboard, sales, booking, stock]) {
    assert.match(page, /FreshnessIndicator/);
    assert.doesNotMatch(page, /ActiveFilterSummary/);
    assert.match(page, /sm:/);
    assert.match(page, /xl:/);
  }
});

test("Marketing retains the approved compact workspace exception", async () => {
  const marketing = await read(
    "components/marketing/marketing-intelligence-page.tsx",
  );

  assert.match(marketing, /data-marketing-workspace="true"/);
  assert.match(marketing, /h-\[calc\(100vh-72px\)\]/);
  assert.match(marketing, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.match(marketing, /inline-flex h-14 min-w-\[132px\]/);
  assert.match(marketing, /kmm-compare-control inline-flex h-14/);
  assert.match(marketing, /transition-\[border-color,background-color\]/);
});

test("Design V3.3 keeps glass selective and Dashboard actions source-backed", async () => {
  const [globals, dashboard, chart, header, search, kpi] = await Promise.all([
    read("app/globals.css"),
    read("components/dashboard/dashboard-page.tsx"),
    read("components/common/charts/StandardLineChart.tsx"),
    read("components/layout/global-header.tsx"),
    read("components/navigation/global-navigation-search.tsx"),
    read("components/design-system/kpi-card.tsx"),
  ]);

  assert.match(globals, /\.kmm-glass-bar/);
  assert.match(globals, /\.kmm-data-surface/);
  assert.match(header, /<GlobalNavigationSearch/);
  assert.match(search, /visibleNavigationItems/);
  assert.match(dashboard, /AttentionPanel/);
  assert.match(dashboard, /t\("dashboard\.agedStockReview"\)/);
  assert.match(dashboard, /RecentActivityTable/);
  assert.doesNotMatch(dashboard, /Overdue bookings/i);
  assert.match(chart, /visualStyle\?: "classic" \| "precision"/);
  assert.match(chart, /tabIndex=\{0\}/);
  assert.match(kpi, /featured\?: boolean/);
  assert.match(kpi, /sparklineValues\?: number\[\]/);
});
