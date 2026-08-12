/**
 * KAI Phase 2A Runtime Query Engine.
 *
 * The engine resolves a question from the Phase 1E knowledge tables, parses a
 * read-only query plan stored in kai_query_templates, validates every source
 * and field against kai_data_dictionary, executes parameterized D1 SQL, and
 * formats the result using the response template from knowledge.
 */

export type RuntimeQueryResult = {
  intent: string;
  metric: RuntimeMetric;
  metrics: RuntimeMetric[];
  data: Record<string, unknown>;
  response: {
    template: string;
    text: string;
  };
};

export type RuntimeQueryContext = {
  companyId: string;
  timeZone: string;
  now?: Date;
};

export type RuntimePreparedStatement = {
  bind(...values: unknown[]): RuntimePreparedStatement;
  all<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<{
    results?: T[];
  }>;
};

export type RuntimeQueryDatabase = {
  prepare(query: string): RuntimePreparedStatement;
};

export class KaiRuntimeQueryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "unsupported_question"
      | "knowledge_error"
      | "query_error"
      | "database_unavailable",
    readonly status = code === "unsupported_question" ? 422 : 500,
  ) {
    super(message);
  }
}

type KnowledgeQuestion = {
  question: string;
  intent: string;
  domain: string;
  required_metric: string;
  response_type: string;
};

type KnowledgeAlias = {
  alias_word: string;
  canonical_term: string;
  intent: string;
  domain: string;
};

type KnowledgeMetric = {
  metric_code: string;
  metric_name: string;
  description: string;
  formula: string;
  data_source: string;
  unit_type: string;
};

type KnowledgeQueryTemplate = {
  intent: string;
  purpose: string;
  required_data: string;
  query_logic: string;
};

type KnowledgeResponseTemplate = {
  intent: string;
  response_structure: string;
};

type KnowledgeDictionaryRow = {
  business_name: string;
  table_name: string;
  field_name: string;
  data_type: string;
  description: string;
  domain: string;
};

type RuntimeKnowledge = {
  questions: KnowledgeQuestion[];
  aliases: KnowledgeAlias[];
  metrics: KnowledgeMetric[];
  queries: KnowledgeQueryTemplate[];
  responses: KnowledgeResponseTemplate[];
  dictionary: KnowledgeDictionaryRow[];
};

type QueryPlan = {
  version: 1;
  source: string;
  response_kind: "sales_summary" | "sales_year_compare" | "booking_summary" | "booking_aging" | "stock_aging_model";
  period_mode: "current_month" | "year_compare" | "reference_date";
  date_field?: string;
  filters?: QueryFilter[];
  aggregates?: QueryAggregate[];
  select?: QuerySelect[];
  dedupe_by?: string[];
  limit?: number;
};

type QueryFilter = {
  field: string;
  operator: "equals" | "equals_ci" | "in" | "not_in" | "greater_than" | "age_greater_than_days";
  parameter?: "companyId" | "referenceDate";
  value?: string | number;
  values?: Array<string | number>;
};

type QueryAggregate = {
  alias: string;
  function: "count_star" | "sum" | "sum_real";
  field?: string;
  filters?: QueryFilter[];
};

type QuerySelect = {
  field: string;
  alias?: string;
};

type RuntimeMetric = {
  code: string;
  name: string;
  unitType: string;
  formula: string;
};

type Period = {
  year: number;
  month: number;
  start: string;
  end: string;
  label: string;
};

