import assert from "node:assert/strict";
import test from "node:test";
import { buildProductionCommissionPreview, renderCommissionBackfillSql } from "../scripts/backfill-production-commission.mjs";

const masters = [
  { employeeCode: "MM220406", salespersonCode: "MM220406", salespersonName: "Htet Lin Aung", status: "active" },
  { employeeCode: "MM220407", salespersonCode: "MM220407", salespersonName: "Kaung Si Thu", status: "inactive" },
];
const aliases = [
  { sourceEmployeeCode: "MM230406", sourceSalespersonCode: null, sourceSalespersonName: "03-Lin Aung", sourceBranch: "KMM03", canonicalEmployeeCode: "MM220406", canonicalSalespersonCode: "MM220406" },
  { sourceEmployeeCode: "MM230407", sourceSalespersonCode: null, sourceSalespersonName: "03-Kaung Si Thu (Out)", sourceBranch: "KMM03", canonicalEmployeeCode: "MM220407", canonicalSalespersonCode: "MM220407" },
];
const row = (overrides = {}) => ({
  sourceRow: 4, refCode: "REF-1", invoiceNo: "INV-1", saleDate: "2026-08-01", branch: "KMM03", modelCode: "M6040+FD", employeeCode: "MM220406", salespersonCode: "MM220406", salespersonName: "03-Lin Aung", finalReceived: "100000", gp1: "10000", sourceCommission: { value: 2500, text: "2500" }, ...overrides,
});
const db = (overrides = {}) => ({ id: "tx-1", invoiceNo: "INV-1", saleDate: "2026-08-01", branch: "KMM03", modelCode: "M6040+FD", employeeCode: "MM220406", salespersonCode: null, salespersonName: "03-Htet Lin Aung", finalReceived: "100000", gp1: "10000", commission: null, ...overrides });

test("C3.2D canonical aliases match legacy production codes without fuzzy names", () => {
  const preview = buildProductionCommissionPreview([row({ employeeCode: "MM220406" })], [db({ employeeCode: "MM230406", salespersonName: "03-Lin Aung" })], masters, aliases);
  assert.equal(preview.summary.proposedWrites, 1);
  assert.equal(preview.summary.unresolvedPositiveCommission, 0);
  assert.equal(preview.rows[0].productionEmployeeCode, "MM230406");
  const mismatch = buildProductionCommissionPreview([row({ salespersonName: "03-Htet Lin Aung" })], [db({ employeeCode: "MM230406", salespersonName: "03-Other Person" })], masters, aliases);
  assert.equal(mismatch.summary.unmatched, 1);
});

test("C3.2D leaves zero-only ambiguity visible and blocks positive ambiguity", () => {
  const zero = buildProductionCommissionPreview([row({ sourceCommission: { value: 0, text: "0" } })], [db({ id: "tx-1" }), db({ id: "tx-2" })], masters, aliases);
  assert.equal(zero.summary.ambiguous, 1);
  assert.equal(zero.summary.unresolvedPositiveCommission, 0);
  const positive = buildProductionCommissionPreview([row()], [db({ id: "tx-1" }), db({ id: "tx-2" })], masters, aliases);
  assert.equal(positive.summary.financialCodeCollisions, 1);
  assert.equal(positive.summary.unresolvedPositiveCommission, 2500);
});

test("C3.2D SQL is transaction-id targeted and changes Commission only", () => {
  const preview = buildProductionCommissionPreview([row()], [db()], masters, aliases);
  const sql = renderCommissionBackfillSql(preview);
  const statements = sql.split("\n").filter((line) => !line.startsWith("--")).join("\n");
  assert.match(sql, /UPDATE sales_transactions SET commission/);
  assert.match(sql, /id = 'tx-1'/);
  assert.doesNotMatch(statements, /BEGIN|COMMIT|sale_amount|gp1|expense|booking|stock|target/i);
});
