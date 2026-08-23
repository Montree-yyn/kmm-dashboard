/**
 * KAI Phase 2B executable-query runtime.
 *
 * Query plans are records in D1, but all SQL grammar, identifiers, and values
 * remain server-owned. Question text is parsed into a small verified constraint
 * object and becomes bound values only.
 */

import { canonicalModelName } from "../dashboard/model-normalization";
import {
  getCurrentStockRows,
  getStockUnitRows,
  getStockValueRows,
  normalizeProductType as normalizeDashboardStockProduct,
} from "../dashboard/stock-selectors";

export type RuntimePreparedStatement = {
  bind(...values: unknown[]): RuntimePreparedStatement;
  all<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<{ results?: T[] }>;
};

export type RuntimeQueryDatabase = { prepare(query: string): RuntimePreparedStatement };

export type RuntimeQueryContext = {
  companyId: string;
  timeZone: string;
  now?: Date;
  branches?: Array<{ code: string; name: string }>;
  /**
   * A separately bound Company D1 database. It is used only by explicit
   * Company-master plans after the route has resolved the caller's company
   * membership and read permission.
   */
  companyDatabase?: RuntimeQueryDatabase;
};

type RuntimeMetric = { code: string; name: string; unitType: string; formula: string };

export type RuntimeQueryResult = {
  intent: string;
  metric: RuntimeMetric;
  metrics: RuntimeMetric[];
  data: Record<string, unknown>;
  response: { template: string; text: string };
};

export class KaiRuntimeQueryError extends Error {
  constructor(
    message: string,
    readonly code: "unsupported_question" | "knowledge_error" | "query_error" | "database_unavailable",
    readonly status = code === "unsupported_question" ? 422 : 500,
  ) {
    super(message);
  }
}

type MetricRow = {
  metric_code: string;
  metric_name: string;
  unit_type: string;
  formula: string;
};
type QuestionRow = { intent: string; required_metric: string };
type PlanRow = { intent: string; query_logic: string };
type ResponseRow = { intent: string; response_structure: string };
type Plan = {
  version: 2;
  source: "sales_transactions" | "booking_transactions" | "stock_transactions" | "business_targets" | "salesperson_master" | "company_branches" | "company_master" | "agriculture";
  operation: string;
  group_by?: string;
  threshold?: number;
  limit?: number;
  mode?: string;
  target_metric?: TargetMetric;
  company_entity?: CompanyMasterEntity;
  list?: boolean;
};
type Period = { start: string; end: string; label: string };
type TargetMetric = "SALES_UNITS" | "SALES_REVENUE" | "GP1";
type CompanyMasterEntity = "profile" | "currency" | "localization" | "fiscal_year" | "working_calendar" | "department" | "holiday";
type AgeRange = { min: number; max?: number; label: string };
type Constraints = {
  branches?: string[];
  product?: ProductGroup;
  model?: string;
  salesperson?: string;
  salespersonCode?: string;
  customer?: string;
  purchaseStatus?: string;
  bookingLifecycleStatus?: "Open" | "Delivered" | "Cancelled";
  ageRange?: AgeRange;
  sort: "units" | "value";
  limit: number;
  period: Period;
  explicitPeriod: boolean;
};
type ProductGroup = "TT" | "CH" | "EX" | "TP" | "IM" | "IMO" | "OT";

const MAX_ROWS = 5_000;
const PRODUCT_CODES: Record<"sales" | "booking" | "stock", Partial<Record<ProductGroup, string[]>>> = {
  sales: { TT: ["01-TT"], CH: ["02-CH"], EX: ["04-EX"], TP: ["03-TP"], IM: ["06-IM"], IMO: ["07-IMO"], OT: ["08-OT"] },
  booking: { TT: ["01-TT"], CH: ["02-CH"], EX: ["04-EX"] },
  stock: { TT: ["01-TT"], CH: ["02-CH"], EX: ["03-EX"], TP: ["04-TP"], IM: ["06-IM"], IMO: ["07-IMO"] },
};
const SALES_UNIT_CODES = ["01-TT", "02-CH", "03-TP", "04-EX"];
// The Sales business service keeps Expense on its existing verified legacy
// value scope. Unknown raw codes (notably 05-TX and MITSU) are intentionally
// excluded until a source-backed product definition exists.
const SALES_EXPENSE_CODES = ["01-TT", "02-CH", "03-TP", "04-EX", "06-IM", "07-IMO", "08-OT"];
const CLOSED_BOOKING_STATUSES = ["Delivered", "Cancelled", "Canceled", "Closed"];
const MONTHS: Array<[number, string[]]> = [
  [1, ["มกราคม", "ม.ค.", "january", "jan"]],
  [2, ["กุมภาพันธ์", "ก.พ.", "february", "feb"]],
  [3, ["มีนาคม", "มี.ค.", "march", "mar"]],
  [4, ["เมษายน", "เม.ย.", "april", "apr"]],
  [5, ["พฤษภาคม", "พ.ค.", "may"]],
  [6, ["มิถุนายน", "มิ.ย.", "june", "jun"]],
  [7, ["กรกฎาคม", "ก.ค.", "july", "jul"]],
  [8, ["สิงหาคม", "ส.ค.", "august", "aug"]],
  [9, ["กันยายน", "ก.ย.", "september", "sep", "sept"]],
  [10, ["ตุลาคม", "ต.ค.", "october", "oct"]],
  [11, ["พฤศจิกายน", "พ.ย.", "november", "nov"]],
  [12, ["ธันวาคม", "ธ.ค.", "december", "dec"]],
];

export async function executeKaiRuntimeQuery(
  database: RuntimeQueryDatabase,
  question: string,
  context: RuntimeQueryContext,
): Promise<RuntimeQueryResult> {
  const clean = question.trim();
  if (!clean || isUnsafeRuntimeQuestion(clean)) {
    throw new KaiRuntimeQueryError("Only read-only business questions are supported.", "unsupported_question");
  }
  const knowledge = await loadKnowledge(database);
  const unrecognizedBranch = unresolvedBranchCode(clean, context);
  if (unrecognizedBranch) {
    return unavailableResult(knowledge, "SALES_CURRENT_MONTH", "BRANCH_UNAVAILABLE",
      `ไม่พบสาขา “${unrecognizedBranch}” ใน branch scope ที่ผู้ใช้มีสิทธิ์ จึงไม่สามารถใช้ยอดรวมบริษัทแทนได้`);
  }
  const unresolvedCode = unresolvedProductCode(clean);
  if (unresolvedCode) {
    return unavailableResult(knowledge, "SALES_CURRENT_MONTH", "PRODUCT_MAPPING_UNAVAILABLE",
      `พบ raw product code “${unresolvedCode}” ใน source แต่ยังไม่มี canonical product mapping ที่ยืนยันได้ จึงไม่สามารถตีความเป็น Product Group หรือ Sales Unit ได้`);
  }
  const unverifiedField = unverifiedBusinessField(clean);
  if (unverifiedField) {
    return unavailableResult(knowledge, "SALES_CURRENT_MONTH", "UNVERIFIED_FIELD_UNAVAILABLE",
      `ยังไม่มี field หรือ relationship ที่ยืนยันได้สำหรับ ${unverifiedField} จึงไม่สามารถแทนด้วย Sales หรือ Booking metric อื่นได้`);
  }
  const intent = resolveIntent(clean, context);
  if (intent === "BOOKING_PAYMENT_UNAVAILABLE") {
    return unavailableResult(knowledge, "BOOKING_CURRENT_MONTH", intent,
      "ไม่มีข้อมูล Payment Type “Cash” ที่ยืนยันได้ในฐานข้อมูลปัจจุบัน จึงไม่สามารถตอบคำถามนี้ได้");
  }
  if (intent === "BOOKING_OUTSTANDING_UNAVAILABLE") {
    return unavailableResult(knowledge, "BOOKING_CURRENT_MONTH", intent,
      "ยังไม่มี business definition ที่ยืนยันได้สำหรับ Outstanding Booking จึงไม่สามารถคำนวณได้");
  }
  if (intent === "CUSTOMER_PURCHASE_UNAVAILABLE") {
    return unavailableResult(knowledge, "CUSTOMER_BOOKING_QUERY", intent,
      "ฐานข้อมูลที่ยืนยันได้มีข้อมูลลูกค้าเฉพาะ Booking และไม่มีข้อมูลการซื้อหรือส่งมอบรายลูกค้าสำหรับคำถามนี้");
  }
  if (intent === "AMBIGUOUS_METRIC") {
    return ambiguousResult(knowledge,
      "คำถามยังไม่ระบุ metric ที่ต้องการ กรุณาระบุ Sales, Booking, Stock, GP, Target หรือ Value ให้ชัดเจน");
  }
  if (!intent) {
    throw new KaiRuntimeQueryError("This question is not covered by the current KAI Knowledge Layer.", "unsupported_question");
  }
  const planRow = knowledge.plans.get(intent);
  const response = knowledge.responses.get(intent);
  if (!planRow || !response) {
    throw new KaiRuntimeQueryError(`Knowledge mapping is incomplete for intent ${intent}.`, "knowledge_error");
  }
  const plan = parsePlan(planRow.query_logic, intent);
  const metrics = metricsForIntent(intent, knowledge.questions, knowledge.metrics);
  const metric = metrics[0] ?? {
    code: "UNAVAILABLE",
    name: "Unavailable",
    unitType: "N/A",
    formula: "No verified metric is available",
  };
  const constraints = parseConstraints(clean, context);
  const data = await executePlan(database, plan, intent, clean, constraints, context);
  return {
    intent,
    metric,
    metrics,
    data,
    response: { template: response, text: formatResponse(intent, data) },
  };
}

