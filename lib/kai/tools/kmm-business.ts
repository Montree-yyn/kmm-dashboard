import { adaptBookingRow, adaptStockRow } from "../../operations/adapters";
import { listBookingTransactions, listStockTransactions } from "../../operations/repository";
import {
  getBookingByProduct,
  getBookingValue,
  getDepositAmount,
  getOpenBookingUnit,
  normalizeBookingProduct,
  type BookingFilters,
} from "../../dashboard/booking-selectors";
import {
  getCurrentStockRows,
  getStockByProduct,
  getStockUnit,
  getStockValue,
  normalizeProductType,
} from "../../dashboard/stock-selectors";
import { canonicalDailyBranch } from "../../daily-management/branch";
import type { StockAdapterRow } from "../../operations/types";
import { toCanonicalSalesRow } from "../../sales/compatibility-adapter";
import { filterSalesRows, getProductSummary, getSalesKpis } from "../../sales/business-service";
import type { SalesFilterInput } from "../../sales/types";
import { listSalesTransactions } from "../../sales/repository";
import { getHeatmapSalesAreaAggregate } from "../../marketing/sales-area-service";
import { getCompanyMonthlyTarget, targetProgress } from "../../targets/business-service";
import type { TargetMetric, TargetProductGroup } from "../../targets/types";
import { buildExecutiveSnapshot, canEvaluateFullPeriodTarget, deriveExecutiveSignals, executiveRecommendations, groupExecutiveSignals, rankExecutivePriorities, selectExecutiveSignalGroups, type ExecutiveSignal, type ExecutiveSignalGroup } from "../executive-intelligence";
import { composeExecutiveNarrative } from "../executive-narrative";
import { evaluateExecutiveAlerts } from "../executive-alerts";
import { composeExecutiveBriefing } from "../executive-briefing";
import type { KaiTool, KaiToolOutput } from "./types";

type ProductGroup = "TT" | "CH" | "EX" | "TP" | "MAX" | "IM" | "IMO" | "OT";
type BusinessArea = "sales" | "booking" | "stock";
type DateRange =
  | {
      kind: "dateRange";
      start: string;
      end: string;
      label: string;
      scopeLabel: string;
      defaultedCurrentYear?: boolean;
    }
  | {
      kind: "monthAcrossYears";
      month: number;
      label: string;
      scopeLabel: string;
    };

const MONTH_REFERENCES = [
  { month: 1, thai: "มกราคม", thaiAliases: ["ม.ค.", "มค"], english: ["january", "jan"] },
  { month: 2, thai: "กุมภาพันธ์", thaiAliases: ["ก.พ.", "กพ"], english: ["february", "feb"] },
  { month: 3, thai: "มีนาคม", thaiAliases: ["มี.ค.", "มีค"], english: ["march", "mar"] },
  { month: 4, thai: "เมษายน", thaiAliases: ["เม.ย.", "เมย"], english: ["april", "apr"] },
  { month: 5, thai: "พฤษภาคม", thaiAliases: ["พ.ค.", "พค"], english: ["may"] },
  { month: 6, thai: "มิถุนายน", thaiAliases: ["มิ.ย.", "มิย"], english: ["june", "jun"] },
  { month: 7, thai: "กรกฎาคม", thaiAliases: ["ก.ค.", "กค"], english: ["july", "jul"] },
  { month: 8, thai: "สิงหาคม", thaiAliases: ["ส.ค.", "สค"], english: ["august", "aug"] },
  { month: 9, thai: "กันยายน", thaiAliases: ["ก.ย.", "กย"], english: ["september", "sep", "sept"] },
  { month: 10, thai: "ตุลาคม", thaiAliases: ["ต.ค.", "ตค"], english: ["october", "oct"] },
  { month: 11, thai: "พฤศจิกายน", thaiAliases: ["พ.ย.", "พย"], english: ["november", "nov"] },
  { month: 12, thai: "ธันวาคม", thaiAliases: ["ธ.ค.", "ธค"], english: ["december", "dec"] },
] as const;

const AUTH_BYPASS_REQUEST = /(ignore (all )?permissions|ignore.*สิทธิ|ข้ามสิทธิ|bypass (?:authorization|permission)|เปลี่ยนบริษัท|change company|switch company)/i;
const PII_REQUEST = /(raw (sales )?rows|raw database|customer (phone|name|address)|เบอร์.*ลูกค้า|โทรศัพท์.*ลูกค้า|ข้อมูลลูกค้า|รายการ.*ดิบ)/i;
const SQL_REQUEST = /(?:\b(?:select|insert|update|delete|alter|drop|create)\b[\s\S]{0,160}\b(?:sales_transactions|booking_transactions|stock_transactions|kmm)\b|\brun\s+(?:select|sql)\b|\bquery\s+(?:the )?(?:database|db)\b|\b(?:sql|database)\b[\s\S]{0,120}\b(?:kmm|sales|booking|stock)\b|(?:รัน|เขียน|ขอ).*sql|sql.*(?:kmm|ยอดขาย|จอง|stock|สต็อก))/i;
const MUTATION_REQUEST = /(?:\b(?:delete|update|insert|alter|drop|create)\b|\b(?:change|approve|import|overwrite)\s+target\b|\bchange\s+(?:gp|sales|booking|stock)\b|ลบ(?:ข้อมูล|ยอดขาย|booking|stock|สต็อก)|แก้(?:ไข)?(?:\s*(?:gp|ยอดขาย|booking|stock|สต็อก|target|เป้า))|เปลี่ยน\s*(?:target|เป้า)|อัปเดต(?:ยอดขาย|booking|stock|สต็อก|target|เป้า)|เพิ่ม(?:ข้อมูล|ยอดขาย|booking|stock|สต็อก))/i;
const TARGET_REQUEST = /(\btarget\b|เป้า|achievement|gap)/i;
const SALESPERSON_REQUEST = /(salesperson|salesman|พนักงานขาย|เซลส์|ใครขายสูงสุด|จัดอันดับ.*ขาย|ยอดขายของ\s*[A-Za-zก-๙])/i;
const SALES_REQUEST = /(ยอดขาย|พื้นที่ขาย|sales|ขายได้|ขาย(?:สูงสุด|ดีที่สุด|มากที่สุด|น้อยที่สุด|ดี|ไม่ดี|เพิ่ม|ลด)|\bgp\b|gross profit|กำไรขั้นต้น)/i;
const BOOKING_REQUEST = /(booking|ยอดจอง|รับจอง)/i;
const STOCK_REQUEST = /(stock|สต็อก|inventory|เหลือกี่คัน)/i;
const EXECUTIVE_REQUEST = /(สรุปสถานการณ์|วิเคราะห์(?:ละเอียด)?|น่ากังวล|อะไรดีขึ้น|สินค้าไหน(?:ต้องเร่ง|ควรโฟกัส)|สาขาไหน(?:ต้องจับตา|ควรจับตา)|stock.*ขายช้า|booking.*เป็นอย่างไร|gp.*(?:ปัญหา|เป็นยังไง)|เทียบ.*target|ผู้บริหาร.*โฟกัส|ขอรายละเอียดเพิ่ม|ทำไม.*(?:ต้องเร่ง|stock|gp|ยอดขาย.*ลด)|สัปดาห์นี้.*โฟกัส|executive|management focus|what improved|what.*concern|stock.*slow|which product|which branch|why.*(?:stock|gp|sales.*down))/i;
const BUSINESS_ASSESSMENT_REQUEST = /(จุดแข็ง|จุดอ่อน|ข้อได้เปรียบ|ข้อควรปรับปรุง|วิเคราะห์.*(?:ธุรกิจ|ภาพรวม)|business assessment|strengths?.*weakness|weakness(?:es)?.*strength|swot)/i;
const BUSINESS_COMPARISON_REQUEST = /(?:(?:เปรียบเทียบ|เทียบ).*(?:ยอดขาย|booking|ยอดจอง|stock|สต็อก|gp|กำไร|สาขา|สินค้า)|compare.*(?:sales|booking|stock|gp|gross profit|branch|product))/i;
const SALES_MONTH_COMPARISON_REQUEST = /(?:(?:ยอดขาย|sales).*(?:เทียบ|เปรียบเทียบ).*(?:เดือนก่อน|เดือนที่แล้ว|previous month|last month)|(?:เทียบ|เปรียบเทียบ).*(?:ยอดขาย|sales).*(?:เดือนก่อน|เดือนที่แล้ว|previous month|last month))/i;
const HIGH_STOCK_LOW_SALES_REQUEST = /(?:(?:stock|สต็อก).*(?:สูง|มาก).*(?:ยอดขาย|sales).*(?:ต่ำ|น้อย)|(?:ยอดขาย|sales).*(?:ต่ำ|น้อย).*(?:stock|สต็อก).*(?:สูง|มาก))/i;
const ALERT_REQUEST = /(alert|แจ้งเตือน|ต้องระวัง|เรื่องด่วน|อะไรต้องระวัง|เตือนเรื่อง)/i;
const BRIEFING_REQUEST = /(สรุปวันนี้|วันนี้เป็นอย่างไร|daily briefing|สรุปสัปดาห์นี้|weekly briefing|สรุปเดือนนี้|executive briefing|สรุปให้ผู้บริหาร|สัปดาห์นี้มีอะไรสำคัญ|เดือนนี้ควรโฟกัสอะไร|มีอะไรเปลี่ยนแปลง|สรุปเดือน.*สำหรับผู้บริหาร|แบบละเอียด)/i;
const BUSINESS_CONTEXT = /(kmm|เดือนนี้|เดือนก่อน|เดือนที่แล้ว|วันนี้|เมื่อวาน|ตอนนี้|ปัจจุบัน|สัปดาห์นี้|ปีนี้|this month|last month|previous month|this year|by branch|tractor|combine|excavator|transplanter|สรุป)/i;
const SALES_AREA_TREND_REQUEST = /(?:(?:พื้นที่ขาย|township|sales\s*area).*(?:ยอดขาย|sales).*(?:ลดลงเรื่อย|ลดลงต่อเนื่อง|ลดลงทุกปี|declin|decreas)|(?:ยอดขาย|sales).*(?:ลดลงเรื่อย|ลดลงต่อเนื่อง|ลดลงทุกปี|declin|decreas).*(?:พื้นที่ขาย|township|sales\s*area))/i;
const SALES_AREA_RANKING_REQUEST = /(?:(?:พื้นที่ขาย|township|sales\s*area).*(?:เยอะที่สุด|มากที่สุด|สูงสุด|อันดับ|top)|(?:อันดับ|top).*(?:พื้นที่ขาย|township|sales\s*area))/i;
const SALES_BRANCH_RANKING_REQUEST = /(?:(?:สาขา|branch).*(?:เยอะที่สุด|มากที่สุด|สูงสุด|อันดับ|top)|(?:อันดับ|top).*(?:สาขา|branch))/i;