const MAX_QUERY_ROWS = 5000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function executeKaiRuntimeQuery(
  database: RuntimeQueryDatabase,
  question: string,
  context: RuntimeQueryContext,
): Promise<RuntimeQueryResult> {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) {
    throw new KaiRuntimeQueryError(
      "A question is required.",
      "unsupported_question",
    );
  }
  if (isUnsafeRuntimeQuestion(cleanQuestion)) {
    throw new KaiRuntimeQueryError(
      "Only read-only business questions are supported by the Phase 2A Runtime Query Engine.",
      "unsupported_question",
    );
  }

  const knowledge = await loadKnowledge(database);
  const questionRow = resolveQuestion(cleanQuestion, knowledge);
  if (!questionRow) {
    throw new KaiRuntimeQueryError(
      "This question is not covered by the current KAI Knowledge Layer.",
      "unsupported_question",
    );
  }

  const queryTemplate = knowledge.queries.find((row) => row.intent === questionRow.intent);
  const responseTemplate = knowledge.responses.find((row) => row.intent === questionRow.intent);
  if (!queryTemplate || !responseTemplate) {
    throw new KaiRuntimeQueryError(
      `Knowledge mapping is incomplete for intent ${questionRow.intent}.`,
      "knowledge_error",
    );
  }

  const metrics = resolveMetrics(questionRow.required_metric, knowledge.metrics);
  const plan = parsePlan(queryTemplate.query_logic, questionRow.intent);
  validatePlan(plan, knowledge.dictionary);
  const now = context.now ?? new Date();
  const data = await executePlan(database, plan, cleanQuestion, {
    ...context,
    now,
  });
  const primaryMetric = metrics[0];
  if (!primaryMetric) {
    throw new KaiRuntimeQueryError(
      `No metric is mapped for intent ${questionRow.intent}.`,
      "knowledge_error",
    );
  }

  return {
    intent: questionRow.intent,
    metric: primaryMetric,
    metrics,
    data,
    response: {
      template: responseTemplate.response_structure,
      text: formatResponse(plan.response_kind, data),
    },
  };
}

export function normalizeRuntimeQuestion(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function buildRuntimeSql(
  plan: QueryPlan,
  period: Period | null,
  context: RuntimeQueryContext,
) {
  const selectParts = [
    ...(plan.aggregates ?? []).map((aggregate) => buildAggregate(aggregate)),
    ...(plan.select ?? []).map((selection) => `${quoteIdentifier(selection.field)} AS ${quoteIdentifier(selection.alias ?? selection.field)}`),
  ];
  if (!selectParts.length) {
    throw new KaiRuntimeQueryError(
      `Query plan for ${plan.response_kind} has no selected fields.`,
      "knowledge_error",
    );
  }

  const parameters: unknown[] = [];
  const whereParts: string[] = [];
  for (const filter of plan.filters ?? []) {
    const predicate = buildFilter(filter, parameters, context);
    whereParts.push(predicate);
  }
  if (period && plan.date_field) {
    whereParts.push(`${quoteIdentifier(plan.date_field)} >= ?`);
    parameters.push(period.start);
    whereParts.push(`${quoteIdentifier(plan.date_field)} < ?`);
    parameters.push(period.end);
  }

  const limit = plan.limit === undefined ? undefined : Math.min(MAX_QUERY_ROWS, assertSafeLimit(plan.limit));
  const sql = [
    `SELECT ${selectParts.join(", ")}`,
    `FROM ${quoteIdentifier(plan.source)}`,
    whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "",
    limit === undefined ? "" : `LIMIT ${limit}`,
  ].filter(Boolean).join(" ");
  return { sql, parameters };
}

async function loadKnowledge(database: RuntimeQueryDatabase): Promise<RuntimeKnowledge> {
  try {
    const questions = await readRows<KnowledgeQuestion>(database, "SELECT question, intent, domain, required_metric, response_type FROM kai_question_library");
    const aliases = await readRows<KnowledgeAlias>(database, "SELECT alias_word, canonical_term, intent, domain FROM kai_alias_mapping");
    const metrics = await readRows<KnowledgeMetric>(database, "SELECT metric_code, metric_name, description, formula, data_source, unit_type FROM kai_metrics");
    const queries = await readRows<KnowledgeQueryTemplate>(database, "SELECT intent, purpose, required_data, query_logic FROM kai_query_templates");
    const responses = await readRows<KnowledgeResponseTemplate>(database, "SELECT intent, response_structure FROM kai_response_templates");
    const dictionary = await readRows<KnowledgeDictionaryRow>(database, "SELECT business_name, table_name, field_name, data_type, description, domain FROM kai_data_dictionary");
    return { questions, aliases, metrics, queries, responses, dictionary };
  } catch (error) {
    if (error instanceof KaiRuntimeQueryError) throw error;
    throw new KaiRuntimeQueryError(
      "The local KAI Knowledge Layer is unavailable.",
      "database_unavailable",
      503,
    );
  }
}

async function readRows<T extends Record<string, unknown>>(
  database: RuntimeQueryDatabase,
  query: string,
) {
  const result = await database.prepare(query).all<T>();
  return result.results ?? [];
}

function resolveQuestion(question: string, knowledge: RuntimeKnowledge) {
  const normalized = normalizeRuntimeQuestion(question);
  const exact = knowledge.questions.find((row) => normalizeRuntimeQuestion(row.question) === normalized);
  if (exact) return exact;

  const availableQueryIntents = new Set(knowledge.queries.map((row) => row.intent));
  const aliases = [...knowledge.aliases]
    .filter((row) => availableQueryIntents.has(row.intent))
    .sort((left, right) => normalizeRuntimeQuestion(right.alias_word).length - normalizeRuntimeQuestion(left.alias_word).length);
  const alias = aliases.find((row) => {
    const candidate = normalizeRuntimeQuestion(row.alias_word);
    return candidate === normalized || normalized.includes(candidate);
  });
  if (!alias) return undefined;
  return knowledge.questions.find((row) => row.intent === alias.intent) ?? {
    question,
    intent: alias.intent,
    domain: alias.domain,
    required_metric: "",
    response_type: "summary",
  };
}

function isUnsafeRuntimeQuestion(question: string) {
  return /\b(?:select|insert|update|delete|alter|drop|create)\b[\s\S]{0,160}\b(?:sql|database|table|ข้อมูล|ยอดขาย|booking|stock)\b|(?:ลบ|แก้ไข|อัปเดต|เปลี่ยน|เพิ่ม)\s*(?:ข้อมูล|ยอดขาย|booking|stock|สต็อก|target|เป้า)?/i.test(question);
}

function resolveMetrics(requiredMetric: string, metrics: KnowledgeMetric[]) {
  return requiredMetric
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean)
    .map((code) => metrics.find((metric) => metric.metric_code === code))
    .filter((metric): metric is KnowledgeMetric => Boolean(metric))
    .map((metric) => ({
      code: metric.metric_code,
      name: metric.metric_name,
      unitType: metric.unit_type,
      formula: metric.formula,
    }));
}