export function normalizeRuntimeQuestion(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

async function loadKnowledge(database: RuntimeQueryDatabase) {
  try {
    const [metrics, questions, plans, responses] = await Promise.all([
      rows<MetricRow>(database, "SELECT metric_code, metric_name, unit_type, formula FROM kai_metrics"),
      rows<QuestionRow>(database, "SELECT intent, required_metric FROM kai_question_library"),
      rows<PlanRow>(database, "SELECT intent, query_logic FROM kai_query_templates"),
      rows<ResponseRow>(database, "SELECT intent, response_structure FROM kai_response_templates"),
    ]);
    return {
      metrics,
      questions,
      plans: new Map(plans.map((row) => [row.intent, row])),
      responses: new Map(responses.map((row) => [row.intent, row.response_structure])),
    };
  } catch {
    throw new KaiRuntimeQueryError("The local KAI Knowledge Layer is unavailable.", "database_unavailable", 503);
  }
}

async function rows<T extends Record<string, unknown>>(database: RuntimeQueryDatabase, sql: string, values: unknown[] = []) {
  try {
    return (await database.prepare(sql).bind(...values).all<T>()).results ?? [];
  } catch (error) {
    throw new KaiRuntimeQueryError(
      error instanceof Error ? `Runtime query failed: ${error.message}` : "Runtime query failed.",
      "query_error",
    );
  }
}

function parsePlan(raw: string, intent: string): Plan {
  try {
    const plan = JSON.parse(raw) as Partial<Plan>;
    if (
      plan.version !== 2 ||
      !["sales_transactions", "booking_transactions", "stock_transactions", "business_targets", "salesperson_master", "company_branches", "company_master", "agriculture"].includes(String(plan.source)) ||
      typeof plan.operation !== "string" ||
      (plan.target_metric !== undefined && !["SALES_UNITS", "SALES_REVENUE", "GP1"].includes(String(plan.target_metric))) ||
      (plan.company_entity !== undefined && !["profile", "currency", "localization", "fiscal_year", "working_calendar", "department", "holiday"].includes(String(plan.company_entity)))
    ) throw new Error();
    return plan as Plan;
  } catch {
    throw new KaiRuntimeQueryError(`Query template ${intent} is not an executable Phase 2B plan.`, "knowledge_error");
  }
}

function metricsForIntent(intent: string, questionRows: QuestionRow[], metrics: MetricRow[]) {
  const codes = [...new Set(questionRows.filter((row) => row.intent === intent)
    .flatMap((row) => row.required_metric.split(",").map((code) => code.trim()).filter(Boolean)))];
  return codes.map((code) => metrics.find((metric) => metric.metric_code === code))
    .filter((metric): metric is MetricRow => Boolean(metric))
    .map((metric) => ({ code: metric.metric_code, name: metric.metric_name, unitType: metric.unit_type, formula: metric.formula }));
}

function resolveIntent(question: string, context: RuntimeQueryContext): string | null {
  const q = question.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(question);
  const agriculture = resolveAgricultureIntent(question);
  if (agriculture) return agriculture;
  const booking = has(/booking|ยอดจอง|รับจอง|ใบจอง|จอง/iu);
  const stock = has(/stock|สต็อก|คงเหลือ|รถค้าง|inventory/iu) || (has(/(?:\bTT\b|\bCH\b|\bEX\b|\bTP\b|\bIM\b|\bIMO\b|\bOT\b)/iu) && has(/เหลือ|กี่คัน/iu));
  const sales = has(/ยอดขาย|\bsales\b|ขายได้|ขาย/iu);
  const target = has(/\btarget\b|เป้า|achievement|\bgap\b/iu);
  const customer = has(/ลูกค้า|\bcustomer\b/iu);
  const salesperson = has(/salesperson|salesman|พนักงานขาย|เซลส์|ใครขาย/iu);
  const comparison = has(/เทียบ|compare|\bvs\.?\b|versus/iu);
  const namedBranches = resolveBranches(question, context);
  const product = parseProduct(question);
  const explicitDateToken = has(/mtd|ytd|today|yesterday|this month|current month|this week|current week|last month|previous month|this quarter|current quarter|last quarter|previous quarter|เดือนนี้|ปีนี้|ปี\s*20\d{2}|เดือน\s*\d{1,2}|20\d{2}-\d{2}-\d{2}|(?:มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)|(?:january|february|march|april|may|june|july|august|september|october|november|december)/iu);
  const shortSales = Boolean(namedBranches.length && product && explicitDateToken && !booking && !stock);

  if (has(/cash|payment\s*type|ชำระเงิน/iu)) return "BOOKING_PAYMENT_UNAVAILABLE";
  if (booking && has(/outstanding/iu)) return "BOOKING_OUTSTANDING_UNAVAILABLE";
  // Customer is verified only as an aggregate Booking attribute.  Sales has
  // no customer relationship, so a customer-sales question must never fall
  // through to an unfiltered Sales aggregate.
  if (customer && has(/ซื้อ|purchase|bought|buy|\bsales?\b|ขาย|revenue|รายได้/iu)) return "CUSTOMER_PURCHASE_UNAVAILABLE";
  if (customer && booking) return "CUSTOMER_BOOKING_QUERY";
  const companyMaster = companyMasterIntent(question, sales, booking, stock, target);
  if (companyMaster) return companyMaster;
  if (isBranchDirectoryQuestion(question, sales, booking, stock, target)) return "BRANCH_DIRECTORY_QUERY";
  if (isSalespersonMasterQuestion(question, salesperson)) return "SALESPERSON_MASTER_QUERY";
  if (target) {
    return targetIntent(targetMetricForQuestion(question), has(/ขาดเป้า|\bgap\b/iu) ? "gap" : has(/ได้กี่เปอร์เซ็นต์|achievement/iu) ? "achievement" : "target");
  }
  if (booking) {
    if (isAgingQuestion(question)) return has(/รายการ|อะไรบ้าง|รายชื่อ|list/iu) ? "BOOKING_AGING_LIST" : "BOOKING_AGING";
    if (has(/deposit|down\s*payment|มัดจำ/iu)) return "BOOKING_DEPOSIT_QUERY";
    if (salesperson && has(/ranking|อันดับ|top|มากที่สุด|สูงสุด|highest|most/iu)) return "BOOKING_SALESPERSON_RANKING";
    if (isPurchaseStatusBreakdown(question)) return "BOOKING_PURCHASE_STATUS_RANKING";
    if (isBookingStatusBreakdown(question)) return "BOOKING_STATUS_RANKING";
    if (has(/conversion|เปลี่ยน.*ส่งมอบ/iu)) return "BOOKING_CONVERSION_QUERY";
    if (has(/สาขา.*(?:มากที่สุด|สูงสุด|อันดับ|top|ดีที่สุด)|(?:มากที่สุด|สูงสุด|อันดับ|top|ดีที่สุด).*สาขา|branch.*(?:ranking|top|highest|most)|(?:ranking|top|highest|most).*branch/iu) || (comparison && namedBranches.length >= 2)) return "BOOKING_BRANCH_RANKING";
    if (has(/รุ่น|model|product/iu) && has(/มากที่สุด|สูงสุด|อันดับ|top|ranking|ดีที่สุด|highest|most/iu)) return "BOOKING_MODEL_RANKING";
    if (has(/เทียบ.*ปี|ปี.*เทียบ|compare.*year|year.*compare|previous year|yoy/iu)) return "BOOKING_YOY_COMPARE";
    if (has(/เทียบ.*เดือน|เดือน.*เทียบ|compare.*month|month.*compare/iu)) return "BOOKING_MONTH_COMPARE";
    if (has(/มูลค่า|value|ราคา/iu)) return "BOOKING_VALUE_CURRENT";
    if (has(/ปี\s*20\d{2}|เดือน\s*\d|20\d{2}-\d{2}-\d{2}|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|january|february|march|april|may|june|july|august|september|october|november|december/iu)) return "BOOKING_HISTORY_QUERY";
    return "BOOKING_CURRENT_MONTH";
  }
  if (stock) {
    if (isAgingQuestion(question)) {
      if (isSlowMovingQuestion(question)) return has(/รุ่น|model|อะไรบ้าง/iu) ? "STOCK_SLOW_MOVING_MODEL_RANKING" : "STOCK_SLOW_MOVING_QUERY";
      return has(/รุ่น|model|อะไรบ้าง/iu) ? "STOCK_AGING_MODEL" : "STOCK_AGING_QUERY";
    }
    if (has(/สาขา.*(?:มากที่สุด|สูงสุด|อันดับ|top|ดีที่สุด)|(?:มากที่สุด|สูงสุด|อันดับ|top|ดีที่สุด).*สาขา|branch.*(?:ranking|top|highest|most)|(?:ranking|top|highest|most).*branch/iu) || (comparison && namedBranches.length >= 2)) return "STOCK_BRANCH_RANKING";
    if (has(/รุ่น|model/iu) && has(/มากที่สุด|สูงสุด|อันดับ|top|ranking|ดีที่สุด|highest|most/iu)) return "STOCK_MODEL_RANKING";
    if (has(/มูลค่า|value|msrp/iu)) return "STOCK_VALUE_CURRENT";
    if (has(/รุ่น|model/iu) || parseModel(question, context)) return "STOCK_MODEL_QUERY";
    return "STOCK_CURRENT";
  }
  if (salesperson && (sales || shortSales || has(/ranking|อันดับ|top|มากที่สุด|สูงสุด/iu) || explicitDateToken)) return "SALES_PERSON_RANKING";
  if (sales || shortSales || has(/\bgp\b|gross profit|กำไรขั้นต้น/iu)) {
    if (has(/expense|ค่าใช้จ่าย/iu)) return "SALES_EXPENSE_QUERY";
    if (has(/\bgp\b|gross profit|กำไรขั้นต้น/iu)) return "SALES_GP_QUERY";
    if (has(/สาขา.*(?:มากที่สุด|สูงสุด|อันดับ|top|ดีที่สุด)|(?:มากที่สุด|สูงสุด|อันดับ|top|ดีที่สุด).*สาขา|branch.*(?:ranking|top|highest|most)|(?:ranking|top|highest|most).*branch/iu) || (comparison && namedBranches.length >= 2)) return "SALES_BRANCH_RANKING";
    if (has(/รุ่น|model/iu) && has(/มากที่สุด|สูงสุด|อันดับ|top|ranking|ดีที่สุด|highest|most/iu)) return "SALES_MODEL_RANKING";
    if (has(/product type|product.*(?:มากที่สุด|สูงสุด|อันดับ|top|ranking|ดีที่สุด|highest|most)/iu)) return "SALES_PRODUCT_RANKING";
    if (has(/โต.*ปีที่แล้ว|จากปีที่แล้ว|growth/iu)) return "SALES_GROWTH_QUERY";
    if (has(/เทียบ.*ปี|ปี.*เทียบ|compare.*year|year.*compare|previous year|yoy/iu)) return "SALES_YOY_COMPARE";
    if (has(/เทียบ.*เดือน|เดือน.*เทียบ|compare.*month|month.*compare/iu)) return "SALES_MONTH_COMPARE";
    if (has(/มูลค่า|value|เท่าไร/iu) && /\bvalue\b|มูลค่า/iu.test(q)) return "SALES_VALUE_CURRENT";
    if (has(/ปีนี้|this year|ปี\s*20\d{2}|เดือน\s*\d|20\d{2}-\d{2}-\d{2}|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|january|february|march|april|may|june|july|august|september|october|november|december/iu)) return "SALES_HISTORY_QUERY";
    return "SALES_CURRENT_MONTH";
  }
  return looksAmbiguous(question, namedBranches) ? "AMBIGUOUS_METRIC" : null;
}

function resolveAgricultureIntent(question: string): string | null {
  const agriculture = /agri(?:culture|cultural)?|crop|พืช|เกษตร|เก็บเกี่ยว|harvest|ปฏิทินพืช|crop stage|ระยะพืช|เครื่องจักรเกษตร|machine opportunity|weather impact|ผลกระทบ.*อากาศ|ความเชื่อมั่น.*(?:เกษตร|พืช)|data confidence.*(?:agri|crop)/iu.test(question);
  if (!agriculture) return null;
  if (/opportunit|โอกาส|priority|จัดอันดับ|top|ranking/iu.test(question)) return "AGRI_TOP_OPPORTUNITIES";
  if (/harvest.*soon|เก็บเกี่ยว.*เร็ว|ใกล้เก็บเกี่ยว|เก็บเกี่ยวเร็ว/iu.test(question)) return "AGRI_HARVEST_SOON";
  if (/stage|ระยะ|ช่วงพืช|crop.*state/iu.test(question)) return "AGRI_CROP_STAGE";
  if (/weather.*impact|impact.*weather|ผลกระทบ.*อากาศ|อากาศ.*กระทบ|risk.*crop|crop.*risk/iu.test(question)) return "AGRI_WEATHER_IMPACT";
  if (/customer.*priority|priority.*customer|ลูกค้า.*สำคัญ|ลูกค้า.*เร่ง/iu.test(question)) return "AGRI_CUSTOMER_PRIORITY";
  if (/machine.*demand|demand.*machine|ความต้องการ.*เครื่อง|เครื่องจักร.*ต้องการ/iu.test(question)) return "AGRI_MACHINE_DEMAND";
  if (/calendar|ปฏิทิน|วันเก็บเกี่ยว|วันที่.*เก็บเกี่ยว|เก็บเกี่ยว.*วันที่|กำหนด.*เก็บเกี่ยว/iu.test(question)) return "AGRI_CALENDAR";
  return "AGRI_DATA_CONFIDENCE";
}

function companyMasterIntent(question: string, sales: boolean, booking: boolean, stock: boolean, target: boolean) {
  if (sales || booking || stock || target) return null;
  if (/\b(?:company|organization)\s*(?:profile|info|information|details?)\b|ข้อมูลบริษัท|ข้อมูลองค์กร/iu.test(question)) return "COMPANY_PROFILE_QUERY";
  if (/\b(?:company\s*)?currency\b|สกุลเงิน|เงินหลัก/iu.test(question)) return "COMPANY_CURRENCY_QUERY";
  if (/\b(?:company\s*)?(?:timezone|time zone|localization|language)\b|เขตเวลา|ภาษาหลัก/iu.test(question)) return "COMPANY_LOCALIZATION_QUERY";
  if (/\bfiscal\s*year\b|ปีบัญชี/iu.test(question)) return "FISCAL_YEAR_QUERY";
  if (/\bworking\s*calendar\b|วันทำการ|เวลาทำงาน/iu.test(question)) return "WORKING_CALENDAR_QUERY";
  if (/\bdepartments?\b|แผนก/iu.test(question)) return "DEPARTMENT_DIRECTORY_QUERY";
  if (/\bholidays?\b|วันหยุด/iu.test(question)) return "HOLIDAY_DIRECTORY_QUERY";
  return null;
}

function targetMetricForQuestion(question: string): TargetMetric {
  if (/\bgp\b|gross\s*profit|กำไรขั้นต้น/iu.test(question)) return "GP1";
  if (/sales\s*value|sales\s*revenue|\brevenue\b|มูลค่ายอดขาย|รายได้/iu.test(question)) return "SALES_REVENUE";
  return "SALES_UNITS";
}

function targetIntent(metric: TargetMetric, mode: "target" | "achievement" | "gap") {
  if (metric === "SALES_REVENUE") {
    if (mode === "achievement") return "SALES_REVENUE_ACHIEVEMENT_QUERY";
    if (mode === "gap") return "SALES_REVENUE_GAP_QUERY";
    return "SALES_REVENUE_TARGET_QUERY";
  }
  if (metric === "GP1") {
    if (mode === "achievement") return "SALES_GP_ACHIEVEMENT_QUERY";
    if (mode === "gap") return "SALES_GP_GAP_QUERY";
    return "SALES_GP_TARGET_QUERY";
  }
  if (mode === "achievement") return "SALES_ACHIEVEMENT_QUERY";
  if (mode === "gap") return "SALES_GAP_QUERY";
  return "TARGET_CURRENT_QUERY";
}

function isAgingQuestion(question: string) {
  return Boolean(parseAgeRange(question)) || /aging|slow\s*moving|อายุ.*วัน|รถค้าง|age\s*(?:stock|booking)?|(?:over|older than|aged?).*\d+\s*days|>\s*\d+\s*(?:วัน|days)|เกิน\s*\d+\s*วัน/iu.test(question);
}

function isSlowMovingQuestion(question: string) {
  const range = parseAgeRange(question);
  return /slow\s*moving|เกิน\s*180\s*วัน|(?:over|older than|aged?).*180\s*days|>\s*180\s*(?:วัน|days)/iu.test(question)
    || Boolean(range && range.min >= 181 && (!range.max || range.max <= 365));
}

function isPurchaseStatusBreakdown(question: string) {
  return /purchase\s*status|hot\s*status|สถานะการซื้อ/iu.test(question)
    && /breakdown|distribution|summary|แยก|สรุป|อันดับ|ranking/iu.test(question);
}

function isBookingStatusBreakdown(question: string) {
  return /booking\s*status|lifecycle|สถานะ.*(?:booking|จอง)|(?:booking|จอง).*สถานะ/iu.test(question)
    && /breakdown|distribution|summary|แยก|สรุป|อันดับ|ranking/iu.test(question);
}

function isSalespersonMasterQuestion(question: string, salesperson: boolean) {
  // "พนักงานขาย" naturally contains the Thai verb "ขาย".  Treat it as a
  // master request when no actual Sales/Booking metric is named.
  const metricRequest = /ยอดขาย|sales\s*(?:value|revenue|target|gp|expense|ranking)|booking|ยอดจอง|จอง/iu.test(question);
  return salesperson && !metricRequest && /master|directory|รายชื่อ|list|กี่คน|ทั้งหมด|active|สถานะ|team|ทีม/iu.test(question);
}

function isBranchDirectoryQuestion(question: string, sales: boolean, booking: boolean, stock: boolean, target: boolean) {
  return !sales && !booking && !stock && !target
    && /\bbranch(?:es)?\b|สาขา|showroom/iu.test(question)
    && /directory|list|รายชื่อ|details?|ข้อมูล|กี่สาขา|ทั้งหมด|location|อยู่ที่ไหน|region|township|ที่ตั้ง/iu.test(question);
}

function parseConstraints(question: string, context: RuntimeQueryContext): Constraints {
  const now = context.now ?? new Date();
  const date = dateParts(now, context.timeZone);
  const periodResult = parsePeriod(question, date.year, date.month, date.day);
  const branches = resolveBranches(question, context);
  const purchaseStatus = ["A HOT", "B HOT", "FAIL", "S"]
    .find((value) => new RegExp(`\\b${value.replace(" ", "\\s+")}\\b`, "i").test(question));
  return {
    period: periodResult.period,
    explicitPeriod: periodResult.explicit,
    branches,
    product: parseProduct(question),
    model: parseModel(question, context),
    salesperson: parseSalesperson(question),
    salespersonCode: parseSalespersonCode(question),
    customer: parseCustomer(question),
    purchaseStatus,
    bookingLifecycleStatus: parseBookingLifecycleStatus(question),
    ageRange: parseAgeRange(question),
    sort: /\b(?:value|มูลค่า|ราคา)\b/i.test(question) ? "value" : "units",
    limit: parseLimit(question),
  };
}

function parsePeriod(question: string, currentYear: number, currentMonth: number, currentDay = 1) {
  const dateRange = question.match(/\b(20\d{2}-\d{2}-\d{2})\b\s*(?:ถึง|to|through|จนถึง|-)\s*\b(20\d{2}-\d{2}-\d{2})\b/i);
  if (dateRange && dateRange[1] <= dateRange[2]) {
    return { period: { start: dateRange[1], end: dateRange[2], label: dateRange[1] + " – " + dateRange[2] }, explicit: true };
  }
  const today = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay));
  if (/เมื่อวาน|yesterday/i.test(question)) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - 1);
    const value = isoDate(day);
    return { period: { start: value, end: value, label: value }, explicit: true };
  }
  if (/วันนี้|today/i.test(question)) {
    const value = isoDate(today);
    return { period: { start: value, end: value, label: value }, explicit: true };
  }
  if (/สัปดาห์นี้|this week|current week/i.test(question)) {
    const start = new Date(today);
    const day = start.getUTCDay();
    start.setUTCDate(start.getUTCDate() - ((day + 6) % 7));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return { period: { start: isoDate(start), end: isoDate(end), label: "current week" }, explicit: true };
  }
  if (/เดือนก่อน|เดือนที่แล้ว|last month|previous month/i.test(question) && !/เทียบ|compare|vs/i.test(question)) {
    return { period: makeMonth(currentYear, currentMonth - 1), explicit: true };
  }
  if (/ไตรมาสนี้|this quarter|current quarter/i.test(question)) {
    return { period: makeQuarter(currentYear, Math.floor((currentMonth - 1) / 3)), explicit: true };
  }
  if (/ไตรมาสที่แล้ว|ไตรมาสก่อน|last quarter|previous quarter/i.test(question)) {
    return { period: makeQuarter(currentYear, Math.floor((currentMonth - 1) / 3) - 1), explicit: true };
  }
  if (/ปีที่แล้ว|last year|previous year/i.test(question)) {
    return { period: { start: (currentYear - 1) + "-01-01", end: (currentYear - 1) + "-12-31", label: String(currentYear - 1) }, explicit: true };
  }
  if (/mtd|month.to.date|เดือนนี้ถึงวันนี้/i.test(question)) {
    const value = isoDate(today);
    return { period: { start: currentYear + "-" + String(currentMonth).padStart(2, "0") + "-01", end: value, label: currentYear + "-" + String(currentMonth).padStart(2, "0") + " MTD" }, explicit: true };
  }
  if (/ytd|year.to.date|ปีนี้ถึงวันนี้/i.test(question)) {
    const value = isoDate(today);
    return { period: { start: currentYear + "-01-01", end: value, label: currentYear + " YTD" }, explicit: true };
  }
  const numeric = question.match(/เดือน\s*(\d{1,2})\s*(?:ปี\s*)?(20\d{2})?/iu);
  if (numeric) {
    const month = Number(numeric[1]);
    if (month >= 1 && month <= 12) return { period: makeMonth(Number(numeric[2] ?? currentYear), month), explicit: true };
  }
  const named = MONTHS.find(([, names]) => names.some((name) => monthNamePattern(name).test(question)));
  if (named) {
    const match = namesMatch(question, named[1]);
    return { period: makeMonth(Number(match?.[1] ?? currentYear), named[0]), explicit: true };
  }
  const year = question.match(/(?:ปี\s*)?(20\d{2})/u)?.[1];
  if (year || /ปีนี้|this year/iu.test(question)) {
    const targetYear = Number(year ?? currentYear);
    return { period: { start: `${targetYear}-01-01`, end: `${targetYear}-12-31`, label: String(targetYear) }, explicit: true };
  }
  return { period: makeMonth(currentYear, currentMonth), explicit: false };
}

