import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const repoRoot = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");
const runtime = await tsImport("../lib/kai/runtime-query.ts", import.meta.url);
const queryRoute = read("app/api/kai/query/route.ts");
const queryPlanMigration = read("drizzle/operations/0015_seed_kai_phase2a_query_plans.sql");

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

test("Phase 2A stores executable plans in the Knowledge Layer", () => {
  for (const intent of supportedCases.map((item) => item.intent)) {
    assert.match(queryPlanMigration, new RegExp("WHERE `intent` = '" + intent + "'"));
  }
  assert.match(queryPlanMigration, /"version":1/);
  assert.match(queryPlanMigration, /"source":"sales_transactions"/);
  assert.match(queryPlanMigration, /"source":"booking_transactions"/);
  assert.match(queryPlanMigration, /"source":"stock_transactions"/);
  assert.match(queryPlanMigration, /"stock_age_days"/);
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
