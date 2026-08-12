#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "@e965/xlsx";

const ROOT = resolve(import.meta.dirname, "..");
const ORIGINAL_FILE = resolve(ROOT, "../01_Data/Sales/Sales KPI.xlsx");
const REVISED_FILE = resolve(ROOT, "../01_Data/Sales/SALES KPI Update.xlsx");
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const COMPANY_METRICS = Object.freeze([
  ["SALES_REVENUE", "Revenue (2026)"],
  ["GP1", "GP1"],
  ["SALES_UNITS", "Total Units"],
]);
const PRODUCT_METRICS = Object.freeze([
  ["TT", "TT"],
  ["CH", "CH"],
  ["EX_TP", "EX&TP"],
]);

export const TARGET_SOURCE_VERSIONS = Object.freeze({
  originalH1: { source: "Sales KPI.xlsx", sourceVersion: "2026-Original-H1", months: [1, 2, 3, 4, 5, 6] },
  revisedH2: { source: "SALES KPI Update.xlsx", sourceVersion: "2026-Revised-H2", months: [7, 8, 9, 10, 11, 12] },
});

function numeric(value, label) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replaceAll(",", ""));
  if (!Number.isFinite(parsed)) throw new Error(`Missing or invalid approved target cell: ${label}`);
  return parsed;
}

export function readKpiWorkbook(file) {
  const workbook = XLSX.read(readFileSync(file), { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets["SL 2026"];
  if (!sheet) throw new Error(`Target workbook has no SL 2026 sheet: ${file}`);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  const headerIndex = rows.findIndex((row) => row.includes("Category") && MONTHS.every((month) => row.includes(month)));
  if (headerIndex < 0) throw new Error(`Target workbook is missing a Category / Jan-Dec header row: ${file}`);
  const headers = rows[headerIndex];
  const categoryColumn = headers.indexOf("Category");
  const monthColumns = new Map(MONTHS.map((month) => [month, headers.indexOf(month)]));
  if ([...monthColumns.values()].some((index) => index < 0)) throw new Error(`Target workbook is missing a Jan-Dec header row: ${file}`);
  const categories = new Map(rows.slice(headerIndex + 1).map((row) => [String(row[categoryColumn] ?? "").trim(), row]));
  const valuesFor = (category) => {
    const row = categories.get(category);
    if (!row) throw new Error(`Target workbook is missing ${category}: ${file}`);
    return MONTHS.map((month) => numeric(row[monthColumns.get(month)], `${category} ${month}`));
  };
  return {
    company: Object.fromEntries(COMPANY_METRICS.map(([metric, category]) => [metric, valuesFor(category)])),
    product: Object.fromEntries(PRODUCT_METRICS.map(([group, category]) => [group, valuesFor(category)])),
  };
}

/**
 * The updated workbook is H1 actuals plus the approved H2 revised plan.
 * This explicit month split prevents H1 actual performance from ever being
 * imported as a Target, including if its cells are later edited.
 */
export function buildVersioned2026Targets(original, revised) {
  const records = [];
  const append = (sourcePolicy, sourceData, metric, values, productGroup = "") => {
    for (const month of sourcePolicy.months) {
      const value = values[month - 1];
      if (!Number.isFinite(value)) throw new Error(`Invalid ${metric} target for ${month}`);
      records.push({ year: 2026, month, metric, targetValue: String(value), productGroup, branchId: "", salespersonId: "", approvalStatus: "approved", effectiveFrom: `2026-${String(month).padStart(2, "0")}-01`, source: sourcePolicy.source, sourceVersion: sourcePolicy.sourceVersion });
    }
  };
  for (const [metric] of COMPANY_METRICS) {
    append(TARGET_SOURCE_VERSIONS.originalH1, original, metric, original.company[metric]);
    append(TARGET_SOURCE_VERSIONS.revisedH2, revised, metric, revised.company[metric]);
  }
  for (const [group] of PRODUCT_METRICS) {
    append(TARGET_SOURCE_VERSIONS.originalH1, original, "SALES_UNITS", original.product[group], group);
    append(TARGET_SOURCE_VERSIONS.revisedH2, revised, "SALES_UNITS", revised.product[group], group);
  }
  if (records.length !== 72) throw new Error(`Expected exactly 72 approved target records, received ${records.length}`);
  return records;
}

function sqlLiteral(value) { return `'${String(value).replaceAll("'", "''")}'`; }

export function targetsToSql(records) {
  const columns = ["id", "tenant_id", "company_id", "target_year", "target_month", "metric", "target_value", "product_group", "branch_id", "salesperson_id", "source", "source_version", "approval_status", "effective_from", "created_by", "updated_by"];
  const values = records.map((record) => {
    const id = `local-target-${record.sourceVersion.toLowerCase()}-${record.month}-${record.metric.toLowerCase()}-${record.productGroup.toLowerCase() || "company"}`.replaceAll(/[^a-z0-9-]/g, "-");
    return [id, "kmm-tenant", "kmm-company", record.year, record.month, record.metric, record.targetValue, record.productGroup, record.branchId, record.salespersonId, record.source, record.sourceVersion, record.approvalStatus, record.effectiveFrom, "local-phase-3b-target-import", "local-phase-3b-target-import"].map(sqlLiteral).join(", ");
  });
  return `BEGIN IMMEDIATE;\nINSERT INTO business_targets (${columns.join(", ")}) VALUES\n${values.map((value) => `  (${value})`).join(",\n")};\nCOMMIT;\n`;
}

export function readApproved2026Targets() {
  return buildVersioned2026Targets(readKpiWorkbook(ORIGINAL_FILE), readKpiWorkbook(REVISED_FILE));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const records = readApproved2026Targets();
  if (process.argv.includes("--sql")) process.stdout.write(targetsToSql(records));
  else console.log(JSON.stringify(records, null, 2));
}