function namesMatch(question: string, names: string[]) {
  for (const name of names) {
    const match = question.match(monthNamePattern(name));
    if (match) return match;
  }
  return null;
}

function monthNamePattern(name: string) {
  // English month abbreviations must be tokens: otherwise “summary” is
  // accidentally interpreted as March through its embedded “mar”. Thai has
  // no reliable word boundary, so it retains the existing Thai form.
  const token = /^[A-Za-z]+$/.test(name) ? `\\b${escapeRegex(name)}\\b` : escapeRegex(name);
  return new RegExp(`(?:เดือน\\s*)?${token}(?:\\s*(20\\d{2}))?`, "iu");
}

function makeMonth(year: number, month: number): Period {
  const normalized = new Date(Date.UTC(year, month - 1, 1));
  const normalizedYear = normalized.getUTCFullYear();
  const normalizedMonth = normalized.getUTCMonth() + 1;
  const end = new Date(Date.UTC(normalizedYear, normalizedMonth, 0)).getUTCDate();
  const monthText = String(normalizedMonth).padStart(2, "0");
  return { start: `${normalizedYear}-${monthText}-01`, end: `${normalizedYear}-${monthText}-${String(end).padStart(2, "0")}`, label: `${normalizedYear}-${monthText}` };
}

function makeQuarter(year: number, quarter: number): Period {
  const normalizedYear = year + Math.floor(quarter / 4);
  const normalizedQuarter = ((quarter % 4) + 4) % 4;
  const startMonth = normalizedQuarter * 3 + 1;
  return { start: makeMonth(normalizedYear, startMonth).start, end: makeMonth(normalizedYear, startMonth + 2).end, label: normalizedYear + " Q" + (normalizedQuarter + 1) };
}

function isoDate(value: Date) {
  return value.getUTCFullYear() + "-" + String(value.getUTCMonth() + 1).padStart(2, "0") + "-" + String(value.getUTCDate()).padStart(2, "0");
}

function parseProduct(question: string): ProductGroup | undefined {
  if (/(?:\bTT\b|tractor|แทรกเตอร์)/iu.test(question)) return "TT";
  if (/(?:\bCH\b|combine|คอมไบน์)/iu.test(question)) return "CH";
  if (/(?:\bEX\b|excavator|รถขุด)/iu.test(question)) return "EX";
  if (/(?:\bTP\b|transplanter)/iu.test(question)) return "TP";
  if (/\bIMO\b/iu.test(question)) return "IMO";
  if (/\bIM\b/iu.test(question)) return "IM";
  if (/(?:\bOT\b|other)/iu.test(question)) return "OT";
  return undefined;
}

function parseModel(question: string, context?: RuntimeQueryContext) {
  if (/\bDC\s*[- ]?\s*70G\s*PRO\b/iu.test(question)) return "DC70G PRO";
  const match = question.match(/(?:รุ่น|\bmodel\b)\s*[:：]?\s*([A-Za-z0-9][A-Za-z0-9+()\- .]{1,50}?)(?=\s*(?:มี|เหลือ|ขาย|จอง|stock|สต็อก|เดือน|ปี|เท่าไร|กี่|มากที่สุด|$))/iu);
  const candidate = match?.[1]?.trim();
  // Terms such as "model ranking July" describe a grouping, not a model
  // filter.  Applying them as a product-model predicate returns an empty
  // result and silently violates the requested ranking scope.
  if (candidate && !/\b(?:ranking|rank|top|highest|most|best|by)\b|อันดับ|สูงสุด|มากที่สุด/iu.test(candidate)) {
    return canonicalModelName(candidate);
  }
  const trailingStock = question.match(/^\s*([A-Za-z0-9][A-Za-z0-9+()\- .]{2,50}?)\s+(?:stock|สต็อก)\s*$/iu)?.[1]?.trim();
  const isKnownBranch = context?.branches?.some((branch) => branch.code.localeCompare(trailingStock ?? "", undefined, { sensitivity: "accent" }) === 0 || branch.name.localeCompare(trailingStock ?? "", undefined, { sensitivity: "accent" }) === 0);
  const containsFilterVocabulary = /\bKMM0[1-3]\b|\b(?:TT|CH|EX|TP|IM|IMO|OT|tractor|combine|excavator|transplanter|other|current|now|value|aging|slow\s*moving)\b/iu.test(trailingStock ?? "");
  if (trailingStock && !isKnownBranch && !containsFilterVocabulary) return canonicalModelName(trailingStock);
  return undefined;
}

function parseSalesperson(question: string) {
  const match = question.match(/(?:salesperson|พนักงานขาย|เซลส์)\s*[:：]?\s*([A-Za-z0-9][A-Za-z0-9 .()\-]{2,60}?)(?=\s*(?:ขาย|sales|booking|เดือน|ปี|january|february|march|april|may|june|july|august|september|october|november|december|เท่าไร|กี่|$))/iu);
  const candidate = match?.[1]?.trim();
  // A role followed by a time or grouping word means "rank salespeople", not
  // "filter by a salesperson whose name is that word".
  if (candidate && !/^(?:ranking|rank|top|directory|master|active|list|summary|breakdown|status)\b|^(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+20\d{2})?$/iu.test(candidate)) {
    return candidate;
  }
  return undefined;
}

function parseSalespersonCode(question: string) {
  return question.match(/\bMM\d{6}\b/i)?.[0]?.toUpperCase();
}

function parseCustomer(question: string) {
  const match = question.match(/(?:ลูกค้า|customer)\s*[:：]?\s*([A-Za-z][A-Za-z .()\-]{2,60}?)(?=\s*(?:จอง|booking|เดือน|ปี|เท่าไร|กี่|$))/iu);
  return match?.[1]?.trim() || undefined;
}

function parseLimit(question: string) {
  const match = question.match(/(?:top|อันดับ|สูงสุด|มากที่สุด)\s*(\d{1,2})/iu)
    ?? question.match(/(\d{1,2})\s*(?:อันดับ|รายการ|รายการแรก)/iu);
  return Math.max(1, Math.min(50, Number(match?.[1] ?? 50)));
}

function parseBookingLifecycleStatus(question: string): Constraints["bookingLifecycleStatus"] {
  if (/cancelled|canceled|cancel|ยกเลิก/iu.test(question)) return "Cancelled";
  if (/delivered|delivery|ส่งมอบ/iu.test(question)) return "Delivered";
  if (/\bopen\b|เปิด/iu.test(question)) return "Open";
  return undefined;
}

function parseAgeRange(question: string): AgeRange | undefined {
  const range = question.match(/(?:aging|age|อายุ)?\s*(\d{1,3})\s*(?:-|–|ถึง|to)\s*(\d{1,3})\s*(?:วัน|days)/iu);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (Number.isInteger(min) && Number.isInteger(max) && min >= 0 && min <= max) return { min, max, label: `${min}–${max}` };
  }
  const over = question.match(/(?:เกิน|มากกว่า|over|older than|aged?\s*over|>)\s*(\d{1,3})\s*(?:วัน|days)/iu);
  if (over) {
    const threshold = Number(over[1]);
    if (Number.isInteger(threshold) && threshold >= 0) return { min: threshold + 1, label: `>${threshold}` };
  }
  return undefined;
}