function parsePlan(value: string, intent: string): QueryPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new KaiRuntimeQueryError(
      `Query template ${intent} is not an executable Phase 2A plan.`,
      "knowledge_error",
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new KaiRuntimeQueryError(
      `Query template ${intent} is invalid.`,
      "knowledge_error",
    );
  }
  const plan = parsed as Partial<QueryPlan>;
  if (plan.version !== 1 || typeof plan.source !== "string" || typeof plan.response_kind !== "string" || typeof plan.period_mode !== "string") {
    throw new KaiRuntimeQueryError(
      `Query template ${intent} has an unsupported plan version.`,
      "knowledge_error",
    );
  }
  return plan as QueryPlan;
}

function validatePlan(plan: QueryPlan, dictionary: KnowledgeDictionaryRow[]) {
  const mappedFields = new Set(
    dictionary
      .filter((row) => row.table_name === plan.source)
      .map((row) => row.field_name),
  );
  if (!dictionary.some((row) => row.table_name === plan.source)) {
    throw new KaiRuntimeQueryError(
      `Query source ${plan.source} is not mapped in kai_data_dictionary.`,
      "knowledge_error",
    );
  }

  const fields = [
    ...(plan.date_field ? [plan.date_field] : []),
    ...(plan.filters ?? []).map((filter) => filter.field),
    ...(plan.aggregates ?? []).flatMap((aggregate) => [
      ...(aggregate.field ? [aggregate.field] : []),
      ...(aggregate.filters ?? []).map((filter) => filter.field),
    ]),
    ...(plan.select ?? []).map((selection) => selection.field),
    ...(plan.dedupe_by ?? []),
  ];
  const missing = [...new Set(fields)].filter((field) => !mappedFields.has(field));
  if (missing.length) {
    throw new KaiRuntimeQueryError(
      `Query plan uses unmapped fields: ${missing.join(", ")}.`,
      "knowledge_error",
    );
  }
}

async function executePlan(
  database: RuntimeQueryDatabase,
  plan: QueryPlan,
  question: string,
  context: RuntimeQueryContext & { now: Date },
) {
  if (plan.period_mode === "year_compare") {
    const periods = resolveYearComparison(question, context.now, context.timeZone);
    const previousRows = await executeD1Plan(database, plan, periods.previous, context);
    const currentRows = await executeD1Plan(database, plan, periods.current, context);
    return formatYearComparison(previousRows, currentRows, periods);
  }

  const period = plan.period_mode === "current_month"
    ? currentMonthPeriod(context.now, context.timeZone)
    : null;
  const thresholdDays = plan.response_kind === "booking_aging" || plan.response_kind === "stock_aging_model"
    ? resolveAgeThreshold(plan)
    : null;
  const rows = await executeD1Plan(database, plan, period, context);
  if (plan.response_kind === "sales_summary") return formatSalesSummary(rows, period);
  if (plan.response_kind === "booking_summary") return formatBookingSummary(rows, period);
  if (plan.response_kind === "booking_aging") return formatBookingAging(rows, context.now, context.timeZone, thresholdDays);
  if (plan.response_kind === "stock_aging_model") return formatStockAging(rows, plan.dedupe_by ?? [], thresholdDays);
  throw new KaiRuntimeQueryError(
    `Response formatter ${plan.response_kind} is not supported.`,
    "knowledge_error",
  );
}

