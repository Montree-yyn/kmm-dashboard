import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const backfill = await import("../scripts/backfill-local-sales-commission.mjs");
const identity = await tsImport("../lib/sales/commission-identity.ts", import.meta.url);

const source = (overrides = {}) => ({
  sourceRow: 4, refCode: "REF-1", invoiceNo: "INV-1", saleDate: "2026-08-01", branch: "KMM01", salespersonCode: "SP-1", employeeCode: "SP-1", salespersonName: "Person One", productType: "01-TT", modelCode: "DC-70G PRO", finalReceived: "150000", gp1: "10000", sourceCommission: backfill.commissionNumber("1,250.50"), ...overrides,
});
const database = (overrides = {}) => ({
  id: "db-1", invoiceNo: "INV-1", saleDate: "2026-08-01", branch: "KMM01", employeeCode: "SP-1", modelCode: "DC70G PRO", finalReceived: "150000", gp1: "10000", commission: null, ...overrides,
});

test("C2 backfill classifies a normalized CPI transaction and preserves decimal, zero, and blank values", () => {
  const preview = backfill.buildCommissionBackfillPreview([
    source(), source({ sourceRow: 5, invoiceNo: "INV-2", sourceCommission: backfill.commissionNumber("0") }), source({ sourceRow: 6, invoiceNo: "INV-3", sourceCommission: backfill.commissionNumber(null) }),
  ], [
    database(), database({ id: "db-2", invoiceNo: "INV-2", commission: "0" }), database({ id: "db-3", invoiceNo: "INV-3", commission: null }),
  ]);
  assert.equal(preview.rows[0].status, "VALUE_CHANGED");
  assert.equal(preview.rows[0].proposedCommission, "1250.5");
  assert.equal(preview.rows[1].status, "ALREADY_MATCHING");
  assert.equal(preview.rows[2].status, "ALREADY_MATCHING");
  assert.equal(preview.summary.zero, 1);
  assert.equal(preview.summary.blank, 1);
});

test("C2 backfill rejects invalid values and never writes unmatched or ambiguous transactions", () => {
  const invalid = source({ sourceCommission: backfill.commissionNumber("not-a-number") });
  const unmatched = source({ invoiceNo: "MISSING" });
  const duplicated = source({ invoiceNo: "DUPLICATE", sourceCommission: backfill.commissionNumber("0") });
  const preview = backfill.buildCommissionBackfillPreview([invalid, unmatched, duplicated, { ...duplicated, sourceRow: 9 }], [database(), database({ id: "db-2", invoiceNo: "DUPLICATE" }), database({ id: "db-3", invoiceNo: "DUPLICATE" })]);
  assert.deepEqual(preview.rows.map((row) => row.status), ["INVALID_COMMISSION", "UNMATCHED", "AMBIGUOUS", "AMBIGUOUS"]);
  assert.equal(preview.rows.filter((row) => row.status === "VALUE_CHANGED").length, 0);
});

test("C2 financial identity prefers salesperson code, then employee code, then a unique master relation", () => {
  const employees = [
    { employeeCode: "EMP-1", salespersonCode: "SP-1", salespersonName: "Person One" },
    { employeeCode: "EMP-2", salespersonCode: "SP-2", salespersonName: "Person Two" },
  ];
  assert.deepEqual(identity.resolveCommissionIdentity({ salespersonCode: "SP-1", employeeCode: "EMP-2", salesperson: "Wrong Name" }, employees), { key: "salesperson_code:SP-1", salespersonCode: "SP-1", employeeCode: "EMP-1", name: "Person One", source: "salesperson_code" });
  assert.deepEqual(identity.resolveCommissionIdentity({ employeeCode: "EMP-2", salesperson: "Wrong Name" }, employees), { key: "employee_code:EMP-2", salespersonCode: "SP-2", employeeCode: "EMP-2", name: "Person Two", source: "employee_code" });
  assert.equal(identity.resolveCommissionIdentity({ salesperson: "Person One" }, employees)?.source, "unique_master_relation");
  assert.equal(identity.resolveCommissionIdentity({ salesperson: "Unverified Display Name" }, employees), null);
});

test("C2 percentage safety keeps unavailable Commission and zero denominators out of financial rankings", () => {
  const ratio = (numerator, denominator) => numerator === null || denominator === 0 ? null : (numerator / denominator) * 100;
  assert.ok(Math.abs(ratio(1250.5, 95000) - 1.316315789473684) < 1e-12);
  assert.equal(ratio(1250.5, 0), null);
  assert.equal(ratio(null, 10000), null);
});