function ageRangeFor(constraints: Constraints, defaultThreshold: number): AgeRange {
  return constraints.ageRange ?? { min: defaultThreshold + 1, label: `>${defaultThreshold}` };
}

function unresolvedProductCode(question: string) {
  const code = question.match(/\b(?:05\s*-?\s*TX|08\s*-?\s*TX|MITSU)\b/iu)?.[0];
  return code?.replace(/\s+/g, "").toUpperCase();
}

function unresolvedBranchCode(question: string, context: RuntimeQueryContext) {
  const available = context.branches ?? [];
  const codes = [...question.matchAll(/\bKMM\d{2,}\b/giu)].map((match) => match[0].toUpperCase());
  // A branch code without permission-derived vocabulary must fail closed;
  // accepting it would turn a requested branch filter into a company total.
  if (!available.length) return codes[0];
  return codes.find((code) => !available.some((branch) => branch.code.toUpperCase() === code));
}

function unverifiedBusinessField(question: string) {
  if (/\bcommission\b|คอมมิชชั่น|คอมมิชชั่น/iu.test(question)) return "Commission";
  if (/\bmarketing(?:\s+expense)?\b|ค่าใช้จ่ายการตลาด|การตลาด/iu.test(question)) return "Marketing Expense";
  if (/\b(?:receive|received)\s*date\b|(?:วันที่|วัน)\s*รับ/iu.test(question)) return "Receive Date";
  if (/\bdelivery\s*date\b|(?:วันที่|วัน)\s*ส่งมอบ/iu.test(question)) return "Delivery Date";
  // Booking lifecycle status "Delivered" is verified.  A Sales-delivery
  // question is not: Sales has no verified delivery relationship.
  if (/(?:\bsales\b|ยอดขาย|ขาย)/iu.test(question) && /\bdelivery\b|ส่งมอบ/iu.test(question)) return "Sales Delivery";
  return undefined;
}

function resolveBranches(question: string, context: RuntimeQueryContext) {
  const available = context.branches ?? [];
  const normalized = question.toLocaleLowerCase();
  const named = available
    .filter((branch) => normalized.includes(branch.code.toLocaleLowerCase()) || (branch.name && normalized.includes(branch.name.toLocaleLowerCase())))
    .map((branch) => branch.code.toUpperCase());
  const shorthand = [...question.matchAll(/(?:^|\s)0([123])(?:\s|$)/g)].map((match) => "KMM0" + match[1]);
  return [...new Set([...named, ...shorthand].filter((code) => !available.length || available.some((branch) => branch.code.toUpperCase() === code)))];
}

function looksAmbiguous(question: string, branches: string[]) {
  const trimmed = question.trim();
  const hasBareModel = /^[A-Za-z0-9+()\- .]{3,60}\s*(?:เท่าไร|เท่าไหร่|กี่คัน|how many|how much)?[?؟!]*$/iu.test(trimmed);
  const hasBareBranch = branches.length > 0 && !/\b(?:sales|booking|stock|gp|target|value|ยอดขาย|ยอดจอง|สต็อก|คงเหลือ|กำไร|เป้า)\b/iu.test(trimmed);
  const bareTemporalAmount = /^(?:ยอด|amount|total)(?:\s*(?:วันนี้|เมื่อวาน|เดือนนี้|เดือนก่อน|ปีนี้|mtd|ytd|today|yesterday|this month|last month|this year))?$/iu.test(trimmed);
  return hasBareModel || hasBareBranch || bareTemporalAmount || /^(?:ยอด|amount|total)\s+(?:KMM0[1-3])$/iu.test(trimmed);
}

function ambiguousResult(knowledge: Awaited<ReturnType<typeof loadKnowledge>>, text: string): RuntimeQueryResult {
  const metrics = metricsForIntent("SALES_CURRENT_MONTH", knowledge.questions, knowledge.metrics);
  const metric = metrics[0] ?? { code: "AMBIGUOUS", name: "Ambiguous", unitType: "N/A", formula: "N/A" };
  return { intent: "AMBIGUOUS_METRIC", metric, metrics, data: { available: false, ambiguous: true, reason: text }, response: { template: "ambiguous question", text } };
}

async function executePlan(
  database: RuntimeQueryDatabase,
  plan: Plan,
  intent: string,
  question: string,
  constraints: Constraints,
  context: RuntimeQueryContext,
) {
  const salesConstraints = ["sales_summary", "sales_gp", "sales_expense", "sales_ranking", "sales_compare", "sales_target"].includes(plan.operation)
    ? await resolveSalespersonForSales(database, constraints, context.companyId)
    : constraints;
  const agricultureLocationId = plan.source === "agriculture" && plan.operation !== "agri_data_confidence"
    ? await resolveAgricultureLocationId(database, question)
    : undefined;
  if (plan.operation === "sales_summary") return salesSummary(database, salesConstraints, context.companyId);
  if (plan.operation === "sales_gp") return salesGp(database, salesConstraints, context.companyId);
  if (plan.operation === "sales_expense") return salesExpense(database, salesConstraints, context.companyId);
  if (plan.operation === "sales_ranking") return salesRanking(database, salesConstraints, plan.group_by ?? "model", context.companyId);
  if (plan.operation === "sales_compare") return salesComparison(database, salesConstraints, context, question);
  if (plan.operation === "sales_target") return salesTarget(database, salesConstraints, plan.mode ?? "target", plan.target_metric ?? "SALES_UNITS", context.companyId);
  if (plan.operation === "booking_summary") return bookingSummary(database, constraints, context.companyId);
  if (plan.operation === "booking_deposit") return bookingDeposit(database, constraints, context.companyId);
  if (plan.operation === "booking_ranking") return bookingRanking(database, constraints, plan.group_by ?? "product_model", context.companyId);
  if (plan.operation === "booking_compare") return bookingComparison(database, constraints, context, question);
  if (plan.operation === "booking_aging") return bookingAging(database, constraints, context, Boolean(plan.list));
  if (plan.operation === "booking_conversion") return bookingConversion(database, constraints, context.companyId);
  if (plan.operation === "customer_summary") return customerSummary(database, constraints, context.companyId);
  if (plan.operation === "stock_summary") return stockSummary(database, constraints, context.companyId);
  if (plan.operation === "stock_ranking") return stockRanking(database, constraints, plan.group_by ?? "product_model", plan.threshold, context.companyId);
  if (plan.operation === "stock_aging") return stockAging(database, constraints, plan.threshold ?? 90, context.companyId);
  if (plan.operation === "salesperson_master") return salespersonMaster(database, constraints, context.companyId);
  if (plan.operation === "branch_directory") return branchDirectory(context.companyDatabase, constraints, context.companyId);
  if (plan.operation === "company_master") return companyMaster(context.companyDatabase, plan.company_entity, context.companyId);
  if (plan.operation === "agri_top_opportunities") return agricultureTopOpportunities(database, context.companyId, plan.limit ?? constraints.limit, agricultureLocationId);
  if (plan.operation === "agri_harvest_soon") return agricultureHarvestSoon(database, plan.limit ?? constraints.limit, agricultureLocationId);
  if (plan.operation === "agri_crop_stage") return agricultureCropStage(database, plan.limit ?? constraints.limit, agricultureLocationId);
  if (plan.operation === "agri_weather_impact") return agricultureWeatherImpact(database, plan.limit ?? constraints.limit, agricultureLocationId);
  if (plan.operation === "agri_customer_priority") return agricultureCustomerPriority(database, context.companyId, plan.limit ?? constraints.limit, agricultureLocationId);
  if (plan.operation === "agri_machine_demand") return agricultureMachineDemand(database, context.companyId, plan.limit ?? constraints.limit, agricultureLocationId);
  if (plan.operation === "agri_calendar") return agricultureCalendar(database, plan.limit ?? constraints.limit, agricultureLocationId);
  if (plan.operation === "agri_data_confidence") return agricultureDataConfidence(database);
  throw new KaiRuntimeQueryError(`Unsupported executable operation for ${intent}.`, "knowledge_error");
}

async function resolveAgricultureLocationId(database: RuntimeQueryDatabase, question: string) {
  const locations = await rows<Record<string, unknown>>(database, "SELECT location_id, canonical_name, alternate_names FROM agri_locations WHERE is_active = 1");
  const normalizedQuestion = normalizeAgricultureLocationText(question);
  const match = locations.find((row) => {
    const names = [row.canonical_name, ...parseJsonStringArray(row.alternate_names)];
    return names.some((name) => {
      const normalizedName = normalizeAgricultureLocationText(String(name ?? ""));
      return normalizedName.length >= 4 && normalizedQuestion.includes(normalizedName);
    });
  });
  return match?.location_id ? String(match.location_id) : undefined;
}

function normalizeAgricultureLocationText(value: string) {
  return value.toLocaleLowerCase().replace(/[\s\-_]/g, "");
}

