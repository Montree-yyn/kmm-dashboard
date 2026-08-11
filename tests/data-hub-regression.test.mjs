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

test("Data Hub is an authenticated route inside the shared shell", async () => {
  const [route, shell, header, navigation] = await Promise.all([
    read("app/data-hub/page.tsx"), read("components/layout/global-app-shell.tsx"), read("components/layout/global-header.tsx"), read("components/navigation/navigation-config.ts"),
  ]);
  assert.match(route, /<DataHubPage\s*\/>/);
  assert.match(shell, /"\/data-hub"/);
  assert.match(shell, /<AuthGate>/);
  assert.match(header, /prefix: "\/data-hub"/);
  assert.match(header, /title: "route\.dataHub\.title"/);
  assert.match(header, /subtitle: "route\.dataHub\.subtitle"/);
  assert.match(navigation, /labelKey: "nav\.dataHub"/);
});

test("Data Hub exposes six transactional sources and the extensible Master Data registry", async () => {
  const sources = await read("lib/data-hub/source-definitions.ts");
  for (const id of ["sales", "booking", "stock", "expense", "marketing", "team", "master_data"]) assert.match(sources, new RegExp(`id: "${id}"[\\s\\S]*?visible: true`));
  for (const id of ["product", "model", "branch", "township", "salesman", "customer_type", "dealer", "campaign", "price_list"]) assert.match(sources, new RegExp(`id: "${id}"`));
  assert.match(sources, /masterDataDefinitions/);
  assert.match(sources, /getImportSourceDefinition/);
});

test("Sales mapping keeps the approved canonical import field contract", async () => {
  const sources = await read("lib/data-hub/source-definitions.ts");
  for (const field of ["sale_date", "model_code", "employee_code", "sale_amount"]) {
    assert.match(sources, new RegExp(`field\\("${field}"`));
  }
});

test("spreadsheet parser accepts only XLSX, XLS and CSV with safety limits", async () => {
  const [parser, packageJson] = await Promise.all([read("lib/data-hub/parse-spreadsheet.ts"), read("package.json")]);
  assert.match(parser, /new Set\(\["xlsx", "xls", "csv"\]\)/);
  assert.match(parser, /MAX_FILE_SIZE = 20 \* 1024 \* 1024/);
  assert.match(parser, /MAX_ROWS = 50_000/);
  assert.match(parser, /XLSX\.read/);
  assert.match(packageJson, /"@e965\/xlsx"/);
});

test("validation covers missing columns, duplicates, wrong types and empty cells", async () => {
  const validator = await read("lib/data-hub/validate-import.ts");
  for (const issue of ["missing_column", "duplicate", "wrong_data_type", "empty_cell"]) assert.match(validator, new RegExp(`code: "${issue}"`));
});

test("validation accepts a clean batch and blocks malformed rows", async () => {
  const { validateImportRows } = await importTypeScriptModule("lib/data-hub/validate-import.ts");
  const source = { id: "sales", label: "Sales", description: "", visible: true, fields: [{ key: "invoice_no", label: "Invoice No.", type: "string", required: true }, { key: "quantity", label: "Quantity", type: "number", required: true }, { key: "date", label: "Date", type: "date", required: true }], duplicateKey: ["invoice_no"] };
  const valid = validateImportRows(source, ["invoice_no", "quantity", "date"], [{ invoice_no: "INV-001", quantity: 2, date: "2026-07-01" }, { invoice_no: "INV-002", quantity: "3", date: new Date("2026-07-02") }]);
  assert.equal(valid.canImport, true);
  const invalid = validateImportRows(source, ["invoice_no", "quantity", "date"], [{ invoice_no: "INV-001", quantity: 2, date: "2026-07-01" }, { invoice_no: "INV-001", quantity: "not-a-number", date: "" }]);
  assert.equal(invalid.canImport, false);
  assert.equal(invalid.duplicateRows, 0);
  assert.equal(invalid.wrongTypeCells, 1);
  assert.equal(invalid.emptyCells, 1);
  const repeated = { invoice_no: "INV-003", quantity: 1, date: "2026-07-03" };
  const duplicate = validateImportRows(source, ["invoice_no", "quantity", "date"], [repeated, { ...repeated }]);
  assert.equal(duplicate.canImport, false);
  assert.equal(duplicate.duplicateRows, 1);
});

