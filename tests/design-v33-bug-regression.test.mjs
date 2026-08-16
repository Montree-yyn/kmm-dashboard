import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Dashboard V3.3 keeps comparisons truthful and prevents stale cross-company rendering", async () => {
  const dashboard = await read("components/dashboard/dashboard-page.tsx");

  assert.match(dashboard, /const comparisonEnabled = years\.length === 1/);
  assert.match(dashboard, /t\("dashboard\.selectOneYearForYoy"\)/);
  assert.doesNotMatch(dashboard, /vs same period last year/);
  assert.doesNotMatch(dashboard, /Sales delivery:/);
  assert.match(dashboard, /status: ""/);
  assert.match(dashboard, /dashboardState\.companyId === companyId/);
  assert.match(dashboard, /filterSnapshot\.companyId === companyId/);
  assert.match(dashboard, /availableYears\.slice\(0, 2\)\.map\(String\)/);
});

test("V3.3 compact filters expose All without search, refresh, or active-filter clutter", async () => {
  const [controls, filterBar, dashboard, sales, booking, stock, search] = await Promise.all([
    read("components/design-system/data-controls.tsx"),
    read("components/design-system/filter-bar.tsx"),
    read("components/dashboard/dashboard-page.tsx"),
    read("components/sales/sales-page.tsx"),
    read("components/booking/booking-intelligence-page.tsx"),
    read("components/stock/stock-intelligence-page.tsx"),
    read("components/navigation/global-navigation-search.tsx"),
  ]);

  assert.match(controls, /allValues\?: string\[\]/);
  assert.match(controls, /onChange\(allValues\)/);
  assert.match(controls, /bg-\[var\(--surface-default\)\]/);
  assert.match(controls, /z-\[80\]/);
  assert.doesNotMatch(controls, /type="search"|Search year|Search product/);
  assert.match(filterBar, /relative z-20 overflow-visible/);
  assert.match(search, /max-w-\[520px\]/);
  assert.match(search, /bg-\[var\(--surface-default\)\]/);

  for (const page of [dashboard, sales, booking, stock]) {
    assert.doesNotMatch(page, /ActiveFilterSummary/);
    assert.doesNotMatch(page, /RefreshCw/);
  }
  assert.match(dashboard, /sm:grid-cols-3 xl:grid-cols-3/);
  for (const page of [sales, booking, stock]) assert.match(page, /xl:grid-cols-4/);
});

test("Operational Dashboard filters Booking and Stock by salesperson", async () => {
  const { getOperationalBusiness } = await tsImport(
    "../lib/operations/business-service.ts",
    import.meta.url,
  );
  const booking = ["Alice", "Bob"].map((salesperson, index) => ({
    date: `2026-08-0${index + 1}`,
    year: 2026,
    month: 8,
    branch: "KM01",
    salesperson,
    productType: "TT",
    model: "M7040",
    price: 100,
    deposit: 10,
    purchaseStatus: "A HOT",
    status: "Open",
  }));
  const stock = ["Alice", "Bob"].map((salesperson, index) => ({
    companyId: "KM-COMPANY",
    date: `2026-08-0${index + 1}`,
    year: 2026,
    month: 8,
    branch: "KM01",
    salesperson,
    productType: "TT",
    productGroup: "TT",
    model: "M7040",
    currentStatus: "FREE STOCK",
    stockId: `STOCK-${index + 1}`,
    msrp: 200,
  }));

  const result = getOperationalBusiness(booking, stock, {
    salesperson: ["Alice"],
  });

  assert.equal(result.booking.unit, 1);
  assert.equal(result.booking.byProduct.find((row) => row.product === "TT").unit, 1);
  assert.equal(result.stock.unit, 1);
  assert.equal(result.stock.byProduct.find((row) => row.product === "TT").unit, 1);
});

test("V3.3 header, search, charts, and text tokens preserve accessible behavior", async () => {
  const [globals, header, search, chart] = await Promise.all([
    read("app/globals.css"),
    read("components/layout/global-header.tsx"),
    read("components/navigation/global-navigation-search.tsx"),
    read("components/common/charts/StandardLineChart.tsx"),
  ]);

  assert.match(globals, /--text-tertiary: #9ca3af/);
  assert.match(header, /xl:hidden/);
  assert.match(header, /xl:flex/);
  assert.doesNotMatch(header, /common\.openNotifications/);
  assert.doesNotMatch(header, /common\.openProfileMenu/);
  for (const key of ["ArrowDown", "ArrowUp", "Enter", "aria-activedescendant"]) {
    assert.match(search, new RegExp(key));
  }
  assert.match(chart, /role="img"/);
  assert.doesNotMatch(chart, /role="button"/);
});
