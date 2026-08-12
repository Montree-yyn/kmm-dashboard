import { File } from "node:buffer";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { tsImport } from "tsx/esm/api";

const root = resolve(import.meta.dirname, "..");
const localDb = process.env.KMM_LOCAL_D1 ?? resolve(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/25b8c09731e6730e7346a57bf0354f6ad5ba2f35e7efd12ab95fbb1bbe08d08a.sqlite");
const outputDir = resolve(process.env.KMM_OPERATIONS_BOOTSTRAP_OUTPUT ?? "/tmp/kmm-operations-bootstrap");
const sourceFiles = {
  sales: resolve(root, "../01_Data/Sales/2607_KMM_CPI.xlsx"),
  booking: resolve(root, "../01_Data/Booking/KMMF3002 KMM Booking Data.2.xlsx"),
  stock: resolve(root, "../01_Data/Stock/2607_KMM_R2_STOCK.xlsx"),
  targetsOriginal: resolve(root, "../01_Data/Sales/Sales KPI.xlsx"),
  targetsRevised: resolve(root, "../01_Data/Sales/SALES KPI Update.xlsx"),
  employees: resolve(root, "../01_Data/Sales/KMM_Sales_Marketing_Employee_List.xlsx"),
  organization: resolve(root, "../01_Data/Sales/KMM_Sales_Oragnization.xlsx"),
} as const;

const { parseSpreadsheetFile } = await tsImport("../lib/data-hub/parse-spreadsheet.ts", import.meta.url);
const { applyColumnMappings, createColumnMappings } = await tsImport("../lib/data-hub/column-mapping.ts", import.meta.url);
const { getImportSourceDefinition } = await tsImport("../lib/data-hub/source-definitions.ts", import.meta.url);
const { validateImportRows } = await tsImport("../lib/data-hub/validate-import.ts", import.meta.url);
const { adaptStockRow } = await tsImport("../lib/operations/adapters.ts", import.meta.url);
const { getCurrentStockRows, getStockUnit, getStockValue } = await tsImport("../lib/dashboard/stock-selectors.ts", import.meta.url);

type Module = "sales" | "booking" | "stock";
type SqlValue = string | number | null;

function localRows(table: string): Record<string, SqlValue>[] {
  return JSON.parse(execFileSync("sqlite3", ["-json", localDb, `SELECT * FROM ${table}`], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }) || "[]") as Record<string, SqlValue>[];
}

function sqlValue(value: SqlValue) {
  if (value === null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

function insertStatements(table: string, rows: Record<string, SqlValue>[]) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  return rows.map((row) => `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES (${columns.map((column) => sqlValue(row[column] ?? null)).join(", ")});`).join("\n");
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function rowsHash(rows: Record<string, SqlValue>[]) {
  const canonical = rows.map((row) => JSON.stringify(Object.fromEntries(Object.keys(row).sort().map((key) => [key, row[key]])))).sort().join("\n");
  return sha256(canonical);
}

async function sourceFingerprint(path: string) {
  const [details, contents] = await Promise.all([stat(path), readFile(path)]);
  return { filename: basename(path), bytes: details.size, modifiedAt: details.mtime.toISOString(), sha256: sha256(contents) };
}

async function parseAndValidate(module: Module, path: string) {
  const bytes = await readFile(path);
  const parsed = await parseSpreadsheetFile(new File([bytes], basename(path)), { module });
  const source = getImportSourceDefinition(module, "product");
  const mappings = createColumnMappings(source, parsed.headers, {}, parsed.inferredFields);
  const mapped = applyColumnMappings(parsed, mappings);
  const validation = validateImportRows(source, mapped.headers, mapped.rows, {
    quantityRule: mapped.quantityRule,
    duplicateRule: mapped.duplicateRule,
    sourceRowNumbers: mapped.sourceRowNumbers,
    sourceRowSignatures: mapped.sourceRowSignatures,
  });
  return {
    filename: basename(path), sheet: mapped.sheetName, headerRow: mapped.headerRow,
    columns: mapped.detectedColumns, parsedRows: mapped.rows.length,
    validRows: validation.validRows, warningCells: validation.warningCells,
    invalidRows: validation.invalidRows, duplicateRows: validation.duplicateRows,
    canImport: validation.canImport,
  };
}

function canonicalStock(rows: Record<string, SqlValue>[]) {
  const camelCaseRow = (row: Record<string, SqlValue>) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), value]),
  );
  const adapted = rows.map((row) => adaptStockRow(camelCaseRow(row)));
  const current = getCurrentStockRows(adapted);
  return {
    snapshotDate: [...new Set(adapted.map((row) => row.snapshotDate).filter(Boolean))].sort().at(-1) ?? null,
    currentDeduplicatedRows: current.length,
    units: getStockUnit(adapted),
    value: getStockValue(adapted),
  };
}

