import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";
import * as XLSX from "@e965/xlsx";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const daily = await tsImport("../lib/daily-management/business-service.ts", import.meta.url);
const dailyBranch = await tsImport("../lib/daily-management/branch.ts", import.meta.url);
const dailyDate = await tsImport("../lib/daily-management/date.ts", import.meta.url);
const inputParser = await tsImport("../lib/daily-management/parse-input-workbook.ts", import.meta.url);
const inputStore = await tsImport("../lib/daily-management/input-storage.ts", import.meta.url);
const templateApi = await tsImport("../app/api/daily-management/template/route.ts", import.meta.url);

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

test("Daily Management canonicalizes branch labels and excludes future operational rows", () => {
  const snapshot = daily.buildDailyManagementSnapshot({
    sales: [
      salesRow({ date: "2026-08-09", branch: "KMM01" }),
      salesRow({ date: "2026-08-10", branch: "KMM01" }),
    ],
    booking: [
      bookingRow({ date: "2026-08-09", branch: "Hpa-an" }),
      bookingRow({ date: "2026-08-10", branch: "Hpa-an" }),
    ],
    stock: [
      stockRow({ branch: "Hpa-an" }),
      { ...stockRow({ branch: "Hpa-an", ageDays: 80 }), snapshotDate: "2026-08-10" },
    ],
  }, { asOfDate: "2026-08-09", branch: "KMM01 · Hpa-an" });

  assert.equal(dailyBranch.canonicalDailyBranch("KMM01 · Hpa-an"), "KMM01");
  assert.equal(snapshot.scope.branch, "KMM01");
  assert.equal(snapshot.sales.mtdUnits, 1);
  assert.equal(snapshot.booking.activeUnits, 1);
  assert.equal(snapshot.stock.engineUnits, 1);
  assert.deepEqual(snapshot.availableBranches, ["KMM01"]);
});

test("Daily Management uses approved targets as context until a full month is complete", () => {
  const base = daily.buildDailyManagementSnapshot({
    sales: [salesRow({ date: "2026-08-09", quantity: 10 })],
    booking: [],
    stock: [],
  }, { asOfDate: "2026-08-09" });
  const target = { year: 2026, month: 8, metric: "SALES_UNITS", target: 48, productGroup: "", source: "KMM", sourceVersion: "H2-2026", effectiveFrom: "2026-07-01" };
  const partial = daily.attachApprovedTarget(base, target, "2026-08-11");
  assert.equal(partial.target.monthlyUnits, 48);
  assert.equal(partial.target.evaluationEligible, false);
  assert.equal(partial.target.achievementPercent, null);

  const completed = daily.attachApprovedTarget({ ...base, asOfDate: "2026-08-31" }, target, "2026-09-01");
  assert.equal(completed.target.evaluationEligible, true);
  assert.equal(completed.target.achievementPercent, (10 / 48) * 100);
  assert.equal(dailyDate.isValidIsoDate("2026-02-30"), false);
});

