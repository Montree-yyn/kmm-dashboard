import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const incremental = await tsImport("../lib/data-hub/sales-incremental.ts", import.meta.url);

const { APPROVED_SALES_INCREMENTAL_GUARD, buildSalesIncrementalPreview, normalizeSalesDate, salesTransactionIdentity } = incremental;

function row(index, overrides = {}) {
  return {
    id: `row-${index}`,
    saleDate: "2026-08-06",
    invoiceNo: `121-2608-${String(index).padStart(4, "0")}`,
    branch: index % 3 === 0 ? "KMM01" : index % 3 === 1 ? "KMM02" : "KMM03",
    modelCode: "M6240HI+FD",
    productType: index < 9 ? "01-TT" : "06-IM",
    employeeCode: "MM230301",
    salespersonCode: null,
    salespersonName: "03-Nandar Hlaing Win",
    quantity: index < 9 ? 1 : 0,
    saleAmount: index === 10 ? 490266100 : 100000000,
    finalReceived: index === 10 ? 490266100 : 100000000,
    gp1: index === 10 ? 15837850 : 10000000,
    commission: 0,
    ...overrides,
  };
}

const approvedRows = Array.from({ length: 11 }, (_, index) => row(index));

test("Excel serial dates normalize to the canonical sale date", () => {
  assert.equal(normalizeSalesDate(46239), "2026-08-05");
  assert.equal(normalizeSalesDate("2026-08-10"), "2026-08-10");
  assert.equal(normalizeSalesDate("not-a-date"), null);
});

test("approved 11-row subset preview is exact and append-only", () => {
  const preview = buildSalesIncrementalPreview(approvedRows, []);
  assert.equal(preview.mode, "append");
  assert.equal(preview.currentRows, 3376 - 3376);
  assert.equal(preview.proposedRows, 11);
  assert.equal(preview.newRows, 11);
  assert.equal(preview.alreadyExists, 0);
  assert.equal(preview.ambiguous, 0);
  assert.equal(preview.invalid, 0);
  assert.equal(preview.expectedRowsAfter, 11);
  assert.equal(preview.quantityDelta, 9);
  assert.equal(preview.salesValueDelta, 1_490_266_100);
  assert.equal(preview.gpDelta, 115_837_850);
  assert.equal(preview.commissionDelta, 0);
  assert.equal(preview.deletedRows, 0);
  assert.equal(preview.overwrittenRows, 0);
  assert.equal(preview.canCommit, false, "the production guard must fail when the current row count is not 3376");
  assert.match(preview.violations.join(";"), /current Sales rows must be 3376/);
});

test("the approved production guard passes only with 3,376 existing rows", () => {
  const existing = Array.from({ length: 3376 }, (_, index) => row(index + 100, {
    saleDate: "2026-07-31",
    invoiceNo: `existing-${index}`,
    quantity: 1,
    saleAmount: 1,
    finalReceived: 1,
    gp1: 1,
  }));
  const preview = buildSalesIncrementalPreview(approvedRows, existing);
  assert.equal(preview.currentRows, 3376);
  assert.equal(preview.newRows, 11);
  assert.equal(preview.expectedRowsAfter, 3387);
  assert.equal(preview.canCommit, true);
  assert.deepEqual(preview.violations, []);
});

test("replace mode remains the default and the existing destructive boundary is unchanged", async () => {
  const route = await read("app/api/data-hub/sales/route.ts");
  assert.match(route, /const mode = payload\.mode \?\? "replace"/);
  assert.match(route, /db\.delete\(salesTransactions\)\.where\(eq\(salesTransactions\.companyId, companyId\)\)/);
  assert.match(route, /payload\.action !== "replace"/);
});

test("an exact existing transaction is skipped and reported", () => {
  const preview = buildSalesIncrementalPreview([approvedRows[0]], [approvedRows[0]]);
  assert.equal(preview.alreadyExists, 1);
  assert.equal(preview.newRows, 0);
  assert.equal(preview.classifications[0].status, "ALREADY_EXISTS");
  assert.equal(preview.deletedRows, 0);
  assert.equal(preview.overwrittenRows, 0);
});

