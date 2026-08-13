#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as XLSX from "@e965/xlsx";

const repoRoot = path.resolve(import.meta.dirname, "..");
const defaultWorkbook = "/Users/CAKE/Documents/KMM_Sales_2026/01_Data/Sales/2608_KMM_CPI.xlsx";

const stable = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const modelKey = (value) => stable(value).replace(/[^A-Z0-9]/g, "");
const usable = (value) => stable(value) !== "" && stable(value) !== "-";

export function commissionNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return { value: null, text: null };
  const input = String(value).trim().replaceAll(",", "").replace(/^\((.*)\)$/, "-$1").replace(/\s/g, "");
  if (input === "-" || input === "—") return { value: null, text: null };
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) return { value: Number.NaN, text: null };
  return { value: numeric, text: String(numeric) };
}

function workbookDate(value) {
  if (typeof value !== "number") throw new Error(`Expected Excel serial date, received ${String(value)}`);
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) throw new Error(`Invalid Excel serial date: ${value}`);
  return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
}

export function transactionKey(row) {
  return [
    stable(row.invoiceNo),
    stable(row.saleDate),
    stable(row.branch),
    modelKey(row.modelCode),
    stable(row.employeeCode),
    commissionNumber(row.finalReceived).text,
    commissionNumber(row.gp1).text,
  ].join("|");
}

function groupByKey(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = transactionKey(row);
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }
  return grouped;
}

export function readCpiCommissionWorkbook(workbookPath) {
  if (!existsSync(workbookPath)) throw new Error(`CPI workbook is unavailable: ${workbookPath}`);
  const workbook = XLSX.read(readFileSync(workbookPath), { type: "buffer", cellDates: false });
  const worksheetName = "2026_KMM_DATA";
  const worksheet = workbook.Sheets[worksheetName];
  if (!worksheet) throw new Error(`Expected worksheet ${worksheetName} was not found.`);
  const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true, blankrows: false });
  const headers = allRows[2] ?? [];
  if (headers[63] !== "Total") throw new Error(`Expected CPI Total at BL (index 63), received ${String(headers[63])}`);
  return {
    worksheetName,
    totalHeader: headers[63],
    rows: allRows.slice(3).filter((row) => usable(row[0])).map((row, index) => ({
      sourceRow: index + 4,
      refCode: String(row[0] ?? "").trim(),
      invoiceNo: String(row[1] ?? "").trim(),
      branch: String(row[2] ?? "").trim(),
      saleDate: workbookDate(row[6]),
      salespersonCode: String(row[21] ?? "").trim(),
      employeeCode: String(row[21] ?? "").trim(),
      salespersonName: String(row[22] ?? "").trim(),
      productType: String(row[25] ?? "").trim(),
      modelCode: String(row[27] ?? "").trim(),
      finalReceived: row[43],
      gp1: row[47],
      sourceCommission: commissionNumber(row[63]),
    })),
  };
}

