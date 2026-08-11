import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function importTypeScriptModule(path) {
  if (path === "lib/data-hub/validate-import.ts") {
    return tsImport(`../${path}`, import.meta.url);
  }
  const source = await read(path);
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const cpiHeaders = [
  "REF_CODE", "Sale Memo No.2", "Dealer", "KMM Year", "KMM RS", "KMCL RS",
  "Delivery Date", "Week", "Sales Code", "Sales Man", "TYPE", "MODEL",
  "MSRP (MMK)", "Net Received", "Final Received", "Total Expense", "GP1", "%GP",
];

test("detects a title row above the header", async () => {
  const { detectHeaderRow } = await importTypeScriptModule("lib/data-hub/spreadsheet-structure.ts");
  assert.equal(detectHeaderRow([["KMM CPI Report"], cpiHeaders, ["KMM020001", "INV-1"]]).rowNumber, 2);
});

test("detects a numbering row above the header", async () => {
  const { detectHeaderRow } = await importTypeScriptModule("lib/data-hub/spreadsheet-structure.ts");
  assert.equal(detectHeaderRow([[1, 2, 3, 4], cpiHeaders, ["KMM020001", "INV-1"]]).rowNumber, 2);
});

test("detects the real CPI header at Row 4", async () => {
  const { detectHeaderRow } = await importTypeScriptModule("lib/data-hub/spreadsheet-structure.ts");
  const matrix = [[null, "KMM CONSUMER PRICE INDEX"], [], [1, 2, 3, 4], cpiHeaders, ["KMM020001", "INV-1"]];
  const result = detectHeaderRow(matrix);
  assert.equal(result.rowNumber, 4);
  assert.equal(result.confidence, "high");
  assert.ok(result.matchedFields.includes("sale_date"));
  assert.ok(result.matchedFields.includes("invoice_no"));
});

test("maps real CPI aliases to canonical Sales fields without estimating values", async () => {
  const { applyColumnMappings, createColumnMappings } = await importTypeScriptModule("lib/data-hub/column-mapping.ts");
  const keys = ["sale_date", "invoice_no", "branch", "model_code", "model", "product_type", "employee_code", "salesperson_code", "salesperson_name", "quantity", "sale_amount", "msrp", "net_received", "final_received", "expense", "gp1", "gp_percent"];
  const source = { id: "sales", label: "Sales", description: "", visible: true, fields: keys.map((key) => ({ key, label: key, type: ["quantity", "sale_amount", "msrp", "net_received", "final_received", "expense", "gp1", "gp_percent"].includes(key) ? "number" : key === "sale_date" ? "date" : "string", required: ["sale_date", "invoice_no", "branch", "model_code", "quantity", "sale_amount"].includes(key) })), duplicateKey: ["invoice_no"] };
  const headers = cpiHeaders.map((header) => String(header).toLowerCase().replace(/%/g, " percent ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""));
  const mappings = createColumnMappings(source, headers, {}, ["quantity", "sale_amount"]);
  const mappedByExcel = Object.fromEntries(mappings.filter((mapping) => mapping.excelColumn !== "—").map((mapping) => [mapping.excelColumn, mapping.fieldKey]));
  assert.equal(mappedByExcel.delivery_date, "sale_date");
  assert.equal(mappedByExcel.sale_memo_no_2, "invoice_no");
  assert.equal(mappedByExcel.dealer, "branch");
  assert.equal(mappedByExcel.model, "model_code");
  assert.equal(mappedByExcel.type, "product_type");
  assert.equal(mappedByExcel.sales_code, "employee_code");
  assert.equal(mappedByExcel.sales_man, "salesperson_name");
  assert.equal(mappedByExcel.msrp_mmk, "msrp");
  assert.equal(mappedByExcel.total_expense, "expense");
  assert.equal(mappedByExcel.percent_gp, "gp_percent");

  const raw = Object.fromEntries(headers.map((header) => [header, header === "delivery_date" ? "30-7-2026" : header === "final_received" ? 100 : `value:${header}`]));
  const mapped = applyColumnMappings({ filename: "2607_KMM_CPI.xlsx", extension: "xlsx", headers, rows: [raw], sheetName: "2026_KMM_DATA", headerRow: 4, headerConfidence: "high", detectedColumns: headers.length, inferredFields: ["quantity", "sale_amount"], canonicalCopies: { model: "model_code", sale_amount: "final_received" }, quantityRule: "one_per_verified_sales_transaction" }, mappings);
  assert.equal(mapped.rows[0].quantity, 1);
  assert.equal(mapped.rows[0].sale_date, "2026-07-30");
  assert.equal(mapped.rows[0].sale_amount, 100);
  assert.equal(mapped.rows[0].final_received, 100);
  assert.equal(mapped.rows[0].model, mapped.rows[0].model_code);
});

test("ignores blank rows", async () => {
  const { isBlankRow } = await importTypeScriptModule("lib/data-hub/spreadsheet-structure.ts");
  assert.equal(isBlankRow([null, "", undefined]), true);
});

test("ignores summary, footer, and incomplete non-unit rows", async () => {
  const { isSummaryLikeRow, isVerifiedSalesTransactionRow } = await importTypeScriptModule("lib/data-hub/spreadsheet-structure.ts");
  assert.equal(isSummaryLikeRow(["Grand Total", null, 100]), true);
  const headers = ["delivery_date", "sale_memo_no_2", "dealer", "type", "model"];
  assert.equal(isVerifiedSalesTransactionRow({ delivery_date: "2026-07-01", sale_memo_no_2: "INV-1", dealer: "KMM02", type: "TT", model: "M7040" }, headers), true);
  assert.equal(isVerifiedSalesTransactionRow({ delivery_date: null, sale_memo_no_2: null, dealer: "KMM02", type: null, model: null }, headers), false);
});

test("manual header-row fallback accepts an explicit nonstandard header", async () => {
  const { detectHeaderRow } = await importTypeScriptModule("lib/data-hub/spreadsheet-structure.ts");
  const automatic = detectHeaderRow([["Report"], ["Alpha", "Beta"], ["A", "B"]]);
  assert.equal(automatic.confidence, "low");
  const manual = detectHeaderRow([["Report"], ["Alpha", "Beta"], ["A", "B"]], 2);
  assert.equal(manual.rowNumber, 2);
  assert.equal(manual.confidence, "manual");
});

test("existing simple Excel header format still detects Row 1", async () => {
  const { detectHeaderRow } = await importTypeScriptModule("lib/data-hub/spreadsheet-structure.ts");
  const simpleHeader = ["Sale Date", "Invoice No", "Branch", "Model Code", "Quantity", "Sale Amount"];
  assert.equal(detectHeaderRow([simpleHeader, ["2026-07-01", "INV-1", "KMM01", "M1", 1, 100]]).rowNumber, 1);
});

test("existing CSV header format still detects Row 1", async () => {
  const { detectHeaderRow } = await importTypeScriptModule("lib/data-hub/spreadsheet-structure.ts");
  const simpleHeader = ["Sale Date", "Invoice No", "Branch", "Model Code", "Quantity", "Sale Amount"];
  assert.equal(detectHeaderRow([simpleHeader, ["2026-07-02", "INV-2", "KMM02",  "M2", 1, 200]]).rowNumber, 1);
});

test("assigns quantity 1 only under the verified CPI unit rule", async () => {
  const { applyColumnMappings } = await importTypeScriptModule("lib/data-hub/column-mapping.ts");
  const file = { filename: "cpi.xlsx", extension: "xlsx", headers: ["invoice"], rows: [{ invoice: "INV-1" }], sheetName: "Sales", headerRow: 4, headerConfidence: "high", detectedColumns: 1, inferredFields: ["quantity"], quantityRule: "one_per_verified_sales_transaction" };
  const mapped = applyColumnMappings(file, [{ excelColumn: "invoice", fieldKey: "invoice_no", status: "mapped" }]);
  assert.equal(mapped.rows[0].quantity, 1);
});

test("Sales duplicate configuration uses the complete canonical transaction instead of invoice number", async () => {
  const { getDataSourceDefinition } = await importTypeScriptModule("lib/data-hub/source-definitions.ts");
  const source = getDataSourceDefinition("sales");
  assert.deepEqual(source.duplicateKey, source.fields.map((field) => field.key));
  assert.notDeepEqual(source.duplicateKey, ["invoice_no"]);
});

test("repeated invoice numbers with different canonical transaction data remain valid", async () => {
  const { validateImportRows } = await importTypeScriptModule("lib/data-hub/validate-import.ts");
  const { getDataSourceDefinition } = await importTypeScriptModule("lib/data-hub/source-definitions.ts");
  const source = getDataSourceDefinition("sales");
  const headers = ["sale_date", "invoice_no", "branch", "model_code", "quantity", "sale_amount", "net_received"];
  const rows = [
    { sale_date: "2026-07-01", invoice_no: "INV-1", branch: "KMM01", model_code: "M7040", quantity: 1, sale_amount: 100, net_received: 90 },
    { sale_date: "2026-07-01", invoice_no: "INV-1", branch: "KMM01", model_code: "M7040", quantity: 1, sale_amount: 100, net_received: 95 },
  ];
  const result = validateImportRows(source, headers, rows, { sourceRowNumbers: [5, 6] });
  assert.equal(result.canImport, true);
  assert.equal(result.duplicateRows, 0);
  assert.equal(result.validRows, 2);
});

test("an exact repeated canonical Sales transaction is rejected as a duplicate", async () => {
  const { validateImportRows } = await importTypeScriptModule("lib/data-hub/validate-import.ts");
  const { getDataSourceDefinition } = await importTypeScriptModule("lib/data-hub/source-definitions.ts");
  const source = getDataSourceDefinition("sales");
  const headers = ["sale_date", "invoice_no", "branch", "model_code", "quantity", "sale_amount", "net_received"];
  const row = { sale_date: "2026-07-01", invoice_no: "INV-1", branch: "KMM01", model_code: "M7040", quantity: 1, sale_amount: 100, net_received: null };
  const result = validateImportRows(source, headers, [row, { ...row }], { quantityRule: "one_per_verified_sales_transaction", sourceRowNumbers: [5, 6] });
  assert.equal(result.canImport, false);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.validRows, 1);
  assert.deepEqual(result.issues.filter((issue) => issue.code === "duplicate").map((issue) => issue.row), [6]);
  assert.match(result.issues.find((issue) => issue.code === "duplicate").message, /duplicates row 5/);
});
