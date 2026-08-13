#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as XLSX from "@e965/xlsx";

const repoRoot = path.resolve(import.meta.dirname, "..");
const workbookPath = "/Users/CAKE/Documents/KMM_Sales_2026/01_Data/Sales/2608_KMM_CPI.v3.xlsx";
const legacyName = "01-Ye Htet";
const branch = "KMM01";
const canonicalCode = "MM240503";
const aliasId = "local-commission-c21-ye-htet-kmm01";
const evidence = "CPI v3 2026_KMM_DATA: exact source name 01-Ye Htet at KMM01 has 2 missing-code rows (Commission 400000) and coded KMM01 history exclusively uses MM240503; Master MM240503 is U Ye Htet.";

const text = (value) => String(value ?? "").trim();
const numeric = (value) => Number(text(value).replaceAll(",", "").replace(/^\((.*)\)$/, "-$1").replace(/\s/g, "")) || 0;

function localOperationsDb() {
  const directory = path.join(repoRoot, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  const database = readdirSync(directory).filter((name) => name.endsWith(".sqlite")).map((name) => path.join(directory, name)).find((candidate) => {
    const output = execFileSync("sqlite3", ["-json", candidate, "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'kai_metrics'"], { encoding: "utf8" });
    return Number(JSON.parse(output)[0]?.count) === 1;
  });
  if (!database) throw new Error("Local Operations D1 database was not found.");
  return database;
}

function auditSource() {
  if (!existsSync(workbookPath)) throw new Error(`CPI workbook is unavailable: ${workbookPath}`);
  const worksheet = XLSX.read(readFileSync(workbookPath), { type: "buffer" }).Sheets["2026_KMM_DATA"];
  if (!worksheet) throw new Error("Expected worksheet 2026_KMM_DATA was not found.");
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false, blankrows: false }).slice(3);
  const relevant = rows.filter((row) => text(row[2]) === branch && text(row[22]) === legacyName);
  const missingCode = relevant.filter((row) => text(row[21]) === "");
  const coded = [...new Set(relevant.map((row) => text(row[21])).filter(Boolean))];
  const missingCommission = missingCode.reduce((sum, row) => sum + numeric(row[63]), 0);
  if (missingCode.length !== 2 || missingCommission !== 400000 || coded.length !== 1 || coded[0] !== canonicalCode) {
    throw new Error("Controlled legacy alias evidence no longer matches the approved CPI source.");
  }
  return { relevantRows: relevant.length, missingCodeRows: missingCode.length, missingCommission, codedSalespersonCodes: coded };
}

function query(database, sql) {
  const output = execFileSync("sqlite3", ["-json", database, sql], { encoding: "utf8" }).trim();
  return output ? JSON.parse(output) : [];
}

function auditMaster(database) {
  const rows = query(database, `SELECT employee_code AS employeeCode, salesperson_code AS salespersonCode, salesperson_name AS salespersonName, status FROM salesperson_master WHERE company_id = 'kmm-company' AND salesperson_code = '${canonicalCode}'`);
  if (rows.length !== 1 || rows[0].employeeCode !== canonicalCode || rows[0].salespersonName !== "U Ye Htet" || rows[0].status !== "active") throw new Error("Canonical Salesperson Master evidence is not unique and active.");
  return rows[0];
}

function apply(database) {
  const sql = `BEGIN IMMEDIATE;
    DELETE FROM salesperson_identity_aliases WHERE company_id = 'kmm-company' AND source_salesperson_code IS NULL AND source_employee_code IS NULL AND source_salesperson_name = '${legacyName}' AND source_branch = '${branch}';
    INSERT INTO salesperson_identity_aliases (id, tenant_id, company_id, source_salesperson_code, source_employee_code, source_salesperson_name, source_branch, canonical_employee_code, canonical_salesperson_code, evidence, created_by)
    VALUES ('${aliasId}', 'kmm-tenant', 'kmm-company', NULL, NULL, '${legacyName}', '${branch}', '${canonicalCode}', '${canonicalCode}', '${evidence.replaceAll("'", "''")}', 'local-commission-c2.1');
    COMMIT;`;
  execFileSync("sqlite3", [database, sql], { encoding: "utf8" });
}

const applyRequested = process.argv.includes("--apply");
const database = localOperationsDb();
const source = auditSource();
const master = auditMaster(database);
if (applyRequested) apply(database);
const stored = query(database, `SELECT source_salesperson_name AS sourceSalespersonName, source_branch AS sourceBranch, canonical_salesperson_code AS canonicalSalespersonCode FROM salesperson_identity_aliases WHERE company_id = 'kmm-company' AND source_salesperson_name = '${legacyName}' AND source_branch = '${branch}'`);
console.log(JSON.stringify({ mode: applyRequested ? "LOCAL_APPLY" : "PREVIEW", source, master, storedAliases: stored.length }, null, 2));
