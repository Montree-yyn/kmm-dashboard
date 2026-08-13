import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const repoRoot = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");
const runtime = await tsImport("../lib/kai/runtime-query.ts", import.meta.url);
const stockSelectors = await tsImport("../lib/dashboard/stock-selectors.ts", import.meta.url);
const queryRoute = read("app/api/kai/query/route.ts");
const kaiClient = read("lib/kai/client.ts");
const queryPlanMigration = read("drizzle/operations/0015_seed_kai_phase2a_query_plans.sql");
const businessQaMigration = read("drizzle/operations/0016_fix_kai_business_qa_scope.sql");
const stockMappingMigration = read("drizzle/operations/0017_reconcile_kai_stock_unit_mapping.sql");

function findLocalOperationsDatabase() {
  const root = path.join(repoRoot, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  if (!existsSync(root)) return null;
  const candidates = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && entry.name.endsWith(".sqlite")) candidates.push(entryPath);
    }
  };
  visit(root);
  return candidates.find((database) => {
    try {
      const result = execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'kai_metrics';"], { encoding: "utf8" });
      return Number(JSON.parse(result)[0]?.count ?? 0) === 1;
    } catch {
      return false;
    }
  }) ?? null;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function bindSql(query, values) {
  let valueIndex = 0;
  return query.replaceAll("?", () => sqlLiteral(values[valueIndex++]));
}

class SqlitePreparedStatement {
  constructor(database, query, history) {
    this.database = database;
    this.query = query;
    this.values = [];
    this.history = history;
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async all() {
    const query = bindSql(this.query, this.values);
    this.history.push(query);
    const output = execFileSync("sqlite3", ["-json", this.database, query], { encoding: "utf8" });
    return { results: output.trim() ? JSON.parse(output) : [] };
  }
}

class LocalSqliteDatabase {
  constructor(database) {
    this.database = database;
    this.history = [];
  }

