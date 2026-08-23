#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "@e965/xlsx";

const [workbookPath, productionSnapshotPath, outputPath] = process.argv.slice(2);
if (!workbookPath || !productionSnapshotPath || !outputPath) {
  throw new Error("Usage: node scripts/analyze-c3-2c-reconciliation.mjs <cpi-v3.xlsx> <production.json> <output.json>");
}

const stable = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const modelKey = (value) => stable(value).replace(/[^A-Z0-9]/g, "");
const numeric = (value) => {
  const normalized = String(value ?? "").trim().replaceAll(",", "").replace(/^\((.*)\)$/, "-$1").replace(/\s/g, "");
  if (!normalized || normalized === "-" || normalized === "—") return 0;
  const result = Number(normalized);
  if (!Number.isFinite(result)) throw new Error(`Non-numeric value: ${String(value)}`);
  return result;
};
const dateFromExcel = (value) => {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) throw new Error(`Invalid Excel date: ${String(value)}`);
  return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
};
const key = (...values) => values.map(stable).join("|");
const indexBy = (rows, selector) => {
  const index = new Map();
  for (const row of rows) {
    const entry = index.get(selector(row)) ?? [];
    entry.push(row);
    index.set(selector(row), entry);
  }
  return index;
};
const total = (rows, selector = (row) => row.commission) => rows.reduce((sum, row) => sum + selector(row), 0);

const workbook = XLSX.read(readFileSync(workbookPath), { type: "buffer", cellDates: false });
const sheet = workbook.Sheets["2026_KMM_DATA"];
if (!sheet) throw new Error("CPI v3 worksheet 2026_KMM_DATA is missing.");
const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, blankrows: false });
if (raw[2]?.[63] !== "Total") throw new Error("CPI v3 BL Total header is not present.");

const source = raw.slice(3)
  .filter((row) => stable(row[0]) && stable(row[0]) !== "-")
  .map((row, index) => ({
    sourceRow: index + 4,
    refCode: String(row[0] ?? "").trim(),
    invoiceNo: String(row[1] ?? "").trim(),
    branch: String(row[2] ?? "").trim(),
    saleDate: dateFromExcel(row[6]),
    customer: String(row[8] ?? "").trim(),
    salespersonCode: String(row[21] ?? "").trim(),
    employeeCode: String(row[21] ?? "").trim(),
    salespersonName: String(row[22] ?? "").trim(),
    outDetected: /\(out\)\s*$/i.test(String(row[22] ?? "")),
    productType: String(row[25] ?? "").trim(),
    modelCode: String(row[27] ?? "").trim(),
    chassis: String(row[28] ?? "").trim(),
    engineNumber: String(row[29] ?? "").trim(),
    finalReceived: numeric(row[43]),
    gp1: numeric(row[47]),
    commission: numeric(row[63]),
  }));

const snapshot = JSON.parse(readFileSync(productionSnapshotPath, "utf8"));
const production = snapshot[0]?.results ?? snapshot.results;
if (!Array.isArray(production)) throw new Error("Production snapshot does not contain D1 query results.");
const database = production.map((row) => ({
  id: String(row.id),
  invoiceNo: String(row.invoiceNo ?? "").trim(),
  saleDate: String(row.saleDate ?? "").trim(),
  branch: String(row.branch ?? "").trim(),
  modelCode: String(row.modelCode ?? "").trim(),
  employeeCode: String(row.employeeCode ?? "").trim(),
  salespersonCode: String(row.salespersonCode ?? "").trim(),
  salespersonName: String(row.salespersonName ?? "").trim(),
  finalReceived: numeric(row.finalReceived),
  gp1: numeric(row.gp1),
}));
const productionMaxSaleDate = database.reduce((latest, row) => row.saleDate > latest ? row.saleDate : latest, "");

const primary = (row) => key(row.invoiceNo, row.saleDate, row.branch, modelKey(row.modelCode), row.employeeCode, row.finalReceived, row.gp1);
const identityIndependent = (row) => key(row.invoiceNo, row.saleDate, row.branch, modelKey(row.modelCode), row.finalReceived, row.gp1);
const noGp = (row) => key(row.invoiceNo, row.saleDate, row.branch, modelKey(row.modelCode), row.finalReceived);
const invoiceBranchModel = (row) => key(row.invoiceNo, row.branch, modelKey(row.modelCode));
const invoiceModelValue = (row) => key(row.invoiceNo, modelKey(row.modelCode), row.finalReceived);
const sourcePrimary = indexBy(source, primary);
const dbPrimary = indexBy(database, primary);
const dbIdentityIndependent = indexBy(database, identityIndependent);
const dbNoGp = indexBy(database, noGp);
const dbInvoiceBranchModel = indexBy(database, invoiceBranchModel);
const dbInvoiceModelValue = indexBy(database, invoiceModelValue);

