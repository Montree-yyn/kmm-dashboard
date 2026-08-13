#!/usr/bin/env node

/**
 * Auditable, fail-closed Production Commission backfill for C3.2D.
 *
 * The default mode is read-only preview.  `--apply` is deliberately explicit
 * and writes only transaction-id-targeted `sales_transactions.commission`
 * updates generated from the fresh preview.  Identity aliases are read from
 * Production and are never guessed or created by this script.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { commissionNumber, readCpiCommissionWorkbook } from "./backfill-local-sales-commission.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const defaultSource = "/Users/CAKE/Documents/KMM_Sales_2026/01_Data/Sales/2608_KMM_CPI.v3.xlsx";
const defaultConfig = path.join(repoRoot, "wrangler.production-commission.jsonc");
const defaultPreview = "/Users/CAKE/Documents/KMM_Sales_2026/commission-c3-2b-backup.uZqjyA/c3-2d-commission-preview.json";
const defaultSql = "/Users/CAKE/Documents/KMM_Sales_2026/commission-c3-2b-backup.uZqjyA/c3-2d-commission-backfill.sql";

export const APPROVED_C3_2D = Object.freeze({
  sourceRows: 3417,
  commissionTotal: 341705800,
  productionRows: 3387,
});

const text = (value) => String(value ?? "").trim();
const stable = (value) => text(value).replace(/\s+/g, " ").toUpperCase();
const usableCode = (value) => {
  const normalized = stable(value);
  return normalized && normalized !== "-" && normalized !== "—" ? normalized : "";
};
const modelKey = (value) => stable(value).replace(/[^A-Z0-9]/g, "");
const nameKey = (value) => stable(value);
const amount = (value) => Number(value ?? 0) || 0;

function readJsonFile(filePath) {
  if (!existsSync(filePath)) throw new Error(`JSON input is unavailable: ${filePath}`);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function resultRows(payload) {
  const envelope = Array.isArray(payload) ? payload[0] : payload;
  if (!envelope?.success || !Array.isArray(envelope.results)) {
    throw new Error("Unexpected Wrangler D1 JSON result.");
  }
  return envelope.results;
}

function remoteQuery(config, sql) {
  const output = execFileSync("npx", [
    "wrangler", "d1", "execute", "kmm-operations", "--remote", "--config", config,
    "--json", "--command", sql,
  ], { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return resultRows(JSON.parse(output));
}

function remoteRows(config) {
  return remoteQuery(config, "SELECT id, invoice_no AS invoiceNo, sale_date AS saleDate, branch, model_code AS modelCode, employee_code AS employeeCode, salesperson_code AS salespersonCode, salesperson_name AS salespersonName, final_received AS finalReceived, gp1, commission, quantity, sale_amount AS saleAmount, product_type AS productType, expense FROM sales_transactions WHERE company_id='kmm-company'");
}

function remoteMasters(config) {
  return remoteQuery(config, "SELECT employee_code AS employeeCode, salesperson_code AS salespersonCode, salesperson_name AS salespersonName, status FROM salesperson_master WHERE company_id='kmm-company'");
}

function remoteAliases(config) {
  return remoteQuery(config, "SELECT source_salesperson_code AS sourceSalespersonCode, source_employee_code AS sourceEmployeeCode, source_salesperson_name AS sourceSalespersonName, source_branch AS sourceBranch, canonical_employee_code AS canonicalEmployeeCode, canonical_salesperson_code AS canonicalSalespersonCode FROM salesperson_identity_aliases WHERE company_id='kmm-company'");
}

function masterIndex(masters) {
  const index = new Map();
  for (const master of masters) {
    const employee = usableCode(master.employeeCode);
    const salesperson = usableCode(master.salespersonCode);
    if (employee) index.set(employee, master);
    if (salesperson) index.set(salesperson, master);
  }
  return index;
}

/**
 * Resolve only direct Master codes or exact, company-scoped aliases.  Names
 * are supporting evidence for an already-coded alias; no fuzzy matching is
 * allowed.  The returned identity is used only for transaction matching and
 * reconciliation, not as a silent identity merge.
 */
export function canonicalIdentity(row, masters, aliases) {
  const index = masterIndex(masters);
  const employeeCode = usableCode(row.employeeCode);
  const salespersonCode = usableCode(row.salespersonCode);
  const direct = index.get(employeeCode) ?? index.get(salespersonCode);
  if (direct) return { code: usableCode(direct.employeeCode), source: "master" };

  const exactAliases = aliases.filter((alias) => {
    const sourceEmployee = usableCode(alias.sourceEmployeeCode);
    const sourceSalesperson = usableCode(alias.sourceSalespersonCode);
    const codeMatches = (sourceEmployee && sourceEmployee === employeeCode)
      || (sourceSalesperson && sourceSalesperson === salespersonCode);
    return codeMatches
      && stable(alias.sourceBranch) === stable(row.branch)
      && nameKey(alias.sourceSalespersonName) === nameKey(row.salespersonName);
  });
  if (exactAliases.length !== 1) return { code: employeeCode || salespersonCode, source: "raw" };
  return { code: usableCode(exactAliases[0].canonicalEmployeeCode), source: "controlled_alias" };
}

