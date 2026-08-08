import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Miniflare } from "miniflare";
import { bookingTransactions, salesTransactions, stockTransactions } from "../db/schema.ts";
import {
  D1_BOUND_PARAMETER_LIMIT,
  D1_SAFE_PARAMETER_BUDGET,
  assertStatementWithinD1Budget,
  chunkRowsForD1,
  countBoundParameters,
  executeAtomicD1Batch,
} from "../lib/data-hub/d1-batching.ts";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const sqlBuilder = drizzle(async () => ({ rows: [] }));
const common = {
  tenantId: "kmm-tenant",
  companyId: "kmm-company",
  importId: "wide-import",
  importYear: 2026,
  importMonth: 7,
  businessWeek: null,
  createdBy: "qa-user",
};

function bookingRow(index) {
  return {
    id: `booking-${index}`,
    ...common,
    bookingDate: "2026-07-01",
    bookingNo: `BK-${index}`,
    bookingNumber: `BK-${index}`,
    branch: "KMM",
    customer: `Customer ${index}`,
    product: "Tractor",
    status: "Open",
    bookingYear: 2026,
    bookingMonth: 7,
    branchCode: null,
    branchName: null,
    salespersonCode: null,
    salespersonName: null,
    productType: null,
    productModel: null,
    customerName: null,
    bookingPrice: null,
    depositAmount: null,
    bookingStatus: null,
    purchaseStatus: null,
  };
}

function stockRow(index) {
  return {
    id: `stock-${index}`,
    ...common,
    asOfDate: "2026-07-31",
    branch: "KMM",
    product: "Tractor",
    quantity: 1,
    stockDate: "2026-07-01",
    branchCode: null,
    branchName: null,
    productType: null,
    productGroup: null,
    productModel: null,
    kmmFlag: null,
    msrp: null,
    stockStatus: null,
    stockNumber: null,
    serialNumber: null,
    engineNumber: null,
    chassisNumber: null,
    stockAgeDays: null,
    snapshotDate: null,
  };
}

function salesRow(index) {
  return {
    id: `sales-${index}`,
    tenantId: common.tenantId,
    companyId: common.companyId,
    importId: common.importId,
    importYear: common.importYear,
    importMonth: common.importMonth,
    saleDate: "2026-07-01",
    invoiceNo: `SM-${index}`,
    branch: "KMM",
    modelCode: "M7040",
    employeeCode: "EMP-1",
    quantity: 1,
    saleAmount: "100000000",
    productType: "Tractor",
    model: "M7040",
    finalReceived: null,
    netReceived: null,
    gp1: null,
    expense: null,
    salespersonCode: null,
    salespersonName: null,
    createdBy: common.createdBy,
  };
}

function assertWideChunks(table, rows, expectedParametersPerRow, expectedChunkCount, expectedRowsPerInsert = 3) {
  const oneRowStatement = sqlBuilder.insert(table).values(rows[0]);
  const parametersPerRow = countBoundParameters(oneRowStatement);
  assert.equal(parametersPerRow, expectedParametersPerRow);

  const { rowsPerInsert, chunks } = chunkRowsForD1(rows, parametersPerRow);
  assert.equal(rowsPerInsert, expectedRowsPerInsert);
  assert.equal(chunks.length, expectedChunkCount);
  assert.deepEqual(chunks.flat().map((row) => row.id), rows.map((row) => row.id));

  for (const chunk of chunks) {
    const parameterCount = assertStatementWithinD1Budget(sqlBuilder.insert(table).values(chunk));
    assert.ok(parameterCount <= D1_SAFE_PARAMETER_BUDGET);
    assert.ok(parameterCount < D1_BOUND_PARAMETER_LIMIT);
  }

  return chunks;
}

test("wide Booking rows adapt to the measured D1 parameter ceiling", () => {
  const rows = Array.from({ length: 382 }, (_, index) => bookingRow(index));
  assertWideChunks(bookingTransactions, rows, 28, 128);
});

test("wide Stock rows adapt to the measured D1 parameter ceiling", () => {
  const rows = Array.from({ length: 748 }, (_, index) => stockRow(index));
  assertWideChunks(stockTransactions, rows, 27, 250);
});

test("wide Sales rows reuse adaptive D1 batching without a module-specific size", () => {
  const rows = Array.from({ length: 3376 }, (_, index) => salesRow(index));
  const chunks = assertWideChunks(salesTransactions, rows, 22, 844, 4);
  assert.equal(chunks[0].length, 4);
});