async function executeD1Plan(
  database: RuntimeQueryDatabase,
  plan: QueryPlan,
  period: Period | null,
  context: RuntimeQueryContext,
) {
  const { sql, parameters } = buildRuntimeSql(plan, period, context);
  try {
    const result = await database.prepare(sql).bind(...parameters).all<Record<string, unknown>>();
    return result.results ?? [];
  } catch (error) {
    throw new KaiRuntimeQueryError(
      error instanceof Error ? `Runtime query failed: ${error.message}` : "Runtime query failed.",
      "query_error",
    );
  }
}

function buildAggregate(aggregate: QueryAggregate) {
  if (aggregate.function === "count_star") return `COUNT(*) AS ${quoteIdentifier(aggregate.alias)}`;
  if (!aggregate.field) {
    throw new KaiRuntimeQueryError(
      `Aggregate ${aggregate.alias} has no field.`,
      "knowledge_error",
    );
  }
  const field = quoteIdentifier(aggregate.field);
  const expression = aggregate.filters?.length
    ? `CASE WHEN ${aggregate.filters.map((filter) => buildStaticFilter(filter)).join(" AND ")} THEN ${field} ELSE ${aggregate.function === "sum_real" ? "NULL" : "0"} END`
    : aggregate.function === "sum_real"
      ? `CAST(${field} AS REAL)`
      : field;
  return `SUM(${aggregate.function === "sum_real" ? `CAST(${expression} AS REAL)` : expression}) AS ${quoteIdentifier(aggregate.alias)}`;
}

function buildFilter(
  filter: QueryFilter,
  parameters: unknown[],
  context: RuntimeQueryContext,
) {
  const field = quoteIdentifier(filter.field);
  if (filter.operator === "age_greater_than_days") {
    const referenceDate = filter.parameter === "referenceDate"
      ? formatDateInTimeZone(context.now ?? new Date(), context.timeZone)
      : filter.value;
    parameters.push(referenceDate, filter.value);
    return `julianday(?) - julianday(${field}) > ?`;
  }
  if (filter.operator === "in" || filter.operator === "not_in") {
    const values = filter.values ?? [];
    if (!values.length) throw new KaiRuntimeQueryError("An IN filter has no values.", "knowledge_error");
    parameters.push(...values);
    return `${field} ${filter.operator === "in" ? "IN" : "NOT IN"} (${values.map(() => "?").join(", ")})`;
  }
  const value = filter.parameter === "companyId"
    ? context.companyId
    : filter.value;
  parameters.push(value);
  if (filter.operator === "equals_ci") return `UPPER(${field}) = UPPER(?)`;
  if (filter.operator === "greater_than") return `${field} > ?`;
  return `${field} = ?`;
}

function buildStaticFilter(filter: QueryFilter) {
  const field = quoteIdentifier(filter.field);
  if (filter.operator === "in" || filter.operator === "not_in") {
    const values = filter.values ?? [];
    if (!values.length) throw new KaiRuntimeQueryError("An aggregate IN filter has no values.", "knowledge_error");
    const literals = values.map((value) => sqlLiteral(value));
    return `${field} ${filter.operator === "in" ? "IN" : "NOT IN"} (${literals.join(", ")})`;
  }
  if (filter.operator === "equals_ci") return `UPPER(${field}) = UPPER(${sqlLiteral(filter.value)})`;
  return `${field} = ${sqlLiteral(filter.value)}`;
}

function sqlLiteral(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function quoteIdentifier(value: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new KaiRuntimeQueryError(`Unsafe query identifier: ${value}.`, "knowledge_error");
  }
  return `"${value}"`;
}

function assertSafeLimit(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new KaiRuntimeQueryError("Query limit is invalid.", "knowledge_error");
  }
  return value;
}

