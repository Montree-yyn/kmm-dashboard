import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const migration = await read("drizzle/operations/0007_create_kai_knowledge_tables.sql");
const seed = await read("drizzle/operations/0008_seed_kai_knowledge.sql");
const rollback = await read("docs/kai/rollback_0007_0008_kai_knowledge_layer.sql");
const schema = await read("db/schema.ts");
const operationsMigrations = await Promise.all([
  read("drizzle/operations/0001_operations_sales.sql"),
  read("drizzle/operations/0003_operations_booking.sql"),
  read("drizzle/operations/0004_operations_stock.sql"),
]);
const operationsSchema = operationsMigrations.join("\n");

const tableColumns = {
  kai_metrics: ["id", "metric_code", "metric_name", "description", "formula", "data_source", "unit_type", "business_rule", "ai_usage", "created_at"],
  kai_data_dictionary: ["id", "business_name", "table_name", "field_name", "data_type", "description", "domain", "created_at"],
  kai_question_library: ["id", "question", "intent", "domain", "required_metric", "response_type", "created_at"],
  kai_query_templates: ["id", "intent", "purpose", "required_data", "query_logic", "created_at"],
  kai_response_templates: ["id", "intent", "response_structure", "created_at"],
  kai_history: ["id", "user_question", "intent", "answer", "feedback", "created_at"],
};

test("KAI Phase 1E migration defines all six additive knowledge tables", () => {
  for (const [table, columns] of Object.entries(tableColumns)) {
    assert.match(migration, new RegExp("CREATE TABLE IF NOT EXISTS `" + table + "`"));
    for (const column of columns) assert.match(migration, new RegExp("`" + column + "`"));
  }
  assert.match(migration, /kai_metrics_metric_code_unique/);
  assert.match(migration, /kai_query_templates_intent_unique/);
  assert.match(migration, /kai_response_templates_intent_unique/);
});

test("seed contains the required metrics and at least thirty questions", () => {
  const metricSeed = seed.split("INSERT OR IGNORE INTO `kai_data_dictionary`")[0];
  const metricCodes = [...metricSeed.matchAll(/\('((?:SALES|BOOK|STOCK)\d{3})',/g)].map((match) => match[1]);
  assert.deepEqual(metricCodes, [
    "SALES001", "SALES002", "SALES003", "SALES004", "SALES005", "SALES006",
    "BOOK001", "BOOK002", "BOOK003", "BOOK004",
    "STOCK001", "STOCK002", "STOCK003", "STOCK004",
  ]);

  const questionSeed = seed.split("INSERT OR IGNORE INTO `kai_question_library`")[1].split("INSERT OR IGNORE INTO `kai_query_templates`")[0];
  const questionRows = [...questionSeed.matchAll(/\('([^']*)',\s*'([A-Z0-9_]+)',\s*'(sales|booking|stock)',/g)];
  assert.ok(questionRows.length >= 30, `expected at least 30 questions, found ${questionRows.length}`);
  assert.match(questionSeed, /ยอดขายเดือน 5 ปี 2023 เทียบปีนี้เป็นอย่างไร/);
  assert.match(questionSeed, /Booking อายุเกิน 90 วันมีเท่าไหร่/);
  assert.match(questionSeed, /Stock เกิน 90 วันมีรุ่นอะไรบ้าง/);
});

test("data dictionary maps only verified KMM fields and documents application mappings", () => {
  const requiredMappings = [
    ["sales_transactions", "sale_date"],
    ["sales_transactions", "quantity"],
    ["sales_transactions", "final_received"],
    ["sales_transactions", "gp1"],
    ["booking_transactions", "booking_date"],
    ["booking_transactions", "booking_price"],
    ["booking_transactions", "product_model"],
    ["stock_transactions", "stock_age_days"],
    ["stock_transactions", "stock_status"],
    ["stock_transactions", "serial_number"],
    ["branches", "branch_code"],
  ];
  for (const [table, field] of requiredMappings) assert.match(seed, new RegExp("'" + table + "', '" + field + "'"));
  assert.match(seed, /'APPLICATION_MAPPING', 'lib\/sales\/business-service\.ts::SALES_PRODUCT_TYPE_GROUPS'/);
  assert.match(seed, /ไม่พบตาราง product หรือ product_master ใน schema จริง/);
  assert.doesNotMatch(seed, /'sales_transaction',/);
  assert.doesNotMatch(seed, /'booking_transaction',/);
  assert.doesNotMatch(seed, /'stock_inventory',/);

  for (const table of ["sales_transactions", "booking_transactions", "stock_transactions"]) {
    assert.match(operationsSchema, new RegExp("CREATE TABLE `" + table + "`"));
  }
  for (const field of ["sale_date", "quantity", "final_received", "gp1", "product_type"]) {
    assert.match(operationsSchema, new RegExp("`" + field + "`"));
  }
  for (const field of ["booking_date", "booking_price", "product_model", "status"]) {
    assert.match(operationsSchema, new RegExp("`" + field + "`"));
  }
  for (const field of ["stock_age_days", "stock_status", "product_model", "serial_number", "msrp"]) {
    assert.match(operationsSchema, new RegExp("`" + field + "`"));
  }
  assert.match(schema, /sqliteTable\(\s*"branches"/);
  assert.match(schema, /branchCode: text\("branch_code"\)/);
});

test("query and response templates cover all seeded question intents", () => {
  const questionSeed = seed.split("INSERT OR IGNORE INTO `kai_question_library`")[1].split("INSERT OR IGNORE INTO `kai_query_templates`")[0];
  const questionIntents = new Set([...questionSeed.matchAll(/\('[^']*',\s*'([A-Z0-9_]+)',/g)].map((match) => match[1]));
  const queryBlock = seed.split("INSERT OR IGNORE INTO `kai_query_templates`")[1].split("INSERT OR IGNORE INTO `kai_response_templates`")[0];
  const responseBlock = seed.split("INSERT OR IGNORE INTO `kai_response_templates`")[1];
  for (const intent of questionIntents) {
    assert.match(queryBlock, new RegExp("'" + intent + "',"), `missing query template for ${intent}`);
  }
  for (const intent of ["SALES_CURRENT", "SALES_YOY_COMPARE", "BOOKING_CURRENT", "BOOKING_AGING_QUERY", "STOCK_CURRENT", "STOCK_AGING_QUERY"]) {
    assert.match(responseBlock, new RegExp("'" + intent + "',"), `missing response template for ${intent}`);
  }
  assert.ok((queryBlock.match(/\('[A-Z0-9_]+',/g) ?? []).length >= 30);
});

test("rollback removes only the KAI Phase 1E objects", () => {
  for (const table of Object.keys(tableColumns).reverse()) assert.match(rollback, new RegExp("DROP TABLE IF EXISTS `" + table + "`"));
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS `sales_transactions`/);
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS `booking_transactions`/);
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS `stock_transactions`/);
});