test("the route derives row width from generated SQL and keeps one atomic D1 batch", () => {
  const route = read("app/api/data-hub/import/route.ts");
  const salesRoute = read("app/api/data-hub/sales/route.ts");
  assert.equal(D1_BOUND_PARAMETER_LIMIT, 100);
  assert.equal(D1_SAFE_PARAMETER_BUDGET, 90);
  assert.match(route, /countBoundParameters\(db\.insert\(bookingTransactions\)\.values\(rows\[0\]\)\)/);
  assert.match(route, /countBoundParameters\(db\.insert\(stockTransactions\)\.values\(rows\[0\]\)\)/);
  assert.match(route, /await executeAtomicD1Batch\(statements/);
  assert.doesNotMatch(route, /forEach\([^)]*await context\.db\.batch/);
  assert.match(salesRoute, /countBoundParameters\(db\.insert\(salesTransactions\)\.values\(rows\[0\]\)\)/);
  assert.match(salesRoute, /chunkRowsForD1\(rows, boundParametersPerRow\)/);
  assert.match(salesRoute, /await executeAtomicD1Batch\(statements/);
  assert.match(salesRoute, /db\.delete\(salesTransactions\)\.where\(eq\(salesTransactions\.companyId, companyId\)\)/);
  assert.doesNotMatch(salesRoute, /db\.delete\(salesTransactions\)[\s\S]{0,240}salesTransactions\.importYear/);
  assert.doesNotMatch(salesRoute, /index \+= 750|slice\(index, index \+ 750\)/);
});

const D1_TEST_WORKER = `
const columnNames = Array.from({ length: 28 }, (_, index) => "c" + index);

async function resetDatabase(db) {
  const definitions = columnNames.map((name, index) => name + " TEXT" + (index === 0 ? " PRIMARY KEY" : "")).join(", ");
  await db.exec("DROP TABLE IF EXISTS wide_rows; DROP TABLE IF EXISTS import_history; CREATE TABLE wide_rows (" + definitions + "); CREATE TABLE import_history (id TEXT PRIMARY KEY, status TEXT NOT NULL);");
}

async function resetSalesReplacementDatabase(db) {
  await db.exec("DROP TABLE IF EXISTS sales_transactions; DROP TABLE IF EXISTS import_history; CREATE TABLE sales_transactions (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, import_year INTEGER NOT NULL, import_month INTEGER NOT NULL, quantity INTEGER NOT NULL, final_received REAL NOT NULL, gp1 REAL NOT NULL); CREATE TABLE import_history (id TEXT PRIMARY KEY, status TEXT NOT NULL);");
}

function salesInsertStatement(db, row) {
  return db.prepare("INSERT INTO sales_transactions (id, company_id, import_year, import_month, quantity, final_received, gp1) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(row.id, row.companyId, row.year, row.month, row.quantity, row.value, row.gp);
}

async function replaceSales(db, importId, rows) {
  await db.batch([
    db.prepare("DELETE FROM sales_transactions WHERE company_id = ?").bind("kmm-company"),
    ...rows.map((row) => salesInsertStatement(db, { ...row, companyId: "kmm-company" })),
    db.prepare("INSERT INTO import_history (id, status) VALUES (?, ?)").bind(importId, "success"),
  ]);
}

function insertStatement(db, columnCount, chunkSize, startIndex, prefix) {
  const columns = columnNames.slice(0, columnCount);
  const tuple = "(" + columns.map(() => "?").join(",") + ")";
  const sql = "INSERT INTO wide_rows (" + columns.join(",") + ") VALUES " + Array(chunkSize).fill(tuple).join(",");
  const values = [];
  for (let row = 0; row < chunkSize; row += 1) {
    for (let column = 0; column < columnCount; column += 1) {
      values.push(column === 0 ? prefix + "-" + (startIndex + row) : "v-" + (startIndex + row) + "-" + column);
    }
  }
  return db.prepare(sql).bind(...values);
}

export default {
  async fetch(request, env) {
    const input = await request.json();
    if (input.mode === "sales-replacement") {
      await resetSalesReplacementDatabase(env.DB);
      await salesInsertStatement(env.DB, { id: "other-company-row", companyId: "other-company", year: 2025, month: 12, quantity: 99, value: 999, gp: 99 }).run();
      const firstFile = [
        { id: "first-1", year: 2023, month: 1, quantity: 1, value: 100, gp: 10 },
        { id: "first-2", year: 2023, month: 2, quantity: 1, value: 200, gp: 20 },
        { id: "first-3", year: 2026, month: 7, quantity: 1, value: 300, gp: 30 },
      ];
      await replaceSales(env.DB, "first-import", firstFile);
      const firstCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM sales_transactions WHERE company_id = ?").bind("kmm-company").first("count");
      await replaceSales(env.DB, "second-import", firstFile.map((row) => ({ ...row, id: row.id.replace("first", "second") })));
      const secondCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM sales_transactions WHERE company_id = ?").bind("kmm-company").first("count");
      const latestFile = [
        { id: "latest-1", year: 2026, month: 8, quantity: 2, value: 350, gp: 35 },
        { id: "latest-2", year: 2026, month: 8, quantity: 1, value: 50, gp: 5 },
      ];
      await replaceSales(env.DB, "latest-import", latestFile);
      const final = await env.DB.prepare("SELECT COUNT(*) AS count, SUM(quantity) AS quantity, SUM(final_received) AS value, SUM(gp1) AS gp FROM sales_transactions WHERE company_id = ?").bind("kmm-company").first();
      const otherCompanyCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM sales_transactions WHERE company_id = ?").bind("other-company").first("count");
      const historyCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM import_history WHERE status = ?").bind("success").first("count");
      return Response.json({ firstCount, secondCount, final, otherCompanyCount, historyCount });
    }
    if (input.mode === "limit") {
      const result = {};
      for (const count of [100, 101]) {
        try {
          await env.DB.prepare("SELECT ?" + count + " AS value").bind(...Array(count).fill(1)).first();
          result[count] = true;
        } catch (error) {
          result[count] = error.message;
        }
      }
      return Response.json(result);
    }

    await resetDatabase(env.DB);
    if (input.mode === "failure") {
      await env.DB.prepare("INSERT INTO wide_rows (c0) VALUES (?)").bind("pre-existing").run();
      let failed = false;
      try {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM wide_rows"),
          insertStatement(env.DB, input.columnCount, 4, 0, "replacement"),
          insertStatement(env.DB, input.columnCount, 4, 0, "replacement"),
          env.DB.prepare("INSERT INTO import_history (id, status) VALUES (?, ?)").bind("should-not-exist", "success"),
        ]);
      } catch {
        failed = true;
      }
      const rowCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM wide_rows").first("count");
      const originalCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM wide_rows WHERE c0 = ?").bind("pre-existing").first("count");
      const replacementCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM wide_rows WHERE c0 LIKE ?").bind("replacement-%").first("count");
      const historyCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM import_history").first("count");
      return Response.json({ failed, rowCount, originalCount, replacementCount, historyCount });
    }

    const statements = [env.DB.prepare("DELETE FROM wide_rows")];
    let startIndex = 0;
    for (const chunkSize of input.chunkSizes) {
      statements.push(insertStatement(env.DB, input.columnCount, chunkSize, startIndex, input.prefix));
      startIndex += chunkSize;
    }
    statements.push(env.DB.prepare("INSERT INTO import_history (id, status) VALUES (?, ?)").bind(input.prefix, "success"));
    await env.DB.batch(statements);
    const rowCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM wide_rows").first("count");
    const historyCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM import_history WHERE status = ?").bind("success").first("count");
    return Response.json({ rowCount, historyCount, statementCount: statements.length });
  },
};`;

function createD1TestRuntime(databaseId) {
  return new Miniflare({
    modules: true,
    script: D1_TEST_WORKER,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: { DB: databaseId },
  });
}

async function post(runtime, body) {
  const response = await runtime.dispatchFetch("http://d1-test/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  return response.json();
}

test("multi-statement D1 batches persist every Booking, Stock, and Sales row", async (t) => {
  const runtime = createD1TestRuntime("wide-row-persistence-test");
  t.after(async () => runtime.dispose());

  const limit = await post(runtime, { mode: "limit" });
  assert.equal(limit[100], true);
  assert.match(limit[101], /between \?1 and \?100|too many SQL variables/);

  for (const scenario of [
    { prefix: "booking", rowCount: 382, columnCount: 28 },
    { prefix: "stock", rowCount: 748, columnCount: 27 },
    { prefix: "sales", rowCount: 3376, columnCount: 22 },
  ]) {
    const rows = Array.from({ length: scenario.rowCount }, (_, index) => index);
    const { chunks } = chunkRowsForD1(rows, scenario.columnCount);
    const result = await post(runtime, {
      mode: "success",
      prefix: scenario.prefix,
      columnCount: scenario.columnCount,
      chunkSizes: chunks.map((chunk) => chunk.length),
    });
    assert.equal(result.rowCount, scenario.rowCount);
    assert.equal(result.historyCount, 1);
    assert.equal(result.statementCount, chunks.length + 2);
  }
});

test("a failed Sales insert chunk rolls back replacement rows and never records success", async (t) => {
  const runtime = createD1TestRuntime("wide-row-rollback-test");
  t.after(async () => runtime.dispose());

  const result = await post(runtime, { mode: "failure", columnCount: 22 });
  assert.equal(result.failed, true);
  assert.equal(result.rowCount, 1);
  assert.equal(result.originalCount, 1);
  assert.equal(result.replacementCount, 0);
  assert.equal(result.historyCount, 0);

  await assert.rejects(
    executeAtomicD1Batch(["delete", "insert", "history"], async () => {
      throw new Error("middle insert failed");
    }),
    /middle insert failed/,
  );
});

test("Sales replacement keeps only the newest full KMM dataset while history remains append-only", async (t) => {
  const runtime = createD1TestRuntime("sales-full-replacement-test");
  t.after(async () => runtime.dispose());

  const result = await post(runtime, { mode: "sales-replacement" });
  assert.equal(result.firstCount, 3);
  assert.equal(result.secondCount, 3);
  assert.deepEqual(result.final, { count: 2, quantity: 3, value: 400, gp: 40 });
  assert.equal(result.otherCompanyCount, 1);
  assert.equal(result.historyCount, 3);
});