const [sales, booking, stock, salesperson, targets] = ["sales_transactions", "booking_transactions", "stock_transactions", "salesperson_master", "business_targets"].map(localRows);
const [salesParse, bookingParse, stockParse] = await Promise.all([
  parseAndValidate("sales", sourceFiles.sales),
  parseAndValidate("booking", sourceFiles.booking),
  parseAndValidate("stock", sourceFiles.stock),
]);

const baseline = {
  sales: { rows: sales.length, firstDate: sales.map((row) => String(row.sale_date)).sort()[0], lastDate: sales.map((row) => String(row.sale_date)).sort().at(-1), hash: rowsHash(sales) },
  booking: { rows: booking.length, firstDate: booking.map((row) => String(row.booking_date)).sort()[0], lastDate: booking.map((row) => String(row.booking_date)).sort().at(-1), hash: rowsHash(booking) },
  stock: { rows: stock.length, hash: rowsHash(stock), ...canonicalStock(stock) },
  salesperson: { rows: salesperson.length, hash: rowsHash(salesperson) },
  targets: { rows: targets.length, hash: rowsHash(targets), sourceVersions: [...new Set(targets.map((row) => String(row.source_version)))].sort() },
};

const expected = { sales: 3376, booking: 398, stock: 748, salesperson: 18, targets: 72, stockUnits: 90, stockValue: 14651394000 };
if (baseline.sales.rows !== expected.sales || baseline.booking.rows !== expected.booking || baseline.stock.rows !== expected.stock || baseline.salesperson.rows !== expected.salesperson || baseline.targets.rows !== expected.targets || baseline.stock.units !== expected.stockUnits || baseline.stock.value !== expected.stockValue) throw new Error("Canonical local operational baseline does not match the approved production values.");
if (![salesParse, bookingParse, stockParse].every((result) => result.canImport) || salesParse.validRows !== expected.sales || stockParse.validRows !== expected.stock) throw new Error("Approved Sales or Stock workbook staging validation does not match the approved production row counts.");
const sourceRebuildParity = {
  sales: salesParse.validRows === expected.sales,
  booking: bookingParse.validRows === expected.booking,
  stock: stockParse.validRows === expected.stock,
};

await mkdir(outputDir, { recursive: true });
const bootstrapHistory = [
  ["bootstrap-sales-2026-08-10", "sales", "2026-08-10", sales.length],
  ["bootstrap-booking-2026-08-10", "booking", "2026-08-10", booking.length],
  ["bootstrap-stock-2026-08-10", "stock", "2026-08-10", stock.length],
].map(([id, module, importedAt, rows]) => ({ id, tenant_id: "kmm-tenant", company_id: "kmm-company", module, import_year: 2026, import_month: 8, filename: "production-operations-bootstrap", status: "success", total_rows: rows, valid_rows: rows, warning_rows: 0, error_rows: 0, duration_ms: 0, error_report: null, imported_by: "production-bootstrap", imported_at: importedAt }));
// Wrangler's D1 SQL-file importer provides whole-file failure safety but rejects
// explicit BEGIN/COMMIT statements; keep each deterministic INSERT standalone.
const sql = [insertStatements("salesperson_master", salesperson), insertStatements("business_targets", targets), insertStatements("sales_transactions", sales), insertStatements("booking_transactions", booking), insertStatements("stock_transactions", stock), insertStatements("data_import_history", bootstrapHistory), ""].filter(Boolean).join("\n");
const manifest = {
  format: "kmm-operations-bootstrap/v1", generatedAt: new Date().toISOString(),
  sourceFiles: Object.fromEntries(await Promise.all(Object.entries(sourceFiles).map(async ([name, path]) => [name, await sourceFingerprint(path)]))),
  sourceStaging: { sales: salesParse, booking: bookingParse, stock: stockParse, sourceRebuildParity }, baseline,
  package: { sqlFile: "kmm-operations-bootstrap.sql", sha256: sha256(sql), bootstrapHistoryRows: bootstrapHistory.length },
};
await writeFile(resolve(outputDir, "kmm-operations-bootstrap.sql"), sql, { mode: 0o600 });
await writeFile(resolve(outputDir, "kmm-operations-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ outputDir, baseline, sourceStaging: manifest.sourceStaging, sqlSha256: manifest.package.sha256 }, null, 2));