const matched = [];
const duplicateComposite = [];
const missing = [];
for (const row of source) {
  const sourceMatches = sourcePrimary.get(primary(row)) ?? [];
  const productionMatches = dbPrimary.get(primary(row)) ?? [];
  if (sourceMatches.length === 1 && productionMatches.length === 1) {
    matched.push({ ...row, productionId: productionMatches[0].id });
  } else if (productionMatches.length || sourceMatches.length > 1) {
    duplicateComposite.push({ ...row, sourceKeyMultiplicity: sourceMatches.length, productionKeyMultiplicity: productionMatches.length });
  } else {
    missing.push(row);
  }
}

const classifiedMissing = missing.map((row) => {
  const candidates = [
    { kind: "identity_independent", rows: dbIdentityIndependent.get(identityIndependent(row)) ?? [] },
    { kind: "same_transaction_except_gp", rows: dbNoGp.get(noGp(row)) ?? [] },
    { kind: "same_invoice_branch_model", rows: dbInvoiceBranchModel.get(invoiceBranchModel(row)) ?? [] },
    { kind: "same_invoice_model_value", rows: dbInvoiceModelValue.get(invoiceModelValue(row)) ?? [] },
  ];
  const exactIdentityIndependent = candidates[0].rows;
  const exactNoGp = candidates[1].rows;
  const invoiceBranchModelRows = candidates[2].rows;
  const invoiceModelValueRows = candidates[3].rows;
  let category;
  let evidence;
  let candidate = null;
  if (exactIdentityIndependent.length === 1) {
    category = "SALESPERSON_CODE_CHANGED";
    candidate = exactIdentityIndependent[0];
    evidence = "Invoice/date/branch/model/Sales Value/GP match exactly; salesperson code differs.";
  } else if (exactNoGp.length === 1) {
    category = "TRANSACTION_KEY_CHANGED";
    candidate = exactNoGp[0];
    evidence = "Invoice/date/branch/model/Sales Value match exactly; GP differs.";
  } else if (invoiceBranchModelRows.length === 1 || invoiceModelValueRows.length === 1) {
    category = "TRANSACTION_KEY_CHANGED";
    candidate = invoiceBranchModelRows.length === 1 ? invoiceBranchModelRows[0] : invoiceModelValueRows[0];
    evidence = "A single deterministic invoice/model candidate exists, but one or more transaction fields differ.";
  } else if (!invoiceBranchModelRows.length && !invoiceModelValueRows.length && row.saleDate > productionMaxSaleDate) {
    category = "PRODUCTION_DATA_OLDER_THAN_CPI";
    evidence = `CPI sale date is after the Production sales cutoff (${productionMaxSaleDate}) and no deterministic Production candidate exists.`;
  } else if (!invoiceBranchModelRows.length && !invoiceModelValueRows.length) {
    category = "PRODUCTION_MISSING_TRANSACTION";
    evidence = "No Production row shares the CPI invoice + branch + model or invoice + model + Sales Value evidence.";
  } else {
    category = "AMBIGUOUS";
    evidence = "More than one deterministic Production candidate exists; no safe one-to-one match.";
  }
  return {
    ...row,
    category,
    evidence,
    candidateCount: Object.fromEntries(candidates.map((entry) => [entry.kind, entry.rows.length])),
    candidate: candidate ? {
      id: candidate.id,
      invoiceNo: candidate.invoiceNo,
      saleDate: candidate.saleDate,
      branch: candidate.branch,
      modelCode: candidate.modelCode,
      employeeCode: candidate.employeeCode,
      salespersonCode: candidate.salespersonCode,
      salespersonName: candidate.salespersonName,
      finalReceived: candidate.finalReceived,
      gp1: candidate.gp1,
    } : null,
  };
});

const summarize = (rows) => Object.fromEntries([...new Set(rows.map((row) => row.category))].sort().map((category) => {
  const entries = rows.filter((row) => row.category === category);
  return [category, { rows: entries.length, commission: total(entries) }];
}));
const by = (rows, field) => Object.fromEntries([...new Set(rows.map((row) => row[field]))].sort().map((value) => {
  const entries = rows.filter((row) => row[field] === value);
  return [value || "(blank)", { rows: entries.length, commission: total(entries), salesValue: total(entries, (row) => row.finalReceived), gp: total(entries, (row) => row.gp1) }];
}));
const person = (code) => ({
  cpiRows: source.filter((row) => row.salespersonCode === code).length,
  productionRows: database.filter((row) => row.employeeCode === code || row.salespersonCode === code).length,
  unmatched: classifiedMissing.filter((row) => row.salespersonCode === code),
});
const impactRows = classifiedMissing.filter((row) => ["PRODUCTION_MISSING_TRANSACTION", "PRODUCTION_DATA_OLDER_THAN_CPI"].includes(row.category));
const monthBy = (rows) => by(rows.map((row) => ({ ...row, month: row.saleDate.slice(0, 7) })), "month");
const sourceOnlyPrimaryKeys = [...sourcePrimary.keys()].filter((value) => !dbPrimary.has(value));
const productionOnlyPrimaryKeys = [...dbPrimary.keys()].filter((value) => !sourcePrimary.has(value));
const duplicateSourceKeys = [...sourcePrimary.entries()].filter(([, rows]) => rows.length > 1);
const duplicateProductionKeys = [...dbPrimary.entries()].filter(([, rows]) => rows.length > 1);

