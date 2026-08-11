import assert from "node:assert/strict";
import { File } from "node:buffer";
import test from "node:test";
import * as XLSX from "@e965/xlsx";
import { tsImport } from "tsx/esm/api";

const { parseSpreadsheetFile } = await tsImport("../lib/data-hub/parse-spreadsheet.ts", import.meta.url);
const { applyColumnMappings, createColumnMappings } = await tsImport("../lib/data-hub/column-mapping.ts", import.meta.url);
const { getImportSourceDefinition } = await tsImport("../lib/data-hub/source-definitions.ts", import.meta.url);
const { detectHeaderRow } = await tsImport("../lib/data-hub/spreadsheet-structure.ts", import.meta.url);
const { validateImportRows } = await tsImport("../lib/data-hub/validate-import.ts", import.meta.url);
const { getCurrentStockRows } = await tsImport("../lib/dashboard/stock-selectors.ts", import.meta.url);

const bookingHeaders = [
  "No", "Dealer", "Date", "Month", "No.BK", "SL Name", "CS NAME", "Month Out", "Sales Memo No.",
  "State/Division/Region", "Township", "Village", "Area", "Phone No (1)", "Phone No (2)", "Customer Source",
  "Product Type", "Model", "Price", "USD", "DH", "RX", "DP", "BK/CK", "Others IM", "IMO", "Deposit",
  "Purchase Type", "Leasing", "Purchase Status", "Q", "Delivery Dete/Cancer Date", "Remark",
];

const stockHeaders = [
  "STOCK CODE", "BRANCH", "KMCL DATE OUT", "DAY IN", "Today", "Age Stock", "Car Flow", "ဝယ်ယူသည့်နှစ်",
  "Years", "မှတ်ချက်", "SUPPLIER", "Status ", "PRODUCT CODE", "TYPE", "SUB_TYPE", "Delivery Fee", "MODEL",
  "Front Dozer", "CHASSIS NUMBER", "ENGINE NUMBER", "PRICE(USD)", "Exchange Rate", "MSRP", "KMM", "KMM တัดขาย",
  "SKC/KMCL", "SKC/KMCL တัดขาย", "PLACE ", "Status PD", "DAY OUT", "Stock DL", "Sale Branch", "CUSTOMER NAME",
  "Customer ID", "Address", "Village", "Twonship", "Division", "PHONE", "Sale Price", "Sale Memo No.",
  "Delivery Order", "Purchase Type", "Sales Staff", "WS Incentive", "WS Incentive Q.", "အပိုမှတ်ချက်", "Total", null, null,
];

const salesHeaders = [
  "REF_CODE", "Sale Memo No.2", "Dealer", "KMM Year", "KMM RS", "KMCL RS", "Delivery Date", "Week",
  "Sales Code", "Sales Man", "TYPE", "MODEL", "MSRP", "Net Received", "Final Received", "Total Expense", "GP1", "%GP",
];

function rowFor(headers, values) {
  return headers.map((header) => header === null ? null : values[header] ?? null);
}

function bookingRow(overrides = {}) {
  return rowFor(bookingHeaders, {
    No: 1,
    Dealer: "KMM1",
    Date: "2026-07-01",
    Month: 2607,
    "No.BK": "2607-0001",
    "SL Name": "Aye Aye",
    "CS NAME": "Customer One",
    "Month Out": null,
    "Sales Memo No.": "SM-1",
    "Product Type": "01-TT",
    Model: "M7040",
    Price: 120_000_000,
    Deposit: 5_000_000,
    "Purchase Type": "HIRE PURCHASE",
    Leasing: "KMM",
    "Purchase Status": "B HOT",
    "Delivery Dete/Cancer Date": null,
    Remark: "Source remark",
    ...overrides,
  });
}

function stockRow(overrides = {}) {
  return rowFor(stockHeaders, {
    "STOCK CODE": "STK-001",
    BRANCH: "KMM1",
    "DAY IN": "2026-07-01",
    Today: "2026-08-08",
    "Age Stock": 38,
    "PRODUCT CODE": "P-001",
    TYPE: "01-TT",
    SUB_TYPE: "DH",
    MODEL: "M7040",
    "CHASSIS NUMBER": "CH-001",
    "ENGINE NUMBER": "EN-001",
    MSRP: 100_000_000,
    KMM: 1,
    "Status PD": "Free Stock",
    "DAY OUT": null,
    "Sale Branch": null,
    "CUSTOMER NAME": null,
    "Sale Memo No.": null,
    ...overrides,
  });
}

