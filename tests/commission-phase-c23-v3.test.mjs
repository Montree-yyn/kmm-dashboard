import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import * as XLSX from "@e965/xlsx";

const repoRoot = path.resolve(import.meta.dirname, "..");
const workbookPath = "/Users/CAKE/Documents/KMM_Sales_2026/01_Data/Sales/2608_KMM_CPI.v3.xlsx";
const historicalCodes = ["MM150701", "MM150807", "MM170309", "MM190905", "MM220404", "MM220407", "MM230802", "MM250602"];
const text = (value) => String(value ?? "").trim();
const amount = (value) => Number(text(value).replaceAll(",", "").replace(/^\((.*)\)$/, "-$1")) || 0;

function sourceRows() {
  const workbook = XLSX.read(readFileSync(workbookPath), { type: "buffer", cellDates: false });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets["2026_KMM_DATA"], { header: 1, raw: true, defval: null, blankrows: false });
  assert.equal(rows[2]?.[63], "Total");
  return rows.slice(3).filter((row) => text(row[0]));
}

function operationsDb() {
  const directory = path.join(repoRoot, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  if (!existsSync(directory)) return null;
  return readdirSync(directory).filter((name) => name.endsWith(".sqlite")).map((name) => path.join(directory, name)).find((database) => {
    try { return JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'kai_metrics'"], { encoding: "utf8" }))[0]?.count === 1; } catch { return false; }
  }) ?? null;
}

test("C2.3 reads CPI v3 without dropping the first data row", () => {
  const rows = sourceRows();
  assert.equal(rows.length, 3417);
  assert.equal(rows.reduce((total, row) => total + amount(row[63]), 0), 341705800);
  const aung = rows.filter((row) => text(row[0]) === "KMM020001" && text(row[1]) === "121-2301-0001");
  assert.deepEqual(aung.map((row) => [text(row[21]), text(row[22]), amount(row[63])]), [["MM170313", "02-Aung Bo Bo", 481400]]);
});

test("C2.3 preserves code separation for Kaung Si Thu and Htet Lin Aung", () => {
  const rows = sourceRows();
  const kaung = rows.filter((row) => text(row[22]) === "03-Kaung Si Thu (Out)");
  const htet = rows.filter((row) => text(row[22]) === "03-Htet Lin Aung");
  assert.equal(kaung.length, 70);
  assert.equal(kaung.reduce((total, row) => total + amount(row[63]), 0), 12042400);
  assert.deepEqual([...new Set(kaung.map((row) => text(row[21])))] , ["MM220407"]);
  assert.equal(htet.length, 229);
  assert.equal(htet.reduce((total, row) => total + amount(row[63]), 0), 29500000);
  assert.deepEqual([...new Set(htet.map((row) => text(row[21])))] , ["MM220406"]);
});

test("C2.3 Local D1 retains source financial values and historical canonical identities", { skip: !operationsDb() }, () => {
  const database = operationsDb();
  const query = (sql) => JSON.parse(execFileSync("sqlite3", ["-json", database, sql], { encoding: "utf8" }));
  assert.deepEqual(query("SELECT COUNT(*) AS rows, SUM(CAST(commission AS REAL)) AS commission FROM sales_transactions WHERE company_id = 'kmm-company'"), [{ rows: 3417, commission: 341705800 }]);
  assert.deepEqual(query("SELECT employee_code AS code, status FROM salesperson_master WHERE company_id = 'kmm-company' AND employee_code IN ('MM150701','MM150807','MM170309','MM190905','MM220404','MM220407','MM230802','MM250602') ORDER BY employee_code"), historicalCodes.sort().map((code) => ({ code, status: "inactive" })));
  assert.deepEqual(query("SELECT COUNT(*) AS rows, SUM(CAST(commission AS REAL)) AS commission FROM sales_transactions WHERE company_id = 'kmm-company' AND employee_code = 'MM220407'"), [{ rows: 70, commission: 12042400 }]);
  assert.deepEqual(query("SELECT COUNT(*) AS rows, SUM(CAST(commission AS REAL)) AS commission FROM sales_transactions WHERE company_id = 'kmm-company' AND employee_code = 'MM220406'"), [{ rows: 229, commission: 29500000 }]);
});
