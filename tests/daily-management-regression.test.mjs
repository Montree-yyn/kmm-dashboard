import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const daily = await tsImport("../lib/daily-management/business-service.ts", import.meta.url);

const salesRow = ({ date, branch = "KMM01", salesperson = "Aung", model = "M7040", quantity = 1 }) => ({
  id: `${date}-${branch}-${salesperson}-${model}`,
  date,
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
  branch,
  salesperson,
  salespersonCode: null,
  employeeCode: "",
  productType: "TT",
  model,
  modelCode: model,
  quantity,
  saleAmount: 0,
  finalReceived: null,
  netReceived: null,
  gp1: null,
  expense: null,
});

const bookingRow = ({ date, branch = "KMM01", salesperson = "Aung", model = "M7040", purchaseStatus = "A HOT" }) => ({
  date,
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
  branch,
  salesperson,
  productType: "TT",
  model,
  price: null,
  bookingNo: `${date}-${model}`,
  customer: "Customer",
  deposit: null,
  paymentType: "",
  financeType: "",
  purchaseStatus,
  statusDate: date,
  status: "Open",
});

const stockRow = ({ branch = "KMM01", model = "M7040", ageDays = 40, msrp = 100 }) => ({
  date: "2026-08-01",
  year: 2026,
  month: 8,
  branch,
  salesperson: "",
  kmm: 1,
  productType: "TT",
  productGroup: "TT",
  model,
  ageBucket: "31–60",
  ageDays,
  snapshotDate: "2026-08-09",
  msrp,
  stockId: `${branch}-${model}-${ageDays}`,
  serialNumber: null,
  engineNumber: `${branch}-${model}-${ageDays}`,
  chassisNumber: null,
  currentStatus: "Free Stock",
});

test("Daily Management uses selected-date Sales, MTD and current operational snapshots", () => {
  const snapshot = daily.buildDailyManagementSnapshot({
    sales: [
      salesRow({ date: "2026-08-01", quantity: 2 }),
      salesRow({ date: "2026-08-09", quantity: 1 }),
      salesRow({ date: "2026-08-09", branch: "KMM02", salesperson: "Than", model: "DC70G", quantity: 3 }),
      salesRow({ date: "2026-07-31", quantity: 9 }),
    ],
    booking: [
      bookingRow({ date: "2026-08-09", purchaseStatus: "A HOT" }),
      bookingRow({ date: "2026-08-08", branch: "KMM02", model: "DC70G", purchaseStatus: "B HOT" }),
    ],
    stock: [
      stockRow({ ageDays: 40 }),
      stockRow({ branch: "KMM02", model: "DC70G", ageDays: 120, msrp: 200 }),
    ],
  }, { asOfDate: "2026-08-09" });

  assert.equal(snapshot.sales.todayUnits, 4);
  assert.equal(snapshot.sales.mtdUnits, 6);
  assert.deepEqual(snapshot.sales.byBranch, [{ branch: "KMM01", units: 3 }, { branch: "KMM02", units: 3 }]);
  assert.equal(snapshot.booking.newToday, 1);
  assert.equal(snapshot.booking.activeUnits, 2);
  assert.equal(snapshot.booking.aHot, 1);
  assert.equal(snapshot.booking.bHot, 1);
  assert.equal(snapshot.stock.engineUnits, 2);
  assert.equal(snapshot.stock.value, 300);
  assert.equal(snapshot.stock.aging.find((row) => row.label === ">90").units, 1);
});

test("Daily Management branch scope and unavailable management fields stay explicit", () => {
  const snapshot = daily.buildDailyManagementSnapshot({
    sales: [salesRow({ date: "2026-08-09" }), salesRow({ date: "2026-08-09", branch: "KMM02" })],
    booking: [bookingRow({ date: "2026-08-09" }), bookingRow({ date: "2026-08-09", branch: "KMM02" })],
    stock: [stockRow({}), stockRow({ branch: "KMM02" })],
  }, { asOfDate: "2026-08-09", branch: "KMM02" });

  assert.equal(snapshot.scope.branch, "KMM02");
  assert.equal(snapshot.sales.todayUnits, 1);
  assert.equal(snapshot.booking.newToday, 1);
  assert.equal(snapshot.stock.engineUnits, 1);
  assert.equal(snapshot.availability.target.available, false);
  assert.equal(snapshot.availability.cancelReason.available, false);
  assert.equal(snapshot.availability.stockLocation.available, false);
  assert.equal(snapshot.availability.actions.available, false);
  assert.equal(snapshot.availability.notes.available, false);
});

test("Daily Management groups DC70G PRO spelling variants under one canonical model", () => {
  const snapshot = daily.buildDailyManagementSnapshot({
    sales: [],
    booking: [
      bookingRow({ date: "2026-08-09", model: "DC70G PRO", purchaseStatus: "A HOT" }),
      bookingRow({ date: "2026-08-09", model: "DC-70G PRO", purchaseStatus: "B HOT" }),
    ],
    stock: [
      stockRow({ model: "DC70G PRO", ageDays: 10 }),
      stockRow({ model: "DC-70G PRO", ageDays: 20 }),
    ],
  }, { asOfDate: "2026-08-09" });

  assert.equal(daily.canonicalDailyModel("DC-70G PRO"), "DC70G PRO");
  assert.equal(daily.canonicalDailyModel("DC70G PRO"), "DC70G PRO");
  assert.deepEqual(snapshot.bookingStock, [{
    model: "DC70G PRO",
    activeBooking: 2,
    stock: 2,
    coverageMonths: 1,
    signal: "balanced",
  }]);
  assert.deepEqual(new Set(snapshot.booking.today.map((row) => row.model)), new Set(["DC70G PRO"]));
});

test("Daily Management route, feature flag and page remain read-only", async () => {
  const [route, page, client, feature, navigation, shell] = await Promise.all([
    read("app/api/daily-management/route.ts"),
    read("components/daily-management/daily-management-page.tsx"),
    read("lib/daily-management/client.ts"),
    read("lib/features.ts"),
    read("components/navigation/navigation-config.ts"),
    read("components/layout/global-app-shell.tsx"),
  ]);
  assert.match(route, /verifyFirebaseRequest/);
  assert.match(route, /listSalesTransactions/);
  assert.match(route, /listBookingTransactions/);
  assert.match(route, /listStockTransactions/);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(client, /\/api\/daily-management/);
  assert.match(feature, /NEXT_PUBLIC_DAILY_MANAGEMENT_REPORT/);
  assert.match(navigation, /Daily Report/);
  assert.match(shell, /daily-management/);
  assert.match(page, /Phase 1 Data Readiness/);
  assert.match(page, /Waiting for governed source/);
  assert.doesNotMatch(page, /12,983|Sales Today[^\n]*3 Units/);
});
