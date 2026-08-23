import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const source = await import(new URL("../scripts/import-local-targets.mjs", import.meta.url));
const targetBusiness = await tsImport("../lib/targets/business-service.ts", import.meta.url);

test("versioned Target import keeps revised-workbook H1 actuals out of Target records", () => {
  const original = source.readKpiWorkbook(fileURLToPath(new URL("../../01_Data/Sales/Sales KPI.xlsx", import.meta.url)));
  const revised = source.readKpiWorkbook(fileURLToPath(new URL("../../01_Data/Sales/SALES KPI Update.xlsx", import.meta.url)));
  const records = source.buildVersioned2026Targets(original, revised);
  const januaryUnits = records.find((row) => row.month === 1 && row.metric === "SALES_UNITS" && !row.productGroup);
  const julyUnits = records.find((row) => row.month === 7 && row.metric === "SALES_UNITS" && !row.productGroup);
  assert.equal(records.length, 72);
  assert.equal(januaryUnits?.targetValue, "55");
  assert.equal(januaryUnits?.sourceVersion, "2026-Original-H1");
  assert.notEqual(januaryUnits?.targetValue, String(revised.company.SALES_UNITS[0]));
  assert.equal(julyUnits?.targetValue, String(revised.company.SALES_UNITS[6]));
  assert.equal(julyUnits?.sourceVersion, "2026-Revised-H2");
});

test("approved Target rows provide exactly company metrics and the supported product scopes", () => {
  const records = source.readApproved2026Targets();
  const company = records.filter((row) => !row.productGroup);
  const product = records.filter((row) => row.productGroup);
  assert.equal(company.length, 36);
  assert.equal(product.length, 36);
  assert.deepEqual([...new Set(product.map((row) => row.productGroup))].sort(), ["CH", "EX_TP", "TT"]);
  assert.equal(records.some((row) => row.productGroup === "EX" || row.productGroup === "TP"), false);
  for (const row of records) {
    assert.equal(row.branchId, "");
    assert.equal(row.salespersonId, "");
    assert.equal(row.approvalStatus, "approved");
  }
});

test("Sales target plan selects the latest approved revision and preserves missing months", () => {
  const rows = source.readApproved2026Targets()
    .filter((row) => row.metric === "SALES_UNITS" && !row.productGroup)
    .map((row) => ({
      targetYear: row.year,
      targetMonth: row.month,
      metric: row.metric,
      targetValue: row.targetValue,
      productGroup: row.productGroup,
      source: row.source,
      sourceVersion: row.sourceVersion,
      effectiveFrom: row.effectiveFrom,
      updatedAt: row.effectiveFrom,
    }));
  rows.push({
    ...rows[0],
    targetValue: "59",
    sourceVersion: "2026-Approved-Revision-2",
    effectiveFrom: "2026-08-01",
    updatedAt: "2026-08-01",
  });
  const plan = targetBusiness.buildLatestCompanyMonthlyTargetPlan(rows, "SALES_UNITS");
  assert.equal(plan?.year, 2026);
  assert.equal(plan?.monthlyTargets.length, 12);
  assert.equal(plan?.monthlyTargets[0]?.target, 59);
  assert.equal(plan?.monthlyTargets[6]?.sourceVersion, "2026-Revised-H2");

  const partialNextYear = targetBusiness.buildLatestCompanyMonthlyTargetPlan([
    ...rows,
    {
      ...rows[0],
      targetYear: 2027,
      targetMonth: 2,
      targetValue: "61",
      sourceVersion: "2027-Approved-Plan",
      effectiveFrom: "2027-02-01",
      updatedAt: "2027-02-01",
    },
  ], "SALES_UNITS");
  assert.equal(partialNextYear?.year, 2027);
  assert.equal(partialNextYear?.monthlyTargets[0], null);
  assert.equal(partialNextYear?.monthlyTargets[1]?.target, 61);
});

test("Target migration is additive and runtime access remains read-only", async () => {
  const [migration, repository, service, business] = await Promise.all([
    read("drizzle/0010_common_shocker.sql"),
    read("lib/targets/repository.ts"),
    read("lib/targets/business-service.ts"),
    read("lib/kai/tools/kmm-business.ts"),
  ]);
  assert.match(migration, /^CREATE TABLE `business_targets`/);
  assert.match(migration, /CREATE UNIQUE INDEX `business_targets_exact_version_unique`/);
  assert.doesNotMatch(migration, /\b(?:DROP|DELETE|UPDATE|ALTER)\b/i);
  assert.match(repository, /approvalStatus, "approved"/);
  assert.match(repository, /listApprovedCompanyTargets/);
  assert.doesNotMatch(repository, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(service, /getLatestCompanyMonthlyTargetPlan/);
  assert.match(service, /targetProgress/);
  assert.match(business, /ยังไม่มี Target ระดับสาขา/);
  assert.match(business, /EX&TP/);
  assert.match(business, /KAI อยู่ในโหมด Read-only/);
});

test("Target intent keeps branch scope unavailable and EX/TP combined", async () => {
  const sourceText = await read("lib/kai/tools/kmm-business.ts");
  assert.match(sourceText, /export function resolveTargetIntent/);
  assert.match(sourceText, /product === "EX" \|\| product === "TP"/);
  assert.match(sourceText, /branchRequested/);
  assert.match(sourceText, /EX_TP/);
});
