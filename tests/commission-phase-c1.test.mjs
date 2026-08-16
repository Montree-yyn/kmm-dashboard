import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const repoRoot = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");
const mapping = await tsImport("../lib/data-hub/column-mapping.ts", import.meta.url);
const sources = await tsImport("../lib/data-hub/source-definitions.ts", import.meta.url);
const validation = await tsImport("../lib/data-hub/validate-import.ts", import.meta.url);
const adapter = await tsImport("../lib/sales/compatibility-adapter.ts", import.meta.url);

function localOperationsDb() {
  const root = path.join(repoRoot, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  if (!existsSync(root)) return null;
  return readdirSync(root).filter((name) => name.endsWith(".sqlite"))
    .map((name) => path.join(root, name)).find((database) => {
      try {
        const output = execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'kai_metrics'"], { encoding: "utf8" });
        return Number(JSON.parse(output)[0]?.count) === 1;
      } catch { return false; }
    }) ?? null;
}

const operationsDb = localOperationsDb();
const salesSource = sources.getDataSourceDefinition("sales");
const baseRow = {
  sale_date: "2026-08-01", invoice_no: "C1-001", branch: "KMM01", model_code: "M7040",
  quantity: 1, sale_amount: "100000", final_received: "95000", gp1: "10000",
};

test("Commission C1 adds only a nullable local Operations D1 column", { skip: !operationsDb }, () => {
  const columns = JSON.parse(execFileSync("sqlite3", ["-json", operationsDb, "PRAGMA table_info(sales_transactions)"], { encoding: "utf8" }));
  const commission = columns.find((column) => column.name === "commission");
  assert.deepEqual({ type: commission?.type, notnull: commission?.notnull }, { type: "TEXT", notnull: 0 });
  const legacy = JSON.parse(execFileSync("sqlite3", ["-json", operationsDb, "SELECT COUNT(*) AS rows, SUM(CASE WHEN commission IS NULL THEN 1 ELSE 0 END) AS null_commission FROM sales_transactions WHERE company_id = 'kmm-company'"], { encoding: "utf8" }))[0];
  assert.ok(Number(legacy.rows) > 0);
  assert.ok(Number(legacy.null_commission) >= 0 && Number(legacy.null_commission) <= Number(legacy.rows));
  assert.match(read("drizzle/operations/0021_add_sales_commission.sql"), /independent[\s-]+production-commission lineage/i);
  assert.match(read("drizzle/production-commission/0001_commission_prod_001.sql"), /ALTER TABLE `sales_transactions` ADD COLUMN `commission` text/i);
});

test("Commission mapping recognizes CPI Total without confusing Total Expense", () => {
  const mappings = mapping.createColumnMappings(salesSource, ["Total", "Total Expense", "Commission Total"]);
  const byColumn = Object.fromEntries(mappings.filter((item) => item.excelColumn !== "—").map((item) => [item.excelColumn, item.fieldKey]));
  assert.equal(byColumn.Total, "commission");
  assert.equal(byColumn["Total Expense"], "expense");
  assert.equal(byColumn["Commission Total"], "commission");
  const totalMapping = mappings.find((item) => item.excelColumn === "Total");
  assert.ok(totalMapping);
  const mapped = mapping.applyColumnMappings({ filename: "2608_KMM_CPI.xlsx", extension: "xlsx", headers: ["Total"], rows: [{ Total: "1,250.50" }], sheetName: "CPI", headerRow: 4, headerConfidence: "high", detectedColumns: 1 }, [totalMapping]);
  assert.equal(mapped.rows[0].commission, "1,250.50");
});

test("Commission validation accepts null, zero, and decimal values but rejects invalid text", () => {
  const headers = [...Object.keys(baseRow), "commission"];
  for (const value of [null, "0", "1,250.50"]) {
    const result = validation.validateImportRows(salesSource, headers, [{ ...baseRow, commission: value }]);
    assert.equal(result.canImport, true, String(value));
  }
  const malformed = validation.validateImportRows(salesSource, headers, [{ ...baseRow, commission: "not-a-number" }]);
  assert.equal(malformed.canImport, false);
  assert.equal(malformed.wrongTypeCells, 1);
  assert.equal(malformed.issues[0]?.column, "commission");
});

test("Commission survives a D1-compatible nullable round trip and API adapter serialization", () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "kmm-commission-c1-"));
  const database = path.join(temporary, "operations.sqlite");
  try {
    execFileSync("sqlite3", [database, "CREATE TABLE sales_transactions (id TEXT PRIMARY KEY); ALTER TABLE sales_transactions ADD COLUMN commission text; INSERT INTO sales_transactions (id, commission) VALUES ('blank', NULL), ('zero', '0'), ('decimal', '1250.50');"], { encoding: "utf8" });
    const rows = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT id, commission FROM sales_transactions ORDER BY id"], { encoding: "utf8" }));
    assert.deepEqual(rows, [{ id: "blank", commission: null }, { id: "decimal", commission: "1250.50" }, { id: "zero", commission: "0" }]);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
  for (const [value, expected] of [[null, null], ["0", 0], ["1250.50", 1250.5]]) {
    const row = adapter.toCanonicalSalesRow({ id: "row", saleDate: "2026-08-01", importYear: 2026, importMonth: 8, branch: "KMM01", modelCode: "M7040", employeeCode: "EMP-1", quantity: 1, saleAmount: "100000", productType: "01-TT", model: "M7040", finalReceived: "95000", netReceived: null, gp1: "10000", expense: null, commission: value, salespersonCode: "SP-1", salespersonName: "Salesperson" });
    assert.equal(row.commission, expected);
    assert.equal(adapter.toLegacySalesRow(row).commission, expected);
  }
});

