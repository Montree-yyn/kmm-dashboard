import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared KPI Card exposes the approved executive API and fixed zones", async () => {
  const card = await read("components/design-system/kpi-card.tsx");

  for (const prop of [
    "title",
    "value",
    "unit",
    "subtitle",
    "trendValue",
    "trendDirection",
    "comparisonLabel",
    "icon",
    "footer",
    "status",
    "loading",
    "empty",
    "className",
  ]) {
    assert.match(card, new RegExp(`\\b${prop}\\??:`));
  }

  assert.match(card, /grid-rows-\[24px_48px_40px_14px\]/);
  for (const zone of ["header", "value", "context", "footer"]) {
    assert.match(card, new RegExp(`data-kpi-zone="${zone}"`));
  }
  assert.match(card, /flex-nowrap items-baseline/);
  assert.match(card, /kmm-tabular whitespace-nowrap text-\[32px\]/);
});

test("shared KPI Card renders semantic trend, loading, and empty states", async () => {
  const card = await read("components/design-system/kpi-card.tsx");
  assert.match(card, /ArrowUpRight/);
  assert.match(card, /ArrowDownRight/);
  assert.match(card, /aria-busy=\{loading \|\| undefined\}/);
  assert.match(card, /aria-label=\{`Loading \$\{title\}`\}/);
  assert.match(card, /No data available/);
  assert.match(card, /data-kpi-status=\{status\}/);
});

test("Dashboard, Sales, and Booking use only the shared executive KPI Card", async () => {
  const pages = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("components/sales/sales-page.tsx"),
    read("components/booking/booking-intelligence-page.tsx"),
  ]);

  for (const page of pages) {
    assert.match(page, /import \{ KpiCard \}/);
    assert.match(page, /<KpiCard[\s\S]*?variant="executive"/);
    assert.doesNotMatch(
      page,
      /function (?:ExecutiveKpiCard|SalesExecutiveKpiCard|BookingExecutiveKpiCard)/,
    );
  }
});

test("approved KPI labels remain unchanged after migration", async () => {
  const [dashboard, sales, booking] = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("components/sales/sales-page.tsx"),
    read("components/booking/booking-intelligence-page.tsx"),
  ]);

  for (const label of [
    "Sales Unit",
    "Sales Value",
    "Gross Profit",
    "Open Booking Unit",
    "Stock Unit",
  ]) {
    assert.match(dashboard, new RegExp(`title="${label}"`));
  }
  for (const label of [
    "Sales Unit",
    "Sales Value",
    "Gross Profit",
    "Achievement",
    "Average Selling Price \\(ASP\\)",
  ]) {
    assert.match(sales, new RegExp(`title="${label}"`));
  }
  for (const label of [
    "Open Booking Unit",
    "Booking Value",
    "Deposit Received",
    "Average Booking Age",
    "Booking Conversion Rate",
  ]) {
    assert.match(booking, new RegExp(`title="${label}"`));
  }
});

test("existing selectors and calculations remain attached to KPI props", async () => {
  const [dashboard, sales, booking] = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("components/sales/sales-page.tsx"),
    read("components/booking/booking-intelligence-page.tsx"),
  ]);

  assert.match(dashboard, /getOpenBookingUnit\(data\.booking, filters\)/);
  assert.match(dashboard, /getStockUnit\(currentStock\)/);
  assert.match(sales, /const achievement =/);
  assert.match(sales, /const asp = getSalesAsp/);
  assert.match(booking, /getOpenBookingUnit\(data\.booking, filters\)/);
  assert.match(booking, /getBookingConversionRate\(data\.booking, filters\)/);
});

test("Stock and Sales Organization are executive while legacy compatibility remains available", async () => {
  const [card, stock, team] = await Promise.all([
    read("components/design-system/kpi-card.tsx"),
    read("components/stock/stock-intelligence-page.tsx"),
    read("components/team/sales-organization-page.tsx"),
  ]);

  assert.match(card, /variant = "legacy"/);
  assert.match(card, /function LegacyKpiCard/);
  assert.match(stock, /variant="executive"/);
  assert.match(team, /variant="executive"/);
});
