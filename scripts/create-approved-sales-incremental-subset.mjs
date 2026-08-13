#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "@e965/xlsx";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
const positional = args.filter((value, index) => value !== "--output" && index !== outputIndex + 1);
const sourcePath = positional.find((value) => value.endsWith(".xlsx")) ?? "/Users/CAKE/Documents/KMM_Sales_2026/01_Data/Sales/2608_KMM_CPI.v3.xlsx";
const reportPath = positional.find((value) => value.endsWith(".json")) ?? "/Users/CAKE/Documents/KMM_Sales_2026/commission-c3-2b-backup.uZqjyA/c3-2c-reconciliation.json";

if (!outputPath) throw new Error("Usage: node scripts/create-approved-sales-incremental-subset.mjs --output /absolute/path/subset.xlsx [source.xlsx] [reconciliation.json]");
if (!existsSync(sourcePath)) throw new Error(`CPI source is unavailable: ${sourcePath}`);
if (!existsSync(reportPath)) throw new Error(`C3.2C reconciliation report is unavailable: ${reportPath}`);

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const approved = report.allMissing.filter((row) => row.category === "PRODUCTION_DATA_OLDER_THAN_CPI");
if (approved.length !== 11) throw new Error(`Expected exactly 11 approved CPI-only rows, received ${approved.length}.`);
const expectedValue = approved.reduce((sum, row) => sum + Number(row.finalReceived || 0), 0);
const expectedGp = approved.reduce((sum, row) => sum + Number(row.gp1 || 0), 0);
if (expectedValue !== 1_490_266_100 || expectedGp !== 115_837_850) throw new Error(`Approved subset KPI mismatch: value=${expectedValue}, gp=${expectedGp}`);
if (approved.some((row) => row.saleDate < "2026-08-05" || row.saleDate > "2026-08-10" || !["KMM01", "KMM02", "KMM03"].includes(row.branch))) throw new Error("Approved subset contains a row outside the C3.2D date/branch scope.");

const workbook = XLSX.read(readFileSync(sourcePath), { type: "buffer", cellDates: false });
const sheet = workbook.Sheets["2026_KMM_DATA"];
if (!sheet) throw new Error("Expected worksheet 2026_KMM_DATA was not found.");
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, blankrows: false });
const headers = matrix[2] ?? [];
if (headers[63] !== "Total") throw new Error(`Expected CPI Total at BL (index 63), received ${String(headers[63])}`);
const usableRows = matrix.slice(3).filter((row) => String(row[0] ?? "").trim() !== "");
const sourceRows = new Map(approved.map((row) => [row.sourceRow, usableRows[row.sourceRow - 4]]));
const selectedRows = approved.slice().sort((a, b) => a.sourceRow - b.sourceRow).map((row) => {
  const sourceRow = sourceRows.get(row.sourceRow);
  if (!sourceRow) throw new Error(`Source row ${row.sourceRow} was not found in CPI workbook.`);
  return sourceRow;
});
const outputWorkbook = XLSX.utils.book_new();
const outputSheet = XLSX.utils.aoa_to_sheet([["Approved CPI v3 incremental Sales subset"], [], headers, ...selectedRows]);
XLSX.utils.book_append_sheet(outputWorkbook, outputSheet, "2026_KMM_DATA");
writeFileSync(path.resolve(outputPath), XLSX.write(outputWorkbook, { type: "buffer", bookType: "xlsx" }));
console.log(JSON.stringify({ source: path.basename(sourcePath), worksheet: "2026_KMM_DATA", rows: selectedRows.length, salesValue: expectedValue, gp: expectedGp, commission: 0, output: path.resolve(outputPath) }, null, 2));