function parseJsonStringArray(value: unknown) {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function agricultureTopOpportunities(database: RuntimeQueryDatabase, companyId: string, limit: number, locationId?: string) {
  const locationFilter = locationId ? " AND o.location_id = ?" : "";
  const records = await rows<Record<string, unknown>>(database,
    `SELECT o.opportunity_id, l.canonical_name AS location_name, c.crop_code, c.crop_name, o.stage_code, o.opportunity_type, o.machine_category, o.opportunity_score, o.confidence_score, o.priority_score, o.window_start, o.window_end, o.reason_codes, o.recommended_action, o.model_version FROM agri_opportunities o LEFT JOIN agri_locations l ON l.location_id = o.location_id LEFT JOIN agri_crops c ON c.crop_id = o.crop_id WHERE o.company_id = ? AND o.status IN ('ACTIVE', 'EXPIRING') AND o.stage_code IS NOT NULL AND o.opportunity_score IS NOT NULL AND o.confidence_score >= 35${locationFilter} ORDER BY COALESCE(o.priority_score, -1) DESC, COALESCE(o.opportunity_score, -1) DESC LIMIT ?`,
    locationId ? [companyId, locationId, Math.max(1, Math.min(50, limit))] : [companyId, Math.max(1, Math.min(50, limit))],
  );
  if (!records.length) return unavailableData("No verified Agriculture opportunity records are available for the selected company.");
  return { agricultureRows: records, agricultureKind: "opportunities", source: "OPERATIONS_DB.agri_opportunities" };
}

async function agricultureHarvestSoon(database: RuntimeQueryDatabase, limit: number, locationId?: string) {
  const locationFilter = locationId ? " AND c.location_id = ?" : "";
  const records = await rows<Record<string, unknown>>(database,
    `SELECT c.calendar_record_id, l.canonical_name AS location_name, c.crop_year, cr.crop_code, cr.crop_name, c.stage_code, e.estimated_start_date, e.estimated_end_date, e.verification_level, e.confidence_score FROM agri_crop_calendars c JOIN agri_calendar_estimates e ON e.calendar_record_id = c.calendar_record_id LEFT JOIN agri_locations l ON l.location_id = c.location_id LEFT JOIN agri_crops cr ON cr.crop_id = c.crop_id WHERE c.stage_code = 'HARVEST' AND e.estimated_start_date IS NOT NULL AND c.verification_level IN ('V2', 'V3', 'V4') AND e.verification_level IN ('V2', 'V3', 'V4') AND e.confidence_score >= 50${locationFilter} ORDER BY e.estimated_start_date LIMIT ?`,
    locationId ? [locationId, Math.max(1, Math.min(50, limit))] : [Math.max(1, Math.min(50, limit))],
  );
  if (!records.length) return unavailableData("No verified township-specific harvest estimate is available. KAI will not invent an exact date from a regional baseline.");
  return { agricultureRows: records, agricultureKind: "harvest_soon", source: "OPERATIONS_DB.agri_calendar_estimates" };
}

async function agricultureCropStage(database: RuntimeQueryDatabase, limit: number, locationId?: string) {
  const locationFilter = locationId ? " AND c.location_id = ?" : "";
  const records = await rows<Record<string, unknown>>(database,
    `SELECT c.calendar_record_id, l.canonical_name AS location_name, cr.crop_code, cr.crop_name, c.stage_code, c.crop_year, c.verification_level, c.confidence_score FROM agri_crop_calendars c LEFT JOIN agri_locations l ON l.location_id = c.location_id LEFT JOIN agri_crops cr ON cr.crop_id = c.crop_id WHERE c.verification_level IN ('V2', 'V3', 'V4') AND c.confidence_score >= 50${locationFilter} ORDER BY l.canonical_name, cr.crop_code, c.crop_year DESC LIMIT ?`,
    locationId ? [locationId, Math.max(1, Math.min(50, limit))] : [Math.max(1, Math.min(50, limit))],
  );
  if (!records.length) return unavailableData("No verified current crop-stage record is available. KAI cannot infer a stage from weather or location name.");
  return { agricultureRows: records, agricultureKind: "crop_stage", source: "OPERATIONS_DB.agri_crop_calendars" };
}

async function agricultureWeatherImpact(database: RuntimeQueryDatabase, limit: number, locationId?: string) {
  const locationFilter = locationId ? " AND s.location_id = ?" : "";
  const records = await rows<Record<string, unknown>>(database,
    `SELECT s.state_id, l.canonical_name AS location_name, c.crop_code, c.crop_name, s.stage_code, s.weather_variable, s.state_status, s.observed_value, s.unit, s.quality_status, s.reason_codes FROM agri_crop_weather_state s LEFT JOIN agri_locations l ON l.location_id = s.location_id LEFT JOIN agri_crops c ON c.crop_id = s.crop_id WHERE s.state_status <> 'UNKNOWN' AND s.quality_status <> 'UNKNOWN'${locationFilter} ORDER BY s.calculated_at DESC LIMIT ?`,
    locationId ? [locationId, Math.max(1, Math.min(50, limit))] : [Math.max(1, Math.min(50, limit))],
  );
  if (!records.length) return unavailableData("No calibrated crop-weather impact state is available. Live weather alone is not treated as crop impact.");
  return { agricultureRows: records, agricultureKind: "weather_impact", source: "OPERATIONS_DB.agri_crop_weather_state" };
}

async function agricultureCustomerPriority(database: RuntimeQueryDatabase, companyId: string, limit: number, locationId?: string) {
  const locationFilter = locationId ? " AND o.location_id = ?" : "";
  const records = await rows<Record<string, unknown>>(database,
    `SELECT o.opportunity_id, o.customer_id, l.canonical_name AS location_name, c.crop_name, o.opportunity_score, o.confidence_score, o.recommended_action FROM agri_opportunities o LEFT JOIN agri_locations l ON l.location_id = o.location_id LEFT JOIN agri_crops c ON c.crop_id = o.crop_id WHERE o.company_id = ? AND o.customer_id IS NOT NULL AND o.status IN ('ACTIVE', 'EXPIRING') AND o.stage_code IS NOT NULL AND o.opportunity_score IS NOT NULL AND o.confidence_score >= 35${locationFilter} ORDER BY COALESCE(o.priority_score, -1) DESC LIMIT ?`,
    locationId ? [companyId, locationId, Math.max(1, Math.min(50, limit))] : [companyId, Math.max(1, Math.min(50, limit))],
  );
  if (!records.length) return unavailableData("No verified customer-linked Agriculture priority records are available for the selected company.");
  return { agricultureRows: records, agricultureKind: "customer_priority", source: "OPERATIONS_DB.agri_opportunities" };
}

async function agricultureMachineDemand(database: RuntimeQueryDatabase, companyId: string, limit: number, locationId?: string) {
  const locationFilter = locationId ? " AND o.location_id = ?" : "";
  const records = await rows<Record<string, unknown>>(database,
    `SELECT o.opportunity_id, l.canonical_name AS location_name, c.crop_name, o.machine_category, o.opportunity_type, o.opportunity_score, o.confidence_score, o.reason_codes FROM agri_opportunities o LEFT JOIN agri_locations l ON l.location_id = o.location_id LEFT JOIN agri_crops c ON c.crop_id = o.crop_id WHERE o.company_id = ? AND o.machine_category IS NOT NULL AND o.status IN ('ACTIVE', 'EXPIRING') AND o.stage_code IS NOT NULL AND o.opportunity_score IS NOT NULL AND o.confidence_score >= 35${locationFilter} ORDER BY COALESCE(o.priority_score, -1) DESC LIMIT ?`,
    locationId ? [companyId, locationId, Math.max(1, Math.min(50, limit))] : [companyId, Math.max(1, Math.min(50, limit))],
  );
  if (!records.length) return unavailableData("No verified machine-demand or contractor-capacity record is available for the selected company.");
  return { agricultureRows: records, agricultureKind: "machine_demand", source: "OPERATIONS_DB.agri_opportunities" };
}

async function agricultureCalendar(database: RuntimeQueryDatabase, limit: number, locationId?: string) {
  const locationFilter = locationId ? " AND c.location_id = ?" : "";
  const records = await rows<Record<string, unknown>>(database,
    `SELECT c.calendar_record_id, l.canonical_name AS location_name, cr.crop_code, cr.crop_name, c.stage_code, c.baseline_start_date, c.baseline_end_date, e.estimated_start_date, e.estimated_end_date, c.verification_level, c.confidence_score FROM agri_crop_calendars c LEFT JOIN agri_calendar_estimates e ON e.calendar_record_id = c.calendar_record_id AND e.verification_level IN ('V2', 'V3', 'V4') AND e.confidence_score >= 50 LEFT JOIN agri_locations l ON l.location_id = c.location_id LEFT JOIN agri_crops cr ON cr.crop_id = c.crop_id WHERE c.verification_level IN ('V2', 'V3', 'V4') AND c.confidence_score >= 50${locationFilter} ORDER BY l.canonical_name, cr.crop_code, c.stage_code LIMIT ?`,
    locationId ? [locationId, Math.max(1, Math.min(50, limit))] : [Math.max(1, Math.min(50, limit))],
  );
  if (!records.length) return unavailableData("No verified Agriculture calendar record is available. Exact township dates are not inferred from a regional baseline.");
  return { agricultureRows: records, agricultureKind: "calendar", source: "OPERATIONS_DB.agri_crop_calendars" };
}

async function agricultureDataConfidence(database: RuntimeQueryDatabase) {
  const records = await rows<Record<string, unknown>>(database,
    `SELECT confidence_grade, presence_status, COUNT(*) AS record_count FROM agri_crop_locations GROUP BY confidence_grade, presence_status ORDER BY confidence_grade, presence_status`,
  );
  const sourceRows = await rows<Record<string, unknown>>(database, `SELECT COUNT(*) AS source_count FROM agri_sources`);
  const verified = records.filter((row) => String(row.presence_status ?? "") !== "UNKNOWN" && String(row.confidence_grade ?? "") !== "UNKNOWN");
  if (!verified.length) return unavailableData("Agriculture data confidence is not available because no crop-location record has been verified.");
  return { agricultureRows: records, verifiedRecordCount: verified.length, sourceCount: number(sourceRows[0]?.source_count), agricultureKind: "data_confidence", source: "OPERATIONS_DB.agri_crop_locations" };
}

/**
 * Sales imports are normalized through salesperson_master.  Historic prompts
 * sometimes omit a title or use an ordinal prefix ("02-Aung Bo Bo").  We
 * resolve that format only when it has one, and only one, current master
 * identity; otherwise the original exact source text remains the filter.
 */
async function resolveSalespersonForSales(database: RuntimeQueryDatabase, constraints: Constraints, companyId: string) {
  if (!constraints.salesperson || constraints.salespersonCode) return constraints;
  const masters = await rows<Record<string, unknown>>(database,
    'SELECT "salesperson_name" FROM "salesperson_master" WHERE "company_id" = ?', [companyId]);
  const key = salespersonIdentityKey(constraints.salesperson);
  const matches = masters
    .map((row) => String(row.salesperson_name ?? "").trim())
    .filter((name) => salespersonIdentityKey(name) === key);
  return matches.length === 1 ? { ...constraints, salesperson: matches[0] } : constraints;
}

function salespersonIdentityKey(value: string) {
  return value.trim().toUpperCase()
    .replace(/^\d{1,2}\s*[-.)]?\s*/, "")
    .replace(/^(?:U|DAW|MR\.?|MRS\.?|MG\.?)\s+/u, "")
    .replace(/[^A-Z0-9]+/g, "");
}

function salesWhere(constraints: Constraints) {
  return scopedWhere("sales_transactions", "sale_date", constraints, "sales");
}
function bookingWhere(constraints: Constraints, includePeriod = true) {
  return scopedWhere("booking_transactions", "booking_date", constraints, "booking", includePeriod);
}
function scopedWhere(table: "sales_transactions" | "booking_transactions", dateField: string, constraints: Constraints, domain: "sales" | "booking", includePeriod = true) {
  const values: unknown[] = [];
  const parts = [`"company_id" = ?`];
  values.push("__company__");
  if (includePeriod) {
    parts.push(`"${dateField}" >= ?`, `"${dateField}" <= ?`);
    values.push(constraints.period.start, constraints.period.end);
  }
  if (constraints.branches?.length) {
    parts.push(constraints.branches.length === 1 ? '"branch" = ?' : '"branch" IN (' + constraints.branches.map(() => "?").join(", ") + ")");
    values.push(...constraints.branches);
  }
  const codes = constraints.product ? PRODUCT_CODES[domain][constraints.product] : undefined;
  if (codes?.length) { parts.push(`"product_type" IN (${codes.map(() => "?").join(", ")})`); values.push(...codes); }
  if (constraints.product && !codes?.length) parts.push("1 = 0");
  const modelField = domain === "sales" ? "model" : "product_model";
  if (constraints.model) { parts.push(`UPPER("${modelField}") = UPPER(?)`); values.push(constraints.model); }
  if (domain === "sales" && constraints.salesperson) { parts.push('UPPER("salesperson_name") = UPPER(?)'); values.push(constraints.salesperson); }
  if (domain === "sales" && constraints.salespersonCode) { parts.push('UPPER("salesperson_code") = UPPER(?)'); values.push(constraints.salespersonCode); }
  if (domain === "booking" && constraints.salesperson) { parts.push('UPPER("salesperson_name") = UPPER(?)'); values.push(constraints.salesperson); }
  if (domain === "booking" && constraints.salespersonCode) { parts.push('UPPER("salesperson_code") = UPPER(?)'); values.push(constraints.salespersonCode); }
  if (domain === "booking" && constraints.purchaseStatus) { parts.push('UPPER("purchase_status") = UPPER(?)'); values.push(constraints.purchaseStatus); }
  if (domain === "booking" && constraints.bookingLifecycleStatus) { parts.push('UPPER("status") = UPPER(?)'); values.push(constraints.bookingLifecycleStatus); }
  return { sql: parts.join(" AND "), values };
}

function bindCompany(values: unknown[], companyId: string) {
  return values.map((value) => value === "__company__" ? companyId : value);
}

async function salesSummary(database: RuntimeQueryDatabase, constraints: Constraints, companyId = "") {
  const where = salesWhere(constraints);
  const result = await rows<Record<string, unknown>>(database,
    `SELECT COALESCE(SUM(CASE WHEN "product_type" IN (${SALES_UNIT_CODES.map(() => "?").join(", ")}) THEN "quantity" ELSE 0 END), 0) AS sales_unit, SUM(CAST("final_received" AS REAL)) AS sales_value FROM "sales_transactions" WHERE ${where.sql}`,
    [...SALES_UNIT_CODES, ...bindCompany(where.values, companyId)]);
  const row = result[0] ?? {};
  return { period: constraints.period, salesUnit: number(row.sales_unit), salesValue: nullableNumber(row.sales_value) };
}

async function salesGp(database: RuntimeQueryDatabase, constraints: Constraints, companyId = "") {
  const where = salesWhere(constraints);
  const result = await rows<Record<string, unknown>>(database,
    `SELECT COUNT(*) AS rows_count, SUM(CASE WHEN "gp1" IS NULL OR TRIM("gp1") = '' THEN 1 ELSE 0 END) AS missing_gp, SUM(CAST("gp1" AS REAL)) AS gp_value FROM "sales_transactions" WHERE ${where.sql}`,
    bindCompany(where.values, companyId));
  const row = result[0] ?? {};
  const rowCount = number(row.rows_count);
  const missing = number(row.missing_gp);
  return { period: constraints.period, gpValue: missing ? null : nullableNumber(row.gp_value), rows: rowCount, gpComplete: rowCount === 0 || missing === 0 };
}

async function salesExpense(database: RuntimeQueryDatabase, constraints: Constraints, companyId = "") {
  const where = salesWhere(constraints);
  const row = (await rows<Record<string, unknown>>(database,
    `SELECT COUNT(*) AS rows_count, SUM(CASE WHEN "expense" IS NULL OR TRIM("expense") = '' THEN 1 ELSE 0 END) AS missing_expense, SUM(CAST("expense" AS REAL)) AS expense_value FROM "sales_transactions" WHERE ${where.sql} AND "product_type" IN (${SALES_EXPENSE_CODES.map(() => "?").join(", ")})`,
    [...bindCompany(where.values, companyId), ...SALES_EXPENSE_CODES]))[0] ?? {};
  const rowCount = number(row.rows_count);
  const missing = number(row.missing_expense);
  if (rowCount === 0) return unavailableData("No Sales Expense rows are available for the requested scope.");
  if (missing) return unavailableData("Sales Expense is incomplete for the requested scope, so KAI will not total partial values.");
  return { period: constraints.period, expenseValue: nullableNumber(row.expense_value), rows: rowCount, expenseComplete: true, scope: "verified legacy value products" };
}

async function salesRanking(database: RuntimeQueryDatabase, constraints: Constraints, groupBy: string, companyId = "") {
  const allowed: Record<string, string> = { branch: "branch", model: "model", product_type: "product_type", salesperson_name: "salesperson_name" };
  const field = allowed[groupBy];
  if (!field) throw new KaiRuntimeQueryError("Invalid Sales ranking group.", "knowledge_error");
  const where = salesWhere(constraints);
  const output = await rows<Record<string, unknown>>(database,
    `SELECT "${field}" AS label, COALESCE(SUM(CASE WHEN "product_type" IN (${SALES_UNIT_CODES.map(() => "?").join(", ")}) THEN "quantity" ELSE 0 END), 0) AS units, SUM(CAST("final_received" AS REAL)) AS value FROM "sales_transactions" WHERE ${where.sql} GROUP BY "${field}" ORDER BY ${constraints.sort === "value" ? "value DESC, units DESC" : "units DESC, value DESC"} LIMIT ${constraints.limit}`,
    [...SALES_UNIT_CODES, ...bindCompany(where.values, companyId)]);
  return { period: constraints.period, ranking: output.map((row) => ({ label: String(row.label ?? "ไม่ระบุ"), units: number(row.units), value: nullableNumber(row.value) })) };
}

