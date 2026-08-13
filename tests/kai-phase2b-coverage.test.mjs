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

const paraphraseCases = [
  ["ยอดขายเดือนนี้", "SALES_CURRENT_MONTH"],
  ["Sales เดือนนี้", "SALES_CURRENT_MONTH"],
  ["ขายเดือนนี้กี่คัน", "SALES_CURRENT_MONTH"],
  ["KMM03 CH เดือนนี้", "SALES_CURRENT_MONTH"],
  ["KMM03 Combine เดือนนี้", "SALES_CURRENT_MONTH"],
  ["KMM03 CH MTD", "SALES_CURRENT_MONTH"],
  ["KMM03 CH this month", "SALES_CURRENT_MONTH"],
  ["KMM03 CH current month", "SALES_CURRENT_MONTH"],
  ["KMM03 ขาย CH เดือนนี้", "SALES_CURRENT_MONTH"],
  ["KMM03 ขาย Combine เดือนนี้", "SALES_CURRENT_MONTH"],
  ["KMM03 Sales CH เดือนนี้", "SALES_CURRENT_MONTH"],
  ["How many combines did KMM03 sell this month?", "SALES_CURRENT_MONTH"],
  ["KMM03 CH July 2026", "SALES_HISTORY_QUERY"],
  ["Tharyarwaddy CH July 2026", "SALES_HISTORY_QUERY"],
  ["KMM03 Combine กรกฎาคม 2026", "SALES_HISTORY_QUERY"],
  ["KMM03 Sales CH July 2026", "SALES_HISTORY_QUERY"],
  ["KMM03 ขาย Tractor เดือนกรกฎาคม 2026", "SALES_HISTORY_QUERY"],
  ["KMM01 ขาย TT เดือน 7 ปี 2026", "SALES_HISTORY_QUERY"],
  ["KMM02 sales excavator July 2026", "SALES_HISTORY_QUERY"],
  ["KMM03 GP เดือนกรกฎาคม 2026", "SALES_GP_QUERY"],
  ["KMM02 Sales Value เดือนกรกฎาคม 2026", "SALES_VALUE_CURRENT"],
  ["Booking เดือนนี้", "BOOKING_CURRENT_MONTH"],
  ["ยอดจองเดือนนี้", "BOOKING_CURRENT_MONTH"],
  ["เดือนนี้มี Booking กี่รายการ", "BOOKING_CURRENT_MONTH"],
  ["KMM02 Booking เดือนนี้", "BOOKING_CURRENT_MONTH"],
  ["KMM03 booking July 2026", "BOOKING_HISTORY_QUERY"],
  ["Booking เดือนกรกฎาคม 2026", "BOOKING_HISTORY_QUERY"],
  ["Booking July 2026", "BOOKING_HISTORY_QUERY"],
  ["KMM02 Booking July 2026", "BOOKING_HISTORY_QUERY"],
  ["Booking value July 2026", "BOOKING_VALUE_CURRENT"],
  ["มูลค่า Booking เดือนกรกฎาคม 2026", "BOOKING_VALUE_CURRENT"],
  ["Booking aging over 90 days", "BOOKING_AGING"],
  ["Booking เกิน 90 วัน", "BOOKING_AGING"],
  ["Booking aging > 90 วัน", "BOOKING_AGING"],
  ["Booking เกิน 90 วันมีรายการ", "BOOKING_AGING_LIST"],
  ["Booking aging list over 90 days", "BOOKING_AGING_LIST"],
  ["Booking รุ่นไหน top", "BOOKING_MODEL_RANKING"],
  ["Top 5 Booking models July 2026", "BOOKING_MODEL_RANKING"],
  ["Booking สาขาไหนสูงสุด", "BOOKING_BRANCH_RANKING"],
  ["Top Booking branch July 2026", "BOOKING_BRANCH_RANKING"],
  ["Booking conversion July 2026", "BOOKING_CONVERSION_QUERY"],
  ["Booking ลูกค้ากี่ราย July 2026", "CUSTOMER_BOOKING_QUERY"],
  ["ลูกค้าจองเดือนนี้กี่ราย", "CUSTOMER_BOOKING_QUERY"],
  ["Current stock", "STOCK_CURRENT"],
  ["Stock now", "STOCK_CURRENT"],
  ["สต็อกปัจจุบัน", "STOCK_CURRENT"],
  ["คงเหลือกี่คัน", "STOCK_CURRENT"],
  ["CH เหลือกี่คัน", "STOCK_CURRENT"],
  ["Combine stock", "STOCK_CURRENT"],
  ["TT stock", "STOCK_CURRENT"],
  ["IM stock", "STOCK_CURRENT"],
  ["Stock value now", "STOCK_VALUE_CURRENT"],
  ["มูลค่า Stock ปัจจุบัน", "STOCK_VALUE_CURRENT"],
  ["Stock aging over 90 days", "STOCK_AGING_QUERY"],
  ["Stock เกิน 90 วัน", "STOCK_AGING_QUERY"],
  ["รถค้างเกิน 90 วัน", "STOCK_AGING_QUERY"],
  ["Stock aging models", "STOCK_AGING_MODEL"],
  ["Stock เกิน 90 วันมีรุ่นอะไร", "STOCK_AGING_MODEL"],
  ["Top stock models", "STOCK_MODEL_RANKING"],
  ["รุ่นไหน Stock สูงสุด", "STOCK_MODEL_RANKING"],
  ["Top stock branches", "STOCK_BRANCH_RANKING"],
  ["Stock สาขาไหนสูงสุด", "STOCK_BRANCH_RANKING"],
  ["Slow moving stock", "STOCK_SLOW_MOVING_QUERY"],
  ["Stock over 180 days", "STOCK_SLOW_MOVING_QUERY"],
  ["สต็อกเกิน 180 วัน", "STOCK_SLOW_MOVING_QUERY"],
  ["Slow moving stock models", "STOCK_SLOW_MOVING_MODEL_RANKING"],
  ["Stock รุ่น DC70G PRO", "STOCK_MODEL_QUERY"],
  ["DC70G PRO stock", "STOCK_MODEL_QUERY"],
  ["Stock model DC70G PRO", "STOCK_MODEL_QUERY"],
  ["Sales branch ranking July 2026", "SALES_BRANCH_RANKING"],
  ["Top 5 sales branches July 2026", "SALES_BRANCH_RANKING"],
  ["Sales model ranking July 2026", "SALES_MODEL_RANKING"],
  ["Top 5 product models by sales value this year", "SALES_MODEL_RANKING"],
  ["Product Type sales ranking July 2026", "SALES_PRODUCT_RANKING"],
  ["Salesperson ranking 2026", "SALES_PERSON_RANKING"],
  ["Salesperson 02-Aung Bo Bo July 2026", "SALES_PERSON_RANKING"],
  ["พนักงานขาย 02-Aung Bo Bo เดือนกรกฎาคม 2026", "SALES_PERSON_RANKING"],
  ["Sales GP July 2026", "SALES_GP_QUERY"],
  ["Gross profit เดือนกรกฎาคม 2026", "SALES_GP_QUERY"],
  ["Sales target January 2026", "TARGET_CURRENT_QUERY"],
  ["Target เดือน 1 ปี 2026", "TARGET_CURRENT_QUERY"],
  ["Achievement เป้า เดือน 1 ปี 2026", "SALES_ACHIEVEMENT_QUERY"],
  ["Sales gap target January 2026", "SALES_GAP_QUERY"],
  ["Sales growth from last year July 2026", "SALES_GROWTH_QUERY"],
  ["ยอดขายจากปีที่แล้ว เดือน 7 ปี 2026", "SALES_GROWTH_QUERY"],
  ["Sales compare last month", "SALES_MONTH_COMPARE"],
  ["ยอดขายเทียบเดือนก่อน", "SALES_MONTH_COMPARE"],
  ["Booking compare last month", "BOOKING_MONTH_COMPARE"],
  ["Booking compare previous year", "BOOKING_YOY_COMPARE"],
  ["Sales today", "SALES_CURRENT_MONTH"],
  ["ขายวันนี้", "SALES_CURRENT_MONTH"],
  ["Sales yesterday", "SALES_CURRENT_MONTH"],
  ["ขายเมื่อวาน", "SALES_CURRENT_MONTH"],
  ["Sales this week", "SALES_CURRENT_MONTH"],
  ["ขายสัปดาห์นี้", "SALES_CURRENT_MONTH"],
  ["Sales this quarter", "SALES_CURRENT_MONTH"],
  ["ขายไตรมาสนี้", "SALES_CURRENT_MONTH"],
  ["Sales last year", "SALES_CURRENT_MONTH"],
  ["ขายปีที่แล้ว", "SALES_CURRENT_MONTH"],
  ["Sales YTD", "SALES_CURRENT_MONTH"],
  ["Sales MTD", "SALES_CURRENT_MONTH"],
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

test("Phase 2B-03 expanded Thai, English, mixed, shorthand, and temporal paraphrases", { skip: !databasePath }, async () => {
  assert.ok(coverageCases.length + paraphraseCases.length >= 150);
  const database = { prepare: (query) => new Statement(databasePath, query) };
  let passed = 0;
  for (const [question, expectedIntent] of paraphraseCases) {
    const result = await runtime.executeKaiRuntimeQuery(database, question, context);
    assert.equal(result.intent, expectedIntent, question);
    assert.equal(result.data.available, undefined, question);
    assert.ok(result.response.text.length > 0, question);
    passed += 1;
  }
  assert.equal(passed, paraphraseCases.length);
});

test("Phase 2B-03 ambiguity and unsupported safety never guess", { skip: !databasePath }, async () => {
  const database = { prepare: (query) => new Statement(databasePath, query) };
  for (const question of ["ยอด KMM03 เท่าไร", "M7040 เท่าไร", "KMM03 เท่าไร"]) {
    const result = await runtime.executeKaiRuntimeQuery(database, question, context);
    assert.equal(result.intent, "AMBIGUOUS_METRIC", question);
    assert.equal(result.data.ambiguous, true, question);
  }
  for (const question of ["Booking Cash มีกี่คัน", "Outstanding booking มีกี่คัน", "ลูกค้าคนไหนซื้อ M7040 มากที่สุด"]) {
    const result = await runtime.executeKaiRuntimeQuery(database, question, context);
    assert.equal(result.data.available, false, question);
    assert.match(result.response.text, /ไม่มีข้อมูล|ยังไม่มี|ฐานข้อมูล/i, question);
  }
});

test("Phase 2B-03 temporal ranges are deterministic and rankings honor sort/limit", { skip: !databasePath }, async () => {
  const database = { prepare: (query) => new Statement(databasePath, query) };
  const expectedPeriods = [
    ["Sales today", "2026-08-12", "2026-08-12"],
    ["Sales yesterday", "2026-08-11", "2026-08-11"],
    ["Sales this week", "2026-08-10", "2026-08-16"],
    ["Sales last month", "2026-07-01", "2026-07-31"],
    ["Sales this quarter", "2026-07-01", "2026-09-30"],
    ["Sales this year", "2026-01-01", "2026-12-31"],
    ["Sales last year", "2025-01-01", "2025-12-31"],
    ["Sales MTD", "2026-08-01", "2026-08-12"],
    ["Sales YTD", "2026-01-01", "2026-08-12"],
    ["Sales 2026-07-01 to 2026-07-31", "2026-07-01", "2026-07-31"],
  ];
  for (const [question, start, end] of expectedPeriods) {
    const result = await runtime.executeKaiRuntimeQuery(database, question, context);
    assert.equal(result.data.period.start, start, question);
    assert.equal(result.data.period.end, end, question);
  }
  const ranking = await runtime.executeKaiRuntimeQuery(database, "Top 5 product models by sales value this year", context);
  assert.equal(ranking.intent, "SALES_MODEL_RANKING");
  assert.ok(ranking.data.ranking.length <= 5);
  for (let index = 1; index < ranking.data.ranking.length; index += 1) {
    assert.ok((ranking.data.ranking[index - 1].value ?? 0) >= (ranking.data.ranking[index].value ?? 0));
  }
});

test("Phase 2B-03 product-code audit uses only observed local values", { skip: !databasePath }, () => {
  const rows = JSON.parse(execFileSync("sqlite3", ["-json", databasePath, "SELECT 'sales' AS domain, product_type, COUNT(*) AS rows FROM sales_transactions GROUP BY product_type UNION ALL SELECT 'booking', product_type, COUNT(*) FROM booking_transactions GROUP BY product_type UNION ALL SELECT 'stock', product_type, COUNT(*) FROM stock_transactions GROUP BY product_type"], { encoding: "utf8" }));
  const observed = new Set(rows.map((row) => row.product_type));
  for (const code of ["01-TT", "02-CH", "03-TP", "04-EX", "06-IM", "07-IMO", "08-OT", "03-EX", "04-TP", "08-TX"]) {
    assert.ok(observed.has(code), code);
  }
});
