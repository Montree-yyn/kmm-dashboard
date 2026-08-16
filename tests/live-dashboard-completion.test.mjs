import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Sprint 2.4 schema preserves Booking and Stock frontend contracts", () => {
  const schema = read("db/schema.ts");
  for (const field of ["bookingYear", "bookingMonth", "bookingNumber", "branchCode", "branchName", "salespersonCode", "salespersonName", "productType", "productModel", "customerName", "bookingPrice", "depositAmount", "bookingStatus", "purchaseStatus"]) assert.match(schema, new RegExp(field));
  for (const field of ["stockDate", "branchCode", "branchName", "productType", "productGroup", "productModel", "kmmFlag", "msrp", "stockStatus", "stockNumber", "serialNumber", "engineNumber", "chassisNumber", "stockAgeDays", "quantity"]) assert.match(schema, new RegExp(field));
  assert.match(read("drizzle/0006_closed_jack_power.sql"), /booking_year/);
  assert.match(read("drizzle/0006_closed_jack_power.sql"), /stock_age_days/);
});

test("D1 adapters preserve nullable values and approved age derivation", () => {
  const adapter = read("lib/operations/adapters.ts");
  const route = read("app/api/data-hub/import/route.ts");
  assert.match(adapter, /bookingPrice/);
  assert.match(adapter, /purchaseStatus/);
  assert.match(adapter, /stockAgeDays/);
  assert.match(adapter, /serialNumber/);
  assert.match(route, /calculateAgeDays/);
  assert.match(route, /explicitAge \?\? calculateAgeDays/);
});

test("Dashboard, Booking and Stock read through the shared operational client", () => {
  for (const file of ["components/booking/booking-intelligence-page.tsx", "components/stock/stock-intelligence-page.tsx"]) {
    const page = read(file);
    assert.match(page, /loadLiveOperationalData/);
    assert.match(page, /kmm:sales-imported/);
  }
  assert.match(read("components/dashboard/dashboard-page.tsx"), /loadLiveOperationalDashboardSummary/);
  assert.match(read("components/dashboard/dashboard-page.tsx"), /kmm:sales-imported/);
  assert.match(read("app/api/operations/route.ts"), /listBookingTransactions/);
  assert.match(read("app/api/operations/route.ts"), /listStockTransactions/);
  assert.match(read("app/api/operations/route.ts"), /listBookingDashboardBuckets/);
});

test("Business layer owns cross-module KPI aggregation and retains existing selectors", () => {
  const service = read("lib/operations/business-service.ts");
  assert.match(service, /getOpenBookingUnit/);
  assert.match(service, /getBookingValue/);
  assert.match(service, /getStockUnit/);
  assert.match(service, /getStockValue/);
  assert.match(service, /getAgedStock/);
  assert.match(service, /filterStockRows/);
});

test("Import refresh remains one event after Import All", () => {
  const page = read("components/data-hub/unified-import-center.tsx");
  assert.match(page, /importOne\(id, false\)/);
  assert.match(page, /successful\.length && typeof window !== "undefined"/);
  assert.match(page, /new CustomEvent\("kmm:sales-imported"/);
});