export const kmmBusinessTool: KaiTool = {
  id: "kmmBusiness",
  matches: isKmmBusinessQuestion,
  async execute(context) {
    const security = getKmmSecurityRequestKind(context.message);
    if (security) return securityOutput(security, context.message);
    if (SALESPERSON_REQUEST.test(context.message)) return unavailableOutput("salesperson", context.message);
    if (!context.businessAccess) return accessDeniedOutput(context.message);
    const companyCode = context.businessAccess.companyCode;
    const timeZone = context.businessAccess.timeZone;
    if (
      companyCode !== "KMM"
      && (
        SALES_AREA_RANKING_REQUEST.test(context.message)
        || SALES_AREA_TREND_REQUEST.test(context.message)
        || BRIEFING_REQUEST.test(context.message)
        || ALERT_REQUEST.test(context.message)
        || isExecutiveQuestion(context.message)
      )
    ) {
      return unavailableOutput("business", context.message, companyCode);
    }
    if (isTargetBusinessQuestion(context.message)) return getTargetAnswer(context);
    if (BRIEFING_REQUEST.test(context.message)) return getBriefingAnswer(context);
    if (ALERT_REQUEST.test(context.message)) return getAlertAnswer(context);
    if (isExecutiveQuestion(context.message)) return getExecutiveAnswer(context);

    const areas = selectedAreas(context.message);
    if (!areas.length) return unavailableOutput("business", context.message, companyCode);
    const range = resolveKmmDateRange(context.message, context.now, timeZone);
    const product = resolveProduct(context.message);
    const comparePreviousMonth = wantsPreviousMonthComparison(context.message);
    const results = await Promise.all(areas.map((area) => {
      if (area === "sales" && (SALES_AREA_RANKING_REQUEST.test(context.message) || SALES_AREA_TREND_REQUEST.test(context.message))) return getSalesAreaAggregate(range, product);
      if (area === "sales") return getSalesAggregate(context.businessAccess!.companyId, range, product);
      if (area === "booking") return getBookingAggregate(context.businessAccess!.companyId, range, product);
      return getStockAggregate(context.businessAccess!.companyId, product, range);
    }));
    if (comparePreviousMonth && areas.includes("sales")) {
      results.push(await getSalesAggregate(
        context.businessAccess.companyId,
        previousMonthRange(context.now, timeZone),
        product,
      ));
    }
    const data = { source: `${companyCode} Internal Data`, range, results };
    return { answer: formatBusinessAnswer(context.message, data, companyCode, context.businessAccess.currency), data };
  },
};

export function isKmmBusinessQuestion(message: string) {
  if (isKmmSecurityRequest(message) || isTargetBusinessQuestion(message) || SALESPERSON_REQUEST.test(message)) return true;
  if (SALES_AREA_TREND_REQUEST.test(message)) return true;
  if (isExecutiveQuestion(message) || ALERT_REQUEST.test(message) || BRIEFING_REQUEST.test(message)) return true;
  if (/(stock market|ตลาดหุ้น)/i.test(message)) return false;
  return (BUSINESS_CONTEXT.test(message) || hasNamedMonthReference(message))
    && (SALES_REQUEST.test(message) || BOOKING_REQUEST.test(message) || STOCK_REQUEST.test(message));
}

export function isExecutiveQuestion(message: string) {
  return EXECUTIVE_REQUEST.test(message)
    || BUSINESS_ASSESSMENT_REQUEST.test(message)
    || BUSINESS_COMPARISON_REQUEST.test(message)
    || HIGH_STOCK_LOW_SALES_REQUEST.test(message);
}

async function getAlertAnswer(context: Parameters<KaiTool["execute"]>[0]): Promise<KaiToolOutput> {
  const range = resolveKmmDateRange(context.message, context.now, context.businessAccess!.timeZone);
  if (range.kind !== "dateRange") return unavailableOutput("business", context.message);
  const comparisonScope = resolveExecutiveComparableScope(range, context.now, context.businessAccess!.timeZone);
  const snapshot = await buildExecutiveSnapshot(context.businessAccess!.companyId, comparisonScope.period, comparisonScope.previous, context.now);
  const alerts = evaluateExecutiveAlerts(snapshot, deriveExecutiveSignals(snapshot), context.now.toISOString(), comparisonScope.partial ? "MTD" : "COMPLETED");
  const selected = resolveProduct(context.message); const visible = selected ? alerts.filter((alert) => alert.subject.includes(selected)) : alerts;
  const lines = ["Executive Alerts"];
  for (const level of ["CRITICAL", "WARNING", "WATCH", "POSITIVE"] as const) {
    const group = visible.filter((alert) => alert.severity === level); if (group.length) lines.push(`${level} (${group.length})`, ...group.map((alert) => `• ${alert.summary}`));
  }
  if (!visible.length) lines.push("No deterministic alerts for this scope.");
  const source = `${context.businessAccess!.companyCode} Internal Data`;
  lines.push(`ข้อมูล ณ: ${comparisonScope.period.scopeLabel}`, `แหล่งข้อมูล: ${source}`);
  return { answer: lines.join("\n"), data: { source, alerts: visible, period: comparisonScope.period.scopeLabel } };
}

async function getBriefingAnswer(context: Parameters<KaiTool["execute"]>[0]): Promise<KaiToolOutput> {
  const weekly = executiveWeekScope(context.message, context.now, context.businessAccess!.timeZone); const range = weekly?.period ?? resolveKmmDateRange(context.message, context.now, context.businessAccess!.timeZone);
  if (range.kind !== "dateRange") return unavailableOutput("business", context.message);
  const mode = weekly ? "weekly" : /(วันนี้|daily)/i.test(context.message) ? "daily" : "monthly";
  const comparisonScope = weekly
    ? { period: { start: range.start, end: range.end, scopeLabel: range.scopeLabel }, previous: weekly.previous, partial: false }
    : resolveExecutiveComparableScope(range, context.now, context.businessAccess!.timeZone);
  const isMtd = mode === "monthly" && comparisonScope.partial;
  const snapshot = await buildExecutiveSnapshot(context.businessAccess!.companyId, comparisonScope.period, comparisonScope.previous, context.now);
  const status = weekly ? "WEEKLY" : mode === "daily" ? "DAILY" : isMtd ? "MTD" : "COMPLETED";
  const signals = deriveExecutiveSignals(snapshot);
  const alerts = evaluateExecutiveAlerts(snapshot, signals, context.now.toISOString(), status);
  const groups = groupExecutiveSignals(signals);
  const recommendations = executiveRecommendations(snapshot, groups);
  return { answer: composeExecutiveBriefing(snapshot, alerts, recommendations, mode, isMtd), data: { source: `${context.businessAccess!.companyCode} Internal Data`, briefing: mode, mtd: isMtd, alerts } };
}

/** Security routing runs before access resolution and before every data tool. */
export function isKmmSecurityRequest(message: string) {
  return getKmmSecurityRequestKind(message) !== null;
}

export function getKmmSecurityRequestKind(message: string): "sql" | "mutation" | "pii" | "authorization" | null {
  if (AUTH_BYPASS_REQUEST.test(message)) return "authorization";
  if (PII_REQUEST.test(message)) return "pii";
  if (SQL_REQUEST.test(message)) return "sql";
  if (MUTATION_REQUEST.test(message)) return "mutation";
  return null;
}

function isTargetBusinessQuestion(message: string) {
  // Keep the pre-existing Calculator intent (for example, "150 จากเป้า 270")
  // deterministic and separate from a request for KMM target data.
  return TARGET_REQUEST.test(message)
    && !/\d[\d,]*(?:\.\d+)?\s*(?:จากเป้า(?:หมาย)?|out of)\s*\d/i.test(message);
}

type TargetIntent = {
  metric: TargetMetric;
  productGroup: TargetProductGroup;
  requestedSeparateExOrTp: boolean;
  branchRequested: boolean;
  wantsActualComparison: boolean;
};

export function resolveTargetIntent(message: string): TargetIntent {
  const product = resolveProduct(message);
  const metric: TargetMetric = /(?:revenue|sales\s*value|มูลค่า(?:ยอด)?ขาย|ยอดขาย.*(?:บาท|มูลค่า))/i.test(message)
    ? "SALES_REVENUE"
    : /(?:gp1|gross profit|กำไรขั้นต้น)/i.test(message)
      ? "GP1"
      : "SALES_UNITS";
  return {
    metric,
    productGroup: product === "TT" ? "TT" : product === "CH" ? "CH" : product === "EX" || product === "TP" ? "EX_TP" : "",
    requestedSeparateExOrTp: product === "EX" || product === "TP",
    branchRequested: /\bKMM0[123]\b|(?:สาขา|branch)\s*[A-Z0-9-]+/i.test(message),
    wantsActualComparison: /(?:achievement|gap|ทำยอด.*(?:%|เป้า)|ได้กี่\s*%|เหลือกี่|ส่วนต่าง)/i.test(message),
  };
}

