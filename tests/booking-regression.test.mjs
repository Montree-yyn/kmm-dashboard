import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Booking route preserves the existing page component", async () => {
  const route = await read("app/booking/page.tsx");
  assert.match(route, /<BookingIntelligencePage\s*\/>/);
});

test("Booking KPIs remain backed by the existing selectors", async () => {
  const page = await read("components/booking/booking-intelligence-page.tsx");
  assert.match(page, /fetch\("\/dashboard-data\.json"\)/);
  assert.match(page, /getOpenBookingUnit\(data\.booking, filters\)/);
  assert.match(page, /getBookingValue\(data\.booking, filters\)/);
  assert.match(page, /getDepositAmount\(data\.booking, filters\)/);
  assert.match(page, /getAverageBookingAge\(data\.booking, filters\)/);
  assert.match(page, /getBookingConversionRate\(data\.booking, filters\)/);

  for (const title of [
    "bookingUnit",
    "bookingValue",
    "depositReceived",
    "averageBookingAge",
    "bookingConversionRate",
  ]) {
    assert.match(page, new RegExp(`title=\\{t\\("metric\\.${title}"\\)\\}`));
  }
});

test("operational Booking KPIs preserve already-adapted date metadata", async () => {
  const [service, route, client] = await Promise.all([
    read("lib/operations/business-service.ts"),
    read("app/api/operations/route.ts"),
    read("lib/operations/client.ts"),
  ]);

  // The API/client are the sole raw -> BookingAdapterRow boundaries. The
  // operational selector service receives canonical fields such as
  // `{ year: 2026, month: 8 }` and must not adapt them a second time.
  assert.match(service, /getOperationalBusiness\(bookingRows: BookingRow\[\], stockRows: StockRow\[\]/);
  assert.match(service, /const booking = bookingRows;/);
  assert.doesNotMatch(service, /bookingRows\.map\(adaptBookingRow\)/);
  assert.match(route, /getOperationalBusiness\(booking, stock\)/);
  assert.match(client, /getOperationalBusiness\(booking, stock\)/);
  assert.match(service, /raw DB row -> adapter boundary/);
});

test("Booking aging thresholds and status rules are unchanged", async () => {
  const page = await read("components/booking/booking-intelligence-page.tsx");
  assert.match(
    page,
    /return days <= 30[\s\S]*?"Healthy"[\s\S]*?days <= 60[\s\S]*?"Watch"[\s\S]*?days <= 90[\s\S]*?"At Risk"[\s\S]*?"Critical"/,
  );
  for (const range of ["0–30 Days", "31–60 Days", "61–90 Days", ">90 Days"]) {
    assert.match(page, new RegExp(`range: "${range}"`));
  }
});

test("Booking filters keep the four decision-driving dimensions and accessible 44px controls", async () => {
  const [page, controls] = await Promise.all([
    read("components/booking/booking-intelligence-page.tsx"),
    read("components/design-system/data-controls.tsx"),
  ]);
  for (const key of [
    "year",
    "month",
    "branch",
    "bookingStatus",
  ]) {
    assert.match(page, new RegExp(`label=\\{t\\("filter\\.${key}"\\)\\}`));
  }
  assert.doesNotMatch(page, /label=\{t\("filter\.(salesperson|productType)"\)\}/);
  assert.match(page, /import \{ MultiSelectFilter \}/);
  assert.match(controls, /aria-label=\{`\$\{t\("common\.filters"\)\}: \$\{label\}`\}/);
  assert.match(controls, /aria-haspopup="listbox"/);
  assert.match(controls, /if \(event\.key === "Escape"\) setOpen\(false\)/);
  assert.match(controls, /flex h-11 w-full/);
});

test("Booking charts use lifecycle, composition, and aging views without changing source inputs", async () => {
  const page = await read("components/booking/booking-intelligence-page.tsx");
  assert.match(page, /buildMonthlyLifecycle/);
  assert.match(page, /<StackedColumnChart/);
  assert.match(page, /<PercentStackedBar segments=\{statusSegments\}/);
  assert.match(page, /<HeatmapMatrix/);
  assert.match(page, /<BookingBreakdownExplorer datasets=\{breakdownDatasets\}/);
  assert.match(
    page,
    /data\?\.booking[\s\S]*?match\(row, \{ \.\.\.filters, status: \[\] \}\)[\s\S]*?filter\(isUnitProduct\)/,
  );
  for (const key of [
    "bookingStatusTitle",
    "branchBookingRiskTitle",
    "bookingLifecycleTitle",
    "bookingBreakdownTitle",
    "bookingAgingMatrixTitle",
    "managementFollowUpTitle",
  ]) {
    assert.match(page, new RegExp(`title=\\{t\\("chart\\.${key}"\\)\\}`));
  }
  assert.match(page, /title=\{t\("chart\.bookingHealthTitle"\)\}/);
});

test("Booking status and branch risk use only observed, same-unit comparisons", async () => {
  const [page, chartData] = await Promise.all([
    read("components/booking/booking-intelligence-page.tsx"),
    read("components/common/charts/chartData.ts"),
  ]);
  assert.match(page, /const statusSegments = statusBreakdown\.map/);
  assert.match(page, /businessStatusColor\(item\.label, index\)/);
  assert.match(chartData, /status === "delivered"[\s\S]*?#35363A/);
  assert.match(chartData, /status === "cancelled"[\s\S]*?#9B948A/);
  assert.match(chartData, /status === "open"[\s\S]*?#F56600/);
  assert.match(page, /<PercentStackedBar segments=\{statusSegments\}/);
  assert.match(page, /t\("chart\.bookingStatusDescription"\)/);
  assert.match(page, /function BranchRiskComparison/);
  assert.match(page, /t\("chart\.branchBookingRiskDescription"\)/);
  assert.match(page, /criticalShare = item\.open \? \(item\.critical \/ item\.open\) \* 100 : 0/);
  assert.match(page, /maxOpen = Math\.max/);
  assert.match(page, /xl:grid-cols-\[minmax\(130px,1fr\)_minmax\(150px,1\.35fr\)/);
  assert.doesNotMatch(page, /grid-cols-\[190px_minmax\(180px,1fr\)_72px_82px_86px\]/);
  assert.doesNotMatch(page, /Finance Approved/);
  assert.doesNotMatch(page, /Ready for Delivery/);
  assert.doesNotMatch(page, /Not supplied by source/);
});

test("Booking detail table preserves all operational information", async () => {
  const page = await read("components/booking/booking-intelligence-page.tsx");

  for (const column of [
    "Booking Date",
    "Booking No.",
    "Customer",
    "Branch",
    "Salesperson",
    "Product",
    "Model",
    "Payment Type",
    "Booking Value",
    "Deposit",
    "Deposit %",
    "Booking Age",
    "Current Status",
    "Delivery / Cancel Date",
    "Risk Status",
  ]) {
    assert.match(page, new RegExp(`"${column}"`));
  }
  assert.match(page, /ResponsiveDataTable/);
  assert.match(page, /max-h-\[480px\]/);
  assert.match(page, /Math\.ceil\(table\.length \/ 10\)/);
  assert.match(page, /link\.download = `\$\{companyCode\.toLowerCase\(\)\}-booking-detail\.csv`/);
});

test("Booking page follows the Golden Reference presentation contract", async () => {
  const [page, kpiCard] = await Promise.all([
    read("components/booking/booking-intelligence-page.tsx"),
    read("components/design-system/kpi-card.tsx"),
  ]);
  assert.match(
    page,
    /kmm-booking-page min-h-\[calc\(100vh-72px\)\] bg-\[var\(--surface-canvas\)\]/,
  );
  assert.match(page, /<h1[\s\S]*?id="booking-title"/);
  assert.match(page, /import \{ KpiCard \}/);
  assert.match(page, /<KpiCard[\s\S]*?variant="executive"/);
  assert.doesNotMatch(page, /function BookingExecutiveKpiCard/);
  assert.match(kpiCard, /kmm-tabular whitespace-nowrap text-\[32px\]/);
  assert.match(kpiCard, /grid-rows-\[24px_48px_40px_14px\]/);
  for (const zone of ["header", "value", "context", "footer"]) {
    assert.match(kpiCard, new RegExp(`data-kpi-zone="${zone}"`));
  }
  assert.match(kpiCard, /flex-nowrap items-baseline/);
  assert.match(
    page,
    /Booking KPIs[\s\S]*?xl:grid-cols-\[repeat\(5,minmax\(0,1fr\)\)\]/,
  );
  assert.match(page, /aria-busy="true"/);
  assert.match(page, /aria-live="assertive"/);
});