test("an existing duplicate identity is ambiguous and never inserted", () => {
  const existing = [approvedRows[1], { ...approvedRows[1], id: "duplicate-existing" }];
  const preview = buildSalesIncrementalPreview([approvedRows[1]], existing);
  assert.equal(preview.ambiguous, 1);
  assert.equal(preview.newRows, 0);
  assert.equal(preview.classifications[0].status, "AMBIGUOUS");
  assert.equal(preview.canCommit, false);
});

test("duplicate incoming identities are rejected as ambiguous", () => {
  const preview = buildSalesIncrementalPreview([approvedRows[2], { ...approvedRows[2], id: "incoming-duplicate" }], []);
  assert.equal(preview.ambiguous, 2);
  assert.equal(preview.newRows, 0);
  assert.equal(preview.canCommit, false);
});

test("invalid rows are classified and fail closed", () => {
  const preview = buildSalesIncrementalPreview([{ ...approvedRows[3], quantity: "not-a-number" }], []);
  assert.equal(preview.invalid, 1);
  assert.equal(preview.classifications[0].status, "INVALID");
  assert.equal(preview.canCommit, false);
});

test("employee code is part of identity while display name is ignored", () => {
  const sameIdentityDifferentName = { ...approvedRows[4], salespersonName: "Untrusted display name" };
  assert.equal(salesTransactionIdentity(approvedRows[4]), salesTransactionIdentity(sameIdentityDifferentName));
  const differentIdentitySameName = { ...approvedRows[4], employeeCode: "MM230302", salespersonName: approvedRows[4].salespersonName };
  assert.notEqual(salesTransactionIdentity(approvedRows[4]), salesTransactionIdentity(differentIdentitySameName));
});

test("rerunning the same subset is idempotent and proposes zero new rows", () => {
  const preview = buildSalesIncrementalPreview(approvedRows, approvedRows);
  assert.equal(preview.newRows, 0);
  assert.equal(preview.alreadyExists, 11);
  assert.equal(preview.quantityDelta, 0);
  assert.equal(preview.salesValueDelta, 0);
  assert.equal(preview.gpDelta, 0);
  assert.equal(preview.canCommit, false, "the approved one-time gate must not write an already-imported subset");
});

test("out-of-scope dates and branches are rejected by the approved gate", () => {
  const preview = buildSalesIncrementalPreview([approvedRows[0]], [], APPROVED_SALES_INCREMENTAL_GUARD, [
    "row 2: sale date must be 2026-08-05 through 2026-08-10",
    "row 2: branch is outside the approved KMM01/KMM02/KMM03 scope",
  ]);
  assert.equal(preview.canCommit, false);
  assert.equal(preview.violations.length, 9);
});

test("append route requires edit authorization and an explicit mode/action", async () => {
  const route = await read("app/api/data-hub/sales/route.ts");
  assert.match(route, /permission: "edit"/);
  assert.match(route, /action\?: "replace" \| "append" \| "preview"/);
  assert.match(route, /mode !== "append"/);
  assert.match(route, /approved 11-row incremental safety gate is required/);
});

test("append route has no company delete path in its append branch", async () => {
  const route = await read("app/api/data-hub/sales/route.ts");
  const appendBranch = route.slice(route.indexOf('if (mode === "append")'));
  assert.doesNotMatch(appendBranch.slice(0, appendBranch.indexOf('const history =')), /db\.delete\(salesTransactions\)/);
  assert.match(appendBranch, /executeAtomicD1Batch/);
});

test("client exposes incremental preview and does not silently switch replace mode", async () => {
  const service = await read("lib/data-hub/import-service.ts");
  const ui = await read("components/data-hub/smart-import-center.tsx");
  assert.match(service, /action: "preview"/);
  assert.match(service, /action: mode === "append" \? "append" : "replace"/);
  assert.match(ui, /Incremental \/ Append \(approved subset\)/);
  assert.match(ui, /Preview incremental append/);
  assert.match(ui, /Approve incremental append/);
});