async function getTargetAnswer(context: Parameters<KaiTool["execute"]>[0]): Promise<KaiToolOutput> {
  const thai = /[\u0e00-\u0e7f]/.test(context.message);
  const companyCode = context.businessAccess!.companyCode;
  const currency = context.businessAccess!.currency;
  const targetSource = `${companyCode} Approved Target`;
  const intent = resolveTargetIntent(context.message);
  if (intent.branchRequested) {
    return { answer: thai ? "ยังไม่มี Target ระดับสาขาในแหล่งข้อมูลปัจจุบัน" : "Branch-level Targets are not available in the current approved source.", data: { unavailable: "branch_target", source: targetSource } };
  }
  if (intent.requestedSeparateExOrTp) {
    return { answer: thai ? "Target ในแหล่งข้อมูลปัจจุบันรวม Excavator และ Rice Transplanter เป็น EX&TP จึงยังไม่มี Target แยกรายสินค้า" : "The approved source combines Excavator and Rice Transplanter as EX&TP, so separate product Targets are unavailable.", data: { unavailable: "separate_ex_tp_target", source: targetSource } };
  }
  const range = resolveKmmDateRange(context.message, context.now, context.businessAccess!.timeZone);
  if (range.kind !== "dateRange" || range.start.slice(0, 7) !== range.end.slice(0, 7)) {
    return { answer: thai ? "กรุณาระบุเดือนและปีเดียวสำหรับ Target เนื่องจาก Target ต้องใช้ขอบเขตเดือนที่แน่นอน" : "Please specify one calendar month and year for Target data; targets require an exact monthly scope.", data: { unavailable: "target_scope", source: targetSource } };
  }
  const year = Number(range.start.slice(0, 4));
  const month = Number(range.start.slice(5, 7));
  const target = await getCompanyMonthlyTarget({ companyId: context.businessAccess!.companyId, year, month, metric: intent.metric, productGroup: intent.productGroup });
  if (!target) return unavailableOutput("target", context.message, context.businessAccess!.companyCode);
  const actual = intent.wantsActualComparison
    ? await getSalesAggregate(context.businessAccess!.companyId, range, intent.productGroup === "TT" ? "TT" : intent.productGroup === "CH" ? "CH" : null)
    : null;
  const actualValue = actual
    ? intent.metric === "SALES_REVENUE" ? actual.salesValue : intent.metric === "GP1" ? actual.grossProfit : actual.units
    : null;
  const progress = actualValue === null ? null : targetProgress(actualValue, target.target);
  const sourceLabel = `${targetSource} · ${target.sourceVersion}`;
  const metricLabel = target.metric === "SALES_REVENUE" ? (thai ? "Target Revenue" : "Revenue Target") : target.metric === "GP1" ? "GP1 Target" : (thai ? "Target Sales" : "Sales Target");
  const unit = target.metric === "SALES_UNITS" ? (thai ? " คัน" : " units") : "";
  const lines = [
    `${companyCode} · ${formatDateScope(range, thai)}`,
    `• ${metricLabel}: ${target.metric === "SALES_UNITS" ? formatNumber(target.target) : `${formatMoney(target.target)} ${currency}`}${unit}`,
  ];
  const targetEvaluationEligible = canEvaluateFullPeriodTarget(range, context.now);
  if (actualValue !== null && progress) {
    lines.push(`• ${thai ? "ผลงานจริง" : "Actual"}: ${target.metric === "SALES_UNITS" ? formatNumber(actualValue) : `${formatMoney(actualValue)} ${currency}`}${unit}`);
    if (targetEvaluationEligible) {
      lines.push(`• ${thai ? "Achievement" : "Achievement"}: ${formatNumber(progress.achievementPercent)}%`);
      lines.push(`• Gap: ${target.metric === "SALES_UNITS" ? formatNumber(progress.gap) : `${formatMoney(progress.gap)} ${currency}`}${unit}`);
    } else {
      lines.push(thai ? "• งวดยังไม่สิ้นสุด: Target แสดงเป็นข้อมูลประกอบเท่านั้น ยังไม่ประเมินผลทั้งเดือน" : "• Period incomplete: Target is context only; full-period performance is not evaluated.");
    }
    lines.push(`${thai ? "ข้อมูลจริง" : "Actual source"}: ${companyCode} Internal Data`);
  }
  lines.push(`${thai ? "เป้าหมาย" : "Target source"}: ${sourceLabel}`);
  return { answer: lines.join("\n"), data: { target, actual: actualValue, progress, source: targetSource, range } };
}

async function getExecutiveAnswer(context: Parameters<KaiTool["execute"]>[0]): Promise<KaiToolOutput> {
  const thai = /[\u0e00-\u0e7f]/.test(context.message);
  const weekly = executiveWeekScope(context.message, context.now, context.businessAccess!.timeZone);
  const range = weekly?.period ?? resolveKmmDateRange(context.message, context.now, context.businessAccess!.timeZone);
  if (range.kind !== "dateRange" || range.start.slice(0, 7) !== range.end.slice(0, 7)) {
    return { answer: thai ? "ข้อมูลยังไม่เพียงพอสำหรับสรุป Executive Intelligence ในขอบเขตนี้ กรุณาระบุเดือนและปีเดียว" : "Executive Intelligence requires one explicit calendar month and year for this scope.", data: { unavailable: "executive_scope" } };
  }
  const comparisonScope = weekly
    ? { period: { start: range.start, end: range.end, scopeLabel: range.scopeLabel }, previous: weekly.previous, partial: false }
    : resolveExecutiveComparableScope(range, context.now, context.businessAccess!.timeZone);
  const effectiveRange: DateRange = {
    ...range,
    start: comparisonScope.period.start,
    end: comparisonScope.period.end,
    scopeLabel: comparisonScope.period.scopeLabel,
  };
  const snapshot = await buildExecutiveSnapshot(context.businessAccess!.companyId, comparisonScope.period, comparisonScope.previous, context.now);
  const signals = deriveExecutiveSignals(snapshot);
  const priorities = rankExecutivePriorities(signals);
  const groups = groupExecutiveSignals(signals);
  const recommendations = executiveRecommendations(snapshot, groups);
  const mode = resolveExecutiveAnalysisMode(context.message);
  const source = `${context.businessAccess!.companyCode} Internal Data`;
  if (mode === "assessment") return executiveAssessmentAnswer(snapshot, groups, recommendations, effectiveRange, thai, source, comparisonScope.partial);
  if (mode === "comparison") return executiveComparisonAnswer(snapshot, effectiveRange, thai, source, comparisonScope.partial);
  if (mode === "why") return executiveWhyAnswer(context.message, snapshot, signals, priorities, effectiveRange, thai);
  if (mode === "product") return executiveProductAnswer(snapshot, signals, effectiveRange, thai);
  if (mode === "branch") return executiveBranchAnswer(snapshot, effectiveRange, thai);
  const hasPrior = snapshot.priorSales.units > 0 || snapshot.priorBooking.units > 0;
  const lines = [thai ? "Executive Summary" : "Executive Summary", `• ${thai ? "Sales" : "Sales"}: ${formatNumber(snapshot.sales.units)} ${thai ? "คัน" : "units"} · ${formatMoney(snapshot.sales.value)}`, `• ${thai ? "กำไรขั้นต้น" : "Gross Profit"}: ${formatMoney(snapshot.sales.gp)}${snapshot.sales.gpPercent === null ? "" : ` · ${formatNumber(snapshot.sales.gpPercent)}%`}`, `• ${thai ? "Booking" : "Booking"}: ${formatNumber(snapshot.booking.units)} ${thai ? "คัน" : "units"} · ${formatMoney(snapshot.booking.value)}`, `• ${thai ? "Stock" : "Stock"}: ${formatNumber(snapshot.stock.units)} ${thai ? "คัน" : "units"} · ${formatMoney(snapshot.stock.value)}`];
  if (snapshot.target && snapshot.progress) lines.push(snapshot.targetEvaluationEligible
    ? `• ${thai ? "Target" : "Target"}: ${formatNumber(snapshot.target.target)} ${thai ? "คัน" : "units"} · ${formatNumber(snapshot.progress.achievementPercent)}% · Gap ${formatNumber(snapshot.progress.gap)}`
    : `• ${thai ? "Target (ข้อมูลประกอบ)" : "Target (context only)"}: ${formatNumber(snapshot.target.target)} ${thai ? "คัน" : "units"} · ${thai ? "งวดยังไม่สิ้นสุด จึงไม่ประเมินผลทั้งงวด" : "period incomplete; no full-period assessment"}`);
  if (comparisonScope.partial) lines.push(thai ? "หมายเหตุ: เปรียบเทียบ Month-to-Date กับจำนวนวันเท่ากันของเดือนก่อน" : "Note: Month-to-Date is compared with the same elapsed days of the previous month.");
  if (!hasPrior) lines.push(thai ? "แนวโน้ม: ข้อมูลยังไม่เพียงพอสำหรับเปรียบเทียบงวดก่อน" : "Trend: insufficient prior comparable-period data.");
  const narrative = await composeExecutiveNarrative(context.aiProvider, snapshot, signals, priorities);
  lines.push(thai ? "Analysis" : "Analysis");
  lines.push(narrative.text);
  if (signals.length) {
    lines.push(thai ? "Key Signals" : "Key Signals");
    const risks = selectExecutiveSignalGroups(groups.filter((group) => group.severity !== "positive"), mode === "detailed" ? 5 : 3);
    if (risks.length) risks.forEach((group, index) => lines.push(`${index + 1}. ${formatExecutiveSignalGroup(group, thai)}`));
    else lines.push(thai ? "ยังไม่พบความเสี่ยงตามกฎที่กำหนดในขอบเขตนี้" : "No configured risks were found in this scope.");
    const positives = selectExecutiveSignalGroups(groups.filter((group) => group.severity === "positive"), 3);
    if (positives.length) {
      lines.push(thai ? "Key Positives" : "Key Positives");
      positives.forEach((group, index) => lines.push(`${index + 1}. ${formatExecutiveSignalGroup(group, thai)}`));
    }
  } else lines.push(thai ? "Key Signals: ยังไม่พบสัญญาณตามกฎที่กำหนดในขอบเขตนี้" : "Key Signals: no configured signals were found in this scope.");
  if (recommendations.length) {
    lines.push(thai ? "Recommended Focus" : "Recommended Focus");
    recommendations.forEach((item, index) => lines.push(`${index + 1}. ${thai ? item.text : item.text}\n   ${thai ? "เหตุผล" : "Reason"}: ${item.reason}`));
  }
  lines.push(`${thai ? "ช่วงข้อมูล" : "Data scope"}: ${formatDateScope(effectiveRange, thai)}`);
  lines.push(`${thai ? "แหล่งข้อมูล" : "Source"}: KMM Internal Data`);
  return { answer: lines.join("\n"), data: { source: "KMM Internal Data", snapshot, signals, groups, priorities, recommendations, narrative: { model: narrative.model, fallbackUsed: narrative.fallbackUsed, rejected: narrative.rejected } }, model: narrative.model ?? undefined, fallbackUsed: narrative.fallbackUsed };
}

function formatExecutiveSignalGroup(group: ExecutiveSignalGroup, thai: boolean) {
  const subjects = group.subjects.join(thai ? " และ " : " and ");
  if (thai) {
    if (group.code === "ZERO_SALES_WITH_STOCK") return `${subjects || "สินค้า"} มี Stock แต่ยังไม่มียอดขายในงวด`;
    if (group.code === "HIGH_STOCK_LOW_SALES") return `${subjects || "สินค้า"} มี Stock Cover Proxy สูงเมื่อเทียบกับยอดขายในงวด`;
    if (group.code === "TARGET_AHEAD") return "ยอดขายทำได้ตามหรือสูงกว่า Target ที่อนุมัติ";
    if (group.code === "POSITIVE_MOMENTUM") return "Sales Unit ดีขึ้นจากงวดเปรียบเทียบก่อนหน้า";
    if (group.code === "BOOKING_IMPROVING") return "Booking ดีขึ้นจากงวดเปรียบเทียบก่อนหน้า";
  }
  return thai ? thaiSignal(group.code) : group.signals[0]?.detail ?? group.code;
}

