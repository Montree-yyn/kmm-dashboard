import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const repoRoot = path.resolve(import.meta.dirname, "..");
const runtime = await tsImport("../lib/kai/runtime-query.ts", import.meta.url);
const stockSelectors = await tsImport("../lib/dashboard/stock-selectors.ts", import.meta.url);

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

function localCompanyDb() {
  const root = path.join(repoRoot, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  if (!existsSync(root)) return null;
  return readdirSync(root)
    .filter((name) => name.endsWith(".sqlite"))
    .map((name) => path.join(root, name))
    .find((database) => {
      try {
        return Number(JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='branches'"], { encoding: "utf8" }))[0]?.count) === 1;
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

function runtimeDatabase(database, history) {
  return {
    prepare(query) {
      history?.push(query);
      return new Statement(database, query);
    },
  };
}

function dashboardStockRows(database) {
  const latest = JSON.parse(execFileSync("sqlite3", ["-json", database,
    "SELECT MAX(as_of_date) AS snapshotDate FROM stock_transactions WHERE company_id = 'kmm-company'"], { encoding: "utf8" }))[0]?.snapshotDate;
  const rows = JSON.parse(execFileSync("sqlite3", ["-json", database,
    `SELECT company_id AS companyId, kmm_flag AS kmm, stock_status AS currentStatus, product_type AS productType, product_group AS productGroup, product_model AS model, stock_number AS stockId, serial_number AS serialNumber, engine_number AS engineNumber, chassis_number AS chassisNumber, branch, CAST(NULLIF(TRIM(msrp), '') AS REAL) AS msrp, stock_age_days AS ageDays FROM stock_transactions WHERE company_id = 'kmm-company' AND as_of_date = ${sql(latest)}`], { encoding: "utf8" }));
  return { latest, rows };
}

const databasePath = localOperationsDb();
const companyDatabasePath = localCompanyDb();
const context = {
  companyId: "kmm-company",
  timeZone: "Asia/Yangon",
  now: new Date("2026-08-12T12:00:00.000Z"),
  branches: [
    { code: "KMM01", name: "Hpa-an" },
    { code: "KMM02", name: "Mawlamyine" },
    { code: "KMM03", name: "Tharyarwaddy" },
  ],
  ...(companyDatabasePath ? { companyDatabase: { prepare: (query) => new Statement(companyDatabasePath, query) } } : {}),
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

// Phase 2B-04 adds verified data domains and combinations rather than merely
// rewording the existing suite. Each case is executed against Local D1.
const phase2b04Cases = [
  ["Sales Expense January 2026", "SALES_EXPENSE_QUERY"],
  ["Sales Expense เดือน 2 ปี 2026", "SALES_EXPENSE_QUERY"],
  ["Sales Expense เดือนกรกฎาคม 2026", "SALES_EXPENSE_QUERY"],
  ["ค่าใช้จ่ายขายเดือน 7 ปี 2026", "SALES_EXPENSE_QUERY"],
  ["KMM03 Sales Expense July 2026", "SALES_EXPENSE_QUERY"],
  ["Sales Expense TT July 2026", "SALES_EXPENSE_QUERY"],
  ["Sales Expense CH July 2026", "SALES_EXPENSE_QUERY"],
  ["Sales Expense IM July 2026", "SALES_EXPENSE_QUERY"],
  ["Sales Expense August 2026", "SALES_EXPENSE_QUERY"],
  ["Sales Expense ปี 2026", "SALES_EXPENSE_QUERY"],

  ["Booking Deposit January 2026", "BOOKING_DEPOSIT_QUERY"],
  ["Booking Deposit เดือน 2 ปี 2026", "BOOKING_DEPOSIT_QUERY"],
  ["Booking Deposit เดือนกรกฎาคม 2026", "BOOKING_DEPOSIT_QUERY"],
  ["ยอดมัดจำ Booking เดือนกรกฎาคม 2026", "BOOKING_DEPOSIT_QUERY"],
  ["KMM03 Booking Deposit July 2026", "BOOKING_DEPOSIT_QUERY"],
  ["Booking Deposit A HOT July 2026", "BOOKING_DEPOSIT_QUERY"],
  ["Booking Deposit Open July 2026", "BOOKING_DEPOSIT_QUERY"],
  ["Booking Deposit Delivered July 2026", "BOOKING_DEPOSIT_QUERY"],
  ["Booking Deposit August 2026", "BOOKING_DEPOSIT_QUERY"],
  ["Booking Down Payment July 2026", "BOOKING_DEPOSIT_QUERY"],

  ["Booking Salesperson ranking July 2026", "BOOKING_SALESPERSON_RANKING"],
  ["Top 3 Booking Salesperson July 2026", "BOOKING_SALESPERSON_RANKING"],
  ["Booking Purchase Status breakdown July 2026", "BOOKING_PURCHASE_STATUS_RANKING"],
  ["Booking Purchase Status summary July 2026", "BOOKING_PURCHASE_STATUS_RANKING"],
  ["Booking สถานะการซื้อ สรุป เดือนกรกฎาคม 2026", "BOOKING_PURCHASE_STATUS_RANKING"],
  ["Booking Status breakdown July 2026", "BOOKING_STATUS_RANKING"],
  ["Booking lifecycle summary July 2026", "BOOKING_STATUS_RANKING"],
  ["Booking สถานะ สรุป เดือนกรกฎาคม 2026", "BOOKING_STATUS_RANKING"],
  ["Booking Open July 2026", "BOOKING_HISTORY_QUERY"],
  ["Booking Delivered July 2026", "BOOKING_HISTORY_QUERY"],
  ["Booking Cancelled July 2026", "BOOKING_HISTORY_QUERY"],
  ["Booking A HOT July 2026", "BOOKING_HISTORY_QUERY"],
  ["Booking B HOT July 2026", "BOOKING_HISTORY_QUERY"],
  ["KMM03 Booking A HOT July 2026", "BOOKING_HISTORY_QUERY"],

  ["Sales Revenue Target January 2026", "SALES_REVENUE_TARGET_QUERY"],
  ["Sales Revenue Target เดือน 2 ปี 2026", "SALES_REVENUE_TARGET_QUERY"],
  ["Sales Revenue Target เดือนกรกฎาคม 2026", "SALES_REVENUE_TARGET_QUERY"],
  ["Revenue Target July 2026", "SALES_REVENUE_TARGET_QUERY"],
  ["รายได้ Target เดือน 8 ปี 2026", "SALES_REVENUE_TARGET_QUERY"],
  ["Sales Revenue Target ปี 2026", "SALES_REVENUE_TARGET_QUERY"],
  ["Sales Revenue Target this quarter", "SALES_REVENUE_TARGET_QUERY"],
  ["Sales Revenue Achievement January 2026", "SALES_REVENUE_ACHIEVEMENT_QUERY"],
  ["Sales Revenue Achievement เดือนกรกฎาคม 2026", "SALES_REVENUE_ACHIEVEMENT_QUERY"],
  ["Sales Revenue Gap January 2026", "SALES_REVENUE_GAP_QUERY"],
  ["Sales Revenue Gap เดือนกรกฎาคม 2026", "SALES_REVENUE_GAP_QUERY"],
  ["Sales Revenue Gap ปี 2026", "SALES_REVENUE_GAP_QUERY"],

  ["GP Target January 2026", "SALES_GP_TARGET_QUERY"],
  ["GP Target เดือนกรกฎาคม 2026", "SALES_GP_TARGET_QUERY"],
  ["Gross Profit Target July 2026", "SALES_GP_TARGET_QUERY"],
  ["กำไรขั้นต้น Target เดือน 8 ปี 2026", "SALES_GP_TARGET_QUERY"],
  ["GP Target ปี 2026", "SALES_GP_TARGET_QUERY"],
  ["GP Achievement January 2026", "SALES_GP_ACHIEVEMENT_QUERY"],
  ["GP Achievement เดือนกรกฎาคม 2026", "SALES_GP_ACHIEVEMENT_QUERY"],
  ["Gross Profit Achievement July 2026", "SALES_GP_ACHIEVEMENT_QUERY"],
  ["GP Gap January 2026", "SALES_GP_GAP_QUERY"],
  ["GP Gap เดือนกรกฎาคม 2026", "SALES_GP_GAP_QUERY"],
  ["Gross Profit Gap July 2026", "SALES_GP_GAP_QUERY"],
  ["GP Gap ปี 2026", "SALES_GP_GAP_QUERY"],

  ["Target CH January 2026", "TARGET_CURRENT_QUERY"],
  ["Target CH July 2026", "TARGET_CURRENT_QUERY"],
  ["Target TT January 2026", "TARGET_CURRENT_QUERY"],
  ["Target TT July 2026", "TARGET_CURRENT_QUERY"],
  ["Target EX January 2026", "TARGET_CURRENT_QUERY"],
  ["Target EX July 2026", "TARGET_CURRENT_QUERY"],
  ["Target TP January 2026", "TARGET_CURRENT_QUERY"],
  ["Target TP July 2026", "TARGET_CURRENT_QUERY"],
  ["Target CH Achievement July 2026", "SALES_ACHIEVEMENT_QUERY"],
  ["Target TT Gap July 2026", "SALES_GAP_QUERY"],

  ["Salesperson directory", "SALESPERSON_MASTER_QUERY"],
  ["Salesperson master", "SALESPERSON_MASTER_QUERY"],
  ["Salesperson active list", "SALESPERSON_MASTER_QUERY"],
  ["รายชื่อพนักงานขาย", "SALESPERSON_MASTER_QUERY"],
  ["พนักงานขายกี่คน", "SALESPERSON_MASTER_QUERY"],
  ["Salesperson directory MM170313", "SALESPERSON_MASTER_QUERY"],
  ["Branch directory", "BRANCH_DIRECTORY_QUERY"],
  ["Branches list", "BRANCH_DIRECTORY_QUERY"],
  ["รายชื่อสาขา", "BRANCH_DIRECTORY_QUERY"],
  ["ข้อมูลสาขา", "BRANCH_DIRECTORY_QUERY"],
  ["KMM03 branch details", "BRANCH_DIRECTORY_QUERY"],
  ["KMM01 branch location", "BRANCH_DIRECTORY_QUERY"],
  ["Company profile", "COMPANY_PROFILE_QUERY"],
  ["ข้อมูลบริษัท", "COMPANY_PROFILE_QUERY"],
  ["Company currency", "COMPANY_CURRENCY_QUERY"],
  ["Company timezone", "COMPANY_LOCALIZATION_QUERY"],
  ["Fiscal year", "FISCAL_YEAR_QUERY"],
  ["Working calendar", "WORKING_CALENDAR_QUERY"],

  ["Stock aging 0-90 days", "STOCK_AGING_QUERY"],
  ["Stock aging 31-60 days", "STOCK_AGING_QUERY"],
  ["Stock aging 91-180 days", "STOCK_AGING_QUERY"],
  ["Stock aging over 30 days", "STOCK_AGING_QUERY"],
  ["Stock อายุ 31-60 วัน", "STOCK_AGING_QUERY"],
  ["Stock 31-60 days models", "STOCK_AGING_MODEL"],
  ["Stock slow moving 181-365 days", "STOCK_SLOW_MOVING_QUERY"],
  ["Booking aging 31-60 days", "BOOKING_AGING"],
  ["Booking aging 91-180 days", "BOOKING_AGING"],
  ["Booking 31-60 days list", "BOOKING_AGING_LIST"],
  ["Booking อายุ 31-60 วัน", "BOOKING_AGING"],
  ["Booking aging over 30 days", "BOOKING_AGING"],

  ["Tharyarwaddy Combine sales July 2026", "SALES_HISTORY_QUERY"],
  ["KMM01 Tractor sales July 2026", "SALES_HISTORY_QUERY"],
  ["KMM02 Excavator sales July 2026", "SALES_HISTORY_QUERY"],
  ["KMM03 Combine sales July 2026", "SALES_HISTORY_QUERY"],
  ["Salesperson MM170313 sales July 2026", "SALES_PERSON_RANKING"],
  ["Salesperson 02-Aung Bo Bo sales July 2026", "SALES_PERSON_RANKING"],
  ["Stock DC-70G PRO", "STOCK_MODEL_QUERY"],
  ["KMM01 Combine Stock", "STOCK_CURRENT"],
  ["KMM02 Tractor Stock", "STOCK_CURRENT"],
  ["KMM03 IM Stock", "STOCK_CURRENT"],
  ["Booking KMM01 Combine July 2026", "BOOKING_HISTORY_QUERY"],
  ["Booking KMM02 Tractor July 2026", "BOOKING_HISTORY_QUERY"],
];

const phase2b04UnavailableCases = [
  ["Booking Cash July 2026", /Payment Type|ไม่มีข้อมูล/i],
  ["Outstanding Booking July 2026", /Outstanding|ยังไม่มี/i],
  ["Customer sales July 2026", /ลูกค้า|ฐานข้อมูล/i],
  ["Sales Expense February 2024", /Expense is incomplete|ไม่มีข้อมูล/i],
  ["Sales Revenue Target KMM03 July 2026", /company-wide|branch/i],
  ["GP Target Salesperson MM170313 July 2026", /company-wide|salesperson/i],
  ["Target IM July 2026", /No approved Target|Target/i],
  ["Sales Revenue Target MTD", /monthly|partial/i],
  ["Sales 05-TX July 2026", /canonical product mapping/i],
  ["Stock 08-TX", /canonical product mapping/i],
  ["Sales MITSU July 2026", /canonical product mapping/i],
  ["Department directory", /No active Department/i],
  ["Holiday directory", /No active Holiday/i],
];

test("all Phase 2B-04 Knowledge templates are executable JSON plans", { skip: !databasePath }, () => {
  const rows = JSON.parse(execFileSync("sqlite3", ["-json", databasePath, "SELECT intent, query_logic FROM kai_query_templates ORDER BY intent"], { encoding: "utf8" }));
  assert.equal(rows.length, 54);
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

test("Phase 2B-04 preserves filters, field definitions, unavailable states, and Company DB isolation", { skip: !databasePath || !companyDatabasePath }, async () => {
  const database = { prepare: (query) => new Statement(databasePath, query) };
  const sales = await runtime.executeKaiRuntimeQuery(database, "KMM03 ขาย Combine เดือนกรกฎาคม 2026 กี่คัน", context);
  assert.equal(sales.data.salesUnit, 7);
  assert.equal(sales.data.period.label, "2026-07");
  const stock = await runtime.executeKaiRuntimeQuery(database, "Stock CH อายุเกิน 90 วันใน KMM01 มีกี่คัน", context);
  const expectedStock = stockSelectors.getStockUnitRows(dashboardStockRows(databasePath).rows)
    .filter((row) => row.branch === "KMM01" && stockSelectors.normalizeProductType(row) === "CH" && Number(row.ageDays) > 90).length;
  assert.equal(stock.data.total, expectedStock);
  const person = await runtime.executeKaiRuntimeQuery(database, "Salesperson 02-Aung Bo Bo เดือนกรกฎาคม 2026 ขายกี่คัน", context);
  assert.deepEqual(person.data.ranking, [{ label: "U Aung Bo Bo", units: 5, value: 754333600 }]);
  for (const question of ["Booking Cash มีกี่คัน", "Outstanding booking มีกี่คัน"]) {
    const result = await runtime.executeKaiRuntimeQuery(database, question, context);
    assert.equal(result.data.available, false, question);
    assert.doesNotMatch(result.response.text, /Stock Aging|\b35\b/i, question);
  }

  const salesAlias = await runtime.executeKaiRuntimeQuery(database, "Salesperson 02-Aung Bo Bo sales July 2026", context);
  assert.deepEqual(salesAlias.data.ranking, [{ label: "U Aung Bo Bo", units: 5, value: 754333600 }]);

  const openBooking = await runtime.executeKaiRuntimeQuery(database, "Booking Open July 2026", context);
  const expectedOpenBooking = JSON.parse(execFileSync("sqlite3", ["-json", databasePath,
    "SELECT COUNT(*) AS count FROM booking_transactions WHERE company_id = 'kmm-company' AND booking_date BETWEEN '2026-07-01' AND '2026-07-31' AND UPPER(status) = 'OPEN'"], { encoding: "utf8" }))[0].count;
  assert.equal(openBooking.data.bookingUnit, expectedOpenBooking);

  const deposit = await runtime.executeKaiRuntimeQuery(database, "Booking Deposit July 2026", context);
  const expectedDeposit = JSON.parse(execFileSync("sqlite3", ["-json", databasePath,
    "SELECT COUNT(*) AS bookingUnit, SUM(CASE WHEN deposit_amount IS NULL OR TRIM(deposit_amount) = '' THEN 1 ELSE 0 END) AS missingDepositCount FROM booking_transactions WHERE company_id = 'kmm-company' AND booking_date BETWEEN '2026-07-01' AND '2026-07-31'"], { encoding: "utf8" }))[0];
  assert.equal(deposit.data.bookingUnit, expectedDeposit.bookingUnit);
  assert.equal(deposit.data.missingDepositCount, expectedDeposit.missingDepositCount);
  assert.match(deposit.response.text, /Recorded Deposit/i);

  const revenueTarget = await runtime.executeKaiRuntimeQuery(database, "Sales Revenue Target July 2026", context);
  assert.equal(revenueTarget.data.targetMetric, "SALES_REVENUE");
  assert.equal(revenueTarget.data.target, 3040000000);
  assert.equal(revenueTarget.data.sourceVersions[0], "2026-Revised-H2");
  const gpTarget = await runtime.executeKaiRuntimeQuery(database, "GP Target July 2026", context);
  assert.equal(gpTarget.data.targetMetric, "GP1");
  assert.equal(gpTarget.data.target, 349600000);
  const branchTarget = await runtime.executeKaiRuntimeQuery(database, "Target KMM03 July 2026", context);
  assert.equal(branchTarget.data.available, false);
  assert.match(branchTarget.response.text, /company-wide/i);
  const ageRange = await runtime.executeKaiRuntimeQuery(database, "Stock aging 31-60 days", context);
  assert.deepEqual(ageRange.data.ageRange, { min: 31, max: 60, label: "31–60" });

  const operationsHistory = [];
  const companyHistory = [];
  const scopedContext = { ...context, companyDatabase: runtimeDatabase(companyDatabasePath, companyHistory) };
  const branchDirectory = await runtime.executeKaiRuntimeQuery(runtimeDatabase(databasePath, operationsHistory), "Branch directory", scopedContext);
  assert.equal(branchDirectory.intent, "BRANCH_DIRECTORY_QUERY");
  assert.equal(branchDirectory.data.branchCount, 3);
  assert.ok(companyHistory.some((query) => /FROM "branches"/i.test(query)));
  assert.ok(!operationsHistory.some((query) => /FROM "branches"/i.test(query)));
  const otherCompany = await runtime.executeKaiRuntimeQuery(runtimeDatabase(databasePath), "Branch directory", { ...scopedContext, companyId: "other-company", branches: [] });
  assert.equal(otherCompany.data.branchCount, 0);
  const withoutCompanyBinding = { ...context };
  delete withoutCompanyBinding.companyDatabase;
  await assert.rejects(runtime.executeKaiRuntimeQuery(runtimeDatabase(databasePath), "Branch directory", withoutCompanyBinding), (error) => error?.code === "database_unavailable");
  const route = readFileSync(path.join(repoRoot, "app/api/kai/query/route.ts"), "utf8");
  assert.match(route, /COMPANY_DB/);
  assert.match(route, /requireCompanyContext[\s\S]*permission:\s*"view"/);
});

test("Phase 2B-04 has 250+ Local D1 coverage cases across paraphrases and verified unavailable states", { skip: !databasePath || !companyDatabasePath }, async () => {
  assert.ok(coverageCases.length + paraphraseCases.length + phase2b04Cases.length + phase2b04UnavailableCases.length >= 250);
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
  let pass = 0;
  for (const [question, expectedIntent] of phase2b04Cases) {
    let result;
    try {
      result = await runtime.executeKaiRuntimeQuery(database, question, context);
    } catch (error) {
      assert.fail(`${question}: ${error instanceof Error ? error.message : String(error)}`);
    }
    assert.equal(result.intent, expectedIntent, question);
    assert.notEqual(result.data.available, false, question);
    assert.ok(result.response.text.length > 0, question);
    pass += 1;
  }
  let noData = 0;
  for (const [question, expectedReason] of phase2b04UnavailableCases) {
    const result = await runtime.executeKaiRuntimeQuery(database, question, context);
    assert.equal(result.data.available, false, question);
    assert.match(result.response.text, expectedReason, question);
    noData += 1;
  }
  assert.equal(pass, phase2b04Cases.length);
  assert.equal(noData, phase2b04UnavailableCases.length);
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