function transactionKey(row, masters, aliases) {
  return [
    stable(row.invoiceNo),
    stable(row.saleDate),
    stable(row.branch),
    modelKey(row.modelCode),
    canonicalIdentity(row, masters, aliases).code,
    commissionNumber(row.finalReceived).text,
    commissionNumber(row.gp1).text,
  ].join("|");
}

function groupByKey(rows, masters, aliases) {
  const groups = new Map();
  for (const row of rows) {
    const key = transactionKey(row, masters, aliases);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

function sourceAmount(row) {
  const value = row.sourceCommission && typeof row.sourceCommission === "object"
    ? row.sourceCommission.text
    : row.sourceCommission;
  return amount(value);
}

function sum(rows) {
  return rows.reduce((total, row) => total + sourceAmount(row), 0);
}

export function buildProductionCommissionPreview(sourceRows, productionRows, masters, aliases) {
  const sourceGroups = groupByKey(sourceRows, masters, aliases);
  const productionGroups = groupByKey(productionRows, masters, aliases);
  const rows = sourceRows.map((source) => {
    const key = transactionKey(source, masters, aliases);
    const sourceMatches = sourceGroups.get(key) ?? [];
    const productionMatches = productionGroups.get(key) ?? [];
    const proposedCommission = source.sourceCommission.text;
    let status = "UNMATCHED";
    let transaction = null;
    if (Number.isNaN(source.sourceCommission.value)) status = "INVALID";
    else if (sourceMatches.length !== 1 || productionMatches.length !== 1) {
      status = sourceMatches.length > 1 || productionMatches.length > 1 ? "AMBIGUOUS" : "UNMATCHED";
    } else {
      transaction = productionMatches[0];
      status = commissionNumber(transaction.commission).text === proposedCommission ? "ALREADY_MATCHING" : "VALUE_CHANGED";
    }
    return {
      status,
      key,
      transactionId: transaction?.id ?? null,
      sourceRow: source.sourceRow,
      refCode: source.refCode,
      invoiceNo: source.invoiceNo,
      saleDate: source.saleDate,
      branch: source.branch,
      modelCode: source.modelCode,
      salespersonCode: source.salespersonCode || null,
      salespersonName: source.salespersonName || null,
      canonicalEmployeeCode: canonicalIdentity(source, masters, aliases).code || null,
      productionEmployeeCode: transaction?.employeeCode ?? null,
      productionSalespersonName: transaction?.salespersonName ?? null,
      currentCommission: transaction ? commissionNumber(transaction.commission).text : null,
      sourceCommission: proposedCommission,
      proposedCommission,
    };
  });

  const byStatus = (status) => rows.filter((row) => row.status === status);
  const matched = rows.filter((row) => row.status === "VALUE_CHANGED" || row.status === "ALREADY_MATCHING");
  const unresolved = rows.filter((row) => row.status === "UNMATCHED" || row.status === "AMBIGUOUS" || row.status === "INVALID");
  const positiveUnresolved = unresolved.filter((row) => amount(row.sourceCommission) > 0);
  // A financial collision is any positive source row with more than one
  // possible Production transaction. Zero-only duplicate groups are allowed
  // by the approved C3.2D gate and remain visible as AMBIGUOUS.
  const financialCollisions = rows.filter((row) => row.status === "AMBIGUOUS" && amount(row.sourceCommission) > 0);
  const summary = {
    sourceRows: rows.length,
    sourceCommissionTotal: sum(rows),
    matched: matched.length,
    matchedCommissionTotal: sum(matched),
    alreadyMatching: byStatus("ALREADY_MATCHING").length,
    alreadyMatchingCommissionTotal: sum(byStatus("ALREADY_MATCHING")),
    valueChanged: byStatus("VALUE_CHANGED").length,
    proposedWrites: byStatus("VALUE_CHANGED").length,
    proposedCommissionTotal: sum(byStatus("VALUE_CHANGED")),
    unmatched: byStatus("UNMATCHED").length,
    unmatchedCommissionTotal: sum(byStatus("UNMATCHED")),
    ambiguous: byStatus("AMBIGUOUS").length,
    ambiguousCommissionTotal: sum(byStatus("AMBIGUOUS")),
    invalid: byStatus("INVALID").length,
    invalidCommissionTotal: sum(byStatus("INVALID")),
    unresolvedPositiveRows: positiveUnresolved.length,
    unresolvedPositiveCommission: sum(positiveUnresolved),
    financialCodeCollisions: financialCollisions.length,
    zeroRows: rows.filter((row) => row.sourceCommission === "0").length,
    blankRows: rows.filter((row) => row.sourceCommission === null).length,
    writeTransactionIds: byStatus("VALUE_CHANGED").map((row) => row.transactionId),
  };
  if (new Set(summary.writeTransactionIds).size !== summary.writeTransactionIds.length) {
    throw new Error("Production preview generated duplicate transaction IDs.");
  }
  return { rows, summary };
}

export function renderCommissionBackfillSql(preview) {
  const writes = preview.rows.filter((row) => row.status === "VALUE_CHANGED");
  if (!writes.length) return "-- C3.2D idempotent preview: no Commission updates required.\n";
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const statements = writes.map((row) => {
    if (!row.transactionId || row.proposedCommission === null) throw new Error(`Missing targeted value for source row ${row.sourceRow}.`);
    return `UPDATE sales_transactions SET commission = ${quote(row.proposedCommission)} WHERE company_id = 'kmm-company' AND id = ${quote(row.transactionId)} AND commission IS NULL;`;
  });
  return [
    "-- Generated by scripts/backfill-production-commission.mjs from a fresh C3.2D preview.",
    "-- Only sales_transactions.commission is changed; no Sales/GP/Expense/Booking/Stock/Target fields are touched.",
    "BEGIN IMMEDIATE;",
    ...statements,
    "COMMIT;",
    "",
  ].join("\n");
}

function assertApprovedPreview(preview, productionRows, requireEmptyCommission = false) {
  const { summary } = preview;
  if (summary.sourceRows !== APPROVED_C3_2D.sourceRows) throw new Error(`C3.2D source row guard failed: ${summary.sourceRows}`);
  if (summary.sourceCommissionTotal !== APPROVED_C3_2D.commissionTotal) throw new Error(`C3.2D Commission total guard failed: ${summary.sourceCommissionTotal}`);
  if (productionRows.length !== APPROVED_C3_2D.productionRows) throw new Error(`C3.2D Production row guard failed: ${productionRows.length}`);
  if (summary.unresolvedPositiveRows !== 0 || summary.unresolvedPositiveCommission !== 0) throw new Error("C3.2D preview has unresolved positive Commission.");
  if (summary.financialCodeCollisions !== 0) throw new Error("C3.2D preview has financial code collisions.");
  if (summary.invalid !== 0) throw new Error("C3.2D preview has invalid Commission values.");
  if (requireEmptyCommission && productionRows.some((row) => row.commission !== null && row.commission !== undefined && text(row.commission) !== "")) {
    throw new Error("C3.2D apply guard failed: Production Commission is no longer empty.");
  }
}

function parseArgs(argv) {
  const args = { source: defaultSource, config: defaultConfig, preview: defaultPreview, sql: defaultSql, apply: false, productionJson: null, mastersJson: null, aliasesJson: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--apply") args.apply = true;
    else if (value === "--source") args.source = argv[++index];
    else if (value === "--config") args.config = argv[++index];
    else if (value === "--preview-out") args.preview = argv[++index];
    else if (value === "--sql-out") args.sql = argv[++index];
    else if (value === "--production-json") args.productionJson = argv[++index];
    else if (value === "--masters-json") args.mastersJson = argv[++index];
    else if (value === "--aliases-json") args.aliasesJson = argv[++index];
    else if (value === "--help") {
      console.log("Usage: node scripts/backfill-production-commission.mjs [--apply] [--source path] [--preview-out path] [--sql-out path] [--production-json path --masters-json path --aliases-json path]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

export function createProductionPreview({ sourcePath = defaultSource, productionRows, masters, aliases }) {
  const sourceRows = readCpiCommissionWorkbook(sourcePath).rows;
  const preview = buildProductionCommissionPreview(sourceRows, productionRows, masters, aliases);
  return { source: path.basename(sourcePath), worksheet: "2026_KMM_DATA", header: "BL / Total", productionRows: productionRows.length, ...preview };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const args = parseArgs(process.argv.slice(2));
  const productionRows = args.productionJson ? readJsonFile(args.productionJson) : remoteRows(args.config);
  const masters = args.mastersJson ? readJsonFile(args.mastersJson) : remoteMasters(args.config);
  const aliases = args.aliasesJson ? readJsonFile(args.aliasesJson) : remoteAliases(args.config);
  const preview = createProductionPreview({ sourcePath: args.source, productionRows, masters, aliases });
  assertApprovedPreview(preview, productionRows, args.apply);
  const sql = renderCommissionBackfillSql(preview);
  writeFileSync(args.preview, JSON.stringify({ generatedAt: new Date().toISOString(), mode: args.apply ? "APPLY" : "PREVIEW", ...preview }, null, 2));
  writeFileSync(args.sql, sql);
  if (args.apply) {
    // The SQL is generated from this fresh, guarded preview; no caller can
    // substitute a hand-written statement without changing this report.
    execFileSync("npx", ["wrangler", "d1", "execute", "kmm-operations", "--remote", "--config", args.config, "--file", args.sql], { cwd: repoRoot, stdio: "inherit" });
  }
  const compactSummary = { ...preview.summary };
  delete compactSummary.writeTransactionIds;
  console.log(JSON.stringify({ mode: args.apply ? "PRODUCTION_APPLY" : "PRODUCTION_PREVIEW", source: preview.source, productionRows: preview.productionRows, summary: compactSummary, preview: args.preview, sql: args.sql }, null, 2));
}
