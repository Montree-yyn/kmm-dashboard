/**
 * KAI Phase 2B executable-query runtime.
 *
 * Query plans are records in D1, but all SQL grammar, identifiers, and values
 * remain server-owned. Question text is parsed into a small verified constraint
 * object and becomes bound values only.
 */

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
  source: "sales_transactions" | "booking_transactions" | "stock_transactions" | "business_targets";
  operation: string;
  group_by?: string;
  threshold?: number;
  mode?: string;
  list?: boolean;
};
type Period = { start: string; end: string; label: string };
type Constraints = {
  branch?: string;
  product?: ProductGroup;
  model?: string;
  salesperson?: string;
  paymentStatus?: string;
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
const STOCK_UNIT_CODES = ["01-TT", "02-CH", "03-EX", "04-TP", "08-TX"];
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
  const intent = resolveIntent(clean);
  if (intent === "BOOKING_PAYMENT_UNAVAILABLE") {
    return unavailableResult(knowledge, "BOOKING_CURRENT_MONTH", intent,
      "ไม่มีข้อมูล Payment Type “Cash” ที่ยืนยันได้ในฐานข้อมูลปัจจุบัน จึงไม่สามารถตอบคำถามนี้ได้");
  }
  if (intent === "BOOKING_OUTSTANDING_UNAVAILABLE") {
    return unavailableResult(knowledge, "BOOKING_CURRENT_MONTH", intent,
      "ยังไม่มี business definition ที่ยืนยันได้สำหรับ Outstanding Booking จึงไม่สามารถคำนวณได้");
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
      !["sales_transactions", "booking_transactions", "stock_transactions", "business_targets"].includes(String(plan.source)) ||
      typeof plan.operation !== "string"
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

function resolveIntent(question: string): string | null {
  const q = question.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(question);
  const booking = has(/booking|ยอดจอง|รับจอง|ใบจอง|จอง/iu);
  const stock = has(/stock|สต็อก|คงเหลือ|รถค้าง|inventory/iu) || (has(/(?:\bTT\b|\bCH\b|\bEX\b|\bTP\b|\bIM\b|\bIMO\b|\bOT\b)/iu) && has(/เหลือ|กี่คัน/iu));
  const sales = has(/ยอดขาย|\bsales\b|ขายได้|ขาย/iu);
  const target = has(/\btarget\b|เป้า|achievement|\bgap\b/iu);
  const customer = has(/ลูกค้า|\bcustomer\b/iu);
  const salesperson = has(/salesperson|salesman|พนักงานขาย|เซลส์|ใครขาย/iu);

  if (booking && has(/cash|payment\s*type|ชำระเงิน/iu)) return "BOOKING_PAYMENT_UNAVAILABLE";
  if (booking && has(/outstanding/iu)) return "BOOKING_OUTSTANDING_UNAVAILABLE";
  if (customer && booking) return "CUSTOMER_BOOKING_QUERY";
  if (target) {
    if (has(/ขาดเป้า|\bgap\b/iu)) return "SALES_GAP_QUERY";
    if (has(/ได้กี่เปอร์เซ็นต์|achievement/iu)) return "SALES_ACHIEVEMENT_QUERY";
    return "TARGET_CURRENT_QUERY";
  }
  if (salesperson && sales) return "SALES_PERSON_RANKING";
  if (booking) {
    if (has(/เกิน\s*\d+\s*วัน|อายุ.*วัน/iu)) return has(/รายการ|อะไรบ้าง|รายชื่อ/iu) ? "BOOKING_AGING_LIST" : "BOOKING_AGING";
    if (has(/conversion|เปลี่ยน.*ส่งมอบ/iu)) return "BOOKING_CONVERSION_QUERY";
    if (has(/สาขา.*(?:มากที่สุด|สูงสุด|อันดับ)|(?:มากที่สุด|สูงสุด|อันดับ).*สาขา/iu)) return "BOOKING_BRANCH_RANKING";
    if (has(/รุ่น|model|product/iu) && has(/มากที่สุด|สูงสุด|อันดับ/iu)) return "BOOKING_MODEL_RANKING";
    if (has(/เทียบ.*ปี|ปี.*เทียบ/iu)) return "BOOKING_YOY_COMPARE";
    if (has(/เทียบ.*เดือน|เดือน.*เทียบ/iu)) return "BOOKING_MONTH_COMPARE";
    if (has(/มูลค่า|value|ราคา/iu)) return "BOOKING_VALUE_CURRENT";
    if (has(/ปี\s*20\d{2}|เดือน\s*\d|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|january|february|march|april|may|june|july|august|september|october|november|december/iu)) return "BOOKING_HISTORY_QUERY";
    return "BOOKING_CURRENT_MONTH";
  }
  if (stock) {
    if (has(/เกิน\s*180\s*วัน|slow\s*moving/iu)) return has(/รุ่น|model|อะไรบ้าง/iu) ? "STOCK_SLOW_MOVING_MODEL_RANKING" : "STOCK_SLOW_MOVING_QUERY";
    if (has(/เกิน\s*\d+\s*วัน|อายุ.*วัน|รถค้าง/iu)) return has(/รุ่น|model|อะไรบ้าง/iu) ? "STOCK_AGING_MODEL" : "STOCK_AGING_QUERY";
    if (has(/สาขา.*(?:มากที่สุด|สูงสุด|อันดับ)|(?:มากที่สุด|สูงสุด|อันดับ).*สาขา/iu)) return "STOCK_BRANCH_RANKING";
    if (has(/รุ่น|model/iu) && has(/มากที่สุด|สูงสุด|อันดับ/iu)) return "STOCK_MODEL_RANKING";
    if (has(/มูลค่า|value|msrp/iu)) return "STOCK_VALUE_CURRENT";
    if (has(/รุ่น|model/iu)) return "STOCK_MODEL_QUERY";
    return "STOCK_CURRENT";
  }
  if (sales || has(/\bgp\b|gross profit|กำไรขั้นต้น/iu)) {
    if (has(/\bgp\b|gross profit|กำไรขั้นต้น/iu)) return "SALES_GP_QUERY";
    if (has(/สาขา.*(?:มากที่สุด|สูงสุด|อันดับ|ดีที่สุด)|(?:มากที่สุด|สูงสุด|อันดับ|ดีที่สุด).*สาขา/iu)) return "SALES_BRANCH_RANKING";
    if (has(/รุ่น|model/iu) && has(/มากที่สุด|สูงสุด|อันดับ|ดีที่สุด/iu)) return "SALES_MODEL_RANKING";
    if (has(/product type|product.*(?:มากที่สุด|สูงสุด|อันดับ|ดีที่สุด)/iu)) return "SALES_PRODUCT_RANKING";
    if (has(/โต.*ปีที่แล้ว|growth/iu)) return "SALES_GROWTH_QUERY";
    if (has(/เทียบ.*ปี|ปี.*เทียบ/iu)) return "SALES_YOY_COMPARE";
    if (has(/เทียบ.*เดือน|เดือน.*เทียบ/iu)) return "SALES_MONTH_COMPARE";
    if (has(/มูลค่า|value|เท่าไร/iu) && /\bvalue\b|มูลค่า/iu.test(q)) return "SALES_VALUE_CURRENT";
    if (has(/ปีนี้|this year|ปี\s*20\d{2}|เดือน\s*\d|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|january|february|march|april|may|june|july|august|september|october|november|december/iu)) return "SALES_HISTORY_QUERY";
    return "SALES_CURRENT_MONTH";
  }
  return null;
}

function parseConstraints(question: string, context: RuntimeQueryContext): Constraints {
  const now = context.now ?? new Date();
  const date = dateParts(now, context.timeZone);
  const periodResult = parsePeriod(question, date.year, date.month);
  const branchMatch = question.match(/\bKMM0[1-3]\b/i)?.[0]?.toUpperCase();
  const branch = branchMatch && (!context.branches?.length || context.branches.some((row) => row.code.toUpperCase() === branchMatch))
    ? branchMatch
    : undefined;
  const paymentStatus = ["A HOT", "B HOT", "FAIL", "S"]
    .find((value) => new RegExp(`\\b${value.replace(" ", "\\s+")}\\b`, "i").test(question));
  return {
    period: periodResult.period,
    explicitPeriod: periodResult.explicit,
    branch,
    product: parseProduct(question),
    model: parseModel(question),
    salesperson: parseSalesperson(question),
    paymentStatus,
  };
}

function parsePeriod(question: string, currentYear: number, currentMonth: number) {
  const numeric = question.match(/เดือน\s*(\d{1,2})\s*(?:ปี\s*)?(20\d{2})?/iu);
  if (numeric) {
    const month = Number(numeric[1]);
    if (month >= 1 && month <= 12) return { period: makeMonth(Number(numeric[2] ?? currentYear), month), explicit: true };
  }
  const named = MONTHS.find(([, names]) => names.some((name) => new RegExp(`(?:เดือน\\s*)?${escapeRegex(name)}(?:\\s*(20\\d{2}))?`, "iu").test(question)));
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
    const match = question.match(new RegExp(`(?:เดือน\\s*)?${escapeRegex(name)}(?:\\s*(20\\d{2}))?`, "iu"));
    if (match) return match;
  }
  return null;
}

function makeMonth(year: number, month: number): Period {
  const end = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${year}-${String(month).padStart(2, "0")}-01`, end: `${year}-${String(month).padStart(2, "0")}-${String(end).padStart(2, "0")}`, label: `${year}-${String(month).padStart(2, "0")}` };
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

function parseModel(question: string) {
  const match = question.match(/(?:รุ่น|model)\s*[:：]?\s*([A-Za-z0-9][A-Za-z0-9+()\- .]{1,50}?)(?=\s*(?:มี|เหลือ|ขาย|จอง|stock|สต็อก|เดือน|ปี|เท่าไร|กี่|มากที่สุด|$))/iu);
  return match?.[1]?.trim() || undefined;
}

function parseSalesperson(question: string) {
  const match = question.match(/(?:salesperson|พนักงานขาย|เซลส์)\s*[:：]?\s*([A-Za-z0-9][A-Za-z0-9 .()\-]{2,60}?)(?=\s*(?:ขาย|เดือน|ปี|เท่าไร|กี่|$))/iu);
  return match?.[1]?.trim() || undefined;
}

async function executePlan(
  database: RuntimeQueryDatabase,
  plan: Plan,
  intent: string,
  question: string,
  constraints: Constraints,
  context: RuntimeQueryContext,
) {
  if (plan.operation === "sales_summary") return salesSummary(database, constraints, context.companyId);
  if (plan.operation === "sales_gp") return salesGp(database, constraints, context.companyId);
  if (plan.operation === "sales_ranking") return salesRanking(database, constraints, plan.group_by ?? "model", context.companyId);
  if (plan.operation === "sales_compare") return salesComparison(database, constraints, context, question);
  if (plan.operation === "sales_target") return salesTarget(database, constraints, plan.mode ?? "target", context.companyId);
  if (plan.operation === "booking_summary") return bookingSummary(database, constraints, context.companyId);
  if (plan.operation === "booking_ranking") return bookingRanking(database, constraints, plan.group_by ?? "product_model", context.companyId);
  if (plan.operation === "booking_compare") return bookingComparison(database, constraints, context, question);
  if (plan.operation === "booking_aging") return bookingAging(database, constraints, context, Boolean(plan.list));
  if (plan.operation === "booking_conversion") return bookingConversion(database, constraints, context.companyId);
  if (plan.operation === "customer_summary") return customerSummary(database, constraints, context.companyId);
  if (plan.operation === "stock_summary") return stockSummary(database, constraints, context.companyId);
  if (plan.operation === "stock_ranking") return stockRanking(database, constraints, plan.group_by ?? "product_model", plan.threshold, context.companyId);
  if (plan.operation === "stock_aging") return stockAging(database, constraints, plan.threshold ?? 90, context.companyId);
  throw new KaiRuntimeQueryError(`Unsupported executable operation for ${intent}.`, "knowledge_error");
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
  if (constraints.branch) { parts.push('"branch" = ?'); values.push(constraints.branch); }
  const codes = constraints.product ? PRODUCT_CODES[domain][constraints.product] : undefined;
  if (codes?.length) { parts.push(`"product_type" IN (${codes.map(() => "?").join(", ")})`); values.push(...codes); }
  if (constraints.product && !codes?.length) parts.push("1 = 0");
  const modelField = domain === "sales" ? "model" : "product_model";
  if (constraints.model) { parts.push(`UPPER("${modelField}") = UPPER(?)`); values.push(constraints.model); }
  if (domain === "sales" && constraints.salesperson) { parts.push('UPPER("salesperson_name") = UPPER(?)'); values.push(constraints.salesperson); }
  if (domain === "booking" && constraints.paymentStatus) { parts.push('UPPER("purchase_status") = UPPER(?)'); values.push(constraints.paymentStatus); }
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

async function salesRanking(database: RuntimeQueryDatabase, constraints: Constraints, groupBy: string, companyId = "") {
  const allowed: Record<string, string> = { branch: "branch", model: "model", product_type: "product_type", salesperson_name: "salesperson_name" };
  const field = allowed[groupBy];
  if (!field) throw new KaiRuntimeQueryError("Invalid Sales ranking group.", "knowledge_error");
  const where = salesWhere(constraints);
  const output = await rows<Record<string, unknown>>(database,
    `SELECT "${field}" AS label, COALESCE(SUM(CASE WHEN "product_type" IN (${SALES_UNIT_CODES.map(() => "?").join(", ")}) THEN "quantity" ELSE 0 END), 0) AS units, SUM(CAST("final_received" AS REAL)) AS value FROM "sales_transactions" WHERE ${where.sql} GROUP BY "${field}" ORDER BY units DESC, value DESC LIMIT 50`,
    [...SALES_UNIT_CODES, ...bindCompany(where.values, companyId)]);
  return { period: constraints.period, ranking: output.map((row) => ({ label: String(row.label ?? "ไม่ระบุ"), units: number(row.units), value: nullableNumber(row.value) })) };
}

async function salesComparison(database: RuntimeQueryDatabase, constraints: Constraints, context: RuntimeQueryContext, question: string) {
  const periods = comparisonPeriods(question, constraints.period, context);
  const previous = await salesSummary(database, { ...constraints, period: periods.previous }, context.companyId);
  const current = await salesSummary(database, { ...constraints, period: periods.current }, context.companyId);
  return compare("sales", previous, current, periods);
}

async function salesTarget(database: RuntimeQueryDatabase, constraints: Constraints, mode: string, companyId = "") {
  const month = constraints.period.start.slice(5, 7);
  const year = Number(constraints.period.start.slice(0, 4));
  const isYear = constraints.period.start.endsWith("-01-01") && constraints.period.end.endsWith("-12-31");
  const productGroup = constraints.product === "EX" || constraints.product === "TP" ? "EX_TP" : constraints.product ?? "";
  const targetSql = isYear
    ? `SELECT SUM(CAST("target_value" AS REAL)) AS target_value FROM "business_targets" WHERE "company_id" = ? AND "target_year" = ? AND "metric" = 'SALES_UNITS' AND "approval_status" = 'approved' AND "product_group" = ?`
    : `SELECT SUM(CAST("target_value" AS REAL)) AS target_value FROM "business_targets" WHERE "company_id" = ? AND "target_year" = ? AND "target_month" = ? AND "metric" = 'SALES_UNITS' AND "approval_status" = 'approved' AND "product_group" = ?`;
  const targetRow = (await rows<Record<string, unknown>>(database, targetSql, isYear ? [companyId, year, productGroup] : [companyId, year, Number(month), productGroup]))[0] ?? {};
  const target = nullableNumber(targetRow.target_value);
  const actual = await salesSummary(database, constraints, companyId);
  const achievement = target === null || target === 0 ? null : (actual.salesUnit / target) * 100;
  return { period: constraints.period, target, actual: actual.salesUnit, achievement, gap: target === null ? null : target - actual.salesUnit, mode };
}

async function bookingSummary(database: RuntimeQueryDatabase, constraints: Constraints, companyId = "") {
  const where = bookingWhere(constraints);
  const result = await rows<Record<string, unknown>>(database,
    `SELECT COUNT(*) AS booking_unit, SUM(CAST("booking_price" AS REAL)) AS booking_value FROM "booking_transactions" WHERE ${where.sql}`,
    bindCompany(where.values, companyId));
  const row = result[0] ?? {};
  return { period: constraints.period, bookingUnit: number(row.booking_unit), bookingValue: nullableNumber(row.booking_value) };
}

async function bookingRanking(database: RuntimeQueryDatabase, constraints: Constraints, groupBy: string, companyId = "") {
  const allowed: Record<string, string> = { branch: "branch", product_model: "product_model" };
  const field = allowed[groupBy];
  if (!field) throw new KaiRuntimeQueryError("Invalid Booking ranking group.", "knowledge_error");
  const where = bookingWhere(constraints);
  const output = await rows<Record<string, unknown>>(database,
    `SELECT "${field}" AS label, COUNT(*) AS units, SUM(CAST("booking_price" AS REAL)) AS value FROM "booking_transactions" WHERE ${where.sql} GROUP BY "${field}" ORDER BY units DESC, value DESC LIMIT 50`,
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
  const sql = `SELECT "booking_no", "product_model", "branch", "booking_date", "booking_price" FROM "booking_transactions" WHERE ${where.sql} AND julianday(?) - julianday("booking_date") > 90 AND "status" NOT IN (${CLOSED_BOOKING_STATUSES.map(() => "?").join(", ")}) LIMIT ${MAX_ROWS}`;
  const output = await rows<Record<string, unknown>>(database, sql, [...bindCompany(where.values, context.companyId), reference, ...CLOSED_BOOKING_STATUSES]);
  const records = output.map((row) => ({ bookingNo: String(row.booking_no ?? ""), model: String(row.product_model ?? "ไม่ระบุ"), branch: String(row.branch ?? "ไม่ระบุ"), bookingDate: String(row.booking_date ?? ""), ageDays: ageDays(String(row.booking_date ?? ""), reference), value: nullableNumber(row.booking_price) }));
  const models = grouped(records, "model").map((row) => ({ model: row.label, quantity: row.quantity, agingDays: row.maxAgeDays }));
  const branches = grouped(records, "branch").map((row) => ({ model: row.label, quantity: row.quantity, agingDays: row.maxAgeDays }));
  return { referenceDate: reference, thresholdDays: 90, total: records.length, models, branches, records: list ? records : undefined };
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

async function stockRows(database: RuntimeQueryDatabase, constraints: Constraints, companyId: string) {
  const values: unknown[] = [companyId];
  const parts = ['"company_id" = ?', 'UPPER("stock_status") = UPPER(\'Free Stock\')', '"kmm_flag" = 1'];
  if (constraints.explicitPeriod) {
    parts.push('"as_of_date" >= ?', '"as_of_date" <= ?');
    values.push(constraints.period.start, constraints.period.end);
  }
  if (constraints.branch) { parts.push('"branch" = ?'); values.push(constraints.branch); }
  if (constraints.product) {
    const codes = PRODUCT_CODES.stock[constraints.product];
    if (!codes?.length) parts.push("1 = 0");
    else { parts.push(`"product_type" IN (${codes.map(() => "?").join(", ")})`); values.push(...codes); }
  } else {
    parts.push(`"product_type" IN (${STOCK_UNIT_CODES.map(() => "?").join(", ")})`);
    values.push(...STOCK_UNIT_CODES);
  }
  if (constraints.model) { parts.push('UPPER("product_model") = UPPER(?)'); values.push(constraints.model); }
  const latestWhere = ['"company_id" = ?'];
  const latestValues: unknown[] = [companyId];
  if (constraints.explicitPeriod) { latestWhere.push('"as_of_date" >= ?', '"as_of_date" <= ?'); latestValues.push(constraints.period.start, constraints.period.end); }
  const sql = `SELECT "product_model", "branch", "product_type", "msrp", "stock_age_days", "as_of_date", "stock_number", "serial_number", "engine_number", "chassis_number" FROM "stock_transactions" WHERE ${parts.join(" AND ")} AND "as_of_date" = (SELECT MAX("as_of_date") FROM "stock_transactions" WHERE ${latestWhere.join(" AND ")}) LIMIT ${MAX_ROWS}`;
  return deduplicate(await rows<Record<string, unknown>>(database, sql, [...values, ...latestValues]));
}

async function stockSummary(database: RuntimeQueryDatabase, constraints: Constraints, companyId = "") {
  const data = await stockRows(database, constraints, companyId);
  return { snapshotDate: data[0]?.as_of_date ?? null, stockUnit: data.length, stockValue: sum(data.map((row) => nullableNumber(row.msrp))) };
}

async function stockAging(database: RuntimeQueryDatabase, constraints: Constraints, threshold: number, companyId = "") {
  const data = (await stockRows(database, constraints, companyId)).filter((row) => number(row.stock_age_days) > threshold);
  const models = grouped(data.map((row) => ({ model: String(row.product_model ?? "ไม่ระบุ"), ageDays: number(row.stock_age_days) })), "model")
    .map((row) => ({ model: row.label, quantity: row.quantity, agingDays: row.maxAgeDays }));
  return { snapshotDate: data[0]?.as_of_date ?? null, thresholdDays: threshold, total: data.length, models };
}

async function stockRanking(database: RuntimeQueryDatabase, constraints: Constraints, groupBy: string, threshold: number | undefined, companyId = "") {
  const field = groupBy === "branch" ? "branch" : "product_model";
  const selected = threshold === undefined ? await stockRows(database, constraints, companyId) : (await stockRows(database, constraints, companyId)).filter((row) => number(row.stock_age_days) > threshold);
  const ranking = grouped(selected.map((row) => ({ label: String(row[field] ?? "ไม่ระบุ"), value: nullableNumber(row.msrp), ageDays: number(row.stock_age_days) })), "label");
  return { snapshotDate: selected[0]?.as_of_date ?? null, thresholdDays: threshold ?? null, ranking };
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

function deduplicate(rows: Array<Record<string, unknown>>) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const keys = ["stock_number", "serial_number", "engine_number", "chassis_number"]
      .map((field) => cleanPhysical(row[field]))
      .filter(Boolean);
    if (!keys.length) return true;
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}
function cleanPhysical(value: unknown) {
  const clean = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^(?:|0|NA|N\/A|NONE|NULL|UNKNOWN)$/.test(clean) ? "" : clean;
}

function unavailableResult(knowledge: Awaited<ReturnType<typeof loadKnowledge>>, metricIntent: string, intent: string, text: string): RuntimeQueryResult {
  const metrics = metricsForIntent(metricIntent, knowledge.questions, knowledge.metrics);
  const metric = metrics[0] ?? { code: "UNAVAILABLE", name: "Unavailable", unitType: "N/A", formula: "N/A" };
  return { intent, metric, metrics, data: { available: false, reason: text }, response: { template: "verified data unavailable", text } };
}

function formatResponse(intent: string, data: Record<string, unknown>) {
  if (data.available === false) return String(data.reason);
  if ("salesUnit" in data) return `Period: ${periodLabel(data.period)}; Sales Unit: ${formatNumber(data.salesUnit)}; Sales Value: ${formatNumber(data.salesValue)}`;
  if ("gpValue" in data) return data.gpComplete ? `Period: ${periodLabel(data.period)}; GP: ${formatNumber(data.gpValue)}` : `Period: ${periodLabel(data.period)}; GP: ไม่มีข้อมูล GP1 ครบถ้วนสำหรับขอบเขตนี้`;
  if ("customerCount" in data) return `Period: ${periodLabel(data.period)}; Customers: ${formatNumber(data.customerCount)}; Booking Unit: ${formatNumber(data.bookingUnit)}`;
  if ("bookingUnit" in data) return `Period: ${periodLabel(data.period)}; Booking Unit: ${formatNumber(data.bookingUnit)}; Booking Value: ${formatNumber(data.bookingValue)}`;
  if ("conversionPercent" in data) return `Period: ${periodLabel(data.period)}; Delivered: ${formatNumber(data.delivered)}; Conversion: ${formatPercent(data.conversionPercent)}`;
  if ("target" in data) return `Period: ${periodLabel(data.period)}; Approved Target: ${formatNumber(data.target)}; Actual: ${formatNumber(data.actual)}; Achievement: ${formatPercent(data.achievement)}; Gap: ${formatNumber(data.gap)}`;
  if ("previous" in data && "current" in data) {
    const previous = data.previous as Record<string, unknown>; const current = data.current as Record<string, unknown>;
    return `Previous ${periodLabel(previous.period)}: ${formatNumber(previous.units)} units; Current ${periodLabel(current.period)}: ${formatNumber(current.units)} units; Growth: ${formatPercent(data.growthPercent)}`;
  }
  if ("ranking" in data) return `Snapshot/Period: ${String(data.snapshotDate ?? periodLabel(data.period))}; Ranking: ${formatGroups(data.ranking)}`;
  if ("stockUnit" in data) return `Snapshot: ${String(data.snapshotDate ?? "N/A")}; Stock Unit: ${formatNumber(data.stockUnit)}; Stock Value: ${formatNumber(data.stockValue)}`;
  if ("total" in data && "thresholdDays" in data) return `${intent.startsWith("BOOKING") ? "Booking" : "Stock"} Aging > ${formatNumber(data.thresholdDays)} days; Snapshot: ${String(data.snapshotDate ?? data.referenceDate ?? "N/A")}; Total: ${formatNumber(data.total)}; Models: ${formatGroups(data.models)}`;
  return "ไม่มีข้อมูลสำหรับขอบเขตที่ระบุ";
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
function formatNumber(value: unknown) { const parsed = nullableNumber(value); return parsed === null ? "N/A" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(parsed); }
function formatPercent(value: unknown) { const parsed = nullableNumber(value); return parsed === null ? "N/A" : `${formatNumber(parsed)}%`; }
function number(value: unknown) { return nullableNumber(value) ?? 0; }
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function sum(values: Array<number | null>) { const usable = values.filter((value): value is number => value !== null); return usable.length ? usable.reduce((total, value) => total + value, 0) : null; }
function ageDays(start: string, end: string) { const a = new Date(`${start}T00:00:00Z`).getTime(); const b = new Date(`${end}T00:00:00Z`).getTime(); return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.floor((b - a) / 86_400_000)) : null; }
function localDate(value: Date, timeZone: string) { const parts = dateParts(value, timeZone); return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`; }
function dateParts(value: Date, timeZone: string) { const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value); const get = (type: string) => Number(parts.find((part) => part.type === type)?.value); return { year: get("year"), month: get("month"), day: get("day") }; }
function escapeRegex(value: string) { return value.replace(/[.*+?^$()|[\]\\]/g, "\\$&"); }
function isUnsafeRuntimeQuestion(question: string) { return /\b(?:select|insert|update|delete|alter|drop|create)\b[\s\S]{0,160}\b(?:sql|database|table|ข้อมูล|ยอดขาย|booking|stock)\b|(?:ลบ|แก้ไข|อัปเดต|เปลี่ยน|เพิ่ม)\s*(?:ข้อมูล|ยอดขาย|booking|stock|สต็อก|target|เป้า)?/iu.test(question); }
