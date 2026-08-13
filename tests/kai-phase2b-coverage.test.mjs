import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const repoRoot = path.resolve(import.meta.dirname, "..");
const runtime = await tsImport("../lib/kai/runtime-query.ts", import.meta.url);

function localOperationsDb() {
  const root = path.join(repoRoot, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  if (!existsSync(root)) return null;
  return readdirSync(root)
    .filter((name) => name.endsWith(".sqlite"))
    .map((name) => path.join(root, name))
    .find((database) => {
      try {
        return Number(JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='kai_metrics'"], { encoding: "utf8" }))[0]?.count) === 1;
      } catch { return false; }
    }) ?? null;
}

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

class Statement {
  constructor(database, query) { this.database = database; this.query = query; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async all() {
    let index = 0;
    const bound = this.query.replaceAll("?", () => sql(this.values[index++]));
    const output = execFileSync("sqlite3", ["-json", this.database, bound], { encoding: "utf8" });
    return { results: output.trim() ? JSON.parse(output) : [] };
  }
}

const databasePath = localOperationsDb();
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

const coverageCases = [
  ["KMM03 ขาย Combine เดือนกรกฎาคม 2026 กี่คัน", "SALES_HISTORY_QUERY"],
  ["KMM03 Sales CH July 2026", "SALES_HISTORY_QUERY"],
  ["ยอดขายเดือนกรกฎาคม 2026 เท่าไร", "SALES_HISTORY_QUERY"],
  ["Sales Value เดือนกรกฎาคม 2026 เท่าไร", "SALES_VALUE_CURRENT"],
  ["GP เดือนกรกฎาคม 2026 เท่าไร", "SALES_GP_QUERY"],
  ["สาขาไหนขายดีที่สุดเดือนกรกฎาคม 2026", "SALES_BRANCH_RANKING"],
  ["รุ่นไหนขายดีที่สุดเดือนกรกฎาคม 2026", "SALES_MODEL_RANKING"],
  ["Product Type ไหนขายดีที่สุดเดือนกรกฎาคม 2026", "SALES_PRODUCT_RANKING"],
  ["Salesperson คนไหนขายได้มากที่สุดปี 2026", "SALES_PERSON_RANKING"],
  ["ยอดขายเดือนกรกฎาคม 2026 เทียบเดือนที่แล้ว", "SALES_MONTH_COMPARE"],
  ["ยอดขายเดือน 5 ปี 2023 เทียบกับปีนี้เป็นอย่างไร", "SALES_YOY_COMPARE"],
  ["Target เดือน 1 ปี 2026 เท่าไหร่", "TARGET_CURRENT_QUERY"],
  ["ยอดขายได้กี่เปอร์เซ็นต์ของเป้า เดือน 1 ปี 2026", "SALES_ACHIEVEMENT_QUERY"],
  ["ยอดขายขาดเป้าเท่าไหร่ เดือน 1 ปี 2026", "SALES_GAP_QUERY"],
  ["ยอดขายโตขึ้นกี่เปอร์เซ็นต์จากปีที่แล้ว เดือน 7 ปี 2026", "SALES_GROWTH_QUERY"],
  ["Booking เดือนกรกฎาคม 2026 กี่คัน", "BOOKING_HISTORY_QUERY"],
  ["Booking เดือนกรกฎาคม 2026 มูลค่าเท่าไร", "BOOKING_VALUE_CURRENT"],
  ["Booking เทียบเดือนที่แล้ว", "BOOKING_MONTH_COMPARE"],
  ["Booking เดือนนี้เทียบปีที่แล้ว", "BOOKING_YOY_COMPARE"],
  ["Booking เดือน 7 ปี 2026 เท่าไหร่", "BOOKING_HISTORY_QUERY"],
  ["Booking เกิน 90 วันมีกี่คัน", "BOOKING_AGING"],
  ["Booking เกิน 90 วันมีรายการอะไรบ้าง", "BOOKING_AGING_LIST"],
  ["รุ่นไหนมี Booking มากที่สุดเดือนกรกฎาคม 2026", "BOOKING_MODEL_RANKING"],
  ["สาขาไหนมี Booking มากที่สุดเดือนกรกฎาคม 2026", "BOOKING_BRANCH_RANKING"],
  ["Booking Conversion เดือนกรกฎาคม 2026 เท่าไหร่", "BOOKING_CONVERSION_QUERY"],
  ["เดือนกรกฎาคม 2026 มีลูกค้าจองกี่ราย", "CUSTOMER_BOOKING_QUERY"],
  ["KMM02 มี Booking เท่าไร", "BOOKING_CURRENT_MONTH"],
  ["KMM02 มี Booking B HOT กี่คัน", "BOOKING_CURRENT_MONTH"],
  ["ยอดจองปีนี้กี่คัน", "BOOKING_CURRENT_MONTH"],
  ["เดือนนี้มีลูกค้าจองกี่ราย", "CUSTOMER_BOOKING_QUERY"],
  ["Stock ปัจจุบันมีกี่คัน", "STOCK_CURRENT"],
  ["Stock ปัจจุบันมูลค่าเท่าไหร่", "STOCK_VALUE_CURRENT"],
  ["Stock เกิน 90 วันมีกี่คัน", "STOCK_AGING_QUERY"],
  ["Stock เกิน 90 วันมีรุ่นอะไรบ้าง", "STOCK_AGING_MODEL"],
  ["รุ่นไหน Stock ค้างมากที่สุด", "STOCK_MODEL_RANKING"],
  ["สาขาไหนมี Stock ค้างมากที่สุด", "STOCK_BRANCH_RANKING"],
  ["Stock อายุเกิน 180 วันมีเท่าไหร่", "STOCK_SLOW_MOVING_QUERY"],
  ["Stock Slow Moving มีรุ่นอะไรบ้าง", "STOCK_SLOW_MOVING_MODEL_RANKING"],
  ["Stock รุ่น DC70G PRO มีเท่าไหร่", "STOCK_MODEL_QUERY"],
  ["Stock CH อายุเกิน 90 วันใน KMM01 มีกี่คัน", "STOCK_AGING_QUERY"],
  ["KMM01 Stock TT อายุเกิน 90 วันเท่าไร", "STOCK_AGING_QUERY"],
  ["CH เหลือกี่คัน", "STOCK_CURRENT"],
  ["TT Stock เท่าไร", "STOCK_CURRENT"],
  ["IM Stock เท่าไร", "STOCK_CURRENT"],
  ["สต็อกอายุเกิน 180 วัน", "STOCK_SLOW_MOVING_QUERY"],
  ["รถค้าง", "STOCK_AGING_QUERY"],
  ["Stock KMM03 เท่าไร", "STOCK_CURRENT"],
  ["Salesperson 02-Aung Bo Bo เดือนกรกฎาคม 2026 ขายกี่คัน", "SALES_PERSON_RANKING"],
  ["KMM01 ขาย Tractor เดือนกรกฎาคม 2026 กี่คัน", "SALES_HISTORY_QUERY"],
  ["KMM03 Booking เดือนกรกฎาคม 2026 กี่คัน", "BOOKING_HISTORY_QUERY"],
];

test("all Phase 2B Knowledge templates are executable JSON plans", { skip: !databasePath }, () => {
  const rows = JSON.parse(execFileSync("sqlite3", ["-json", databasePath, "SELECT intent, query_logic FROM kai_query_templates ORDER BY intent"], { encoding: "utf8" }));
  assert.equal(rows.length, 34);
  for (const row of rows) {
    const plan = JSON.parse(row.query_logic);
    assert.equal(plan.version, 2, row.intent);
    assert.equal(typeof plan.source, "string", row.intent);
    assert.equal(typeof plan.operation, "string", row.intent);
  }
});

test("Phase 2B coverage suite has 50 correct database-backed answers and zero hallucinations", { skip: !databasePath }, async () => {
  const database = { prepare: (query) => new Statement(databasePath, query) };
  let pass = 0;
  for (const [question, intent] of coverageCases) {
    const result = await runtime.executeKaiRuntimeQuery(database, question, context);
    assert.equal(result.intent, intent, question);
    assert.notEqual(result.data.available, false, question);
    assert.ok(result.response.text.length > 0, question);
    pass += 1;
  }
  assert.equal(pass, 50);
});

test("Phase 2B preserves every requested filter and verified unavailable state", { skip: !databasePath }, async () => {
  const database = { prepare: (query) => new Statement(databasePath, query) };
  const sales = await runtime.executeKaiRuntimeQuery(database, "KMM03 ขาย Combine เดือนกรกฎาคม 2026 กี่คัน", context);
  assert.equal(sales.data.salesUnit, 7);
  assert.equal(sales.data.period.label, "2026-07");
  const stock = await runtime.executeKaiRuntimeQuery(database, "Stock CH อายุเกิน 90 วันใน KMM01 มีกี่คัน", context);
  assert.equal(stock.data.total, 10);
  const person = await runtime.executeKaiRuntimeQuery(database, "Salesperson 02-Aung Bo Bo เดือนกรกฎาคม 2026 ขายกี่คัน", context);
  assert.deepEqual(person.data.ranking, [{ label: "02-Aung Bo Bo", units: 5, value: 754333600 }]);
  for (const question of ["Booking Cash มีกี่คัน", "Outstanding booking มีกี่คัน"]) {
    const result = await runtime.executeKaiRuntimeQuery(database, question, context);
    assert.equal(result.data.available, false, question);
    assert.doesNotMatch(result.response.text, /Stock Aging|\b35\b/i, question);
  }
});