function workbookFile(name, sheets) {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, matrix] of Object.entries(sheets)) {
    const worksheet = XLSX.utils.aoa_to_sheet(matrix);
    const widest = Math.max(...matrix.map((row) => row.length), 1);
    if (widest === 50) worksheet["!ref"] = `A1:AX${matrix.length}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }
  return new File([XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })], name);
}

async function parseAndMap(file, module) {
  const parsed = await parseSpreadsheetFile(file, { module });
  const source = getImportSourceDefinition(module, "product");
  const mappings = createColumnMappings(source, parsed.headers, {}, parsed.inferredFields);
  return { parsed, mapped: applyColumnMappings(parsed, mappings), mappings, source };
}

function bookingFile(rows = [bookingRow()]) {
  return workbookFile("2607_KMM Booking.xlsx", { Data: [["KMM Booking Report"], [], bookingHeaders, ...rows] });
}

function stockFile(rows = [stockRow()]) {
  return workbookFile("2607_KMM_R2_STOCK.xlsx", { "02) STOCK": [["KMM STOCK 2023"], [], [], stockHeaders, ...rows] });
}

test("Booking maps No.BK to booking_no", async () => {
  const { mapped } = await parseAndMap(bookingFile(), "booking");
  assert.equal(mapped.rows[0].booking_no, "2607-0001");
});

test("Booking maps Dealer to canonical branch", async () => {
  const { mapped } = await parseAndMap(bookingFile(), "booking");
  assert.equal(mapped.rows[0].branch, "KMM01");
});

test("Booking maps CS NAME to customer", async () => {
  const { mapped } = await parseAndMap(bookingFile(), "booking");
  assert.equal(mapped.rows[0].customer, "Customer One");
  assert.equal(mapped.rows[0].customer_name, "Customer One");
});

test("Booking preserves Purchase Status and derives approved lifecycle status from Month Out", async () => {
  const rows = [
    bookingRow({ No: 1, "No.BK": "BK-OPEN", "Month Out": null, "Purchase Status": "B HOT" }),
    bookingRow({ No: 2, "No.BK": "BK-SOLD", "Month Out": 7, "Purchase Status": "S" }),
    bookingRow({ No: 3, "No.BK": "BK-CANCEL", "Month Out": "CANCLE", "Purchase Status": "Fail" }),
  ];
  const { mapped } = await parseAndMap(bookingFile(rows), "booking");
  assert.deepEqual(mapped.rows.map((row) => row.purchase_status), ["B HOT", "S", "Fail"]);
  assert.deepEqual(mapped.rows.map((row) => row.status), ["Open", "Delivered", "Cancelled"]);
  assert.deepEqual(mapped.rows.map((row) => row.booking_status), ["Open", "Delivered", "Cancelled"]);
});

test("Booking keeps Product Type as product and Model as product_model/model", async () => {
  const { mapped } = await parseAndMap(bookingFile(), "booking");
  assert.equal(mapped.rows[0].product_type, "01-TT");
  assert.equal(mapped.rows[0].product, "01-TT");
  assert.equal(mapped.rows[0].product_model, "M7040");
  assert.equal(mapped.rows[0].model, "M7040");
});

test("Booking maps Price and Deposit exactly without estimation", async () => {
  const { mapped } = await parseAndMap(bookingFile([bookingRow({ Price: "-", Deposit: 1_234_567 })]), "booking");
  assert.equal(mapped.rows[0].booking_price, null);
  assert.equal(mapped.rows[0].price, null);
  assert.equal(mapped.rows[0].deposit_amount, 1_234_567);
  assert.equal(mapped.rows[0].deposit, 1_234_567);
});

test("Booking selects the larger valid Data sheet and ignores its numeric summary footer", async () => {
  const shortRows = Array.from({ length: 11 }, (_, index) => bookingRow({ No: index + 1, "No.BK": `SHORT-${index}` }));
  const fullRows = Array.from({ length: 12 }, (_, index) => bookingRow({ No: index + 1, "No.BK": index < 3 ? "TENDER-MULTI-UNIT" : `FULL-${index}` }));
  const file = workbookFile("2607_KMM Booking.xlsx", {
    Sheet3: [bookingHeaders, ...shortRows],
    Data: [["KMM Booking Report"], [], bookingHeaders, ...fullRows, [12, null, null, null, null, null, 12, null, null, null, null, null, null, null, null, null, null, 12]],
  });
  const { parsed, mapped, source } = await parseAndMap(file, "booking");
  assert.equal(parsed.sheetName, "Data");
  assert.equal(parsed.headerRow, 3);
  assert.equal(parsed.rows.length, 12);
  assert.deepEqual(parsed.detection.candidateSheets, ["Data", "Sheet3"]);
  const validation = validateImportRows(source, mapped.headers, mapped.rows, { duplicateRule: mapped.duplicateRule });
  assert.equal(validation.duplicateRows, 0);
  assert.equal(validation.canImport, true);
});

test("Stock skips title and blank rows before the actual header", async () => {
  const parsed = await parseSpreadsheetFile(stockFile(), { module: "stock" });
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.sourceRowNumbers[0], 5);
});

test("Stock detects its real header at Row 4 with high confidence", () => {
  const result = detectHeaderRow([["KMM STOCK 2023"], [], [], stockHeaders], undefined, "stock");
  assert.equal(result.rowNumber, 4);
  assert.equal(result.confidence, "high");
  assert.ok(result.matchedFields.includes("stock_number"));
  assert.ok(result.matchedFields.includes("stock_status"));
});

test("Stock reports the 50-column worksheet structure while retaining named headers", async () => {
  const parsed = await parseSpreadsheetFile(stockFile(), { module: "stock" });
  assert.equal(parsed.detectedColumns, 50);
  assert.equal(parsed.headers.length, 48);
});

test("Stock maps Today to as_of_date and snapshot_date", async () => {
  const { mapped } = await parseAndMap(stockFile(), "stock");
  assert.equal(mapped.rows[0].as_of_date, "2026-08-08");
  assert.equal(mapped.rows[0].snapshot_date, "2026-08-08");
});

test("Stock maps STOCK CODE to stock_number", async () => {
  const { mapped } = await parseAndMap(stockFile(), "stock");
  assert.equal(mapped.rows[0].stock_number, "STK-001");
});

test("Stock keeps TYPE grouping, SUB_TYPE detail, and MODEL product copies separate", async () => {
  const { mapped } = await parseAndMap(stockFile(), "stock");
  assert.equal(mapped.rows[0].product_type, "01-TT");
  assert.equal(mapped.rows[0].product_group, "01-TT");
  assert.equal(mapped.rows[0].sub_type, "DH");
  assert.equal(mapped.rows[0].product_model, "M7040");
  assert.equal(mapped.rows[0].model, "M7040");
  assert.equal(mapped.rows[0].product, "M7040");
});

test("Stock maps MSRP, KMM, and Status PD without claiming generic Status", async () => {
  const { mapped, mappings } = await parseAndMap(stockFile(), "stock");
  assert.equal(mapped.rows[0].msrp, 100_000_000);
  assert.equal(mapped.rows[0].kmm_flag, 1);
  assert.equal(mapped.rows[0].stock_status, "Free Stock");
  assert.equal(mappings.find((mapping) => mapping.excelColumn === "status")?.fieldKey, null);
  assert.equal(mappings.find((mapping) => mapping.excelColumn === "status_pd")?.fieldKey, "stock_status");
});

test("Stock maps chassis and engine identifiers and preserves serial parity", async () => {
  const { mapped } = await parseAndMap(stockFile(), "stock");
  assert.equal(mapped.rows[0].chassis_number, "CH-001");
  assert.equal(mapped.rows[0].serial_number, "CH-001");
  assert.equal(mapped.rows[0].engine_number, "EN-001");
});

test("Stock assigns quantity one only to verified inventory records", async () => {
  const incomplete = stockRow({ BRANCH: null, "STOCK CODE": "INCOMPLETE" });
  const file = stockFile([stockRow(), [], ["Total"], incomplete]);
  const { parsed, mapped } = await parseAndMap(file, "stock");
  assert.equal(parsed.rows.length, 1);
  assert.deepEqual(mapped.rows.map((row) => row.quantity), [1]);
});

test("Stock preserves current-stock filtering and physical-identifier deduplication parity", async () => {
  const rows = [
    { kmm: 0, currentStatus: "S", chassisNumber: "SHARED", stockId: "OLD", productType: "TT" },
    { kmm: 1, currentStatus: " Free   Stock ", chassisNumber: "SHARED", stockId: "CURRENT", productType: "TT" },
    { kmm: 1, currentStatus: "Free Stock", chassisNumber: "A", stockId: "REUSED", productType: "TT" },
    { kmm: 1, currentStatus: "Free Stock", chassisNumber: "B", stockId: "REUSED", productType: "TT" },
    { kmm: 1, currentStatus: "Free Stock", chassisNumber: "B", stockId: "OTHER", productType: "TT" },
  ];
  assert.deepEqual(getCurrentStockRows(rows).map((row) => row.stockId), ["CURRENT", "REUSED"]);

  const source = getImportSourceDefinition("stock", "product");
  const canonical = rows.slice(1).map((row) => ({ as_of_date: "2026-08-08", branch: "KMM01", product: "M7040", quantity: 1, kmm_flag: row.kmm, stock_status: row.currentStatus, chassis_number: row.chassisNumber, stock_number: row.stockId }));
  const result = validateImportRows(source, ["as_of_date", "branch", "product", "quantity", "kmm_flag", "stock_status", "chassis_number", "stock_number"], canonical, { duplicateRule: "current_stock_physical_identifier" });
  assert.equal(result.duplicateRows, 2);
  assert.equal(result.canImport, true);
});

test("Sales CPI Row 4 parsing and quantity inference still work", async () => {
  const salesRow = rowFor(salesHeaders, { "Sale Memo No.2": "INV-1", Dealer: "KMM2", "Delivery Date": "2026-07-01", "Sales Code": "S-1", "Sales Man": "Seller", TYPE: "01-TT", MODEL: "M7040", MSRP: 100, "Net Received": 90, "Final Received": 95, "Total Expense": 5, GP1: 10, "%GP": 0.1 });
  const file = workbookFile("2607_KMM_CPI.xlsx", { "2026_KMM_DATA": [["KMM CPI"], [], salesHeaders.map((_, index) => index + 1), salesHeaders, salesRow] });
  const { parsed, mapped } = await parseAndMap(file, "sales");
  assert.equal(parsed.headerRow, 4);
  assert.equal(parsed.detectedColumns, salesHeaders.length);
  assert.equal(mapped.rows[0].quantity, 1);
});

test("Sales duplicate validation uses the full pre-mapping source row grain", async () => {
  const values = { "Sale Memo No.2": "INV-1", Dealer: "KMM2", "Delivery Date": "2026-07-01", "Sales Code": "S-1", "Sales Man": "Seller", TYPE: "01-TT", MODEL: "M7040", MSRP: 100, "Net Received": 90, "Final Received": 95, "Total Expense": 5, GP1: 10, "%GP": 0.1 };
  const first = rowFor(salesHeaders, { ...values, REF_CODE: "REF-UNIT-1" });
  const second = rowFor(salesHeaders, { ...values, REF_CODE: "REF-UNIT-2" });
  const distinctFile = workbookFile("2607_KMM_CPI.xlsx", { "2026_KMM_DATA": [["KMM CPI"], [], salesHeaders.map((_, index) => index + 1), salesHeaders, first, second] });
  const { parsed, mapped, source } = await parseAndMap(distinctFile, "sales");

  assert.notEqual(parsed.sourceRowSignatures[0], parsed.sourceRowSignatures[1]);
  const distinct = validateImportRows(source, mapped.headers, mapped.rows, {
    quantityRule: mapped.quantityRule,
    sourceRowNumbers: mapped.sourceRowNumbers,
    sourceRowSignatures: mapped.sourceRowSignatures,
  });
  assert.equal(distinct.validRows, 2);
  assert.equal(distinct.duplicateRows, 0);
  assert.equal(distinct.canImport, true);

  const repeatedFile = workbookFile("2607_KMM_CPI.xlsx", { "2026_KMM_DATA": [["KMM CPI"], [], salesHeaders.map((_, index) => index + 1), salesHeaders, first, [...first]] });
  const repeatedImport = await parseAndMap(repeatedFile, "sales");
  const repeated = validateImportRows(repeatedImport.source, repeatedImport.mapped.headers, repeatedImport.mapped.rows, {
    quantityRule: repeatedImport.mapped.quantityRule,
    sourceRowNumbers: repeatedImport.mapped.sourceRowNumbers,
    sourceRowSignatures: repeatedImport.mapped.sourceRowSignatures,
  });
  assert.equal(repeated.validRows, 1);
  assert.equal(repeated.duplicateRows, 1);
  assert.equal(repeated.canImport, false);
});

test("Simple Row 1 Excel parsing still works", async () => {
  const headers = ["Sale Date", "Invoice No", "Branch", "Model Code", "Product Type", "Quantity", "Sale Amount"];
  const file = workbookFile("simple.xlsx", { Sales: [headers, ["2026-07-01", "INV-1", "KMM01", "M1", "TT", 1, 100]] });
  const parsed = await parseSpreadsheetFile(file, { module: "sales" });
  assert.equal(parsed.headerRow, 1);
  assert.equal(parsed.rows.length, 1);
});

test("CSV import still detects and parses a Row 1 Sales header", async () => {
  const csv = "Sale Date,Invoice No,Branch,Model Code,Product Type,Quantity,Sale Amount\n2026-07-02,INV-2,KMM02,M2,TT,1,200\n";
  const parsed = await parseSpreadsheetFile(new File([csv], "sales.csv", { type: "text/csv" }), { module: "sales" });
  assert.equal(parsed.headerRow, 1);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.extension, "csv");
});