test("Daily Management keeps full salesperson MTD totals outside the top-five ranking", () => {
  const sales = ["A", "B", "C", "D", "E", "F"].map((salesperson, index) =>
    salesRow({ date: "2026-08-09", salesperson, quantity: 6 - index }),
  );
  const snapshot = daily.buildDailyManagementSnapshot({ sales, booking: [], stock: [] }, { asOfDate: "2026-08-09" });
  assert.equal(snapshot.sales.topSalespeople.length, 5);
  assert.equal(snapshot.sales.bySalesperson.find((row) => row.salesperson === "F").units, 1);
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
  const templateResponse = await templateApi.GET(new Request("https://dashboard.example/api/daily-management/template"));
  assert.equal(templateResponse.status, 307);
  assert.equal(templateResponse.headers.get("location"), "https://dashboard.example/KMM_Daily_Management_Input_Template.xlsx");

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
  const [route, inputApi, templateRoute, page, inputRoute, inputPage, inputStorage, inputClient, inputWorkbook, client, feature, navigation, shell, schema, access] = await Promise.all([
    read("app/api/daily-management/route.ts"),
    read("app/api/daily-management/input/route.ts"),
    read("app/api/daily-management/template/route.ts"),
    read("components/daily-management/daily-management-page.tsx"),
    read("app/daily-management/input/page.tsx"),
    read("components/daily-management/daily-management-input-page.tsx"),
    read("lib/daily-management/input-storage.ts"),
    read("lib/daily-management/input-client.ts"),
    read("lib/daily-management/parse-input-workbook.ts"),
    read("lib/daily-management/client.ts"),
    read("lib/features.ts"),
    read("components/navigation/navigation-config.ts"),
    read("components/layout/global-app-shell.tsx"),
    read("db/schema.ts"),
    read("lib/daily-management/access.ts"),
  ]);
  assert.match(route, /requireDailyManagementAccess\(request, "view"\)/);
  assert.match(route, /getCompanyMonthlyTarget/);
  assert.match(route, /normalizeDailyTimeZone/);
  assert.match(route, /listSalesTransactions/);
  assert.match(route, /listBookingTransactions/);
  assert.match(route, /listStockTransactions/);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(inputApi, /requireDailyManagementAccess/);
  assert.match(inputApi, /requireDailyManagementAccess\(request, permission\)/);
  assert.match(access, /requireCompanyContext\(request, \{ permission \}\)/);
  assert.match(inputApi, /isNotNull\(dailyManagementInputs\.publishedPayload\)/);
  assert.match(inputApi, /dailyManagementInputs/);
  assert.match(inputApi, /onConflictDoUpdate/);
  assert.match(inputApi, /mode === "publish"/);
  assert.match(templateRoute, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(templateRoute, /Content-Disposition/);
  assert.match(templateRoute, /"Location"/);
  assert.match(client, /\/api\/daily-management/);
  assert.match(feature, /NEXT_PUBLIC_DAILY_MANAGEMENT_REPORT/);
  assert.match(navigation, /Daily Report/);
  assert.match(shell, /daily-management/);
  assert.match(page, /Live · D1 Data/);
  assert.match(page, /xl:grid-cols-6/);
  assert.match(page, /Approved target · context only/);
  assert.match(page, /Branch sales mix/);
  assert.doesNotMatch(page, /PerformerList title="Need Attention"/);
  assert.match(page, /xl:grid-cols-\[1\.35fr_0\.65fr\]/);
  assert.match(page, /xl:grid-cols-\[1\.18fr_0\.82fr\]/);
  assert.match(page, /91\+ Days/);
  assert.match(page, /Booking pipeline distribution/);
  assert.doesNotMatch(page, /overflow-x-auto|min-w-\[/);
  assert.match(page, /\/daily-management\/input/);
  assert.match(page, /new URLSearchParams\(\{ date: input\.reportDate, branch: input\.branch \}\)/);
  assert.match(page, /<a href=\{inputEditHref\(input\)\}/);
  assert.match(page, /loadDailyManagementInput\("published"/);
  assert.match(page, /loadDailyManagementReport/);
  assert.match(page, /No sample values are shown/);
  assert.doesNotMatch(page, /dailyManagementMock|mock-data/);
  assert.doesNotMatch(page, /M MMK/);
  assert.match(page, /sales\.bySalesperson\.find/);
  assert.doesNotMatch(page, /\?\? 40|\?\? 33/);
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
  assert.match(inputPage, /value=\{branch\.code\}/);
  assert.match(inputPage, /loadDailyManagementInput\("draft", \{ \.\.\.scope, companyId \}\)/);
  assert.match(inputPage, /loadDailyManagementInput\("published", \{ \.\.\.scope, companyId \}\)/);
  assert.match(inputPage, /new URLSearchParams\(window\.location\.search\)/);
  assert.doesNotMatch(inputPage, /requestAnimationFrame/);
  assert.match(inputPage, /reportDate: requestedDate, branch: requestedBranch/);
  assert.match(inputWorkbook, /Daily Input/);
  assert.match(inputWorkbook, /Actions/);
  assert.match(inputWorkbook, /Notes/);
  assert.match(inputWorkbook, /MAX_FILE_SIZE/);
  assert.match(inputWorkbook, /ไฟล์นี้เป็น \$\{transactionType\} Data/);
  assert.match(inputStorage, /localStorage/);
  assert.match(inputStorage, /input-draft:v2/);
  assert.match(inputStorage, /function scopedKey/);
  assert.match(inputPage, /hasRemoteRecord/);
  assert.match(inputPage, /daily\.notSaved/);
  assert.match(inputPage, /\(!dirty && !hasRemoteRecord\)/);
  assert.doesNotMatch(inputStorage, /mock-data|2026-08-09/);
  assert.doesNotMatch(inputStorage, /fetch\(|\/api\//);
  assert.match(inputClient, /\/api\/daily-management\/input/);
  assert.match(inputClient, /Authorization/);
  assert.match(schema, /daily_management_inputs/);
  assert.match(access, /requireCompanyContext/);
  assert.match(access, /branches\.companyId, context\.id/);
});
