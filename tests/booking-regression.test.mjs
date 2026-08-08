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
    "Open Booking Unit",
    "Booking Value",
    "Deposit Received",
    "Average Booking Age",
    "Booking Conversion Rate",
  ]) {
    assert.match(page, new RegExp(`title="${title}"`));
  }
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

test("Booking filters retain all dimensions and accessible 44px controls", async () => {
  const [page, controls] = await Promise.all([
    read("components/booking/booking-intelligence-page.tsx"),
    read("components/design-system/data-controls.tsx"),
  ]);
  for (const label of [
    "Year",
    "Month",
    "Branch",
    "Salesperson",
    "Product Type",
    "Booking Status",
  ]) {
    assert.match(page, new RegExp(`label="${label}"`));
  }
  assert.match(page, /import \{ ActiveFilterSummary, MultiSelectFilter \}/);
  assert.match(controls, /aria-label=\{`\$\{label\} filter`\}/);
  assert.match(controls, /aria-haspopup="listbox"/);
  assert.match(controls, /if \(event\.key === "Escape"\) setOpen\(false\)/);
  assert.match(controls, /flex h-11 w-full/);
});

test("Booking charts preserve their existing library and data inputs", async () => {
  const page = await read("components/booking/booking-intelligence-page.tsx");
  assert.match(page, /<PremiumTrendChart/);
  assert.match(page, /series=\{series\}/);
  assert.match(
    page,
    /data\.booking[\s\S]*?match\(r, \{ \.\.\.filters, status: \[\] \}\)[\s\S]*?filter\(isUnitProduct\)/,
  );
  for (const title of [
    "Booking Health Summary",
    "Booking Funnel",
    "Booking by Product",
    "Top 10 Model",
    "Top 10 Salesperson",
    "Booking by Payment / Finance Type",
    "Booking Aging Matrix",
    "Management Follow-up",
  ]) {
    assert.match(page, new RegExp(`title="${title}"`));
  }
});

test("Booking funnel and detail table preserve all operational information", async () => {
  const page = await read("components/booking/booking-intelligence-page.tsx");
  for (const stage of [
    "Booking",
    "Deposit",
    "Finance Approved",
    "Ready for Delivery",
    "Delivered",
  ]) {
    assert.match(page, new RegExp(`"${stage}"`));
  }

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
  assert.match(page, /link\.download = "kmm-booking-detail\.csv"/);
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