async function salesComparison(database: RuntimeQueryDatabase, constraints: Constraints, context: RuntimeQueryContext, question: string) {
  const periods = comparisonPeriods(question, constraints.period, context);
  const previous = await salesSummary(database, { ...constraints, period: periods.previous }, context.companyId);
  const current = await salesSummary(database, { ...constraints, period: periods.current }, context.companyId);
  return compare("sales", previous, current, periods);
}

async function salesTarget(
  database: RuntimeQueryDatabase,
  constraints: Constraints,
  mode: string,
  targetMetric: TargetMetric,
  companyId = "",
) {
  if (constraints.branches?.length || constraints.salesperson || constraints.salespersonCode) {
    return unavailableData("Approved Target in the verified source is company-wide only; branch and salesperson target scopes are not available.");
  }
  if (targetMetric !== "SALES_UNITS" && constraints.product) {
    return unavailableData("Approved Revenue and GP targets are company-wide only; product-group target scope is not available.");
  }
  const months = targetMonthsForPeriod(constraints.period);
  if (!months.length) {
    return unavailableData("Approved Target is monthly. This partial date scope cannot be compared with a verified target.");
  }
  const productGroup = targetMetric === "SALES_UNITS"
    ? constraints.product === "EX" || constraints.product === "TP" ? "EX_TP" : constraints.product ?? ""
    : "";
  const periodKeys = months.map(({ year, month }) => year * 100 + month);
  const targetRows = await rows<Record<string, unknown>>(database,
    `SELECT "target_year", "target_month", "target_value", "source_version", "effective_from", "updated_at" FROM "business_targets" WHERE "company_id" = ? AND "metric" = ? AND "approval_status" = 'approved' AND "product_group" = ? AND "branch_id" = '' AND "salesperson_id" = '' AND ("target_year" * 100 + "target_month") IN (${periodKeys.map(() => "?").join(", ")}) ORDER BY "target_year", "target_month", "effective_from" DESC, "updated_at" DESC, "source_version" DESC`,
    [companyId, targetMetric, productGroup, ...periodKeys]);
  const latestByMonth = new Map<string, Record<string, unknown>>();
  for (const row of targetRows) {
    const key = `${row.target_year}-${row.target_month}`;
    if (!latestByMonth.has(key)) latestByMonth.set(key, row);
  }
  if (latestByMonth.size !== months.length) {
    return unavailableData("No approved Target is available for every month in the requested scope.");
  }
  const target = [...latestByMonth.values()].reduce((total, row) => total + (nullableNumber(row.target_value) ?? 0), 0);
  let actual: number | null;
  if (targetMetric === "SALES_UNITS") {
    actual = number((await salesSummary(database, constraints, companyId)).salesUnit);
  } else if (targetMetric === "SALES_REVENUE") {
    actual = nullableNumber((await salesSummary(database, constraints, companyId)).salesValue);
  } else {
    const gp = await salesGp(database, constraints, companyId);
    actual = gp.gpComplete ? nullableNumber(gp.gpValue) : null;
  }
  if (actual === null) {
    return unavailableData(targetMetric === "GP1"
      ? "GP actual is incomplete for the requested scope, so it cannot be compared with Target."
      : "Actual Revenue is unavailable for the requested scope, so it cannot be compared with Target.");
  }
  const sourceVersions = [...new Set([...latestByMonth.values()].map((row) => String(row.source_version ?? "")).filter(Boolean))];
  return {
    period: constraints.period,
    target,
    actual,
    achievement: target === 0 ? null : (actual / target) * 100,
    gap: target - actual,
    mode,
    targetMetric,
    sourceVersions,
  };
}

/**
 * Target rows are approved as calendar-month values.  A partial month (for
 * example MTD, a day, or an arbitrary date range) must not be compared to a
 * full-month target because that would fabricate an achievement percentage.
 */
function targetMonthsForPeriod(period: Period) {
  const start = parseIsoDate(period.start);
  const end = parseIsoDate(period.end);
  if (!start || !end || start.day !== 1 || end.day !== daysInMonth(end.year, end.month)) return [];
  const result: Array<{ year: number; month: number }> = [];
  for (let year = start.year, month = start.month; year < end.year || (year === end.year && month <= end.month);) {
    result.push({ year, month });
    month += 1;
    if (month === 13) { month = 1; year += 1; }
  }
  return result;
}