export function buildCommissionBackfillPreview(sourceRows, databaseRows) {
  const sourceByKey = groupByKey(sourceRows);
  const databaseByKey = groupByKey(databaseRows);
  const rows = sourceRows.map((source) => {
    const sourceMatches = sourceByKey.get(transactionKey(source)) ?? [];
    const databaseMatches = databaseByKey.get(transactionKey(source)) ?? [];
    const proposedCommission = source.sourceCommission.text;
    let status;
    let transaction = null;
    if (Number.isNaN(source.sourceCommission.value)) status = "INVALID_COMMISSION";
    else if (sourceMatches.length !== 1 || databaseMatches.length !== 1) status = databaseMatches.length || sourceMatches.length > 1 ? "AMBIGUOUS" : "UNMATCHED";
    else {
      transaction = databaseMatches[0];
      status = commissionNumber(transaction.commission).text === proposedCommission ? "ALREADY_MATCHING" : "VALUE_CHANGED";
    }
    return {
      status,
      transactionId: transaction?.id ?? null,
      refCode: source.refCode,
      invoiceNo: source.invoiceNo,
      saleDate: source.saleDate,
      branch: source.branch,
      salespersonCode: source.salespersonCode || null,
      employeeCode: transaction?.employeeCode ?? null,
      modelCode: source.modelCode,
      finalReceived: commissionNumber(source.finalReceived).text,
      currentCommission: transaction ? commissionNumber(transaction.commission).text : null,
      sourceCommission: proposedCommission,
      proposedCommission,
    };
  });
  const amount = (items) => items.reduce((sum, item) => sum + (Number(item.sourceCommission) || 0), 0);
  const byStatus = Object.fromEntries(["VALUE_CHANGED", "ALREADY_MATCHING", "UNMATCHED", "AMBIGUOUS", "INVALID_COMMISSION"].map((status) => [status, rows.filter((row) => row.status === status)]));
  return {
    rows,
    summary: {
      sourceRows: rows.length,
      sourceCommissionTotal: amount(rows.filter((row) => row.status !== "INVALID_COMMISSION")),
      matchedCommissionTotal: amount([...byStatus.VALUE_CHANGED, ...byStatus.ALREADY_MATCHING]),
      unmatchedCommissionTotal: amount(byStatus.UNMATCHED),
      ambiguousCommissionTotal: amount(byStatus.AMBIGUOUS),
      invalidCommissionTotal: amount(byStatus.INVALID_COMMISSION),
      valueChanged: byStatus.VALUE_CHANGED.length,
      alreadyMatching: byStatus.ALREADY_MATCHING.length,
      unmatched: byStatus.UNMATCHED.length,
      ambiguous: byStatus.AMBIGUOUS.length,
      invalidCommission: byStatus.INVALID_COMMISSION.length,
      blank: rows.filter((row) => row.sourceCommission === null).length,
      zero: rows.filter((row) => row.sourceCommission === "0").length,
    },
  };
}

function localOperationsDb() {
  const directory = path.join(repoRoot, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  const database = readdirSync(directory).filter((name) => name.endsWith(".sqlite")).map((name) => path.join(directory, name)).find((candidate) => {
    const output = execFileSync("sqlite3", ["-json", candidate, "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'kai_metrics'"], { encoding: "utf8" });
    return Number(JSON.parse(output)[0]?.count) === 1;
  });
  if (!database) throw new Error("Local Operations D1 database was not found.");
  return database;
}

function databaseRows(database) {
  return JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT id, invoice_no AS invoiceNo, sale_date AS saleDate, branch, model_code AS modelCode, employee_code AS employeeCode, final_received AS finalReceived, gp1, commission FROM sales_transactions WHERE company_id = 'kmm-company'"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
}

function applyPreview(database, preview) {
  const updates = preview.rows.filter((row) => row.status === "VALUE_CHANGED");
  const statements = updates.map((row) => `UPDATE sales_transactions SET commission = ${row.proposedCommission === null ? "NULL" : `'${row.proposedCommission}'`} WHERE id = '${row.transactionId}';`);
  if (!statements.length) return 0;
  execFileSync("sqlite3", [database, `BEGIN IMMEDIATE; ${statements.join(" ")} COMMIT;`], { encoding: "utf8" });
  return updates.length;
}

function report(preview, source) {
  const { summary } = preview;
  return {
    workbook: path.basename(source),
    worksheet: "2026_KMM_DATA",
    header: "BL / Total",
    ...summary,
    reconciliationDifference: summary.sourceCommissionTotal - summary.matchedCommissionTotal - summary.unmatchedCommissionTotal - summary.ambiguousCommissionTotal - summary.invalidCommissionTotal,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const apply = process.argv.includes("--apply");
  const source = process.argv.find((argument) => argument.endsWith(".xlsx")) ?? defaultWorkbook;
  const database = localOperationsDb();
  const workbook = readCpiCommissionWorkbook(source);
  const preview = buildCommissionBackfillPreview(workbook.rows, databaseRows(database));
  if (apply && (preview.summary.unmatched || preview.summary.invalidCommission)) throw new Error("Local backfill is blocked: unmatched or invalid Commission rows exist.");
  const rowsUpdated = apply ? applyPreview(database, preview) : 0;
  console.log(JSON.stringify({ ...report(preview, source), mode: apply ? "LOCAL_APPLY" : "PREVIEW", rowsUpdated }, null, 2));
}