test("three controlled CPI Total samples retain exact Commission values end to end", () => {
  const mappings = mapping.createColumnMappings(salesSource, ["Total"]);
  const totalMapping = mappings.find((item) => item.excelColumn === "Total");
  assert.ok(totalMapping);
  const samples = [
    { salesperson: "SP-001", finalReceived: "95000", gp1: "10000", Total: "1,250.50", expected: 1250.5 },
    { salesperson: "SP-002", finalReceived: "200000", gp1: "30000", Total: "0", expected: 0 },
    { salesperson: "SP-003", finalReceived: "50000", gp1: "5000", Total: "", expected: null },
  ];
  const mapped = mapping.applyColumnMappings({ filename: "2608_KMM_CPI.xlsx", extension: "xlsx", headers: ["Total"], rows: samples, sheetName: "CPI", headerRow: 4, headerConfidence: "high", detectedColumns: 1 }, [totalMapping]);
  mapped.rows.forEach((row, index) => {
    const source = samples[index];
    const canonical = adapter.toCanonicalSalesRow({ id: `sample-${index}`, saleDate: "2026-08-01", importYear: 2026, importMonth: 8, branch: "KMM01", modelCode: "M7040", employeeCode: source.salesperson, quantity: 1, saleAmount: source.finalReceived, productType: "01-TT", model: "M7040", finalReceived: source.finalReceived, netReceived: null, gp1: source.gp1, expense: null, commission: row.commission === null || row.commission === undefined || String(row.commission).trim() === "" ? null : String(Number(String(row.commission).replaceAll(",", ""))), salespersonCode: source.salesperson, salespersonName: source.salesperson });
    assert.equal(canonical.commission, source.expected, source.salesperson);
    assert.equal(adapter.toLegacySalesRow(canonical).commission, source.expected, source.salesperson);
  });
});

test("authenticated import and Sales API include Commission without static fallback", () => {
  const importRoute = read("app/api/data-hub/sales/route.ts");
  const api = read("app/api/sales/route.ts");
  const client = read("lib/sales/client.ts");
  assert.match(importRoute, /commission\?: unknown/);
  assert.match(importRoute, /commission: numberOrNull\(row\.commission, "Commission"\)/);
  assert.match(importRoute, /must be numeric when provided/);
  assert.match(api, /toLegacySalesRow/);
  assert.match(read("lib/sales/compatibility-adapter.ts"), /commission: row\.commission/);
  assert.match(client, /commission: number \| null/);
  assert.match(client, /process\.env\.NODE_ENV === "production"\) throw/);
  assert.doesNotMatch(api, /dashboard-data\.json/);
});