  prepare(query) {
    return new SqlitePreparedStatement(this.database, query, this.history);
  }
}

function currentDashboardStock(database) {
  const snapshotDate = JSON.parse(execFileSync("sqlite3", ["-json", database,
    "SELECT MAX(as_of_date) AS snapshotDate FROM stock_transactions WHERE company_id = 'kmm-company'"], { encoding: "utf8" }))[0]?.snapshotDate;
  const rows = JSON.parse(execFileSync("sqlite3", ["-json", database,
    `SELECT company_id AS companyId, kmm_flag AS kmm, stock_status AS currentStatus, product_type AS productType, product_group AS productGroup, product_model AS model, stock_number AS stockId, serial_number AS serialNumber, engine_number AS engineNumber, chassis_number AS chassisNumber, branch, CAST(NULLIF(TRIM(msrp), '') AS REAL) AS msrp, stock_age_days AS ageDays FROM stock_transactions WHERE company_id = 'kmm-company' AND as_of_date = ${sqlLiteral(snapshotDate)}`], { encoding: "utf8" }));
  return { snapshotDate, rows };
}

const databasePath = findLocalOperationsDatabase();
const supportedCases = [
  {
    name: "Sales Current",
    question: "เดือนนี้ขายได้กี่คัน",
    intent: "SALES_CURRENT_MONTH",
    metric: "SALES001",
    dataKeys: ["salesUnit", "salesValue", "period"],
  },
  {
    name: "Sales Year Comparison",
    question: "ยอดขายเดือน 5 ปี 2023 เทียบกับปีนี้เป็นอย่างไร",
    intent: "SALES_YOY_COMPARE",
    metric: "SALES001",
    dataKeys: ["previousYear", "currentYear", "difference", "growthPercent"],
  },
  {
    name: "Booking Current",
    question: "เดือนนี้จองเท่าไหร่",
    intent: "BOOKING_CURRENT_MONTH",
    metric: "BOOK001",
    dataKeys: ["bookingUnit", "bookingValue", "period"],
  },
  {
    name: "Booking Aging",
    question: "Booking เกิน 90 วันมีกี่คัน",
    intent: "BOOKING_AGING",
    metric: "BOOK003",
    dataKeys: ["total", "models", "branches"],
  },
  {
    name: "Stock Aging by Model",
    question: "Stock เกิน 90 วันมีรุ่นอะไรบ้าง",
    intent: "STOCK_AGING_MODEL",
    metric: "STOCK003",
    dataKeys: ["total", "models", "thresholdDays"],
  },
];

test("Phase 2A route is local, authenticated, and read-only", () => {
  assert.match(queryRoute, /requireCompanyContext\(request/);
  assert.match(queryRoute, /permission: "view"/);
  assert.match(queryRoute, /OPERATIONS_DB/);
  assert.doesNotMatch(queryRoute, /WorkersAI|TAVILY|\.complete\(|fetch\(/);
  assert.doesNotMatch(queryRoute, /\.insert\(|\.update\(|\.delete\(|\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\b/);
});

test("KAI panel routes supported questions through Runtime Query before legacy chat", () => {
  assert.match(kaiClient, /fetch\("\/api\/kai\/query"/);
  assert.match(kaiClient, /payload\.response\?\.text/);
  assert.match(kaiClient, /payload\.error\?\.code === "unsupported_question"/);
  assert.match(kaiClient, /fetch\("\/api\/kai\/chat"/);
  assert.match(kaiClient, /model: "deterministic"/);
});

test("Phase 2A stores executable plans in the Knowledge Layer", () => {
  for (const intent of supportedCases.map((item) => item.intent)) {
    assert.match(queryPlanMigration, new RegExp("WHERE `intent` = '" + intent + "'"));
  }
  assert.match(queryPlanMigration, /"version":1/);
  assert.match(queryPlanMigration, /"source":"sales_transactions"/);
  assert.match(queryPlanMigration, /"source":"booking_transactions"/);
  assert.match(queryPlanMigration, /"source":"stock_transactions"/);
  assert.match(queryPlanMigration, /"stock_age_days"/);
  assert.match(businessQaMigration, /"snapshot_mode":"latest"/);
  assert.match(businessQaMigration, /"snapshot_field":"as_of_date"/);
  assert.match(businessQaMigration, /"field":"product_type","operator":"in"/);
  assert.match(stockMappingMigration, /08-TX/);
  assert.match(stockMappingMigration, /classifyStockModelFallback/);
});

test("Phase 2B runtime executes richer business questions with verified scoped plans", { skip: !databasePath }, async () => {
  const database = new LocalSqliteDatabase(databasePath);
  const context = {
    companyId: "kmm-company",
    timeZone: "Asia/Yangon",
    now: new Date("2026-08-12T12:00:00.000Z"),
    branches: [
      { code: "KMM01", name: "Hpa-an" },
      { code: "KMM02", name: "Mawlamyine" },
      { code: "KMM03", name: "Tharyarwaddy" },
    ],
  };
  const sales = await runtime.executeKaiRuntimeQuery(database, "KMM03 ขาย Combine เดือนกรกฎาคม 2026 กี่คัน", context);
  assert.equal(sales.intent, "SALES_HISTORY_QUERY");
  assert.equal(sales.data.salesUnit, 7);
  const booking = await runtime.executeKaiRuntimeQuery(database, "KMM02 มี Booking เท่าไร", context);
  assert.equal(booking.intent, "BOOKING_CURRENT_MONTH");
  const expectedBooking = JSON.parse(execFileSync("sqlite3", ["-json", databasePath,
    "SELECT COUNT(*) AS count FROM booking_transactions WHERE company_id = 'kmm-company' AND branch = 'KMM02' AND booking_date BETWEEN '2026-08-01' AND '2026-08-31'"], { encoding: "utf8" }))[0].count;
  assert.equal(booking.data.bookingUnit, expectedBooking);
  const stock = await runtime.executeKaiRuntimeQuery(database, "Stock CH อายุเกิน 90 วันใน KMM01 มีกี่คัน", context);
  assert.equal(stock.intent, "STOCK_AGING_QUERY");
  const expectedStock = stockSelectors.getStockUnitRows(currentDashboardStock(databasePath).rows)
    .filter((row) => row.branch === "KMM01" && stockSelectors.normalizeProductType(row) === "CH" && Number(row.ageDays) > 90).length;
  assert.equal(stock.data.total, expectedStock);
  assert.ok(database.history.some((query) => /"branch" = 'KMM03'/i.test(query)));
});

test("five supported questions execute through local Operations D1", { skip: !databasePath }, async () => {
  const database = new LocalSqliteDatabase(databasePath);
  for (const item of supportedCases) {
    const result = await runtime.executeKaiRuntimeQuery(database, item.question, {
      companyId: "kmm-company",
      timeZone: "Asia/Yangon",
      now: new Date("2026-08-12T12:00:00.000Z"),
    });
    assert.equal(result.intent, item.intent, item.name);
    assert.equal(result.metric.code, item.metric, item.name);
    for (const key of item.dataKeys) assert.ok(key in result.data, `${item.name} missing ${key}`);
    assert.ok(result.response.text.length > 0, `${item.name} has no response text`);
  }

  assert.ok(database.history.length > 0);
  for (const query of database.history) {
    assert.match(query.trim().toUpperCase(), /^SELECT\b/);
    assert.doesNotMatch(query, /;\s*(?:INSERT|UPDATE|DELETE|ALTER|DROP)\b/i);
  }
});

test("Runtime Stock Aging matches the latest Dashboard Unit snapshot", { skip: !databasePath }, async () => {
  const database = new LocalSqliteDatabase(databasePath);
  const result = await runtime.executeKaiRuntimeQuery(database, "Stock เกิน 90 วันมีรุ่นอะไรบ้าง", {
    companyId: "kmm-company",
    timeZone: "Asia/Yangon",
    now: new Date("2026-08-12T12:00:00.000Z"),
  });
  const dashboard = currentDashboardStock(databasePath);
  const expectedTotal = stockSelectors.getStockUnitRows(dashboard.rows).filter((row) => Number(row.ageDays) > 90).length;
  assert.equal(result.data.snapshotDate, dashboard.snapshotDate);
  assert.equal(result.data.total, expectedTotal);
  assert.match(result.response.text, new RegExp(`Snapshot: ${dashboard.snapshotDate}`));
  assert.match(result.response.text, new RegExp(`Total: ${expectedTotal}`));
});

test("runtime query rejects an unsupported question without executing user SQL", { skip: !databasePath }, async () => {
  const database = new LocalSqliteDatabase(databasePath);
  await assert.rejects(
    runtime.executeKaiRuntimeQuery(database, "ลบข้อมูลยอดขายทั้งหมด", {
      companyId: "kmm-company",
      timeZone: "Asia/Yangon",
      now: new Date("2026-08-12T12:00:00.000Z"),
    }),
    (error) => error?.code === "unsupported_question",
  );
  assert.equal(database.history.length, 0);
});