function currentMonthPeriod(now: Date, timeZone: string) {
  const parts = dateParts(now, timeZone);
  return makePeriod(parts.year, parts.month);
}

function resolveYearComparison(question: string, now: Date, timeZone: string) {
  const explicit = question.match(/เดือน\s*(\d{1,2})\s*ปี\s*(\d{4})/i);
  const nowParts = dateParts(now, timeZone);
  const month = explicit ? Number(explicit[1]) : nowParts.month;
  const previousYear = explicit ? Number(explicit[2]) : nowParts.year - 1;
  const currentYear = nowParts.year;
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(previousYear)) {
    throw new KaiRuntimeQueryError(
      "The comparison month and year could not be resolved.",
      "unsupported_question",
    );
  }
  return {
    previous: makePeriod(previousYear, month),
    current: makePeriod(currentYear, month),
  };
}

function makePeriod(year: number, month: number): Period {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { year, month, start, end, label: `${year}-${String(month).padStart(2, "0")}` };
}

function dateParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function formatDateInTimeZone(value: Date, timeZone: string) {
  const parts = dateParts(value, timeZone);
  const date = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  if (!ISO_DATE_PATTERN.test(date)) throw new KaiRuntimeQueryError("The reference date is invalid.", "query_error");
  return date;
}

function formatSalesSummary(rows: Array<Record<string, unknown>>, period: Period | null) {
  const row = rows[0] ?? {};
  return {
    period: period ? { start: period.start, end: period.end, label: period.label } : null,
    salesUnit: numberOrZero(row.sales_unit),
    salesValue: numberOrNull(row.sales_value),
  };
}

function formatBookingSummary(rows: Array<Record<string, unknown>>, period: Period | null) {
  const row = rows[0] ?? {};
  return {
    period: period ? { start: period.start, end: period.end, label: period.label } : null,
    bookingUnit: numberOrZero(row.booking_unit),
    bookingValue: numberOrNull(row.booking_value),
  };
}

function resolveAgeThreshold(plan: QueryPlan) {
  const thresholdFilter = (plan.filters ?? []).find((filter) =>
    filter.operator === "age_greater_than_days" ||
    (filter.field === "stock_age_days" && filter.operator === "greater_than"),
  );
  const threshold = numberOrNull(thresholdFilter?.value);
  if (threshold === null || threshold < 0) {
    throw new KaiRuntimeQueryError(
      `Query plan for ${plan.response_kind} has no valid aging threshold.`,
      "knowledge_error",
    );
  }
  return threshold;
}

function formatYearComparison(
  previousRows: Array<Record<string, unknown>>,
  currentRows: Array<Record<string, unknown>>,
  periods: { previous: Period; current: Period },
) {
  const previous = previousRows[0] ?? {};
  const current = currentRows[0] ?? {};
  const previousUnit = numberOrZero(previous.sales_unit);
  const currentUnit = numberOrZero(current.sales_unit);
  const previousValue = numberOrNull(previous.sales_value);
  const currentValue = numberOrNull(current.sales_value);
  return {
    previousYear: { year: periods.previous.year, period: periods.previous.label, salesUnit: previousUnit, salesValue: previousValue },
    currentYear: { year: periods.current.year, period: periods.current.label, salesUnit: currentUnit, salesValue: currentValue },
    difference: {
      salesUnit: currentUnit - previousUnit,
      salesValue: previousValue === null || currentValue === null ? null : currentValue - previousValue,
    },
    growthPercent: {
      salesUnit: growthPercent(previousUnit, currentUnit),
      salesValue: previousValue === null || currentValue === null ? null : growthPercent(previousValue, currentValue),
    },
  };
}

function formatBookingAging(rows: Array<Record<string, unknown>>, now: Date, timeZone: string, thresholdDays: number | null) {
  if (thresholdDays === null) throw new KaiRuntimeQueryError("Booking aging threshold is unavailable.", "knowledge_error");
  const referenceDate = formatDateInTimeZone(now, timeZone);
  const enriched = rows.map((row) => ({
    ...row,
    age_days: calculateAgeDays(String(row.booking_date ?? ""), referenceDate),
  }));
  return {
    referenceDate,
    total: enriched.length,
    models: groupAgingRows(enriched, "model"),
    branches: groupAgingRows(enriched, "branch"),
    thresholdDays,
  };
}