function executiveWeekScope(message: string, now: Date, timeZone = "Asia/Yangon") {
  if (!/(สัปดาห์นี้|this week)/i.test(message)) return null;
  const local = businessLocalDate(now, timeZone);
  const mondayOffset = (local.getDay() + 6) % 7;
  const start = new Date(local.getFullYear(), local.getMonth(), local.getDate() - mondayOffset);
  const end = new Date(local.getFullYear(), local.getMonth(), local.getDate());
  const previousStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
  const previousEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7);
  return {
    period: { kind: "dateRange" as const, start: isoDate(start), end: isoDate(end), label: "current week", scopeLabel: `${isoDate(start)} – ${isoDate(end)}` },
    previous: { start: isoDate(previousStart), end: isoDate(previousEnd), scopeLabel: `${isoDate(previousStart)} – ${isoDate(previousEnd)}` },
  };
}

export function resolveExecutiveAnalysisMode(message: string): "summary" | "detailed" | "why" | "product" | "branch" | "assessment" | "comparison" {
  if (/(ทำไม|why)/i.test(message)) return "why";
  if (/(สินค้าไหน|แยกตามสินค้า|which product)/i.test(message)) return "product";
  if (/(สาขาไหน|แยกตามสาขา|which branch)/i.test(message)) return "branch";
  if (BUSINESS_ASSESSMENT_REQUEST.test(message)) return "assessment";
  if (BUSINESS_COMPARISON_REQUEST.test(message)) return "comparison";
  return /(ละเอียด|ขอรายละเอียด|detail)/i.test(message) ? "detailed" : "summary";
}

