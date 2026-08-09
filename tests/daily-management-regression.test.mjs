import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";
import * as XLSX from "@e965/xlsx";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const daily = await tsImport("../lib/daily-management/business-service.ts", import.meta.url);
const inputParser = await tsImport("../lib/daily-management/parse-input-workbook.ts", import.meta.url);
const inputStore = await tsImport("../lib/daily-management/input-storage.ts", import.meta.url);

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

test("Daily Management accepts its real Excel template and redirects Booking workbooks to Data Hub", async () => {
  const templateBytes = await readFile(new URL("../public/KMM_Daily_Management_Input_Template.xlsx", import.meta.url));
  const template = new File([templateBytes], "KMM_Daily_Management_Input_Template.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const parsed = await inputParser.parseDailyManagementWorkbook(template, inputStore.defaultDailyManagementInput);
  assert.equal(parsed.counts.dailyRows, 1);
  assert.equal(parsed.counts.actions, 3);
  assert.equal(parsed.counts.notes, 6);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["No.BK", "Dealer", "CS NAME", "Purchase Status"],
    ["BK-001", "KMM01", "Customer", "A HOT"],
  ]), "Booking Data");
  const bookingBytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const bookingFile = new File([bookingBytes], "KMM_Booking_2026.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  await assert.rejects(
    inputParser.parseDailyManagementWorkbook(bookingFile, inputStore.defaultDailyManagementInput),
    /ไฟล์นี้เป็น Booking Data · กรุณาอัปโหลดที่ Data Hub > Booking/,
  );
});

test("Daily Management report stays read-only while governed inputs persist to D1", async () => {
  const [route, inputApi, templateRoute, page, inputRoute, inputPage, inputStorage, inputClient, inputWorkbook, mockData, client, feature, navigation, shell, schema] = await Promise.all([
    read("app/api/daily-management/route.ts"),
    read("app/api/daily-management/input/route.ts"),
    read("app/api/daily-management/template/route.ts"),
    read("components/daily-management/daily-management-page.tsx"),
    read("app/daily-management/input/page.tsx"),
    read("components/daily-management/daily-management-input-page.tsx"),
    read("lib/daily-management/input-storage.ts"),
    read("lib/daily-management/input-client.ts"),
    read("lib/daily-management/parse-input-workbook.ts"),
    read("lib/daily-management/mock-data.ts"),
    read("lib/daily-management/client.ts"),
    read("lib/features.ts"),
    read("components/navigation/navigation-config.ts"),
    read("components/layout/global-app-shell.tsx"),
    read("db/schema.ts"),
  ]);
  assert.match(route, /verifyFirebaseRequest/);
  assert.match(route, /listSalesTransactions/);
  assert.match(route, /listBookingTransactions/);
  assert.match(route, /listStockTransactions/);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(inputApi, /verifyFirebaseRequest/);
  assert.match(inputApi, /dailyManagementInputs/);
  assert.match(inputApi, /onConflictDoUpdate/);
  assert.match(inputApi, /mode === "publish"/);
  assert.match(templateRoute, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(templateRoute, /Content-Disposition/);
  assert.match(client, /\/api\/daily-management/);
  assert.match(feature, /NEXT_PUBLIC_DAILY_MANAGEMENT_REPORT/);
  assert.match(navigation, /Daily Report/);
  assert.match(shell, /daily-management/);
  assert.match(page, /Live · D1 Data/);
  assert.match(page, /xl:grid-cols-6/);
  assert.match(page, /item\.key !== "stockValue"/);
  assert.match(page, /Branch achievement/);
  assert.doesNotMatch(page, /PerformerList title="Need Attention"/);
  assert.match(page, /xl:grid-cols-\[1\.35fr_0\.65fr\]/);
  assert.match(page, /xl:grid-cols-\[1\.18fr_0\.82fr\]/);
  assert.match(page, /91\+ Days/);
  assert.match(page, /Booking pipeline distribution/);
  assert.doesNotMatch(page, /overflow-x-auto|min-w-\[/);
  assert.match(page, /\/daily-management\/input/);
  assert.match(page, /loadPublishedDailyManagementInput/);
  assert.match(page, /loadDailyManagementInput\("published"/);
  assert.match(page, /loadDailyManagementReport/);
  assert.match(page, /Cancellation Today/);
  assert.match(mockData, /DC70G PRO/);
  assert.doesNotMatch(mockData, /DC-70G PRO/);
  assert.match(mockData, /Wait Approve/);
  assert.match(mockData, /Wait Delivery/);
  assert.match(inputRoute, /DAILY_MANAGEMENT_REPORT_ENABLED/);
  assert.match(inputPage, /daily\.downloadTemplate/);
  assert.match(inputPage, /\/api\/daily-management\/template/);
  assert.match(inputPage, /daily\.dropExcel/);
  assert.match(inputPage, /daily\.openDataHub/);
  assert.match(inputPage, /role="alert"/);
  assert.match(inputPage, /daily\.webForm/);
  assert.match(inputPage, /daily\.addAction/);
  assert.match(inputPage, /daily\.importExcel/);
  assert.match(inputPage, /parseDailyManagementWorkbook/);
  assert.match(inputPage, /common\.saveDraft/);
  assert.match(inputPage, /daily\.publishReport/);
  assert.match(inputPage, /persistDailyManagementInput/);
  assert.match(inputWorkbook, /Daily Input/);
  assert.match(inputWorkbook, /Actions/);
  assert.match(inputWorkbook, /Notes/);
  assert.match(inputWorkbook, /MAX_FILE_SIZE/);
  assert.match(inputWorkbook, /ไฟล์นี้เป็น \$\{transactionType\} Data/);
  assert.match(inputStorage, /localStorage/);
  assert.doesNotMatch(inputStorage, /fetch\(|\/api\//);
  assert.match(inputClient, /\/api\/daily-management\/input/);
  assert.match(inputClient, /Authorization/);
  assert.match(schema, /daily_management_inputs/);
});