const report = {
  source: { workbook: path.basename(workbookPath), sheet: "2026_KMM_DATA", rows: source.length, commissionTotal: total(source), positiveRows: source.filter((row) => row.commission > 0).length, zeroRows: source.filter((row) => row.commission === 0).length },
  production: { rows: database.length, maxSaleDate: productionMaxSaleDate },
  transactionReconciliation: {
    oneToOnePrimaryMatched: matched.length,
    duplicateCompositeRows: duplicateComposite.length,
    unmatchedRows: missing.length,
    unmatchedPositiveRows: classifiedMissing.filter((row) => row.commission > 0).length,
    unmatchedPositiveCommission: total(classifiedMissing.filter((row) => row.commission > 0)),
    sourcePrimaryUniqueKeys: sourcePrimary.size,
    productionPrimaryUniqueKeys: dbPrimary.size,
    primaryKeyIntersection: [...sourcePrimary.keys()].filter((value) => dbPrimary.has(value)).length,
    sourceOnlyPrimaryKeys: sourceOnlyPrimaryKeys.length,
    productionOnlyPrimaryKeys: productionOnlyPrimaryKeys.length,
    sourceDuplicateKeyGroups: duplicateSourceKeys.length,
    sourceDuplicateRowsBeyondUniqueKeys: source.length - sourcePrimary.size,
    productionDuplicateKeyGroups: duplicateProductionKeys.length,
    productionDuplicateRowsBeyondUniqueKeys: database.length - dbPrimary.size,
    countEquation: `${matched.length} one-to-one + ${duplicateComposite.length} duplicate/composite + ${missing.length} unmatched = ${source.length} CPI rows`,
  },
  missingPositive: classifiedMissing.filter((row) => row.commission > 0).sort((a, b) => stable(a.salespersonName).localeCompare(stable(b.salespersonName)) || stable(a.branch).localeCompare(stable(b.branch)) || a.saleDate.localeCompare(b.saleDate) || stable(a.refCode).localeCompare(stable(b.refCode))),
  allMissing: classifiedMissing.sort((a, b) => stable(a.salespersonName).localeCompare(stable(b.salespersonName)) || stable(a.branch).localeCompare(stable(b.branch)) || a.saleDate.localeCompare(b.saleDate) || stable(a.refCode).localeCompare(stable(b.refCode))),
  rootCause: summarize(classifiedMissing),
  rootCausePositive: summarize(classifiedMissing.filter((row) => row.commission > 0)),
  byBranch: by(classifiedMissing.filter((row) => row.commission > 0), "branch"),
  bySalesperson: by(classifiedMissing.filter((row) => row.commission > 0), "salespersonCode"),
  mm220407: person("MM220407"),
  mm220406: person("MM220406"),
  proposedSalesImpactIfOnlyGenuinelyMissingInserted: {
    rows: impactRows.length,
    salesValue: total(impactRows, (row) => row.finalReceived),
    gp: total(impactRows, (row) => row.gp1),
    engineUnits: total(impactRows.filter((row) => ["01-TT", "02-CH", "03-TP", "04-EX"].includes(stable(row.productType))), () => 1),
    byMonth: monthBy(impactRows),
    byBranch: by(impactRows, "branch"),
    bySalesperson: by(impactRows, "salespersonCode"),
  },
};
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, transactionReconciliation: report.transactionReconciliation, rootCause: report.rootCause, mm220407: { cpiRows: report.mm220407.cpiRows, productionRows: report.mm220407.productionRows, missingRows: report.mm220407.unmatched.length, missingCommission: total(report.mm220407.unmatched) }, mm220406: { cpiRows: report.mm220406.cpiRows, productionRows: report.mm220406.productionRows, missingRows: report.mm220406.unmatched.length, missingCommission: total(report.mm220406.unmatched) }, impact: report.proposedSalesImpactIfOnlyGenuinelyMissingInserted }, null, 2));