function parseIsoDate(value: string) {
  const match = /^(20\d{2})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

async function bookingSummary(database: RuntimeQueryDatabase, constraints: Constraints, companyId = "") {
  const where = bookingWhere(constraints);
  const result = await rows<Record<string, unknown>>(database,
    `SELECT COUNT(*) AS booking_unit, SUM(CAST("booking_price" AS REAL)) AS booking_value FROM "booking_transactions" WHERE ${where.sql}`,
    bindCompany(where.values, companyId));
  const row = result[0] ?? {};
  return { period: constraints.period, bookingUnit: number(row.booking_unit), bookingValue: nullableNumber(row.booking_value) };
}

async function bookingDeposit(database: RuntimeQueryDatabase, constraints: Constraints, companyId = "") {
  const where = bookingWhere(constraints);
  const row = (await rows<Record<string, unknown>>(database,
    `SELECT COUNT(*) AS booking_unit, SUM(CASE WHEN "deposit_amount" IS NULL OR TRIM("deposit_amount") = '' THEN 1 ELSE 0 END) AS missing_deposit_count, SUM(CAST("deposit_amount" AS REAL)) AS recorded_deposit_value FROM "booking_transactions" WHERE ${where.sql}`,
    bindCompany(where.values, companyId)))[0] ?? {};
  return {
    period: constraints.period,
    bookingUnit: number(row.booking_unit),
    recordedDepositValue: nullableNumber(row.recorded_deposit_value),
    missingDepositCount: number(row.missing_deposit_count),
    // Blank source values are not silently treated as zero.  The aggregate is
    // deliberately labelled "recorded" so it cannot be mistaken for a fully
    // reconciled deposit total.
    depositComplete: number(row.missing_deposit_count) === 0,
  };
}

async function bookingRanking(database: RuntimeQueryDatabase, constraints: Constraints, groupBy: string, companyId = "") {
  const allowed: Record<string, string> = {
    branch: "branch",
    product_model: "product_model",
    salesperson_name: "salesperson_name",
    status: "status",
    purchase_status: "purchase_status",
  };
  const field = allowed[groupBy];
  if (!field) throw new KaiRuntimeQueryError("Invalid Booking ranking group.", "knowledge_error");
  const where = bookingWhere(constraints);
  const output = await rows<Record<string, unknown>>(database,
    `SELECT "${field}" AS label, COUNT(*) AS units, SUM(CAST("booking_price" AS REAL)) AS value FROM "booking_transactions" WHERE ${where.sql} GROUP BY "${field}" ORDER BY ${constraints.sort === "value" ? "value DESC, units DESC" : "units DESC, value DESC"} LIMIT ${constraints.limit}`,
    bindCompany(where.values, companyId));
  return { period: constraints.period, ranking: output.map((row) => ({ label: String(row.label ?? "ไม่ระบุ"), units: number(row.units), value: nullableNumber(row.value) })) };
}

async function bookingComparison(database: RuntimeQueryDatabase, constraints: Constraints, context: RuntimeQueryContext, question: string) {
  const periods = comparisonPeriods(question, constraints.period, context);
  const previous = await bookingSummary(database, { ...constraints, period: periods.previous }, context.companyId);
  const current = await bookingSummary(database, { ...constraints, period: periods.current }, context.companyId);
  return compare("booking", previous, current, periods);
}

async function bookingAging(database: RuntimeQueryDatabase, constraints: Constraints, context: RuntimeQueryContext, list: boolean) {
  const where = bookingWhere(constraints, constraints.explicitPeriod);
  const reference = localDate(context.now ?? new Date(), context.timeZone);
  const range = ageRangeFor(constraints, 90);
  const ageSql = range.max === undefined
    ? 'julianday(?) - julianday("booking_date") >= ?'
    : 'julianday(?) - julianday("booking_date") BETWEEN ? AND ?';
  const ageValues = range.max === undefined ? [reference, range.min] : [reference, range.min, range.max];
  const sql = `SELECT "booking_no", "product_model", "branch", "booking_date", "booking_price" FROM "booking_transactions" WHERE ${where.sql} AND ${ageSql} AND "status" NOT IN (${CLOSED_BOOKING_STATUSES.map(() => "?").join(", ")}) LIMIT ${MAX_ROWS}`;
  const output = await rows<Record<string, unknown>>(database, sql, [...bindCompany(where.values, context.companyId), ...ageValues, ...CLOSED_BOOKING_STATUSES]);
  const records = output.map((row) => ({ bookingNo: String(row.booking_no ?? ""), model: String(row.product_model ?? "ไม่ระบุ"), branch: String(row.branch ?? "ไม่ระบุ"), bookingDate: String(row.booking_date ?? ""), ageDays: ageDays(String(row.booking_date ?? ""), reference), value: nullableNumber(row.booking_price) }));
  const models = grouped(records, "model").map((row) => ({ model: row.label, quantity: row.quantity, agingDays: row.maxAgeDays }));
  const branches = grouped(records, "branch").map((row) => ({ model: row.label, quantity: row.quantity, agingDays: row.maxAgeDays }));
  return { referenceDate: reference, thresholdDays: range.min - 1, ageRange: range, total: records.length, models, branches, records: list ? records : undefined };
}

async function bookingConversion(database: RuntimeQueryDatabase, constraints: Constraints, companyId = "") {
  const where = bookingWhere(constraints);
  const row = (await rows<Record<string, unknown>>(database,
    `SELECT COUNT(*) AS total, SUM(CASE WHEN UPPER("status") = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered FROM "booking_transactions" WHERE ${where.sql}`,
    bindCompany(where.values, companyId)))[0] ?? {};
  const total = number(row.total); const delivered = number(row.delivered);
  return { period: constraints.period, total, delivered, conversionPercent: total ? (delivered / total) * 100 : null };
}

async function customerSummary(database: RuntimeQueryDatabase, constraints: Constraints, companyId = "") {
  const where = bookingWhere(constraints);
  const row = (await rows<Record<string, unknown>>(database,
    `SELECT COUNT(DISTINCT NULLIF(TRIM("customer_name"), '')) AS customer_count, COUNT(*) AS booking_unit FROM "booking_transactions" WHERE ${where.sql}`,
    bindCompany(where.values, companyId)))[0] ?? {};
  return { period: constraints.period, customerCount: number(row.customer_count), bookingUnit: number(row.booking_unit), customerNamesExposed: false };
}

async function salespersonMaster(database: RuntimeQueryDatabase, constraints: Constraints, companyId = "") {
  const parts = ['"company_id" = ?'];
  const values: unknown[] = [companyId];
  if (constraints.salespersonCode) {
    parts.push('UPPER("salesperson_code") = UPPER(?)');
    values.push(constraints.salespersonCode);
  }
  if (constraints.salesperson) {
    parts.push('UPPER("salesperson_name") = UPPER(?)');
    values.push(constraints.salesperson);
  }
  const entries = await rows<Record<string, unknown>>(database,
    `SELECT "salesperson_code", "salesperson_name", "status" FROM "salesperson_master" WHERE ${parts.join(" AND ")} ORDER BY CASE WHEN LOWER("status") = 'active' THEN 0 ELSE 1 END, "salesperson_name" LIMIT ${MAX_ROWS}`,
    values);
  return {
    salespersonCount: entries.length,
    salespeople: entries.map((row) => ({
      code: String(row.salesperson_code ?? ""),
      name: String(row.salesperson_name ?? "ไม่ระบุ"),
      status: String(row.status ?? "ไม่ระบุ"),
    })),
  };
}

async function branchDirectory(database: RuntimeQueryDatabase | undefined, constraints: Constraints, companyId = "") {
  if (!database) {
    throw new KaiRuntimeQueryError("The Company D1 binding is unavailable.", "database_unavailable", 503);
  }
  const parts = ['"company_id" = ?', 'LOWER("status") = \'active\''];
  const values: unknown[] = [companyId];
  if (constraints.branches?.length) {
    parts.push(constraints.branches.length === 1 ? '"branch_code" = ?' : '"branch_code" IN (' + constraints.branches.map(() => "?").join(", ") + ")");
    values.push(...constraints.branches);
  }
  const entries = await rows<Record<string, unknown>>(database,
    `SELECT "branch_code", "branch_name", "region", "township" FROM "branches" WHERE ${parts.join(" AND ")} ORDER BY "branch_code" LIMIT ${MAX_ROWS}`,
    values);
  return {
    branchCount: entries.length,
    branches: entries.map((row) => ({
      code: String(row.branch_code ?? ""),
      name: String(row.branch_name ?? "ไม่ระบุ"),
      region: String(row.region ?? "").trim() || null,
      township: String(row.township ?? "").trim() || null,
    })),
  };
}

/**
 * One fixed, read-only Company-master executor serves small configuration
 * directories.  It deliberately selects only operationally useful fields and
 * never returns membership, contact, tax, draft, or audit attributes.
 */
async function companyMaster(database: RuntimeQueryDatabase | undefined, entity: CompanyMasterEntity | undefined, companyId = "") {
  if (!database) {
    throw new KaiRuntimeQueryError("The Company D1 binding is unavailable.", "database_unavailable", 503);
  }
  if (!entity || !["profile", "currency", "localization", "fiscal_year", "working_calendar", "department", "holiday"].includes(entity)) {
    throw new KaiRuntimeQueryError("Company master plan has an invalid entity.", "knowledge_error");
  }
  if (entity === "profile") {
    const row = (await rows<Record<string, unknown>>(database,
      'SELECT "company_name", "company_code", "business_type", "industry", "established_year", "status" FROM "companies" WHERE "company_id" = ? AND LOWER("status") = \'active\' LIMIT 1', [companyId]))[0];
    return row ? { companyProfile: {
      name: String(row.company_name ?? "ไม่ระบุ"), code: String(row.company_code ?? ""), businessType: String(row.business_type ?? "").trim() || null,
      industry: String(row.industry ?? "").trim() || null, establishedYear: nullableNumber(row.established_year), status: String(row.status ?? ""),
    } } : unavailableData("No active Company Profile is available for the authorized company.");
  }
  if (entity === "currency") {
    const row = (await rows<Record<string, unknown>>(database,
      'SELECT "primary_currency", "display_currency", "currency_symbol", "decimal_places", "number_format" FROM "company_currencies" WHERE "company_id" = ? AND LOWER("status") = \'active\' LIMIT 1', [companyId]))[0];
    return row ? { currency: {
      primary: String(row.primary_currency ?? ""), display: String(row.display_currency ?? ""), symbol: String(row.currency_symbol ?? ""),
      decimalPlaces: number(row.decimal_places), numberFormat: String(row.number_format ?? ""),
    } } : unavailableData("No active Company Currency configuration is available for the authorized company.");
  }
  if (entity === "localization") {
    const row = (await rows<Record<string, unknown>>(database,
      'SELECT "default_language", "fallback_language", "default_time_zone", "date_format", "time_format", "first_day_of_week" FROM "company_localizations" WHERE "company_id" = ? AND LOWER("status") = \'active\' LIMIT 1', [companyId]))[0];
    return row ? { localization: {
      defaultLanguage: String(row.default_language ?? ""), fallbackLanguage: String(row.fallback_language ?? ""), timeZone: String(row.default_time_zone ?? ""),
      dateFormat: String(row.date_format ?? ""), timeFormat: String(row.time_format ?? ""), firstDayOfWeek: String(row.first_day_of_week ?? ""),
    } } : unavailableData("No active Company Localization configuration is available for the authorized company.");
  }
  if (entity === "fiscal_year") {
    const entries = await rows<Record<string, unknown>>(database,
      'SELECT "fiscal_year_name", "start_month", "start_day", "end_month", "end_day", "current_fiscal_year", "status" FROM "fiscal_years" WHERE "company_id" = ? AND LOWER("status") = \'active\' ORDER BY "current_fiscal_year" DESC, "fiscal_year_name" LIMIT 100', [companyId]);
    return entries.length ? { fiscalYears: entries.map((row) => ({
      name: String(row.fiscal_year_name ?? "ไม่ระบุ"), startMonth: number(row.start_month), startDay: number(row.start_day), endMonth: number(row.end_month), endDay: number(row.end_day), current: number(row.current_fiscal_year) === 1,
    })) } : unavailableData("No active Fiscal Year is available for the authorized company.");
  }
  if (entity === "working_calendar") {
    const row = (await rows<Record<string, unknown>>(database,
      'SELECT "working_days", "weekend_days", "working_start_time", "working_end_time" FROM "working_calendars" WHERE "company_id" = ? AND LOWER("status") = \'active\' LIMIT 1', [companyId]))[0];
    return row ? { workingCalendar: {
      workingDays: stringArray(row.working_days), weekendDays: stringArray(row.weekend_days), startTime: String(row.working_start_time ?? ""), endTime: String(row.working_end_time ?? ""),
    } } : unavailableData("No active Working Calendar is available for the authorized company.");
  }
  if (entity === "department") {
    const entries = await rows<Record<string, unknown>>(database,
      'SELECT "department_code", "department_name", "branch_id", "users", "status" FROM "departments" WHERE "company_id" = ? AND LOWER("status") = \'active\' ORDER BY "department_code" LIMIT 100', [companyId]);
    return entries.length ? { departments: entries.map((row) => ({
      code: String(row.department_code ?? ""), name: String(row.department_name ?? "ไม่ระบุ"), branchId: String(row.branch_id ?? "") || null, users: number(row.users), status: String(row.status ?? ""),
    })) } : unavailableData("No active Department is available for the authorized company.");
  }
  const entries = await rows<Record<string, unknown>>(database,
    'SELECT "holiday_name", "holiday_date", "repeat_annually", "holiday_type", "branch_id" FROM "holidays" WHERE "company_id" = ? AND LOWER("status") = \'active\' ORDER BY "holiday_date" LIMIT 100', [companyId]);
  return entries.length ? { holidays: entries.map((row) => ({
    name: String(row.holiday_name ?? "ไม่ระบุ"), date: String(row.holiday_date ?? ""), repeatsAnnually: number(row.repeat_annually) === 1,
    type: String(row.holiday_type ?? ""), branchId: String(row.branch_id ?? "") || null,
  })) } : unavailableData("No active Holiday is available for the authorized company.");
}

function stringArray(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

type RuntimeStockRow = {
  companyId: string | null;
  kmm: unknown;
  currentStatus: string | null;
  productType: string | null;
  productGroup: string | null;
  model: string | null;
  stockId: string | null;
  serialNumber: string | null;
  engineNumber: string | null;
  chassisNumber: string | null;
  branch: string | null;
  msrp: number | null;
  ageDays: number | null;
  asOfDate: string | null;
};

type StockSnapshot = { snapshotDate: string | null; rows: RuntimeStockRow[] };

/**
 * KAI intentionally uses the same current-stock selector as the dashboard:
 * the latest snapshot, Free Stock, company ownership, and physical-ID de-dupe
 * are decided before applying question filters.  This prevents a filtered
 * query from reintroducing a duplicate that the dashboard has excluded.
 */
async function stockRows(database: RuntimeQueryDatabase, constraints: Constraints, companyId: string): Promise<StockSnapshot> {
  const latestWhere = ['"company_id" = ?'];
  const latestValues: unknown[] = [companyId];
  if (constraints.explicitPeriod) {
    latestWhere.push('"as_of_date" >= ?', '"as_of_date" <= ?');
    latestValues.push(constraints.period.start, constraints.period.end);
  }
  const sourceRows = await rows<RuntimeStockRow>(database,
    `SELECT "company_id" AS "companyId", "kmm_flag" AS "kmm", "stock_status" AS "currentStatus", "product_type" AS "productType", "product_group" AS "productGroup", "product_model" AS "model", "stock_number" AS "stockId", "serial_number" AS "serialNumber", "engine_number" AS "engineNumber", "chassis_number" AS "chassisNumber", "branch" AS "branch", CAST(NULLIF(TRIM("msrp"), '') AS REAL) AS "msrp", "stock_age_days" AS "ageDays", "as_of_date" AS "asOfDate" FROM "stock_transactions" WHERE "company_id" = ? AND "as_of_date" = (SELECT MAX("as_of_date") FROM "stock_transactions" WHERE ${latestWhere.join(" AND ")}) LIMIT ${MAX_ROWS}`,
    [companyId, ...latestValues]);
  const snapshotDate = sourceRows[0]?.asOfDate ?? null;
  const currentRows = getCurrentStockRows(sourceRows);
  return {
    snapshotDate,
    rows: currentRows.filter((row) => {
      if (constraints.branches?.length && !constraints.branches.includes(String(row.branch ?? ""))) return false;
      if (constraints.product && normalizeDashboardStockProduct(row) !== constraints.product) return false;
      if (constraints.model && canonicalModelName(row.model).toUpperCase() !== constraints.model.toUpperCase()) return false;
      return true;
    }),
  };
}

async function stockSummary(database: RuntimeQueryDatabase, constraints: Constraints, companyId = "") {
  const snapshot = await stockRows(database, constraints, companyId);
  return {
    snapshotDate: snapshot.snapshotDate,
    stockUnit: getStockUnitRows(snapshot.rows).length,
    stockValue: sum(getStockValueRows(snapshot.rows).map((row) => nullableNumber(row.msrp))),
  };
}

async function stockAging(database: RuntimeQueryDatabase, constraints: Constraints, threshold: number, companyId = "") {
  const snapshot = await stockRows(database, constraints, companyId);
  const range = ageRangeFor(constraints, threshold);
  const selected = getStockUnitRows(snapshot.rows).filter((row) => matchesAgeRange(row.ageDays, range));
  const models = grouped(selected.map((row) => ({ model: String(row.model ?? "ไม่ระบุ"), ageDays: number(row.ageDays) })), "model")
    .map((row) => ({ model: row.label, quantity: row.quantity, agingDays: row.maxAgeDays }));
  return { snapshotDate: snapshot.snapshotDate, thresholdDays: range.min - 1, ageRange: range, total: selected.length, models };
}

async function stockRanking(database: RuntimeQueryDatabase, constraints: Constraints, groupBy: string, threshold: number | undefined, companyId = "") {
  const snapshot = await stockRows(database, constraints, companyId);
  const field = groupBy === "branch" ? "branch" : "model";
  const range = threshold === undefined && !constraints.ageRange ? undefined : ageRangeFor(constraints, threshold ?? 0);
  const selected = getStockUnitRows(snapshot.rows).filter((row) => !range || matchesAgeRange(row.ageDays, range));
  const valueRows = new Set(getStockValueRows(selected));
  const ranking = grouped(selected.map((row) => ({
    label: String(row[field] ?? "ไม่ระบุ"),
    value: valueRows.has(row) ? nullableNumber(row.msrp) : null,
    ageDays: number(row.ageDays),
  })), "label")
    .sort((left, right) => constraints.sort === "value"
      ? (right.value ?? 0) - (left.value ?? 0) || right.quantity - left.quantity
      : right.quantity - left.quantity || (right.value ?? 0) - (left.value ?? 0))
    .slice(0, constraints.limit);
  return { snapshotDate: snapshot.snapshotDate, thresholdDays: range ? range.min - 1 : null, ageRange: range, ranking };
}

function matchesAgeRange(value: unknown, range: AgeRange) {
  const age = nullableNumber(value);
  return age !== null && age >= range.min && (range.max === undefined || age <= range.max);
}

function compare(kind: "sales" | "booking", previous: Record<string, unknown>, current: Record<string, unknown>, periods: { previous: Period; current: Period }) {
  const unitKey = kind === "sales" ? "salesUnit" : "bookingUnit";
  const valueKey = kind === "sales" ? "salesValue" : "bookingValue";
  const priorUnit = number(previous[unitKey]); const currentUnit = number(current[unitKey]);
  const priorValue = nullableNumber(previous[valueKey]); const currentValue = nullableNumber(current[valueKey]);
  const previousResult = { period: periods.previous, units: priorUnit, value: priorValue };
  const currentResult = { period: periods.current, units: currentUnit, value: currentValue };
  const difference = { units: currentUnit - priorUnit, value: priorValue === null || currentValue === null ? null : currentValue - priorValue };
  const growthPercent = priorUnit === 0 ? null : ((currentUnit - priorUnit) / priorUnit) * 100;
  return {
    previous: previousResult,
    current: currentResult,
    difference,
    growthPercent,
    ...(kind === "sales" ? {
      previousYear: { year: Number(periods.previous.start.slice(0, 4)), period: periods.previous.label, salesUnit: priorUnit, salesValue: priorValue },
      currentYear: { year: Number(periods.current.start.slice(0, 4)), period: periods.current.label, salesUnit: currentUnit, salesValue: currentValue },
    } : {}),
  };
}

function comparisonPeriods(question: string, primary: Period, context: RuntimeQueryContext) {
  const hasYoy = /เทียบ.*ปี|ปี.*เทียบ|จากปีที่แล้ว|year.?over.?year|\byoy\b|previous year/iu.test(question);
  if (hasYoy) {
    const match = question.match(/เดือน\s*(\d{1,2})\s*ปี\s*(20\d{2})/iu);
    const month = match ? Number(match[1]) : Number(primary.start.slice(5, 7));
    const priorYear = match ? Number(match[2]) : Number(primary.start.slice(0, 4)) - 1;
    const currentYear = dateParts(context.now ?? new Date(), context.timeZone).year;
    return { previous: makeMonth(priorYear, month), current: makeMonth(currentYear, month) };
  }
  const start = new Date(`${primary.start}T00:00:00Z`);
  const previousDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  return { previous: makeMonth(previousDate.getUTCFullYear(), previousDate.getUTCMonth() + 1), current: primary };
}

function grouped(rows: Array<Record<string, unknown>>, key: string) {
  const map = new Map<string, { label: string; quantity: number; value: number | null; maxAgeDays: number | null }>();
  for (const row of rows) {
    const label = String(row[key] ?? row.model ?? "ไม่ระบุ");
    const current = map.get(label) ?? { label, quantity: 0, value: 0, maxAgeDays: null };
    current.quantity += 1;
    const value = nullableNumber(row.value);
    current.value = current.value === null || value === null ? current.value : current.value + value;
    const age = nullableNumber(row.ageDays);
    if (age !== null) current.maxAgeDays = Math.max(current.maxAgeDays ?? age, age);
    map.set(label, current);
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label));
}

function unavailableResult(knowledge: Awaited<ReturnType<typeof loadKnowledge>>, metricIntent: string, intent: string, text: string): RuntimeQueryResult {
  const metrics = metricsForIntent(metricIntent, knowledge.questions, knowledge.metrics);
  const metric = metrics[0] ?? { code: "UNAVAILABLE", name: "Unavailable", unitType: "N/A", formula: "N/A" };
  return { intent, metric, metrics, data: { available: false, reason: text }, response: { template: "verified data unavailable", text } };
}

function unavailableData(reason: string): Record<string, unknown> {
  return { available: false, reason };
}

function formatResponse(intent: string, data: Record<string, unknown>) {
  if (data.available === false) return String(data.reason);
  if ("agricultureRows" in data) return formatAgricultureResponse(intent, data);
  if ("expenseValue" in data) return data.expenseComplete
    ? `Period: ${periodLabel(data.period)}; Sales Expense: ${formatNumber(data.expenseValue)}`
    : `Period: ${periodLabel(data.period)}; Sales Expense: ไม่มีข้อมูล Expense ครบถ้วนสำหรับขอบเขตนี้`;
  if ("recordedDepositValue" in data) {
    const completeness = number(data.missingDepositCount) === 0
      ? "ครบถ้วน"
      : `ยังไม่มีค่า Deposit ใน ${formatNumber(data.missingDepositCount)} Booking`;
    return `Period: ${periodLabel(data.period)}; Recorded Deposit: ${formatNumber(data.recordedDepositValue)}; Data status: ${completeness}`;
  }
  if ("salespersonCount" in data) {
    const people = Array.isArray(data.salespeople) ? data.salespeople.map((item) => {
      const row = item as Record<string, unknown>;
      return `${String(row.code ?? "")}: ${String(row.name ?? "ไม่ระบุ")} (${String(row.status ?? "ไม่ระบุ")})`;
    }).join("; ") : "ไม่มีข้อมูล";
    return `Salespeople: ${formatNumber(data.salespersonCount)}; ${people}`;
  }
  if ("branchCount" in data) {
    const branches = Array.isArray(data.branches) ? data.branches.map((item) => {
      const row = item as Record<string, unknown>;
      const location = [row.region, row.township].filter((value) => typeof value === "string" && value.trim()).join(", ");
      return `${String(row.code ?? "")}: ${String(row.name ?? "ไม่ระบุ")} (${location || "ยังไม่ได้ลงทะเบียน location"})`;
    }).join("; ") : "ไม่มีข้อมูล";
    return `Active Branches: ${formatNumber(data.branchCount)}; ${branches}`;
  }
  if ("companyProfile" in data) {
    const profile = data.companyProfile as Record<string, unknown>;
    return `Company: ${String(profile.name ?? "ไม่ระบุ")} (${String(profile.code ?? "")}); Business Type: ${String(profile.businessType ?? "ไม่ระบุ")}; Industry: ${String(profile.industry ?? "ไม่ระบุ")}`;
  }
  if ("currency" in data) {
    const currency = data.currency as Record<string, unknown>;
    return `Company Currency: ${String(currency.display ?? "ไม่ระบุ")} (${String(currency.symbol ?? "")}); Decimal Places: ${formatNumber(currency.decimalPlaces)}`;
  }
  if ("localization" in data) {
    const localization = data.localization as Record<string, unknown>;
    return `Company Time Zone: ${String(localization.timeZone ?? "ไม่ระบุ")}; Default Language: ${String(localization.defaultLanguage ?? "ไม่ระบุ")}; First Day: ${String(localization.firstDayOfWeek ?? "ไม่ระบุ")}`;
  }
  if ("fiscalYears" in data) return `Fiscal Years: ${formatMasterRows(data.fiscalYears, (row) => `${String(row.name ?? "ไม่ระบุ")}: ${formatNumber(row.startMonth)}/${formatNumber(row.startDay)}–${formatNumber(row.endMonth)}/${formatNumber(row.endDay)}${row.current ? " (current)" : ""}`)}`;
  if ("workingCalendar" in data) {
    const calendar = data.workingCalendar as Record<string, unknown>;
    const workingDays = Array.isArray(calendar.workingDays) ? calendar.workingDays.join(", ") : "";
    return `Working Calendar: ${workingDays || "ไม่ระบุ"}; Hours: ${String(calendar.startTime ?? "")}–${String(calendar.endTime ?? "")}`;
  }
  if ("departments" in data) return `Departments: ${formatMasterRows(data.departments, (row) => `${String(row.code ?? "")}: ${String(row.name ?? "ไม่ระบุ")} (${formatNumber(row.users)} users)`)}`;
  if ("holidays" in data) return `Holidays: ${formatMasterRows(data.holidays, (row) => `${String(row.date ?? "")}: ${String(row.name ?? "ไม่ระบุ")}`)}`;
  if ("target" in data) {
    const metricName = data.targetMetric === "SALES_REVENUE" ? "Sales Revenue" : data.targetMetric === "GP1" ? "GP" : "Sales Unit";
    return `Period: ${periodLabel(data.period)}; ${metricName} Approved Target: ${formatNumber(data.target)}; Actual: ${formatNumber(data.actual)}; Achievement: ${formatPercent(data.achievement)}; Gap: ${formatNumber(data.gap)}`;
  }
  if ("salesUnit" in data) return `Period: ${periodLabel(data.period)}; Sales Unit: ${formatNumber(data.salesUnit)}; Sales Value: ${formatNumber(data.salesValue)}`;
  if ("gpValue" in data) return data.gpComplete ? `Period: ${periodLabel(data.period)}; GP: ${formatNumber(data.gpValue)}` : `Period: ${periodLabel(data.period)}; GP: ไม่มีข้อมูล GP1 ครบถ้วนสำหรับขอบเขตนี้`;
  if ("customerCount" in data) return `Period: ${periodLabel(data.period)}; Customers: ${formatNumber(data.customerCount)}; Booking Unit: ${formatNumber(data.bookingUnit)}`;
  if ("bookingUnit" in data) return `Period: ${periodLabel(data.period)}; Booking Unit: ${formatNumber(data.bookingUnit)}; Booking Value: ${formatNumber(data.bookingValue)}`;
  if ("conversionPercent" in data) return `Period: ${periodLabel(data.period)}; Delivered: ${formatNumber(data.delivered)}; Conversion: ${formatPercent(data.conversionPercent)}`;
  if ("previous" in data && "current" in data) {
    const previous = data.previous as Record<string, unknown>; const current = data.current as Record<string, unknown>;
    return `Previous ${periodLabel(previous.period)}: ${formatNumber(previous.units)} units; Current ${periodLabel(current.period)}: ${formatNumber(current.units)} units; Growth: ${formatPercent(data.growthPercent)}`;
  }
  if ("ranking" in data) return `Snapshot/Period: ${String(data.snapshotDate ?? periodLabel(data.period))}; Ranking: ${formatGroups(data.ranking)}`;
  if ("stockUnit" in data) return `Snapshot: ${String(data.snapshotDate ?? "N/A")}; Stock Unit: ${formatNumber(data.stockUnit)}; Stock Value: ${formatNumber(data.stockValue)}`;
  if ("total" in data && "thresholdDays" in data) return `${intent.startsWith("BOOKING") ? "Booking" : "Stock"} Aging ${formatAgeRange(data.ageRange, data.thresholdDays)} days; Snapshot: ${String(data.snapshotDate ?? data.referenceDate ?? "N/A")}; Total: ${formatNumber(data.total)}; Models: ${formatGroups(data.models)}`;
  return "ไม่มีข้อมูลสำหรับขอบเขตที่ระบุ";
}

function formatAgricultureResponse(intent: string, data: Record<string, unknown>) {
  const rows = Array.isArray(data.agricultureRows) ? data.agricultureRows as Array<Record<string, unknown>> : [];
  if (!rows.length) return "No verified Agriculture data is available for the selected scope.";
  if (intent === "AGRI_DATA_CONFIDENCE") {
    const groups = rows.map((row) => `${String(row.confidence_grade ?? "UNKNOWN")}/${String(row.presence_status ?? "UNKNOWN")}: ${formatNumber(row.record_count)}`).join("; ");
    return `Agriculture confidence groups: ${groups}; verified records: ${formatNumber(data.verifiedRecordCount)}; sources: ${formatNumber(data.sourceCount)}`;
  }
  if (intent === "AGRI_CALENDAR" || intent === "AGRI_HARVEST_SOON") {
    const values = rows.map((row) => `${String(row.location_name ?? "Unknown location")} · ${String(row.crop_name ?? "Unknown crop")} · ${String(row.stage_code ?? "Unknown stage")} · baseline ${String(row.baseline_start_date ?? "N/A")}–${String(row.baseline_end_date ?? "N/A")} · estimate ${String(row.estimated_start_date ?? "N/A")}–${String(row.estimated_end_date ?? "N/A")}`).join("; ");
    return `Agriculture calendar records: ${values}; source: ${String(data.source ?? "OPERATIONS_DB")}`;
  }
  const values = rows.map((row) => {
    const location = String(row.location_name ?? "Unknown location");
    const crop = String(row.crop_name ?? row.crop_code ?? "Unknown crop");
    const score = row.opportunity_score === undefined ? "" : ` · score ${formatNumber(row.opportunity_score)} · confidence ${formatNumber(row.confidence_score)}`;
    return `${location} · ${crop}${row.stage_code ? ` · ${String(row.stage_code)}` : ""}${row.machine_category ? ` · ${String(row.machine_category)}` : ""}${score}`;
  }).join("; ");
  return `Agriculture ${intent.replace("AGRI_", "").toLowerCase()}: ${values}; source: ${String(data.source ?? "OPERATIONS_DB")}`;
}

function periodLabel(value: unknown) {
  return value && typeof value === "object" ? String((value as Record<string, unknown>).label ?? "N/A") : "N/A";
}
function formatGroups(value: unknown) {
  if (!Array.isArray(value) || !value.length) return "ไม่มีข้อมูล";
  return value.map((item) => {
    const row = item as Record<string, unknown>;
    return `${String(row.label ?? row.model ?? "ไม่ระบุ")}: ${formatNumber(row.quantity ?? row.units)}`;
  }).join("; ");
}
function formatAgeRange(value: unknown, threshold: unknown) {
  if (value && typeof value === "object") {
    const label = (value as Record<string, unknown>).label;
    if (typeof label === "string" && label) return label;
  }
  return `>${formatNumber(threshold)}`;
}
function formatMasterRows(value: unknown, render: (row: Record<string, unknown>) => string) {
  if (!Array.isArray(value) || !value.length) return "ไม่มีข้อมูล";
  return value.map((item) => render(item as Record<string, unknown>)).join("; ");
}
function formatNumber(value: unknown) { const parsed = nullableNumber(value); return parsed === null ? "N/A" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(parsed); }
function formatPercent(value: unknown) { const parsed = nullableNumber(value); return parsed === null ? "N/A" : `${formatNumber(parsed)}%`; }
function number(value: unknown) { return nullableNumber(value) ?? 0; }
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function sum(values: Array<number | null>) { const usable = values.filter((value): value is number => value !== null); return usable.length ? usable.reduce((total, value) => total + value, 0) : null; }
function ageDays(start: string, end: string) { const a = new Date(`${start}T00:00:00Z`).getTime(); const b = new Date(`${end}T00:00:00Z`).getTime(); return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.floor((b - a) / 86_400_000)) : null; }
function localDate(value: Date, timeZone: string) { const parts = dateParts(value, timeZone); return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`; }
function dateParts(value: Date, timeZone: string) { const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value); const get = (type: string) => Number(parts.find((part) => part.type === type)?.value); return { year: get("year"), month: get("month"), day: get("day") }; }
function escapeRegex(value: string) { return value.replace(/[.*+?^$()|[\]\\]/g, "\\$&"); }
function isUnsafeRuntimeQuestion(question: string) {
  const sqlAttempt = /\b(?:select|insert|update|delete|alter|drop|create)\b[\s\S]{0,160}\b(?:sql|database|table|ข้อมูล|ยอดขาย|booking|stock)\b/iu;
  // Thai words do not have a reliable RegExp word boundary. Require a real
  // command position so the final ล of "ข้อมูล" plus the first บ of
  // "บริษัท" is never misread as the destructive verb "ลบ".
  const destructiveCommand = /(?:^|[\s:;,.]|(?:ช่วย|กรุณา|ต้องการ|please)\s+)(?:ลบ|แก้ไข|อัปเดต|เปลี่ยน|เพิ่ม)\s*(?:ข้อมูล|ยอดขาย|booking|stock|สต็อก|target|เป้า)?/iu;
  return sqlAttempt.test(question) || destructiveCommand.test(question);
}
