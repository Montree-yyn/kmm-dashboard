/**
 * KAI Phase 2B Final Audit.
 *
 * This is deliberately separate from the coverage suite.  It samples 62
 * existing Thai, English, and mixed-language questions and compares each
 * executable answer with an independent, read-only Local D1 calculation.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const repoRoot = path.resolve(import.meta.dirname, "..");
const runtime = await tsImport("../lib/kai/runtime-query.ts", import.meta.url);
const selectors = await tsImport("../lib/dashboard/stock-selectors.ts", import.meta.url);
const companyContext = await tsImport("../lib/server/company-context.ts", import.meta.url);

function d1Path(requiredTable) {
  const root = path.join(repoRoot, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  if (!existsSync(root)) return null;
  return readdirSync(root).filter((name) => name.endsWith(".sqlite"))
    .map((name) => path.join(root, name)).find((database) => {
      try {
        return Number(JSON.parse(execFileSync("sqlite3", ["-json", database,
          `SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name=${literal(requiredTable)}`], { encoding: "utf8" }))[0]?.count) === 1;
      } catch { return false; }
    }) ?? null;
}

function literal(value) { return typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`; }
function query(database, statement) {
  const raw = execFileSync("sqlite3", ["-json", database, statement], { encoding: "utf8" });
  return raw.trim() ? JSON.parse(raw) : [];
}
function one(database, statement) { return query(database, statement)[0] ?? {}; }
function number(value) { return value === null || value === undefined || value === "" ? null : Number(value); }
function sameNumber(actual, expected, label) { assert.equal(actual, expected === null ? null : Number(expected), label); }

class Statement {
  constructor(database, statement, history) { this.database = database; this.statement = statement; this.history = history; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async all() {
    let index = 0;
    const bound = this.statement.replaceAll("?", () => literal(this.values[index++]));
    this.history?.push(bound);
    return { results: query(this.database, bound) };
  }
}

function runtimeDb(database, history) { return { prepare: (statement) => new Statement(database, statement, history) }; }
function stockRows(database) {
  const snapshotDate = one(database, "SELECT MAX(as_of_date) AS value FROM stock_transactions WHERE company_id = 'kmm-company'").value;
  const rows = query(database, `SELECT company_id AS companyId, kmm_flag AS kmm, stock_status AS currentStatus, product_type AS productType, product_group AS productGroup, product_model AS model, stock_number AS stockId, serial_number AS serialNumber, engine_number AS engineNumber, chassis_number AS chassisNumber, branch, CAST(NULLIF(TRIM(msrp), '') AS REAL) AS msrp, stock_age_days AS ageDays FROM stock_transactions WHERE company_id = 'kmm-company' AND as_of_date = ${literal(snapshotDate)}`);
  return { snapshotDate, rows: selectors.getCurrentStockRows(rows) };
}

const operationsDb = d1Path("kai_metrics");
const companyDb = d1Path("branches");
const context = {
  companyId: "kmm-company",
  timeZone: "Asia/Yangon",
  now: new Date("2026-08-12T12:00:00.000Z"),
  branches: [
    { code: "KMM01", name: "Hpa-an" },
    { code: "KMM02", name: "Mawlamyine" },
    { code: "KMM03", name: "Tharyarwaddy" },
  ],
  ...(companyDb ? { companyDatabase: runtimeDb(companyDb) } : {}),
};
const salesUnits = "'01-TT', '02-CH', '03-TP', '04-EX'";
const expenseProducts = "'01-TT', '02-CH', '03-TP', '04-EX', '06-IM', '07-IMO', '08-OT'";
const julySales = "company_id = 'kmm-company' AND sale_date BETWEEN '2026-07-01' AND '2026-07-31'";
const julyBooking = "company_id = 'kmm-company' AND booking_date BETWEEN '2026-07-01' AND '2026-07-31'";

async function ask(question) { return runtime.executeKaiRuntimeQuery(runtimeDb(operationsDb), question, context); }
async function auditSales(question, intent, predicate = "1 = 1") {
  const result = await ask(question);
  const expected = one(operationsDb, `SELECT COALESCE(SUM(CASE WHEN product_type IN (${salesUnits}) THEN quantity ELSE 0 END), 0) AS units, SUM(CAST(final_received AS REAL)) AS value FROM sales_transactions WHERE ${julySales} AND ${predicate}`);
  assert.equal(result.intent, intent, question);
  sameNumber(result.data.salesUnit, expected.units, question);
  sameNumber(result.data.salesValue, expected.value, question);
  return result;
}
async function auditBooking(question, intent, predicate = "1 = 1") {
  const result = await ask(question);
  const expected = one(operationsDb, `SELECT COUNT(*) AS units, SUM(CAST(booking_price AS REAL)) AS value FROM booking_transactions WHERE ${julyBooking} AND ${predicate}`);
  assert.equal(result.intent, intent, question);
  sameNumber(result.data.bookingUnit, expected.units, question);
  sameNumber(result.data.bookingValue, expected.value, question);
  return result;
}
function expectedRanking(table, where, field, unitSql, valueSql, sort = "units DESC, value DESC", limit = 5) {
  return query(operationsDb, `SELECT ${field} AS label, ${unitSql} AS units, ${valueSql} AS value FROM ${table} WHERE ${where} GROUP BY ${field} ORDER BY ${sort} LIMIT ${limit}`)
    .map((row) => ({ label: String(row.label ?? "ไม่ระบุ"), units: Number(row.units ?? 0), value: number(row.value) }));
}

test("Final Audit: 62 sampled executable answers exactly match Local D1", { skip: !operationsDb || !companyDb }, async () => {
  let checked = 0;
  for (const [question, intent, predicate] of [
    ["KMM03 ขาย Combine เดือนกรกฎาคม 2026 กี่คัน", "SALES_HISTORY_QUERY", "branch = 'KMM03' AND product_type = '02-CH'"],
    ["KMM03 Sales CH July 2026", "SALES_HISTORY_QUERY", "branch = 'KMM03' AND product_type = '02-CH'"],
    ["Tharyarwaddy Combine sales July 2026", "SALES_HISTORY_QUERY", "branch = 'KMM03' AND product_type = '02-CH'"],
    ["KMM01 Tractor sales July 2026", "SALES_HISTORY_QUERY", "branch = 'KMM01' AND product_type = '01-TT'"],
    ["KMM02 Excavator sales July 2026", "SALES_HISTORY_QUERY", "branch = 'KMM02' AND product_type = '04-EX'"],
    ["ยอดขายเดือนกรกฎาคม 2026 เท่าไร", "SALES_HISTORY_QUERY", "1 = 1"],
    ["Sales Value เดือนกรกฎาคม 2026 เท่าไร", "SALES_VALUE_CURRENT", "1 = 1"],
    ["KMM02 Sales Value เดือนกรกฎาคม 2026", "SALES_VALUE_CURRENT", "branch = 'KMM02'"],
  ]) { await auditSales(question, intent, predicate); checked += 1; }

  for (const [question, predicate] of [
    ["GP เดือนกรกฎาคม 2026 เท่าไร", "1 = 1"],
    ["KMM03 GP เดือนกรกฎาคม 2026", "branch = 'KMM03'"],
  ]) {
    const result = await ask(question);
    const expected = one(operationsDb, `SELECT COUNT(*) AS rows, SUM(CASE WHEN gp1 IS NULL OR TRIM(gp1) = '' THEN 1 ELSE 0 END) AS missing, SUM(CAST(gp1 AS REAL)) AS value FROM sales_transactions WHERE ${julySales} AND ${predicate}`);
    assert.equal(result.intent, "SALES_GP_QUERY", question);
    assert.equal(result.data.gpComplete, Number(expected.rows) === 0 || Number(expected.missing) === 0, question);
    sameNumber(result.data.gpValue, Number(expected.missing) ? null : expected.value, question); checked += 1;
  }
  for (const [question, predicate] of [["Sales Expense เดือนกรกฎาคม 2026", "1 = 1"], ["KMM03 Sales Expense July 2026", "branch = 'KMM03'"]]) {
    const result = await ask(question);
    const expected = one(operationsDb, `SELECT COUNT(*) AS rows, SUM(CASE WHEN expense IS NULL OR TRIM(expense) = '' THEN 1 ELSE 0 END) AS missing, SUM(CAST(expense AS REAL)) AS value FROM sales_transactions WHERE ${julySales} AND ${predicate} AND product_type IN (${expenseProducts})`);
    assert.equal(result.intent, "SALES_EXPENSE_QUERY", question);
    assert.equal(result.data.expenseComplete, Number(expected.rows) > 0 && Number(expected.missing) === 0, question);
    sameNumber(result.data.expenseValue, Number(expected.missing) ? null : expected.value, question); checked += 1;
  }
  for (const [question, intent, field] of [
    ["Sales branch ranking July 2026", "SALES_BRANCH_RANKING", "branch"],
    ["Sales model ranking July 2026", "SALES_MODEL_RANKING", "model"],
    ["Product Type sales ranking July 2026", "SALES_PRODUCT_RANKING", "product_type"],
  ]) {
    const result = await ask(question);
    const expected = expectedRanking("sales_transactions", julySales, field, `COALESCE(SUM(CASE WHEN product_type IN (${salesUnits}) THEN quantity ELSE 0 END), 0)`, "SUM(CAST(final_received AS REAL))", "units DESC, value DESC", 50);
    assert.equal(result.intent, intent, question); assert.deepEqual(result.data.ranking, expected, question); checked += 1;
  }
  const person = await ask("Salesperson 02-Aung Bo Bo sales July 2026");
  const expectedPerson = expectedRanking("sales_transactions", `${julySales} AND salesperson_code = 'MM170313'`, "salesperson_name", `COALESCE(SUM(CASE WHEN product_type IN (${salesUnits}) THEN quantity ELSE 0 END), 0)`, "SUM(CAST(final_received AS REAL))");
  assert.equal(person.intent, "SALES_PERSON_RANKING"); assert.deepEqual(person.data.ranking, expectedPerson); checked += 1;

  for (const [question, intent, predicate] of [
    ["Booking เดือนกรกฎาคม 2026 กี่คัน", "BOOKING_HISTORY_QUERY", "1 = 1"],
    ["Booking เดือนกรกฎาคม 2026 มูลค่าเท่าไร", "BOOKING_VALUE_CURRENT", "1 = 1"],
    ["KMM03 Booking เดือนกรกฎาคม 2026 กี่คัน", "BOOKING_HISTORY_QUERY", "branch = 'KMM03'"],
    ["Booking Open July 2026", "BOOKING_HISTORY_QUERY", "UPPER(status) = 'OPEN'"],
    ["Booking Delivered July 2026", "BOOKING_HISTORY_QUERY", "UPPER(status) = 'DELIVERED'"],
    ["Booking B HOT July 2026", "BOOKING_HISTORY_QUERY", "UPPER(purchase_status) = 'B HOT'"],
    ["KMM03 Booking A HOT July 2026", "BOOKING_HISTORY_QUERY", "branch = 'KMM03' AND UPPER(purchase_status) = 'A HOT'"],
  ]) { await auditBooking(question, intent, predicate); checked += 1; }
  for (const [question, predicate] of [["Booking Deposit July 2026", "1 = 1"], ["KMM03 Booking Deposit July 2026", "branch = 'KMM03'"]]) {
    const result = await ask(question);
    const expected = one(operationsDb, `SELECT COUNT(*) AS units, SUM(CASE WHEN deposit_amount IS NULL OR TRIM(deposit_amount) = '' THEN 1 ELSE 0 END) AS missing, SUM(CAST(deposit_amount AS REAL)) AS value FROM booking_transactions WHERE ${julyBooking} AND ${predicate}`);
    assert.equal(result.intent, "BOOKING_DEPOSIT_QUERY", question); sameNumber(result.data.bookingUnit, expected.units, question);
    sameNumber(result.data.recordedDepositValue, expected.value, question); assert.equal(result.data.missingDepositCount, Number(expected.missing), question); checked += 1;
  }
  const customer = await ask("Booking ลูกค้ากี่ราย July 2026");
  const expectedCustomers = one(operationsDb, `SELECT COUNT(DISTINCT NULLIF(TRIM(customer_name), '')) AS customers, COUNT(*) AS units FROM booking_transactions WHERE ${julyBooking}`);
  assert.equal(customer.intent, "CUSTOMER_BOOKING_QUERY"); assert.equal(customer.data.customerCount, Number(expectedCustomers.customers)); assert.equal(customer.data.bookingUnit, Number(expectedCustomers.units)); checked += 1;
  for (const [question, intent, field] of [
    ["Top 5 Booking models July 2026", "BOOKING_MODEL_RANKING", "product_model"],
    ["Top Booking branch July 2026", "BOOKING_BRANCH_RANKING", "branch"],
    ["Top 3 Booking Salesperson July 2026", "BOOKING_SALESPERSON_RANKING", "salesperson_name"],
    ["Booking Purchase Status summary July 2026", "BOOKING_PURCHASE_STATUS_RANKING", "purchase_status"],
    ["Booking lifecycle summary July 2026", "BOOKING_STATUS_RANKING", "status"],
  ]) {
    const result = await ask(question); const limit = question.includes("Top 3") ? 3 : question.includes("Top 5") ? 5 : 50;
    const expected = expectedRanking("booking_transactions", julyBooking, field, "COUNT(*)", "SUM(CAST(booking_price AS REAL))", "units DESC, value DESC", limit);
    assert.equal(result.intent, intent, question); assert.deepEqual(result.data.ranking, expected, question); checked += 1;
  }
  const conversion = await ask("Booking Conversion เดือนกรกฎาคม 2026 เท่าไหร่");
  const expectedConversion = one(operationsDb, `SELECT COUNT(*) AS total, SUM(CASE WHEN UPPER(status) = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered FROM booking_transactions WHERE ${julyBooking}`);
  assert.equal(conversion.intent, "BOOKING_CONVERSION_QUERY"); assert.equal(conversion.data.total, Number(expectedConversion.total)); assert.equal(conversion.data.delivered, Number(expectedConversion.delivered)); checked += 1;

  const stock = stockRows(operationsDb);
  for (const [question, intent, filter, key] of [
    ["Stock ปัจจุบันมีกี่คัน", "STOCK_CURRENT", () => true, "summary"],
    ["Stock ปัจจุบันมูลค่าเท่าไหร่", "STOCK_VALUE_CURRENT", () => true, "summary"],
    ["KMM01 Combine Stock", "STOCK_CURRENT", (row) => row.branch === "KMM01" && selectors.normalizeProductType(row) === "CH", "summary"],
    ["Stock รุ่น DC70G PRO มีเท่าไหร่", "STOCK_MODEL_QUERY", (row) => String(row.model).replaceAll("-", "").replaceAll(" ", "").toUpperCase() === "DC70GPRO", "summary"],
  ]) {
    const result = await ask(question); const filtered = stock.rows.filter(filter); const units = selectors.getStockUnitRows(filtered); const values = selectors.getStockValueRows(filtered);
    assert.equal(result.intent, intent, question); assert.equal(result.data.stockUnit, units.length, question); sameNumber(result.data.stockValue, values.reduce((sum, row) => sum + Number(row.msrp ?? 0), 0), question); checked += 1;
  }
  for (const [question, intent, filter, min, max] of [
    ["Stock CH อายุเกิน 90 วันใน KMM01 มีกี่คัน", "STOCK_AGING_QUERY", (row) => row.branch === "KMM01" && selectors.normalizeProductType(row) === "CH", 91, Infinity],
    ["Stock aging 31-60 days", "STOCK_AGING_QUERY", () => true, 31, 60],
    ["Stock Slow Moving มีรุ่นอะไรบ้าง", "STOCK_SLOW_MOVING_MODEL_RANKING", () => true, 181, Infinity],
  ]) {
    const result = await ask(question); const expected = selectors.getStockUnitRows(stock.rows.filter(filter)).filter((row) => Number(row.ageDays) >= min && Number(row.ageDays) <= max).length;
    assert.equal(result.intent, intent, question); assert.equal(result.data.total ?? result.data.ranking.reduce((sum, row) => sum + row.quantity, 0), expected, question); checked += 1;
  }
  for (const [question, intent, field] of [["Top stock models", "STOCK_MODEL_RANKING", "model"], ["Top stock branches", "STOCK_BRANCH_RANKING", "branch"]]) {
    const result = await ask(question); const units = selectors.getStockUnitRows(stock.rows); const values = new Set(selectors.getStockValueRows(units));
    const groups = new Map(); for (const row of units) { const label = String(row[field] ?? "ไม่ระบุ"); const prior = groups.get(label) ?? { label, quantity: 0, value: 0, maxAgeDays: null }; prior.quantity += 1; prior.value += values.has(row) ? Number(row.msrp ?? 0) : 0; prior.maxAgeDays = Math.max(prior.maxAgeDays ?? 0, Number(row.ageDays ?? 0)); groups.set(label, prior); }
    const expected = [...groups.values()].sort((a, b) => b.quantity - a.quantity || b.value - a.value).slice(0, 50);
    assert.equal(result.intent, intent, question); assert.deepEqual(result.data.ranking, expected, question); checked += 1;
  }

  for (const [question, intent, metric, productGroup, period] of [
    ["Sales target January 2026", "TARGET_CURRENT_QUERY", "SALES_UNITS", "", "2026-01"],
    ["Target CH July 2026", "TARGET_CURRENT_QUERY", "SALES_UNITS", "CH", "2026-07"],
    ["Target EX July 2026", "TARGET_CURRENT_QUERY", "SALES_UNITS", "EX_TP", "2026-07"],
    ["Sales Revenue Target July 2026", "SALES_REVENUE_TARGET_QUERY", "SALES_REVENUE", "", "2026-07"],
    ["GP Target July 2026", "SALES_GP_TARGET_QUERY", "GP1", "", "2026-07"],
  ]) {
    const [year, month] = period.split("-"); const result = await ask(question);
    const expected = one(operationsDb, `SELECT target_value FROM business_targets WHERE company_id = 'kmm-company' AND metric = ${literal(metric)} AND product_group = ${literal(productGroup)} AND approval_status = 'approved' AND branch_id = '' AND salesperson_id = '' AND target_year = ${year} AND target_month = ${Number(month)} ORDER BY effective_from DESC, updated_at DESC, source_version DESC LIMIT 1`);
    assert.equal(result.intent, intent, question); sameNumber(result.data.target, expected.target_value, question); checked += 1;
  }
  for (const [question, intent] of [["Sales Revenue Achievement January 2026", "SALES_REVENUE_ACHIEVEMENT_QUERY"], ["GP Gap July 2026", "SALES_GP_GAP_QUERY"]]) {
    const result = await ask(question); assert.equal(result.intent, intent, question); assert.equal(result.data.available, undefined, question); assert.ok(Number.isFinite(Number(result.data.target)), question); assert.ok(Number.isFinite(Number(result.data.actual)), question); checked += 1;
  }

  const people = await ask("Salesperson directory MM170313");
  const expectedPeople = query(operationsDb, "SELECT salesperson_code AS code, salesperson_name AS name, status FROM salesperson_master WHERE company_id = 'kmm-company' AND UPPER(salesperson_code) = 'MM170313' ORDER BY CASE WHEN LOWER(status) = 'active' THEN 0 ELSE 1 END, salesperson_name");
  assert.equal(people.intent, "SALESPERSON_MASTER_QUERY"); assert.deepEqual(people.data.salespeople, expectedPeople); checked += 1;
  const branches = await ask("Branch directory"); const expectedBranches = query(companyDb, "SELECT branch_code AS code, branch_name AS name, NULLIF(TRIM(region), '') AS region, NULLIF(TRIM(township), '') AS township FROM branches WHERE company_id = 'kmm-company' AND LOWER(status) = 'active' ORDER BY branch_code");
  assert.equal(branches.intent, "BRANCH_DIRECTORY_QUERY"); assert.deepEqual(branches.data.branches, expectedBranches); checked += 1;
  const profile = await ask("Company profile"); const expectedProfile = one(companyDb, "SELECT company_name AS name, company_code AS code, NULLIF(TRIM(business_type), '') AS businessType, NULLIF(TRIM(industry), '') AS industry, established_year AS establishedYear, status FROM companies WHERE company_id = 'kmm-company' AND LOWER(status) = 'active' LIMIT 1");
  assert.equal(profile.intent, "COMPANY_PROFILE_QUERY"); assert.deepEqual(profile.data.companyProfile, { ...expectedProfile, establishedYear: number(expectedProfile.establishedYear) }); checked += 1;
  const currency = await ask("Company currency"); const expectedCurrency = one(companyDb, "SELECT primary_currency AS \"primary\", display_currency AS display, currency_symbol AS symbol, decimal_places AS decimalPlaces, number_format AS numberFormat FROM company_currencies WHERE company_id = 'kmm-company' AND LOWER(status) = 'active' LIMIT 1");
  assert.equal(currency.intent, "COMPANY_CURRENCY_QUERY"); assert.deepEqual(currency.data.currency, { ...expectedCurrency, decimalPlaces: Number(expectedCurrency.decimalPlaces) }); checked += 1;

  for (const [question, start, end] of [
    ["Sales today", "2026-08-12", "2026-08-12"], ["Sales yesterday", "2026-08-11", "2026-08-11"],
    ["Sales this month", "2026-08-01", "2026-08-31"], ["Sales last month", "2026-07-01", "2026-07-31"],
    ["Sales this year", "2026-01-01", "2026-12-31"], ["Sales last year", "2025-01-01", "2025-12-31"],
    ["Sales MTD", "2026-08-01", "2026-08-12"], ["Sales YTD", "2026-01-01", "2026-08-12"],
    ["Sales July 2026", "2026-07-01", "2026-07-31"], ["Sales 2026-07-01 to 2026-07-31", "2026-07-01", "2026-07-31"],
  ]) { const result = await ask(question); assert.equal(result.data.period.start, start, question); assert.equal(result.data.period.end, end, question); checked += 1; }
  assert.equal(checked, 62);
});

test("Final Audit: unsupported and ambiguous questions never substitute a metric", { skip: !operationsDb }, async () => {
  for (const question of ["Booking Cash July 2026", "Outstanding Booking July 2026", "Customer sales July 2026", "Sales 05-TX July 2026", "Sales MITSU July 2026", "Stock 08-TX", "Sales commission July 2026", "Sales receive date July 2026", "KMM99 Sales July 2026"]) {
    const result = await ask(question); assert.equal(result.data.available, false, question); assert.doesNotMatch(result.response.text, /Sales Unit:|Booking Unit:|Stock Unit:/i, question);
  }
  for (const question of ["KMM03 เท่าไร", "M7040 เท่าไร", "ยอดเดือนนี้", "03 CH"]) {
    const result = await ask(question); assert.equal(result.intent, "AMBIGUOUS_METRIC", question); assert.equal(result.data.ambiguous, true, question);
  }
  const noBranchVocabulary = await runtime.executeKaiRuntimeQuery(runtimeDb(operationsDb), "KMM03 Sales July 2026", { ...context, branches: [] });
  assert.equal(noBranchVocabulary.data.available, false);
  assert.match(noBranchVocabulary.response.text, /scope|สิทธิ์/i);
});

test("Final Audit: authorization precedes bindings and unauthorized scopes are rejected", () => {
  const route = readFileSync(path.join(repoRoot, "app/api/kai/query/route.ts"), "utf8");
  assert.ok(route.indexOf("requireCompanyContext(request") < route.indexOf("getOperationsDatabase()"));
  assert.ok(route.indexOf("requireCompanyContext(request") < route.indexOf("getCompanyDatabase()"));
  assert.match(route, /permission:\s*"view"/); assert.match(route, /companyId:\s*context\.id/);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.delete\(|\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\b/);
  const permitted = [{ id: "kmm-company", tenantId: "tenant", code: "KMM", name: "KMM", logoUrl: null, role: "viewer" }];
  assert.throws(() => companyContext.selectAuthorizedCompany(permitted, "other-company", true), (error) => error?.status === 403);
  assert.throws(() => companyContext.selectAuthorizedCompany(permitted, "other-company", false), (error) => error?.status === 403);
  assert.equal(companyContext.selectAuthorizedCompany(permitted, "kmm-company", true).id, "kmm-company");
});