function executiveAssessmentAnswer(
  snapshot: Awaited<ReturnType<typeof buildExecutiveSnapshot>>,
  groups: ExecutiveSignalGroup[],
  recommendations: ReturnType<typeof executiveRecommendations>,
  range: DateRange,
  thai: boolean,
  source: string,
  partialPeriod: boolean,
): KaiToolOutput {
  const strengths = selectExecutiveSignalGroups(
    groups.filter((group) => group.severity === "positive"),
    3,
  );
  const weaknesses = selectExecutiveSignalGroups(
    groups.filter((group) => group.severity !== "positive"),
    4,
  );
  const lines = [thai ? "การประเมินธุรกิจจากข้อมูล" : "Data-supported business assessment"];

  lines.push(thai ? "จุดแข็ง" : "Strengths");
  if (strengths.length) {
    strengths.forEach((group, index) => {
      lines.push(`${index + 1}. ${formatExecutiveSignalGroup(group, thai)}`);
      const evidence = formatExecutiveEvidence(group, thai);
      if (evidence) lines.push(`   ${thai ? "หลักฐาน" : "Evidence"}: ${evidence}`);
    });
  } else {
    lines.push(thai
      ? "• ยังไม่มีหลักฐานเปรียบเทียบหรือ Target ที่เพียงพอสำหรับยืนยันจุดแข็ง"
      : "• There is not enough comparison or Target evidence to confirm a strength.");
  }

  lines.push(thai ? "จุดอ่อนและความเสี่ยง" : "Weaknesses and risks");
  if (weaknesses.length) {
    weaknesses.forEach((group, index) => {
      lines.push(`${index + 1}. ${formatExecutiveSignalGroup(group, thai)}`);
      const evidence = formatExecutiveEvidence(group, thai);
      if (evidence) lines.push(`   ${thai ? "หลักฐาน" : "Evidence"}: ${evidence}`);
    });
  } else {
    lines.push(thai
      ? "• ยังไม่พบสัญญาณเชิงลบตามกฎที่กำหนดในขอบเขตนี้"
      : "• No configured negative signal was found in this scope.");
  }

  if (recommendations.length) {
    lines.push(thai ? "สิ่งที่ควรโฟกัส" : "Recommended focus");
    recommendations.slice(0, 3).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.text}`);
      lines.push(`   ${thai ? "เหตุผล" : "Reason"}: ${item.reason}`);
    });
  }
  if (partialPeriod) {
    lines.push(thai
      ? "หมายเหตุ: ใช้ข้อมูล Month-to-Date เทียบกับจำนวนวันเท่ากันของเดือนก่อน"
      : "Note: Month-to-Date is compared with the same elapsed days of the previous month.");
  }
  lines.push(thai
    ? "ข้อจำกัด: ผลลัพธ์นี้เป็นสัญญาณจากข้อมูลที่มี ไม่ใช่ข้อยืนยันสาเหตุหรือการพยากรณ์"
    : "Limitation: this is a signal-based assessment, not proof of cause or a forecast.");
  lines.push(`${thai ? "ช่วงข้อมูล" : "Data scope"}: ${formatDateScope(range, thai)}`);
  lines.push(`${thai ? "แหล่งข้อมูล" : "Source"}: ${source}`);

  return {
    answer: lines.join("\n"),
    data: { source, snapshot, assessment: { strengths, weaknesses, recommendations } },
  };
}

function executiveComparisonAnswer(
  snapshot: Awaited<ReturnType<typeof buildExecutiveSnapshot>>,
  range: DateRange,
  thai: boolean,
  source: string,
  partialPeriod: boolean,
): KaiToolOutput {
  const lines = [thai ? "เปรียบเทียบผลการดำเนินงาน" : "Business performance comparison"];
  lines.push(`${snapshot.period.scopeLabel} ${thai ? "เทียบกับ" : "vs"} ${snapshot.previous.scopeLabel}`);
  lines.push(`• Sales Unit: ${formatComparisonMetric(snapshot.sales.units, snapshot.priorSales.units, "number", thai)}`);
  lines.push(`• Sales Value: ${formatComparisonMetric(snapshot.sales.value, snapshot.priorSales.value, "money", thai)}`);
  lines.push(`• Booking Unit: ${formatComparisonMetric(snapshot.booking.units, snapshot.priorBooking.units, "number", thai)}`);
  if (snapshot.sales.gpPercent === null || snapshot.priorSales.gpPercent === null) {
    lines.push(thai ? "• GP%: ข้อมูลยังไม่เพียงพอสำหรับเปรียบเทียบ" : "• GP%: insufficient comparable data");
  } else {
    const difference = snapshot.sales.gpPercent - snapshot.priorSales.gpPercent;
    lines.push(`• GP%: ${formatNumber(snapshot.sales.gpPercent)}% ${thai ? "เทียบกับ" : "vs"} ${formatNumber(snapshot.priorSales.gpPercent)}% · ${difference >= 0 ? "+" : ""}${formatNumber(difference)} ${thai ? "จุดเปอร์เซ็นต์" : "pp"}`);
  }
  lines.push(`• Stock: ${formatNumber(snapshot.stock.units)} ${thai ? "คัน ณ" : "units as of"} ${snapshot.stock.snapshotDate ?? (thai ? "ไม่พบวันที่ Snapshot" : "snapshot date unavailable")}`);
  lines.push(thai
    ? "  Stock เป็นข้อมูล ณ จุดเวลา จึงไม่เทียบเป็นแนวโน้มจนกว่าจะมี Snapshot ย้อนหลังที่เพียงพอ"
    : "  Stock is point-in-time data and is not treated as a trend without sufficient historical snapshots.");
  if (partialPeriod) {
    lines.push(thai
      ? "หมายเหตุ: งวดปัจจุบันยังไม่สิ้นสุด จึงเทียบ Month-to-Date กับจำนวนวันเท่ากันของเดือนก่อน"
      : "Note: the current period is incomplete, so Month-to-Date is compared with the same elapsed days of the previous month.");
  }
  lines.push(thai
    ? "ข้อจำกัด: ความแตกต่างที่พบไม่ใช่หลักฐานว่า KPI หนึ่งเป็นสาเหตุของอีก KPI"
    : "Limitation: observed differences do not prove that one KPI caused another.");
  lines.push(`${thai ? "ช่วงข้อมูล" : "Data scope"}: ${formatDateScope(range, thai)}`);
  lines.push(`${thai ? "แหล่งข้อมูล" : "Source"}: ${source}`);

  return {
    answer: lines.join("\n"),
    data: {
      source,
      comparison: {
        current: snapshot.period,
        previous: snapshot.previous,
        sales: { current: snapshot.sales, previous: snapshot.priorSales },
        booking: { current: snapshot.booking, previous: snapshot.priorBooking },
        stock: snapshot.stock,
      },
    },
  };
}

function formatComparisonMetric(current: number, previous: number, kind: "number" | "money", thai: boolean) {
  const format = kind === "money" ? formatMoney : formatNumber;
  const difference = current - previous;
  const percentage = previous === 0 ? null : (difference / Math.abs(previous)) * 100;
  const delta = `${difference >= 0 ? "+" : ""}${format(difference)}`;
  const percentText = percentage === null
    ? (thai ? "ไม่มีฐานเดิมสำหรับคำนวณ %" : "no prior base for %")
    : `${percentage >= 0 ? "+" : ""}${formatNumber(percentage)}%`;
  return `${format(current)} ${thai ? "เทียบกับ" : "vs"} ${format(previous)} · ${delta} (${percentText})`;
}

function formatExecutiveEvidence(group: ExecutiveSignalGroup, thai: boolean) {
  const signal = group.signals[0];
  if (!signal) return "";
  const values = signal.values;
  const evidence: string[] = [];
  if (typeof values.product === "string") evidence.push(`${thai ? "สินค้า" : "Product"} ${values.product}`);
  if (typeof values.achievement === "number") evidence.push(`Achievement ${formatNumber(values.achievement)}%`);
  if (typeof values.salesChange === "number") evidence.push(`Sales ${values.salesChange >= 0 ? "+" : ""}${formatNumber(values.salesChange)}%`);
  if (typeof values.bookingChange === "number") evidence.push(`Booking ${values.bookingChange >= 0 ? "+" : ""}${formatNumber(values.bookingChange)}%`);
  if (typeof values.gpChange === "number") evidence.push(`GP ${values.gpChange >= 0 ? "+" : ""}${formatNumber(values.gpChange)} ${thai ? "จุดเปอร์เซ็นต์" : "pp"}`);
  if (typeof values.sales === "number") evidence.push(`Sales ${formatNumber(values.sales)}`);
  if (typeof values.booking === "number") evidence.push(`Booking ${formatNumber(values.booking)}`);
  if (typeof values.stock === "number") evidence.push(`Stock ${formatNumber(values.stock)}`);
  if (typeof values.stockCoverProxy === "number") evidence.push(`Stock Cover Proxy ${formatNumber(values.stockCoverProxy)}`);
  if (typeof values.gap === "number") evidence.push(`Gap ${formatNumber(values.gap)}`);
  return evidence.join(" · ");
}

function executiveWhyAnswer(message: string, snapshot: Awaited<ReturnType<typeof buildExecutiveSnapshot>>, signals: ExecutiveSignal[], priorities: ReturnType<typeof rankExecutivePriorities>, range: DateRange, thai: boolean): KaiToolOutput {
  const products = mentionedProducts(message);
  const priority = products.length
    ? priorities.find((item) => products.some((product) => product === item.evidence.product))
    : priorities.find((item) => item.severity !== "positive") ?? priorities[0];
  if (!priority) return { answer: thai ? "ยังไม่มีสัญญาณที่มีข้อมูลเพียงพอให้ระบุเหตุผลในขอบเขตนี้" : "There is not enough signal evidence to explain this scope.", data: { unavailable: "executive_evidence" } };
  const rows = products.length ? snapshot.products.filter((item) => products.includes(item.product)) : [];
  const lines = [thai ? "เหตุผลจากข้อมูลที่ตรวจสอบได้" : "Evidence behind the signal", `Signal: ${priority.signal}`, `• ${thai ? "เหตุผล" : "Reason"}: ${thai ? thaiSignal(priority.signal) : priority.reason}`];
  if (rows.length) {
    for (const row of rows) {
      lines.push(`• ${row.product} Sales: ${formatNumber(row.sales.units)} ${thai ? "คัน" : "units"}`);
      lines.push(`• ${row.product} Booking: ${formatNumber(row.booking.units)} ${thai ? "คัน" : "units"}`);
      lines.push(`• ${row.product} Stock: ${formatNumber(row.stock.units)} ${thai ? "คัน" : "units"}`);
      if (row.stockCoverProxy !== null) lines.push(`• ${row.product} Stock Cover Proxy: ${formatNumber(row.stockCoverProxy)}`);
      if (row.target !== null) lines.push(`• ${row.product} ${thai ? "Target" : "Target"}: ${formatNumber(row.target)} ${thai ? "คัน" : "units"}`);
    }
  } else {
    lines.push(`• Sales: ${formatNumber(snapshot.sales.units)} ${thai ? "คัน" : "units"}`);
    lines.push(`• Booking: ${formatNumber(snapshot.booking.units)} ${thai ? "คัน" : "units"}`);
    lines.push(`• Stock: ${formatNumber(snapshot.stock.units)} ${thai ? "คัน" : "units"}`);
    if (snapshot.progress && snapshot.targetEvaluationEligible) lines.push(`• Achievement: ${formatNumber(snapshot.progress.achievementPercent)}%`);
    if (snapshot.progress && !snapshot.targetEvaluationEligible) lines.push(thai ? "• Target เป็นข้อมูลประกอบ เนื่องจากงวดยังไม่สิ้นสุด" : "• Target is context only because the period is incomplete.");
  }
  lines.push(thai ? "ข้อมูลปัจจุบันแสดงสัญญาณ แต่ยังไม่เพียงพอที่จะยืนยันสาเหตุ" : "The available data shows a signal, but is insufficient to confirm a cause.");
  lines.push(`${thai ? "ช่วงข้อมูล" : "Data scope"}: ${formatDateScope(range, thai)}`, `${thai ? "แหล่งข้อมูล" : "Source"}: KMM Internal Data`);
  return { answer: lines.join("\n"), data: { source: "KMM Internal Data", snapshot, signals, priorities, evidence: priority } };
}

function mentionedProducts(message: string) {
  const value = message.toUpperCase();
  return (["TT", "CH", "EX", "TP"] as const).filter((product) => {
    const alias = product === "TT" ? "TRACTOR|แทรกเตอร์" : product === "CH" ? "COMBINE|คอมไบน์" : product === "EX" ? "EXCAVATOR|รถขุด" : "TRANSPLANTER";
    return new RegExp(`\\b${product}\\b|${alias}`, "i").test(value);
  });
}

function executiveProductAnswer(snapshot: Awaited<ReturnType<typeof buildExecutiveSnapshot>>, signals: ExecutiveSignal[], range: DateRange, thai: boolean): KaiToolOutput {
  const products = [...snapshot.products].sort((a, b) => productExposure(b) - productExposure(a));
  const lines = [thai ? "Product Priority" : "Product Priority"];
  products.forEach((row, index) => {
    const matching = signals.find((signal) => signal.values.product === row.product);
    const target = row.target === null ? "" : ` · ${thai ? "Target" : "Target"} ${formatNumber(row.target)}`;
    lines.push(`${index + 1}. ${row.product}: ${thai ? "Sales" : "Sales"} ${formatNumber(row.sales.units)} · ${thai ? "Booking" : "Booking"} ${formatNumber(row.booking.units)} · ${thai ? "Stock" : "Stock"} ${formatNumber(row.stock.units)}${row.stockCoverProxy === null ? "" : ` · Cover ${formatNumber(row.stockCoverProxy)}`}${target}`);
    if (matching) lines.push(`   ${thai ? "สัญญาณ" : "Signal"}: ${thaiSignal(matching.code)}`);
  });
  lines.push(thai ? "Target รายสินค้ารองรับเฉพาะ TT, CH และ EX&TP รวม; จึงไม่จัดอันดับ EX/TP ด้วย Target แยกกัน" : "Product Target support is TT, CH, and combined EX&TP only; EX and TP are not independently Target-ranked.");
  lines.push(`${thai ? "ช่วงข้อมูล" : "Data scope"}: ${formatDateScope(range, thai)}`, `${thai ? "แหล่งข้อมูล" : "Source"}: KMM Internal Data`);
  return { answer: lines.join("\n"), data: { source: "KMM Internal Data", products, signals } };
}

function productExposure(row: Awaited<ReturnType<typeof buildExecutiveSnapshot>>["products"][number]) {
  return (row.stock.units * 1000) + (row.stockCoverProxy === null ? row.stock.units * 100 : row.stockCoverProxy * 100) - (row.sales.units * 10) - row.booking.units;
}

function executiveBranchAnswer(snapshot: Awaited<ReturnType<typeof buildExecutiveSnapshot>>, range: DateRange, thai: boolean): KaiToolOutput {
  const branches = [...snapshot.branches].sort((a, b) => (b.stock.units - b.sales.units) - (a.stock.units - a.sales.units));
  const lines = [thai ? "Branch Watchlist" : "Branch Watchlist"];
  branches.forEach((row, index) => lines.push(`${index + 1}. ${row.branch}: ${thai ? "Sales" : "Sales"} ${formatNumber(row.sales.units)} · ${thai ? "Booking" : "Booking"} ${formatNumber(row.booking.units)} · ${thai ? "Stock" : "Stock"} ${formatNumber(row.stock.units)}${row.sales.gpPercent === null ? "" : ` · GP ${formatNumber(row.sales.gpPercent)}%`}`));
  lines.push(thai ? "ยังไม่มี Target ระดับสาขา จึงใช้เฉพาะผลจริง Sales, Booking, Stock และ GP ในการจัดลำดับ" : "There is no branch-level Target; this ordering uses actual Sales, Booking, Stock, and GP only.");
  lines.push(`${thai ? "ช่วงข้อมูล" : "Data scope"}: ${formatDateScope(range, thai)}`, `${thai ? "แหล่งข้อมูล" : "Source"}: KMM Internal Data`);
  return { answer: lines.join("\n"), data: { source: "KMM Internal Data", branches } };
}

function thaiSignal(code: ExecutiveSignal["code"]) {
  const copy: Record<ExecutiveSignal["code"], string> = {
    TARGET_AHEAD: "ยอดขายทำได้ตามหรือสูงกว่า Target ที่อนุมัติ",
    TARGET_NEAR: "ยอดขายใกล้ Target ที่อนุมัติ",
    TARGET_GAP: "ยอดขายต่ำกว่า Target และควรติดตาม",
    TARGET_MATERIAL_GAP: "ยอดขายต่ำกว่า Target อย่างมีนัยสำคัญ",
    POSITIVE_MOMENTUM: "Sales Unit ดีขึ้นจากงวดเปรียบเทียบก่อนหน้า",
    NEGATIVE_MOMENTUM: "Sales Unit ลดลงจากงวดเปรียบเทียบก่อนหน้า",
    HIGH_STOCK_LOW_SALES: "มี Stock Cover Proxy สูงเมื่อเทียบกับยอดขายในงวด",
    ZERO_SALES_WITH_STOCK: "มี Stock แต่ยังไม่มียอดขายในงวด",
    GP_PRESSURE: "GP% ลดลงจากงวดเปรียบเทียบก่อนหน้าอย่างน้อย 2 จุดเปอร์เซ็นต์",
    BOOKING_IMPROVING: "Booking ดีขึ้นจากงวดเปรียบเทียบก่อนหน้า",
    BOOKING_WEAKENING: "Booking ลดลงจากงวดเปรียบเทียบก่อนหน้า",
    SALES_GAP_BOOKING_IMPROVING: "ยอดขายยังต่ำกว่า Target แต่ Booking ดีขึ้น; ควรติดตามการเปลี่ยนเป็นยอดขาย",
    SALES_GAP_BOOKING_WEAKENING: "ยอดขายและ Booking อ่อนลงพร้อมกัน; ควรติดตามทั้งผลปัจจุบันและ pipeline",
    INVENTORY_PRESSURE_BOOKING_IMPROVING: "Stock ยังมีแรงกดดัน แต่ Booking ดีขึ้น; ควรติดตามการเปลี่ยนเป็นยอดขาย",
    SALES_UP_BOOKING_DOWN: "ยอดขายดีขึ้น แต่ Booking อ่อนลง; ควรติดตาม pipeline ระยะถัดไป",
  };
  return copy[code];
}
function selectedAreas(message: string): BusinessArea[] {
  const areas = new Set<BusinessArea>();
  if (SALES_REQUEST.test(message)) areas.add("sales");
  if (BOOKING_REQUEST.test(message)) areas.add("booking");
  if (STOCK_REQUEST.test(message)) areas.add("stock");
  // GP is a Sales aggregate, not a separately calculated dataset.
  return [...areas].slice(0, 3);
}

async function getSalesAggregate(companyId: string, range: DateRange, product: ProductGroup | null) {
  const rows = (await listSalesTransactions(companyId))
    .map(toCanonicalSalesRow)
    .filter((row) => rowMatchesDateScope(row.date, range));
  const filters: SalesFilterInput = product ? { productGroup: [product] } : {};
  const scoped = filterSalesRows(rows, filters);
  const kpis = getSalesKpis(rows, filters);
  const branchBreakdown = groupBy(scoped, (row) => canonicalDailyBranch(row.branch) || "Missing").map(([branch, branchRows]) => {
    const branchKpis = getSalesKpis(branchRows);
    return salesMetrics(branchKpis, branch);
  }).sort((a, b) => b.units - a.units || b.salesValue - a.salesValue);
  return {
    area: "sales" as const,
    ...salesMetrics(kpis),
    productBreakdown: getProductSummary(rows, filters),
    branchBreakdown,
    range,
  };
}

async function getSalesAreaAggregate(range: DateRange, product: ProductGroup | null) {
  if (range.kind !== "dateRange") {
    return { area: "salesArea" as const, areaBreakdown: [], coverageStart: null, coverageEnd: null, unresolvedUnits: 0, range };
  }
  const aggregate = await getHeatmapSalesAreaAggregate({ start: range.start, end: range.end, product });
  return { area: "salesArea" as const, areaBreakdown: aggregate.areas, ...aggregate, range };
}

function salesMetrics(kpis: ReturnType<typeof getSalesKpis>, branch?: string) {
  const salesValue = kpis.salesValue ?? 0;
  const grossProfit = kpis.grossProfit ?? 0;
  return {
    ...(branch ? { branch } : {}),
    units: kpis.salesUnit,
    salesValue,
    grossProfit,
    grossProfitPercent: salesValue > 0 && kpis.grossProfitAvailable
      ? (grossProfit / salesValue) * 100
      : null,
    dataAvailable: kpis.salesValue !== null,
  };
}

async function getBookingAggregate(companyId: string, range: DateRange, product: ProductGroup | null) {
  const rows = (await listBookingTransactions(companyId))
    .map((row) => adaptBookingRow(row as unknown as Record<string, unknown>))
    .filter((row) => rowMatchesDateScope(row.date, range));
  const filters: BookingFilters = product ? { product: [product] } : {};
  const scoped = rows.filter((row) => !product || normalizeBookingProduct(row.productType) === product);
  const branchBreakdown = groupBy(scoped, (row) => canonicalDailyBranch(row.branch) || "Missing").map(([branch, branchRows]) => ({
    branch,
    units: getOpenBookingUnit(branchRows),
    bookingValue: getBookingValue(branchRows),
    deposit: getDepositAmount(branchRows),
  })).sort((a, b) => b.units - a.units || b.bookingValue - a.bookingValue);
  return {
    area: "booking" as const,
    units: getOpenBookingUnit(rows, filters),
    bookingValue: getBookingValue(rows, filters),
    deposit: getDepositAmount(rows, filters),
    productBreakdown: getBookingByProduct(rows, filters),
    branchBreakdown,
    range,
  };
}

async function getStockAggregate(companyId: string, product: ProductGroup | null, range: DateRange) {
  const rows = (await listStockTransactions(companyId))
    .map((row) => adaptStockRow(row as unknown as Record<string, unknown>));
  const scoped = selectKmmStockSnapshotRows(rows, range);
  if (!scoped.length) {
    return { area: "stock" as const, units: null, stockValue: null, productBreakdown: [], branchBreakdown: [], snapshotDate: null, dataAvailable: false };
  }
  return { ...summarizeKmmStockRows(scoped, product), dataAvailable: true };
}

export function selectKmmStockSnapshotRows(rows: StockAdapterRow[], range: DateRange) {
  if (range.kind !== "dateRange") return [];
  const snapshots = rows
    .map((row) => row.snapshotDate)
    .filter((date): date is string => Boolean(date) && date >= range.start && date <= range.end)
    .sort();
  const selected = snapshots.at(-1);
  return selected ? rows.filter((row) => row.snapshotDate === selected) : [];
}

/**
 * The KAI stock response deliberately starts from Dashboard's canonical
 * current-stock population. Deduplicate once before computing total, product,
 * and branch aggregates so every result describes the same physical vehicles.
 */
export function summarizeKmmStockRows(rows: StockAdapterRow[], product: ProductGroup | null = null) {
  // Match Dashboard selector order exactly: qualify and de-duplicate the full
  // physical inventory population before an optional product presentation
  // filter. This prevents one machine with inconsistent source labels from
  // being counted differently in a filtered KAI answer.
  const currentStock = getCurrentStockRows(rows);
  const scoped = product ? currentStock.filter((row) => normalizeProductType(row) === product) : currentStock;
  const branchBreakdown = groupBy(scoped, (row) => canonicalDailyBranch(row.branch) || "Missing").map(([branch, branchRows]) => ({
    branch,
    units: getStockUnit(branchRows),
    stockValue: getStockValue(branchRows),
  })).sort((a, b) => b.units - a.units || b.stockValue - a.stockValue);
  const snapshots = rows.map((row) => row.snapshotDate).filter(Boolean).sort();
  return {
    area: "stock" as const,
    units: getStockUnit(scoped),
    stockValue: getStockValue(scoped),
    productBreakdown: getStockByProduct(scoped),
    branchBreakdown,
    snapshotDate: snapshots.at(-1) ?? null,
  };
}

function groupBy<T>(rows: readonly T[], label: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = label(row) || "Missing";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()];
}

function resolveProduct(message: string): ProductGroup | null {
  const value = message.toUpperCase();
  if (/(\bTT\b|TRACTOR|แทรกเตอร์)/i.test(value)) return "TT";
  if (/(\bCH\b|COMBINE|คอมไบน์)/i.test(value)) return "CH";
  if (/(\bEX\b|EXCAVATOR|รถขุด)/i.test(value)) return "EX";
  if (/(\bTP\b|TRANSPLANTER)/i.test(value)) return "TP";
  return null;
}

/**
 * KAI always resolves calendar language to an explicit scope. This is
 * intentionally different from a Dashboard month-only filter: KAI's
 * "เดือนนี้" is the current calendar month/year, while all-years month
 * aggregation requires an explicit historical request such as "ทุกปี".
 */
export function resolveKmmDateRange(message: string, now: Date, timeZone = "Asia/Yangon"): DateRange {
  const dates = [...message.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((match) => match[1]);
  if (dates.length) {
    const start = dates[0];
    const end = dates[1] ?? dates[0];
    if (isIsoDate(start) && isIsoDate(end) && start <= end) {
      return { kind: "dateRange", start, end, label: `${start} – ${end}`, scopeLabel: `${start} – ${end}` };
    }
  }
  const yearSpan = message.match(/(?:ตั้งแต่(?:ปี)?|ช่วงปี|ปี)?\s*(20\d{2})\s*(?:[-–—]|ถึง|to)\s*(20\d{2})/i);
  if (yearSpan) {
    const startYear = Number(yearSpan[1]);
    const endYear = Number(yearSpan[2]);
    if (startYear <= endYear) {
      return { kind: "dateRange", start: `${startYear}-01-01`, end: `${endYear}-12-31`, label: "year range", scopeLabel: `${startYear}–${endYear}` };
    }
  }
  const local = businessLocalDate(now, timeZone);
  if (/(วันนี้|today)/i.test(message)) return dayRange(local, "today");
  if (/(เมื่อวาน|yesterday)/i.test(message)) return dayRange(new Date(local.getFullYear(), local.getMonth(), local.getDate() - 1), "yesterday");

  const namedMonth = findNamedMonth(message);
  if (namedMonth && wantsMonthAcrossYears(message)) {
    return {
      kind: "monthAcrossYears",
      month: namedMonth.month,
      label: "month across all years",
      scopeLabel: `${monthLabel(namedMonth.month, /[\u0e00-\u0e7f]/.test(message))} · all years`,
    };
  }
  if (namedMonth) {
    const year = namedMonth.year ?? local.getFullYear();
    return monthRange(
      year,
      namedMonth.month,
      namedMonth.year ? "named month" : "named month, current year default",
      !namedMonth.year,
    );
  }
  if (/(ปีนี้|this year|current year)/i.test(message)) {
    return yearRange(local.getFullYear());
  }
  const asksCurrentAgainstPrevious = /(?:เดือนนี้|this month)/i.test(message)
    && /(?:เดือนก่อน|เดือนที่แล้ว|last month|previous month)/i.test(message)
    && /(?:เทียบ|เปรียบเทียบ|compare|vs)/i.test(message);
  const previous = !asksCurrentAgainstPrevious && /(เดือนก่อน|เดือนที่แล้ว|last month|previous month)/i.test(message);
  return monthRange(
    previous && local.getMonth() === 0 ? local.getFullYear() - 1 : local.getFullYear(),
    previous ? (local.getMonth() || 12) : local.getMonth() + 1,
    previous ? "previous month" : "current month",
  );
}

function wantsPreviousMonthComparison(message: string) {
  return /(เทียบ.*เดือนก่อน|เดือนนี้.*เทียบ|month.?over.?month|mom|compare.*last month)/i.test(message);
}

function previousMonthRange(now: Date, timeZone = "Asia/Yangon") {
  const local = businessLocalDate(now, timeZone);
  const year = local.getMonth() === 0 ? local.getFullYear() - 1 : local.getFullYear();
  const month = local.getMonth() || 12;
  return monthRange(year, month, "previous month");
}

export function resolveExecutiveComparableScope(
  range: Extract<DateRange, { kind: "dateRange" }>,
  now: Date,
  timeZone = "Asia/Yangon",
) {
  const period = { start: range.start, end: range.end, scopeLabel: range.scopeLabel };
  const local = businessLocalDate(now, timeZone);
  const localIso = isoDate(local);
  const rangeYear = Number(range.start.slice(0, 4));
  const rangeMonth = Number(range.start.slice(5, 7));
  const expectedMonthEnd = isoDate(new Date(rangeYear, rangeMonth, 0));
  const isCurrentCalendarMonth = range.start.endsWith("-01")
    && range.end === expectedMonthEnd
    && range.start.slice(0, 7) === localIso.slice(0, 7);

  if (!isCurrentCalendarMonth) return { period, previous: undefined, partial: false };

  const previousStartDate = new Date(rangeYear, rangeMonth - 2, 1);
  const previousYear = previousStartDate.getFullYear();
  const previousMonth = previousStartDate.getMonth() + 1;
  const previousMonthDays = new Date(previousYear, previousMonth, 0).getDate();
  const previousEndDate = new Date(
    previousYear,
    previousMonth - 1,
    Math.min(local.getDate(), previousMonthDays),
  );
  return {
    period: {
      start: range.start,
      end: localIso,
      scopeLabel: `${range.scopeLabel} MTD`,
    },
    previous: {
      start: isoDate(previousStartDate),
      end: isoDate(previousEndDate),
      scopeLabel: `${formatMonthScope(previousYear, previousMonth)} MTD`,
    },
    partial: true,
  };
}

function businessLocalDate(now: Date, timeZone: string) {
  try {
    return new Date(now.toLocaleString("en-US", { timeZone }));
  } catch {
    return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Yangon" }));
  }
}

function findNamedMonth(message: string) {
  for (const reference of MONTH_REFERENCES) {
    const names = [reference.thai, ...reference.thaiAliases, ...reference.english];
    for (const name of names) {
      const match = message.match(new RegExp(`(?:เดือน\\s*)?${escapeRegex(name)}\\s*(20\\d{2})?`, "i"));
      if (match) return { month: reference.month, year: match[1] ? Number(match[1]) : null };
    }
  }
  return null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wantsMonthAcrossYears(message: string) {
  return /(ทุกปี|ทุก\s*ปี|ทุกเดือน|every\s+(?:august|january|february|march|april|may|june|july|september|october|november|december)|across\s+all\s+years|all\s+years|historical)/i.test(message);
}

function hasNamedMonthReference(message: string) {
  return findNamedMonth(message) !== null;
}

function monthRange(year: number, month: number, label: string, defaultedCurrentYear = false): DateRange {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    kind: "dateRange",
    start: isoDate(start),
    end: isoDate(end),
    label,
    scopeLabel: formatMonthScope(year, month),
    ...(defaultedCurrentYear ? { defaultedCurrentYear: true } : {}),
  };
}

function yearRange(year: number): DateRange {
  return {
    kind: "dateRange",
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    label: "current year",
    scopeLabel: String(year),
  };
}

function dayRange(date: Date, label: string): DateRange {
  const iso = isoDate(date);
  return { kind: "dateRange", start: iso, end: iso, label, scopeLabel: iso };
}
function rowMatchesDateScope(date: string, range: DateRange) {
  return range.kind === "monthAcrossYears"
    ? Number(date.slice(5, 7)) === range.month
    : date >= range.start && date <= range.end;
}
function monthLabel(month: number, thai: boolean) {
  const reference = MONTH_REFERENCES[month - 1];
  return thai ? reference.thai : reference.english[0].replace(/^./, (value) => value.toUpperCase());
}
function formatMonthScope(year: number, month: number) {
  return `${monthLabel(month, true)} ${year}`;
}
function isoDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
function isIsoDate(value: string) { return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()); }

export function formatBusinessAnswer(message: string, data: { source: string; range: DateRange; results: unknown[] }, companyCode = "KMM", currency = "MMK") {
  const thai = /[\u0e00-\u0e7f]/.test(message);
  if (SALES_AREA_TREND_REQUEST.test(message)) return formatSalesAreaTrend(message, data, thai);
  if (SALES_AREA_RANKING_REQUEST.test(message)) return formatSalesAreaRanking(message, data, thai);
  const salesResults = (data.results as Array<Record<string, unknown>>).filter((result) => result.area === "sales");
  if (SALES_MONTH_COMPARISON_REQUEST.test(message) && salesResults.length >= 2) {
    return formatSalesMonthComparison(salesResults, thai, currency);
  }
  if (
    SALES_BRANCH_RANKING_REQUEST.test(message)
    && SALES_REQUEST.test(message)
    && !BOOKING_REQUEST.test(message)
    && !STOCK_REQUEST.test(message)
  ) return formatSalesBranchRanking(message, data, thai);
  const branchReport = /(แยกตามสาขา|สาขาไหน|ทุกสาขา|by branch|which branch)/i.test(message);
  const lines: string[] = [];
  for (const result of data.results as Array<Record<string, unknown>>) {
    if (result.area === "sales") {
      lines.push(`${thai ? `ยอดขาย ${companyCode}` : `${companyCode} Sales`}${result.range && (result.range as DateRange).label === "previous month" ? (thai ? " — เดือนก่อน" : " — previous month") : ""}`);
      lines.push(`• ${thai ? "Sales" : "Sales"}: ${formatNumber(result.units)} ${thai ? "คัน" : "units"}`);
      lines.push(`• ${thai ? "Sales Value" : "Sales Value"}: ${formatMoney(result.salesValue)} ${currency}`);
      lines.push(`• ${thai ? "กำไรขั้นต้น" : "Gross Profit"}: ${formatMoney(result.grossProfit)} ${currency}`);
      if (result.grossProfitPercent !== null) lines.push(`• GP: ${formatNumber(result.grossProfitPercent)}%`);
      if (branchReport) appendBranchLines(lines, result.branchBreakdown, "sales", thai, currency);
    }
    if (result.area === "booking") {
      lines.push(thai ? `Booking ${companyCode}` : `${companyCode} Booking`);
      lines.push(`• ${thai ? "รับจอง" : "Open bookings"}: ${formatNumber(result.units)} ${thai ? "คัน" : "units"}`);
      lines.push(`• ${thai ? "มูลค่าจอง" : "Booking Value"}: ${formatMoney(result.bookingValue)} ${currency}`);
      if (branchReport) appendBranchLines(lines, result.branchBreakdown, "booking", thai, currency);
    }
    if (result.area === "stock") {
      lines.push(thai ? `Stock ${companyCode}` : `${companyCode} Stock`);
      if (result.dataAvailable === false) {
        lines.push(thai ? "• ไม่มี Stock snapshot ในช่วงเวลาที่ถาม" : "• No Stock snapshot is available in the requested period");
      } else {
        lines.push(`• ${thai ? "คงเหลือ" : "Available"}: ${formatNumber(result.units)} ${thai ? "คัน" : "units"}`);
        lines.push(`• ${thai ? "มูลค่า Stock" : "Stock Value"}: ${formatMoney(result.stockValue)} ${currency}`);
        lines.push(`${thai ? "ข้อมูล Stock ณ วันที่" : "Stock snapshot"}: ${String(result.snapshotDate ?? "not available")}`);
        if (branchReport) appendBranchLines(lines, result.branchBreakdown, "stock", thai, currency);
      }
    }
  }
  if ((data.results as Array<Record<string, unknown>>).some((result) => result.area !== "stock" || result.dataAvailable === false)) {
    lines.push(`${thai ? "ช่วงข้อมูล" : "Data range"}: ${formatDateScope(data.range, thai)}`);
  }
  lines.push(`${thai ? "แหล่งข้อมูล" : "Source"}: ${data.source}`);
  return lines.join("\n");
}

function formatSalesMonthComparison(
  salesResults: Array<Record<string, unknown>>,
  thai: boolean,
  currency: string,
) {
  const current = salesResults.find((result) => (result.range as DateRange | undefined)?.label !== "previous month") ?? salesResults[0];
  const previous = salesResults.find((result) => (result.range as DateRange | undefined)?.label === "previous month") ?? salesResults[1];
  const currentUnits = Number(current.units ?? 0);
  const previousUnits = Number(previous.units ?? 0);
  const currentValue = Number(current.salesValue ?? 0);
  const previousValue = Number(previous.salesValue ?? 0);
  const unitDifference = currentUnits - previousUnits;
  const valueDifference = currentValue - previousValue;
  const unitGrowth = previousUnits === 0 ? null : (unitDifference / Math.abs(previousUnits)) * 100;
  const valueGrowth = previousValue === 0 ? null : (valueDifference / Math.abs(previousValue)) * 100;
  const currentRange = current.range as DateRange | undefined;
  const previousRange = previous.range as DateRange | undefined;
  const formatGrowth = (value: number | null) => value === null ? "N/A" : `${value >= 0 ? "+" : ""}${formatNumber(value)}%`;
  const formatDifference = (value: number) => `${value >= 0 ? "+" : ""}${formatNumber(value)}`;
  return [
    thai ? "ยอดขายเปรียบเทียบเดือนนี้กับเดือนก่อน" : "Sales Month-over-Month Comparison",
    `• ${thai ? "เดือนนี้" : "Current month"}: ${formatNumber(currentUnits)} ${thai ? "คัน" : "units"} · ${formatMoney(currentValue)} ${currency}`,
    `• ${thai ? "เดือนก่อน" : "Previous month"}: ${formatNumber(previousUnits)} ${thai ? "คัน" : "units"} · ${formatMoney(previousValue)} ${currency}`,
    `• Difference: ${formatDifference(unitDifference)} ${thai ? "คัน" : "units"} · ${formatDifference(valueDifference)} ${currency}`,
    `• Growth: ${formatGrowth(unitGrowth)} ${thai ? "ตามจำนวนคัน" : "by units"} · ${formatGrowth(valueGrowth)} ${thai ? "ตามมูลค่า" : "by value"}`,
    `${thai ? "ช่วงข้อมูล" : "Data scope"}: ${String(currentRange?.scopeLabel ?? currentRange?.label ?? "current month")} vs ${String(previousRange?.scopeLabel ?? previousRange?.label ?? "previous month")}`,
    `${thai ? "แหล่งข้อมูล" : "Source"}: KMM Internal Data`,
  ].join("\n");
}

function formatSalesAreaTrend(message: string, data: { source: string; range: DateRange; results: unknown[] }, thai: boolean) {
  const sales = (data.results as Array<Record<string, unknown>>).find((result) => result.area === "salesArea");
  const requestedLimit = Number(message.match(/(?:อันดับ\s*1\s*[-–—]\s*|top\s*)(\d{1,2})/i)?.[1] ?? 10);
  const limit = Math.min(Math.max(requestedLimit, 1), 10);
  const byValue = /(มูลค่า|ยอดเงิน|revenue|sales\s*value)/i.test(message);
  const rows = (Array.isArray(sales?.annualAreas) ? sales.annualAreas : []) as Array<Record<string, unknown>>;
  const declining = rows.map((row) => {
    const yearly = (Array.isArray(row.yearly) ? row.yearly : []) as Array<Record<string, unknown>>;
    const values = yearly.map((item) => Number(byValue ? item.salesValue : item.units));
    return { row, yearly, values, drop: values.length ? values[0] - values.at(-1)! : 0 };
  }).filter((item) => item.values.length >= 2 && item.values.every(Number.isFinite)
    && item.values.slice(1).every((value, index) => value < item.values[index]))
    .sort((left, right) => right.drop - left.drop)
    .slice(0, limit);
  const samePeriod = String(sales?.samePeriodThrough ?? "12-31");
  const lines = [thai
    ? `Township ที่${byValue ? "มูลค่ายอดขาย" : "Sales Unit"}ลดลงต่อเนื่องทุกปี`
    : `Townships with consecutive annual declines in ${byValue ? "Sales Value" : "Sales Unit"}`];
  if (!declining.length) lines.push(thai ? "• ไม่พบ Township ที่ลดลงทุกปีในช่วงที่ถาม" : "• No Township declined in every year of the requested range");
  declining.forEach((item, index) => {
    const series = item.yearly.map((year) => `${String(year.year)} ${formatNumber(byValue ? year.salesValue : year.units)}`).join(" → ");
    lines.push(`${index + 1}. ${String(item.row.township)} (${String(item.row.stateRegion)}): ${series}${byValue ? "" : thai ? " คัน" : " units"}`);
  });
  lines.push(thai ? `วิธีเทียบ: 01-01 ถึง ${samePeriod} ของทุกปี` : `Comparison window: 01-01 through ${samePeriod} in each year`);
  lines.push(`${thai ? "ช่วงข้อมูล" : "Data range"}: ${formatDateScope(data.range, thai)}`);
  if (sales?.coverageEnd) lines.push(`${thai ? "ข้อมูล Heatmap ล่าสุด" : "Heatmap data through"}: ${String(sales.coverageEnd)}`);
  if (Number(sales?.trendUnresolvedUnits ?? 0) > 0) lines.push(thai ? `หมายเหตุ: มี ${formatNumber(sales?.trendUnresolvedUnits)} คันในช่วงเทียบที่ยังจับคู่ Township ไม่ได้` : `Note: ${formatNumber(sales?.trendUnresolvedUnits)} units in the comparison window could not be mapped to a Township.`);
  lines.push(`${thai ? "แหล่งข้อมูล" : "Source"}: KMM Sales Heatmap`);
  return lines.join("\n");
}

function formatSalesAreaRanking(message: string, data: { source: string; range: DateRange; results: unknown[] }, thai: boolean) {
  const sales = (data.results as Array<Record<string, unknown>>).find((result) => result.area === "salesArea");
  const requestedLimit = Number(message.match(/(?:อันดับ\s*1\s*[-–—]\s*|top\s*)(\d{1,2})/i)?.[1] ?? 5);
  const limit = Math.min(Math.max(requestedLimit, 1), 10);
  const byValue = /(มูลค่า|ยอดเงิน|revenue|sales\s*value)/i.test(message);
  const rows = (Array.isArray(sales?.areaBreakdown) ? sales.areaBreakdown : []) as Array<Record<string, unknown>>;
  const ranked = [...rows]
    .sort((left, right) => Number(byValue ? right.salesValue : right.units) - Number(byValue ? left.salesValue : left.units)
      || Number(right.salesValue) - Number(left.salesValue))
    .slice(0, limit);
  const lines = [thai
    ? `อันดับพื้นที่ขายระดับ Township ตาม${byValue ? "มูลค่ายอดขาย" : "จำนวน Sales Unit"}`
    : `Township ranking by ${byValue ? "Sales Value" : "Sales Unit"}`];
  if (!ranked.length) lines.push(thai ? "• ไม่พบยอดขายในช่วงเวลาที่ถาม" : "• No sales were found in the requested period");
  ranked.forEach((row, index) => lines.push(`${index + 1}. ${String(row.township)} (${String(row.stateRegion)}): ${formatNumber(row.units)} ${thai ? "คัน" : "units"} · ${formatMoney(row.salesValue)}`));
  if (ranked.length < limit) lines.push(thai ? `มีข้อมูลเพียง ${ranked.length} พื้นที่ในช่วงที่ถาม` : `Only ${ranked.length} townships are available in the requested period.`);
  lines.push(`${thai ? "ช่วงข้อมูล" : "Data range"}: ${formatDateScope(data.range, thai)}`);
  if (sales?.coverageEnd) lines.push(`${thai ? "ข้อมูล Heatmap ล่าสุด" : "Heatmap data through"}: ${String(sales.coverageEnd)}`);
  if (Number(sales?.unresolvedUnits ?? 0) > 0) lines.push(thai ? `หมายเหตุ: มี ${formatNumber(sales?.unresolvedUnits)} คันที่ยังจับคู่ Township ไม่ได้` : `Note: ${formatNumber(sales?.unresolvedUnits)} units could not be mapped to a Township.`);
  lines.push(`${thai ? "แหล่งข้อมูล" : "Source"}: KMM Sales Heatmap`);
  return lines.join("\n");
}

function formatSalesBranchRanking(message: string, data: { source: string; range: DateRange; results: unknown[] }, thai: boolean) {
  const sales = (data.results as Array<Record<string, unknown>>).find((result) => result.area === "sales");
  const requestedLimit = Number(message.match(/(?:อันดับ\s*1\s*[-–—]\s*|top\s*)(\d{1,2})/i)?.[1] ?? 5);
  const limit = Math.min(Math.max(requestedLimit, 1), 10);
  const byValue = /(มูลค่า|ยอดเงิน|revenue|sales\s*value)/i.test(message);
  const rows = (Array.isArray(sales?.branchBreakdown) ? sales.branchBreakdown : []) as Array<Record<string, unknown>>;
  const ranked = [...rows]
    .sort((left, right) => Number(byValue ? right.salesValue : right.units) - Number(byValue ? left.salesValue : left.units)
      || Number(right.salesValue) - Number(left.salesValue))
    .slice(0, limit);
  const lines = [thai ? `อันดับสาขาตาม${byValue ? "มูลค่ายอดขาย" : "จำนวน Sales Unit"}` : `Branch ranking by ${byValue ? "Sales Value" : "Sales Unit"}`];
  if (!ranked.length) lines.push(thai ? "• ไม่พบยอดขายในช่วงเวลาที่ถาม" : "• No sales were found in the requested period");
  ranked.forEach((row, index) => lines.push(`${index + 1}. ${String(row.branch)}: ${formatNumber(row.units)} ${thai ? "คัน" : "units"} · ${formatMoney(row.salesValue)}`));
  if (ranked.length < limit) lines.push(thai ? `มีข้อมูลเพียง ${ranked.length} สาขาในแหล่งข้อมูลปัจจุบัน` : `Only ${ranked.length} branches are available in the current source.`);
  lines.push(`${thai ? "ช่วงข้อมูล" : "Data range"}: ${formatDateScope(data.range, thai)}`);
  lines.push(`${thai ? "แหล่งข้อมูล" : "Source"}: ${data.source}`);
  return lines.join("\n");
}

function formatDateScope(range: DateRange, thai: boolean) {
  if (range.kind === "monthAcrossYears") {
    return thai
      ? `เดือน${monthLabel(range.month, true)} · ทุกปี`
      : `${monthLabel(range.month, false)} · all years`;
  }
  if (range.label === "year range") return range.scopeLabel;
  if (range.defaultedCurrentYear) {
    return thai
      ? `${formatThaiDateRange(range.start, range.end)} (ไม่ได้ระบุปี จึงใช้ปีปัจจุบัน)`
      : `${range.start} – ${range.end} (year not specified; using the current year)`;
  }
  return thai ? formatThaiDateRange(range.start, range.end) : `${range.start} – ${range.end}`;
}

function formatThaiDateRange(start: string, end: string) {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  if (startYear === endYear && startMonth === endMonth) {
    return `${startDay}–${endDay} ${monthLabel(startMonth, true)} ${startYear}`;
  }
  return `${start} – ${end}`;
}

function appendBranchLines(lines: string[], value: unknown, area: BusinessArea, thai: boolean, currency: string) {
  const branches = Array.isArray(value) ? value.slice(0, 10) as Array<Record<string, unknown>> : [];
  if (!branches.length) return;
  lines.push(thai ? "แยกตามสาขา:" : "By branch:");
  for (const branch of branches) {
    const amount = area === "sales" ? branch.salesValue : area === "booking" ? branch.bookingValue : branch.stockValue;
    lines.push(`• ${String(branch.branch)}: ${formatNumber(branch.units)} ${thai ? "คัน" : "units"} · ${formatMoney(amount)} ${currency}`);
  }
}

function formatNumber(value: unknown) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(Number(value ?? 0)); }
function formatMoney(value: unknown) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value ?? 0)); }

function securityOutput(kind: "sql" | "mutation" | "pii" | "authorization", message: string): KaiToolOutput {
  const thai = /[\u0e00-\u0e7f]/.test(message);
  const answer = kind === "sql"
    ? (thai
      ? "KAI ไม่อนุญาตให้รันหรือเปิดเผย SQL สำหรับฐานข้อมูลภายในโดยตรง แต่สามารถสรุปข้อมูลที่คุณมีสิทธิ์เข้าถึงผ่านเครื่องมือแบบ Read-only ได้"
      : "KAI does not allow direct SQL execution or disclosure for internal databases. I can summarize data you are authorized to access through read-only tools.")
    : kind === "mutation"
      ? (thai
        ? "KAI อยู่ในโหมด Read-only และไม่สามารถแก้ไข ลบ หรือเพิ่มข้อมูลบริษัทได้"
        : "KAI is read-only and cannot modify, delete, or add company data.")
      : kind === "pii"
        ? (thai
          ? "KAI ไม่สามารถเปิดเผยข้อมูลดิบหรือข้อมูลลูกค้าได้"
          : "KAI cannot disclose raw records or customer information.")
        : (thai
          ? "KAI ไม่สามารถเปลี่ยนบริษัทหรือข้ามสิทธิ์การเข้าถึงได้"
          : "KAI cannot switch companies or bypass access permissions.");
  return { answer, data: { denied: true, kind, source: "Internal Data" } };
}
function accessDeniedOutput(message: string): KaiToolOutput {
  return { answer: /[\u0e00-\u0e7f]/.test(message) ? "คุณไม่มีสิทธิ์เข้าถึง Business Intelligence ของบริษัทที่เลือก" : "You do not have permission to access Business Intelligence for the selected company.", data: { denied: true } };
}
function unavailableOutput(kind: "target" | "salesperson" | "business", message: string, companyCode = "company"): KaiToolOutput {
  const thai = /[\u0e00-\u0e7f]/.test(message);
  const answer = kind === "target"
    ? (thai ? "ข้อมูล Target ยังไม่ได้เชื่อมต่อกับ KAI" : "Target data is not available in KAI yet.")
    : kind === "salesperson"
      ? (thai ? "KAI ยังไม่เปิดใช้ข้อมูลผลการปฏิบัติงานรายบุคคล เนื่องจากระบบสิทธิ์ระดับพนักงานยังอยู่ระหว่างการจัดเตรียม" : "Individual performance data is not enabled while employee-level permissions are being prepared.")
      : (thai ? `KAI ไม่พบข้อมูล ${companyCode} สำหรับคำถามนี้` : `KAI could not find ${companyCode} data for this question.`);
  return { answer, data: { unavailable: kind, source: `${companyCode} Internal Data` } };
}