test("Data Hub renders approval, status recovery and the v1.2 history contract", async () => {
  const page = await read("components/data-hub/data-hub-page.tsx");
  for (const step of ["Upload", "Preview", "Validate", "Approve", "Import", "Dashboard Update", "Completed"]) assert.match(page, new RegExp(`"${step}"`));
  for (const status of ["Ready", "Uploading", "Validating", "Warning", "Importing", "Success", "Failed", "Rollback"]) assert.match(page, new RegExp(`label: "${status}"`));
  for (const column of ["File Name", "Module", "Rows", "Success", "Warning", "Error", "Imported By", "Date Time", "Duration", "Rollback"]) assert.match(page, new RegExp(`"${column}"`));
  assert.match(page, /Download Error Report/);
  assert.match(page, /Approve import/);
  assert.match(page, /recordSessionImportFailure/);
  assert.match(page, /formatDuration/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /focus-visible:ring-2/);
});

test("Data Mapping auto-detects aliases, saves per module, and maps rows before validation", async () => {
  const [mapping, page] = await Promise.all([
    read("lib/data-hub/column-mapping.ts"),
    read("components/data-hub/data-hub-page.tsx"),
  ]);
  for (const alias of ["sale date", "sales date", "model name", "salesman", "sl name", "price"]) {
    assert.match(mapping, new RegExp(`"${alias}"`));
  }
  assert.match(mapping, /localStorage/);
  assert.match(mapping, /applyColumnMappings/);
  assert.match(page, /Data Mapping/);
  assert.match(page, /mappedFile\.headers/);
  assert.match(page, /file: mappedFile/);
});

test("Data Mapping transforms detected Excel columns into canonical import rows", async () => {
  const { applyColumnMappings, createColumnMappings } = await importTypeScriptModule(
    "lib/data-hub/column-mapping.ts",
  );
  const source = {
    id: "sales",
    label: "Sales",
    description: "",
    visible: true,
    fields: [
      { key: "sale_date", label: "Sale Date", type: "date", required: true },
      { key: "model_code", label: "Model Code", type: "string", required: true },
      { key: "employee_code", label: "Employee Code", type: "string", required: false },
      { key: "sale_amount", label: "Sale Amount", type: "number", required: true },
    ],
    duplicateKey: ["sale_date", "model_code"],
  };
  const mappings = createColumnMappings(source, ["Sales Date", "Model Name", "SL Name", "Price"]);
  assert.deepEqual(
    mappings.slice(0, 4).map((mapping) => mapping.fieldKey),
    ["sale_date", "model_code", "employee_code", "sale_amount"],
  );
  assert.equal(mappings[2].status, "warning");
  const mapped = applyColumnMappings(
    { filename: "sales.csv", extension: "csv", headers: ["Sales Date", "Model Name", "SL Name", "Price"], rows: [{ "Sales Date": "2026-07-01", "Model Name": "M7040", "SL Name": "Aung", Price: "100" }], sheetName: "Sheet1" },
    mappings,
  );
  assert.deepEqual(mapped.headers, ["sale_date", "model_code", "employee_code", "sale_amount"]);
  assert.deepEqual(mapped.rows[0], { sale_date: "2026-07-01", model_code: "M7040", employee_code: "Aung", sale_amount: "100" });
});

test("Data Hub remains behind a future API boundary with no database mutation", async () => {
  const [service, page, schema] = await Promise.all([read("lib/data-hub/import-service.ts"), read("components/data-hub/data-hub-page.tsx"), read("db/schema.ts")]);
  assert.match(service, /completeSessionImport/);
  assert.match(service, /This boundary becomes the Data Hub API client/);
  assert.doesNotMatch(service, /\bfetch\s*\(/);
  assert.doesNotMatch(service, /drizzle|firebase|database/i);
  assert.doesNotMatch(page, /\bfetch\s*\(/);
  assert.doesNotMatch(schema, /import_history|data_import/);
});