function formatStockAging(rows: Array<Record<string, unknown>>, dedupeBy: string[], thresholdDays: number | null) {
  if (thresholdDays === null) throw new KaiRuntimeQueryError("Stock aging threshold is unavailable.", "knowledge_error");
  const uniqueRows = deduplicateRows(rows, dedupeBy);
  return {
    thresholdDays,
    total: uniqueRows.length,
    models: groupAgingRows(uniqueRows, "model", "aging_days"),
  };
}

function groupAgingRows(
  rows: Array<Record<string, unknown>>,
  groupField: string,
  ageField = "age_days",
) {
  const groups = new Map<string, { model: string; quantity: number; agingDays: number | null }>();
  for (const row of rows) {
    const label = String(row[groupField] ?? "ไม่ระบุ").trim() || "ไม่ระบุ";
    const current = groups.get(label) ?? { model: label, quantity: 0, agingDays: null };
    const age = numberOrNull(row[ageField]);
    current.quantity += 1;
    current.agingDays = age === null ? current.agingDays : Math.max(current.agingDays ?? 0, age);
    groups.set(label, current);
  }
  return [...groups.values()].sort((left, right) => right.quantity - left.quantity || left.model.localeCompare(right.model));
}

function deduplicateRows(rows: Array<Record<string, unknown>>, fields: string[]) {
  if (!fields.length) return rows;
  const seen = new Set<string>();
  return rows.filter((row) => {
    const keys = fields.flatMap((field) => {
      const value = normalizePhysicalValue(row[field]);
      return value ? [`${field}:${value}`] : [];
    });
    if (!keys.length) return true;
    const duplicate = keys.some((key) => seen.has(key));
    keys.forEach((key) => seen.add(key));
    return !duplicate;
  });
}

function normalizePhysicalValue(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^(?:|0|NA|N\/A|NONE|NULL|UNKNOWN)$/.test(normalized) ? "" : normalized;
}

function calculateAgeDays(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000));
}

function formatResponse(kind: QueryPlan["response_kind"], data: Record<string, unknown>) {
  if (kind === "sales_summary") {
    return `Period: ${periodLabel(data.period)}; Sales Unit: ${formatNumber(data.salesUnit)}; Sales Value: ${formatNumber(data.salesValue)}`;
  }
  if (kind === "sales_year_compare") {
    const previous = data.previousYear as Record<string, unknown>;
    const current = data.currentYear as Record<string, unknown>;
    const difference = data.difference as Record<string, unknown>;
    const growth = data.growthPercent as Record<string, unknown>;
    return `Previous Year ${previous.year}: ${formatNumber(previous.salesUnit)} units; Current Year ${current.year}: ${formatNumber(current.salesUnit)} units; Difference: ${formatNumber(difference.salesUnit)} units; Growth: ${formatPercent(growth.salesUnit)}`;
  }
  if (kind === "booking_summary") {
    return `Period: ${periodLabel(data.period)}; Booking Unit: ${formatNumber(data.bookingUnit)}; Booking Value: ${formatNumber(data.bookingValue)}`;
  }
  if (kind === "booking_aging") {
    return `Booking Aging > ${formatNumber(data.thresholdDays)} days; Total: ${formatNumber(data.total)}; Models: ${formatGroupSummary(data.models)}; Branches: ${formatGroupSummary(data.branches)}`;
  }
  return `Stock Aging > ${formatNumber(data.thresholdDays)} days; Total: ${formatNumber(data.total)}; Models: ${formatGroupSummary(data.models)}`;
}

function periodLabel(value: unknown) {
  if (!value || typeof value !== "object") return "N/A";
  return String((value as Record<string, unknown>).label ?? "N/A");
}

function formatGroupSummary(value: unknown) {
  if (!Array.isArray(value) || !value.length) return "ไม่มีข้อมูล";
  return value.map((item) => {
    const row = item as Record<string, unknown>;
    const age = row.agingDays === null || row.agingDays === undefined ? "" : `, max age ${row.agingDays} days`;
    return `${row.model}: ${row.quantity}${age}`;
  }).join("; ");
}

function formatNumber(value: unknown) {
  const number = numberOrNull(value);
  return number === null ? "N/A" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number);
}

function formatPercent(value: unknown) {
  const number = numberOrNull(value);
  return number === null ? "N/A" : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number)}%`;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value: unknown) {
  return numberOrNull(value) ?? 0;
}

function growthPercent(previous: number, current: number) {
  return previous === 0 ? null : ((current - previous) / previous) * 100;
}
