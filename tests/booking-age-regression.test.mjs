import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("bookingAge and getAverageBookingAge require a caller-supplied asOf date (no frozen default)", async () => {
  const source = await read("lib/dashboard/booking-selectors.ts");
  assert.match(source, /bookingAge\(row: BookingRow, asOf: Date\)/);
  assert.match(source, /getAverageBookingAge<T extends BookingRow>\(rows: T\[\], filters: BookingFilters = \{\}, asOf: Date\)/);
  assert.doesNotMatch(source, /2026-07-11/);
});

test("bookingAge measures age in whole days against the supplied asOf", async () => {
  const { bookingAge } = await tsImport("../lib/dashboard/booking-selectors.ts", import.meta.url);
  const row = (date) => ({ date, status: "Open" });
  const asOf = new Date("2026-08-15T00:00:00");
  assert.equal(bookingAge(row("2026-08-15"), asOf), 0);
  assert.equal(bookingAge(row("2026-07-15"), asOf), 31);
  assert.equal(bookingAge(row("2026-05-17"), asOf), 90);
  assert.equal(bookingAge(row("2026-05-15"), asOf), 92);
  assert.equal(bookingAge(row("2026-08-16"), asOf), 0); // future date clamps to 0
  assert.equal(bookingAge(row(""), asOf), 0); // invalid date is safe
});

test("getAverageBookingAge averages open rows against the supplied asOf", async () => {
  const { getAverageBookingAge } = await tsImport("../lib/dashboard/booking-selectors.ts", import.meta.url);
  const asOf = new Date("2026-08-15T00:00:00");
  const rows = [
    { date: "2026-08-15", status: "Open", productType: "TT", purchaseStatus: "A HOT" },
    { date: "2026-07-16", status: "Open", productType: "TT", purchaseStatus: "A HOT" },
  ];
  assert.equal(getAverageBookingAge(rows, {}, asOf), 15); // (0 + 30) / 2
  assert.equal(getAverageBookingAge([], {}, asOf), null);
});

test("operations API supplies the company-timezone asOf used for booking age", async () => {
  const [route, client] = await Promise.all([
    read("app/api/operations/route.ts"),
    read("lib/operations/client.ts"),
  ]);
  assert.match(route, /timeZone: context\.timeZone/);
  assert.match(route, /asOf,/);
  assert.match(client, /asOf: string/);
  // The API and client parse the payload date through the single shared helper.
  assert.match(route, /asOfDate\(asOf\)/);
  assert.match(client, /asOfDate\(asOf\)/);
});

test("asOfDate parses the payload date as local midnight (single shared helper)", async () => {
  const { asOfDate } = await tsImport("../lib/operations/as-of.ts", import.meta.url);
  const parsed = asOfDate("2026-08-15");
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 7); // August
  assert.equal(parsed.getDate(), 15);
  assert.equal(parsed.getHours(), 0);
  assert.equal(parsed.getMinutes(), 0);
  assert.equal(asOfDate("2026-07-11").getDate(), 11);
});

test("Dashboard, Booking and Stock pages measure age against the payload asOf via the shared helper", async () => {
  const [dashboard, stock, booking] = await Promise.all([
    read("components/dashboard/dashboard-page.tsx"),
    read("components/stock/stock-intelligence-page.tsx"),
    read("components/booking/booking-intelligence-page.tsx"),
  ]);
  // Each page stores the server-supplied asOf in its data state and parses
  // it through the single shared helper.
  assert.match(dashboard, /asOf: liveOperations\.asOf/);
  assert.match(stock, /asOf: value\.asOf/);
  assert.match(booking, /asOf: value\.asOf/);
  for (const page of [dashboard, stock, booking]) {
    assert.match(page, /import \{ asOfDate \} from "\.\.\/\.\.\/lib\/operations\/as-of"/);
  }
  assert.match(dashboard, /stockSummary: liveOperations\.stockSummary/);
  assert.match(stock, /getOperationalBusiness\(\[\], data\.stock, \{[^}]*\}, \{ asOf: asOfDate\(data\.asOf\) \}\)\.stock/);
  assert.match(booking, /getOperationalBusiness\(data\.booking, \[\], filters, \{ asOf \}\)/);
  assert.match(booking, /const asOf = data \? asOfDate\(data\.asOf\) : new Date\(\)/);
  // No page recomputes with a bare evaluation-time date anymore.
  assert.doesNotMatch(dashboard, /getOperationalBusiness\(data\.booking, data\.stock, \{[^}]*\}\)/);
  assert.doesNotMatch(stock, /getOperationalBusiness\(\[\], data\.stock, \{[^}]*\}\)\.stock/);
});

