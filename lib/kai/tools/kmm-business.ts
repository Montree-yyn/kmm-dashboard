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
const SALES_REQUEST = /(ยอดขาย|พื้นที่ขาย|sales|ขายได้|\bgp\b|gross profit|กำไรขั้นต้น)/i;
const BOOKING_REQUEST = /(booking|ยอดจอง|รับจอง)/i;
const STOCK_REQUEST = /(stock|สต็อก|inventory|เหลือกี่คัน)/i;
const EXECUTIVE_REQUEST = /(สรุปสถานการณ์|วิเคราะห์(?:ละเอียด)?|น่ากังวล|อะไรดีขึ้น|สินค้าไหน(?:ต้องเร่ง|ควรโฟกัส)|สาขาไหน(?:ต้องจับตา|ควรจับตา)|stock.*ขายช้า|booking.*เป็นอย่างไร|gp.*(?:ปัญหา|เป็นยังไง)|เทียบ.*target|ผู้บริหาร.*โฟกัส|ขอรายละเอียดเพิ่ม|ทำไม.*(?:ต้องเร่ง|stock|gp|ยอดขาย.*ลด)|สัปดาห์นี้.*โฟกัส|executive|management focus|what improved|what.*concern|stock.*slow|which product|which branch|why.*(?:stock|gp|sales.*down))/i;
const ALERT_REQUEST = /(alert|แจ้งเตือน|ต้องระวัง|เรื่องด่วน|อะไรต้องระวัง|เตือนเรื่อง)/i;
const BRIEFING_REQUEST = /(สรุปวันนี้|วันนี้เป็นอย่างไร|daily briefing|สรุปสัปดาห์นี้|weekly briefing|สรุปเดือนนี้|executive briefing|สรุปให้ผู้บริหาร|สัปดาห์นี้มีอะไรสำคัญ|เดือนนี้ควรโฟกัสอะไร|มีอะไรเปลี่ยนแปลง|สรุปเดือน.*สำหรับผู้บริหาร|แบบละเอียด)/i;
const BUSINESS_CONTEXT = /(kmm|เดือนนี้|เดือนก่อน|เดือนที่แล้ว|วันนี้|เมื่อวาน|ตอนนี้|ปัจจุบัน|สัปดาห์นี้|ปีนี้|this month|last month|previous month|this year|by branch|tractor|combine|excavator|transplanter|สรุป)/i;
const SALES_AREA_RANKING_REQUEST = /(?:(?:พื้นที่ขาย|สาขา).*(?:เยอะที่สุด|มากที่สุด|สูงสุด|อันดับ|top)|(?:อันดับ|top).*(?:พื้นที่ขาย|สาขา))/i;

export const kmmBusinessTool: KaiTool = {
  id: "kmmBusiness",
  matches: isKmmBusinessQuestion,
  async execute(context) {
    const security = getKmmSecurityRequestKind(context.message);
    if (security) return securityOutput(security, context.message);
    if (SALESPERSON_REQUEST.test(context.message)) return unavailableOutput("salesperson", context.message);
    if (!context.businessAccess) return accessDeniedOutput(context.message);
    if (isTargetBusinessQuestion(context.message)) return getTargetAnswer(context);
    if (BRIEFING_REQUEST.test(context.message)) return getBriefingAnswer(context);
    if (ALERT_REQUEST.test(context.message)) return getAlertAnswer(context);
    if (isExecutiveQuestion(context.message)) return getExecutiveAnswer(context);

    const areas = selectedAreas(context.message);
    if (!areas.length) return unavailableOutput("business", context.message);
    const range = resolveKmmDateRange(context.message, context.now);
    const product = resolveProduct(context.message);
    const comparePreviousMonth = wantsPreviousMonthComparison(context.message);
    const results = await Promise.all(areas.map((area) => {
      if (area === "sales") return getSalesAggregate(context.businessAccess!.companyId, range, product);
      if (area === "booking") return getBookingAggregate(context.businessAccess!.companyId, range, product);
      return getStockAggregate(context.businessAccess!.companyId, product, range);
    }));
    if (comparePreviousMonth && areas.includes("sales")) {
      results.push(await getSalesAggregate(
        context.businessAccess.companyId,
        previousMonthRange(context.now),
        product,
      ));
    }
    const data = { source: "KMM Internal Data", range, results };
    return { answer: formatBusinessAnswer(context.message, data), data };
  },
};

export function isKmmBusinessQuestion(message: string) {
  if (isKmmSecurityRequest(message) || isTargetBusinessQuestion(message) || SALESPERSON_REQUEST.test(message)) return true;
  if (isExecutiveQuestion(message) || ALERT_REQUEST.test(message) || BRIEFING_REQUEST.test(message)) return true;
  if (/(stock market|ตลาดหุ้น)/i.test(message)) return false;
  return (BUSINESS_CONTEXT.test(message) || hasNamedMonthReference(message))
    && (SALES_REQUEST.test(message) || BOOKING_REQUEST.test(message) || STOCK_REQUEST.test(message));
}

export function isExecutiveQuestion(message: string) { return EXECUTIVE_REQUEST.test(message); }

async function getAlertAnswer(context: Parameters<KaiTool["execute"]>[0]): Promise<KaiToolOutput> {
  const range = resolveKmmDateRange(context.message, context.now);
  if (range.kind !== "dateRange") return unavailableOutput("business", context.message);
  const snapshot = await buildExecutiveSnapshot(context.businessAccess!.companyId, { start: range.start, end: range.end, scopeLabel: range.scopeLabel }, undefined, context.now);
  const alerts = evaluateExecutiveAlerts(snapshot, deriveExecutiveSignals(snapshot), context.now.toISOString(), range.end >= context.now.toISOString().slice(0, 10) ? "MTD" : "COMPLETED");
  const selected = resolveProduct(context.message); const visible = selected ? alerts.filter((alert) => alert.subject.includes(selected)) : alerts;
  const lines = ["Executive Alerts"];
  for (const level of ["CRITICAL", "WARNING", "WATCH", "POSITIVE"] as const) {
    const group = visible.filter((alert) => alert.severity === level); if (group.length) lines.push(`${level} (${group.length})`, ...group.map((alert) => `• ${alert.summary}`));
  }
  if (!visible.length) lines.push("No deterministic alerts for this scope.");
  lines.push(`ข้อมูล ณ: ${range.scopeLabel}`, `แหล่งข้อมูล: KMM Internal Data`);
  return { answer: lines.join("\n"), data: { source: "KMM Internal Data", alerts: visible, period: range.scopeLabel } };
}

async function getBriefingAnswer(context: Parameters<KaiTool["execute"]>[0]): Promise<KaiToolOutput> {
  const weekly = executiveWeekScope(context.message, context.now); const range = weekly?.period ?? resolveKmmDateRange(context.message, context.now);
  if (range.kind !== "dateRange") return unavailableOutput("business", context.message);
  const mode = weekly ? "weekly" : /(วันนี้|daily)/i.test(context.message) ? "daily" : "monthly";
  const isMtd = mode === "monthly" && range.end >= context.now.toISOString().slice(0,10);
  const snapshot = await buildExecutiveSnapshot(context.businessAccess!.companyId, { start: range.start, end: range.end, scopeLabel: range.scopeLabel }, weekly?.previous, context.now);
  const status = weekly ? "WEEKLY" : mode === "daily" ? "DAILY" : isMtd ? "MTD" : "COMPLETED";
  const signals = deriveExecutiveSignals(snapshot);
  const alerts = evaluateExecutiveAlerts(snapshot, signals, context.now.toISOString(), status);
  const groups = groupExecutiveSignals(signals);
  const recommendations = executiveRecommendations(snapshot, groups);
  return { answer: composeExecutiveBriefing(snapshot, alerts, recommendations, mode, isMtd), data: { source: "KMM Internal Data", briefing: mode, mtd: isMtd, alerts } };
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
    branchRequested: /\bKMM0[123]\b|(?:สาขา|branch)\s*(?:KMM)?0?[123]/i.test(message),
    wantsActualComparison: /(?:achievement|gap|ทำยอด.*(?:%|เป้า)|ได้กี่\s*%|เหลือกี่|ส่วนต่าง)/i.test(message),
  };
}

async function getTargetAnswer(context: Parameters<KaiTool["execute"]>[0]): Promise<KaiToolOutput> {
  const thai = /[\u0e00-\u0e7f]/.test(context.message);
  const intent = resolveTargetIntent(context.message);
  if (intent.branchRequested) {
    return { answer: thai ? "ยังไม่มี Target ระดับสาขาในแหล่งข้อมูลปัจจุบัน" : "Branch-level Targets are not available in the current approved source.", data: { unavailable: "branch_target", source: "KMM Approved Target" } };
  }
  if (intent.requestedSeparateExOrTp) {
    return { answer: thai ? "Target ในแหล่งข้อมูลปัจจุบันรวม Excavator และ Rice Transplanter เป็น EX&TP จึงยังไม่มี Target แยกรายสินค้า" : "The approved source combines Excavator and Rice Transplanter as EX&TP, so separate product Targets are unavailable.", data: { unavailable: "separate_ex_tp_target", source: "KMM Approved Target" } };
  }
  const range = resolveKmmDateRange(context.message, context.now);
  if (range.kind !== "dateRange" || range.start.slice(0, 7) !== range.end.slice(0, 7)) {
    return { answer: thai ? "กรุณาระบุเดือนและปีเดียวสำหรับ Target เนื่องจาก Target ต้องใช้ขอบเขตเดือนที่แน่นอน" : "Please specify one calendar month and year for Target data; targets require an exact monthly scope.", data: { unavailable: "target_scope", source: "KMM Approved Target" } };
  }
  const year = Number(range.start.slice(0, 4));
  const month = Number(range.start.slice(5, 7));
  const target = await getCompanyMonthlyTarget({ companyId: context.businessAccess!.companyId, year, month, metric: intent.metric, productGroup: intent.productGroup });
  if (!target) return unavailableOutput("target", context.message);
  const actual = intent.wantsActualComparison
    ? await getSalesAggregate(context.businessAccess!.companyId, range, intent.productGroup === "TT" ? "TT" : intent.productGroup === "CH" ? "CH" : null)
    : null;
  const actualValue = actual
    ? intent.metric === "SALES_REVENUE" ? actual.salesValue : intent.metric === "GP1" ? actual.grossProfit : actual.units
    : null;
  const progress = actualValue === null ? null : targetProgress(actualValue, target.target);
  const sourceLabel = target.sourceVersion === "2026-Original-H1"
    ? (thai ? "KMM Approved Target · Original H1 2026" : "KMM Approved Target · Original H1 2026")
    : (thai ? "KMM Approved Target · Revised H2 2026" : "KMM Approved Target · Revised H2 2026");
  const metricLabel = target.metric === "SALES_REVENUE" ? (thai ? "Target Revenue" : "Revenue Target") : target.metric === "GP1" ? "GP1 Target" : (thai ? "Target Sales" : "Sales Target");
  const unit = target.metric === "SALES_UNITS" ? (thai ? " คัน" : " units") : "";
  const lines = [
    `KMM · ${formatDateScope(range, thai)}`,
    `• ${metricLabel}: ${target.metric === "SALES_UNITS" ? formatNumber(target.target) : formatMoney(target.target)}${unit}`,
  ];
  const targetEvaluationEligible = canEvaluateFullPeriodTarget(range, context.now);
  if (actualValue !== null && progress) {
    lines.push(`• ${thai ? "ผลงานจริง" : "Actual"}: ${target.metric === "SALES_UNITS" ? formatNumber(actualValue) : formatMoney(actualValue)}${unit}`);
    if (targetEvaluationEligible) {
      lines.push(`• ${thai ? "Achievement" : "Achievement"}: ${formatNumber(progress.achievementPercent)}%`);
      lines.push(`• Gap: ${target.metric === "SALES_UNITS" ? formatNumber(progress.gap) : formatMoney(progress.gap)}${unit}`);
    } else {
      lines.push(thai ? "• งวดยังไม่สิ้นสุด: Target แสดงเป็นข้อมูลประกอบเท่านั้น ยังไม่ประเมินผลทั้งเดือน" : "• Period incomplete: Target is context only; full-period performance is not evaluated.");
    }
    lines.push(`${thai ? "ข้อมูลจริง" : "Actual source"}: KMM Internal Data`);
  }
  lines.push(`${thai ? "เป้าหมาย" : "Target source"}: ${sourceLabel}`);
  return { answer: lines.join("\n"), data: { target, actual: actualValue, progress, source: "KMM Approved Target", range } };
}

async function getExecutiveAnswer(context: Parameters<KaiTool["execute"]>[0]): Promise<KaiToolOutput> {
  const thai = /[\u0e00-\u0e7f]/.test(context.message);
  const weekly = executiveWeekScope(context.message, context.now);
  const range = weekly?.period ?? resolveKmmDateRange(context.message, context.now);
  if (range.kind !== "dateRange" || range.start.slice(0, 7) !== range.end.slice(0, 7)) {
    return { answer: thai ? "ข้อมูลยังไม่เพียงพอสำหรับสรุป Executive Intelligence ในขอบเขตนี้ กรุณาระบุเดือนและปีเดียว" : "Executive Intelligence requires one explicit calendar month and year for this scope.", data: { unavailable: "executive_scope" } };
  }
  const snapshot = await buildExecutiveSnapshot(context.businessAccess!.companyId, { start: range.start, end: range.end, scopeLabel: range.scopeLabel }, weekly?.previous, context.now);
  const signals = deriveExecutiveSignals(snapshot);
  const priorities = rankExecutivePriorities(signals);
  const groups = groupExecutiveSignals(signals);
  const recommendations = executiveRecommendations(snapshot, groups);
  const mode = executiveMode(context.message);
  if (mode === "why") return executiveWhyAnswer(context.message, snapshot, signals, priorities, range, thai);
  if (mode === "product") return executiveProductAnswer(snapshot, signals, range, thai);
  if (mode === "branch") return executiveBranchAnswer(snapshot, range, thai);
  const hasPrior = snapshot.priorSales.units > 0 || snapshot.priorBooking.units > 0;
  const lines = [thai ? "Executive Summary" : "Executive Summary", `• ${thai ? "Sales" : "Sales"}: ${formatNumber(snapshot.sales.units)} ${thai ? "คัน" : "units"} · ${formatMoney(snapshot.sales.value)}`, `• ${thai ? "กำไรขั้นต้น" : "Gross Profit"}: ${formatMoney(snapshot.sales.gp)}${snapshot.sales.gpPercent === null ? "" : ` · ${formatNumber(snapshot.sales.gpPercent)}%`}`, `• ${thai ? "Booking" : "Booking"}: ${formatNumber(snapshot.booking.units)} ${thai ? "คัน" : "units"} · ${formatMoney(snapshot.booking.value)}`, `• ${thai ? "Stock" : "Stock"}: ${formatNumber(snapshot.stock.units)} ${thai ? "คัน" : "units"} · ${formatMoney(snapshot.stock.value)}`];
  if (snapshot.target && snapshot.progress) lines.push(snapshot.targetEvaluationEligible
    ? `• ${thai ? "Target" : "Target"}: ${formatNumber(snapshot.target.target)} ${thai ? "คัน" : "units"} · ${formatNumber(snapshot.progress.achievementPercent)}% · Gap ${formatNumber(snapshot.progress.gap)}`
    : `• ${thai ? "Target (ข้อมูลประกอบ)" : "Target (context only)"}: ${formatNumber(snapshot.target.target)} ${thai ? "คัน" : "units"} · ${thai ? "งวดยังไม่สิ้นสุด จึงไม่ประเมินผลทั้งงวด" : "period incomplete; no full-period assessment"}`);
  if (range.end > isoDate(context.now)) lines.push(thai ? "หมายเหตุ: ข้อมูลเดือนปัจจุบันเป็น Month-to-Date; การเปรียบเทียบกับเดือนก่อนเป็นเพียงข้อมูลประกอบ" : "Note: current-month data is Month-to-Date; the prior-month comparison is contextual only.");
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
  lines.push(`${thai ? "ช่วงข้อมูล" : "Data scope"}: ${formatDateScope(range, thai)}`);
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

function executiveWeekScope(message: string, now: Date) {
  if (!/(สัปดาห์นี้|this week)/i.test(message)) return null;
  const local = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Yangon" }));
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

function executiveMode(message: string): "summary" | "detailed" | "why" | "product" | "branch" {
  if (/(ทำไม|why)/i.test(message)) return "why";
  if (/(สินค้าไหน|แยกตามสินค้า|which product)/i.test(message)) return "product";
  if (/(สาขาไหน|แยกตามสาขา|which branch)/i.test(message)) return "branch";
  return /(ละเอียด|ขอรายละเอียด|detail)/i.test(message) ? "detailed" : "summary";
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
export function resolveKmmDateRange(message: string, now: Date): DateRange {
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
  const local = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Yangon" }));
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
  const previous = /(เดือนก่อน|เดือนที่แล้ว|last month|previous month)/i.test(message);
  return monthRange(
    previous && local.getMonth() === 0 ? local.getFullYear() - 1 : local.getFullYear(),
    previous ? (local.getMonth() || 12) : local.getMonth() + 1,
    previous ? "previous month" : "current month",
  );
}

function wantsPreviousMonthComparison(message: string) {
  return /(เทียบ.*เดือนก่อน|เดือนนี้.*เทียบ|month.?over.?month|mom|compare.*last month)/i.test(message);
}

function previousMonthRange(now: Date) {
  const local = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Yangon" }));
  const year = local.getMonth() === 0 ? local.getFullYear() - 1 : local.getFullYear();
  const month = local.getMonth() || 12;
  return monthRange(year, month, "previous month");
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

export function formatBusinessAnswer(message: string, data: { source: string; range: DateRange; results: unknown[] }) {
  const thai = /[\u0e00-\u0e7f]/.test(message);
  if (SALES_AREA_RANKING_REQUEST.test(message)) return formatSalesAreaRanking(message, data, thai);
  const branchReport = /(แยกตามสาขา|สาขาไหน|ทุกสาขา|by branch|which branch)/i.test(message);
  const lines: string[] = [];
  for (const result of data.results as Array<Record<string, unknown>>) {
    if (result.area === "sales") {
      lines.push(`${thai ? "ยอดขาย KMM" : "KMM Sales"}${result.range && (result.range as DateRange).label === "previous month" ? (thai ? " — เดือนก่อน" : " — previous month") : ""}`);
      lines.push(`• ${thai ? "Sales" : "Sales"}: ${formatNumber(result.units)} ${thai ? "คัน" : "units"}`);
      lines.push(`• ${thai ? "Sales Value" : "Sales Value"}: ${formatMoney(result.salesValue)}`);
      lines.push(`• ${thai ? "กำไรขั้นต้น" : "Gross Profit"}: ${formatMoney(result.grossProfit)}`);
      if (result.grossProfitPercent !== null) lines.push(`• GP: ${formatNumber(result.grossProfitPercent)}%`);
      if (branchReport) appendBranchLines(lines, result.branchBreakdown, "sales", thai);
    }
    if (result.area === "booking") {
      lines.push(thai ? "Booking KMM" : "KMM Booking");
      lines.push(`• ${thai ? "รับจอง" : "Open bookings"}: ${formatNumber(result.units)} ${thai ? "คัน" : "units"}`);
      lines.push(`• ${thai ? "มูลค่าจอง" : "Booking Value"}: ${formatMoney(result.bookingValue)}`);
      if (branchReport) appendBranchLines(lines, result.branchBreakdown, "booking", thai);
    }
    if (result.area === "stock") {
      lines.push(thai ? "Stock KMM" : "KMM Stock");
      if (result.dataAvailable === false) {
        lines.push(thai ? "• ไม่มี Stock snapshot ในช่วงเวลาที่ถาม" : "• No Stock snapshot is available in the requested period");
      } else {
        lines.push(`• ${thai ? "คงเหลือ" : "Available"}: ${formatNumber(result.units)} ${thai ? "คัน" : "units"}`);
        lines.push(`• ${thai ? "มูลค่า Stock" : "Stock Value"}: ${formatMoney(result.stockValue)}`);
        lines.push(`${thai ? "ข้อมูล Stock ณ วันที่" : "Stock snapshot"}: ${String(result.snapshotDate ?? "not available")}`);
        if (branchReport) appendBranchLines(lines, result.branchBreakdown, "stock", thai);
      }
    }
  }
  if ((data.results as Array<Record<string, unknown>>).some((result) => result.area !== "stock" || result.dataAvailable === false)) {
    lines.push(`${thai ? "ช่วงข้อมูล" : "Data range"}: ${formatDateScope(data.range, thai)}`);
  }
  lines.push(`${thai ? "แหล่งข้อมูล" : "Source"}: ${data.source}`);
  return lines.join("\n");
}

function formatSalesAreaRanking(message: string, data: { source: string; range: DateRange; results: unknown[] }, thai: boolean) {
  const sales = (data.results as Array<Record<string, unknown>>).find((result) => result.area === "sales");
  const requestedLimit = Number(message.match(/(?:อันดับ\s*1\s*[-–—]\s*|top\s*)(\d{1,2})/i)?.[1] ?? 5);
  const limit = Math.min(Math.max(requestedLimit, 1), 10);
  const byValue = /(มูลค่า|ยอดเงิน|revenue|sales\s*value)/i.test(message);
  const rows = (Array.isArray(sales?.branchBreakdown) ? sales.branchBreakdown : []) as Array<Record<string, unknown>>;
  const ranked = [...rows]
    .sort((left, right) => Number(byValue ? right.salesValue : right.units) - Number(byValue ? left.salesValue : left.units)
      || Number(right.salesValue) - Number(left.salesValue))
    .slice(0, limit);
  const lines = [thai
    ? `อันดับสาขาตาม${byValue ? "มูลค่ายอดขาย" : "จำนวน Sales Unit"}`
    : `Branch ranking by ${byValue ? "Sales Value" : "Sales Unit"}`];
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

function appendBranchLines(lines: string[], value: unknown, area: BusinessArea, thai: boolean) {
  const branches = Array.isArray(value) ? value.slice(0, 10) as Array<Record<string, unknown>> : [];
  if (!branches.length) return;
  lines.push(thai ? "แยกตามสาขา:" : "By branch:");
  for (const branch of branches) {
    const amount = area === "sales" ? branch.salesValue : area === "booking" ? branch.bookingValue : branch.stockValue;
    lines.push(`• ${String(branch.branch)}: ${formatNumber(branch.units)} ${thai ? "คัน" : "units"} · ${formatMoney(amount)}`);
  }
}

function formatNumber(value: unknown) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(Number(value ?? 0)); }
function formatMoney(value: unknown) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value ?? 0)); }

function securityOutput(kind: "sql" | "mutation" | "pii" | "authorization", message: string): KaiToolOutput {
  const thai = /[\u0e00-\u0e7f]/.test(message);
  const answer = kind === "sql"
    ? (thai
      ? "KAI ไม่อนุญาตให้รันหรือเปิดเผย SQL สำหรับฐานข้อมูลภายใน KMM โดยตรง แต่สามารถสรุปข้อมูลที่คุณมีสิทธิ์เข้าถึงผ่านเครื่องมือแบบ Read-only ได้"
      : "KAI does not allow direct SQL execution or disclosure for KMM internal databases. I can summarize data you are authorized to access through read-only tools.")
    : kind === "mutation"
      ? (thai
        ? "KAI อยู่ในโหมด Read-only และไม่สามารถแก้ไข ลบ หรือเพิ่มข้อมูล KMM ได้"
        : "KAI is read-only and cannot modify, delete, or add KMM data.")
      : kind === "pii"
        ? (thai
          ? "KAI ไม่สามารถเปิดเผยข้อมูลดิบหรือข้อมูลลูกค้าได้"
          : "KAI cannot disclose raw records or customer information.")
        : (thai
          ? "KAI ไม่สามารถเปลี่ยนบริษัทหรือข้ามสิทธิ์การเข้าถึงได้"
          : "KAI cannot switch companies or bypass access permissions.");
  return { answer, data: { denied: true, kind, source: "KMM Internal Data" } };
}
function accessDeniedOutput(message: string): KaiToolOutput {
  return { answer: /[\u0e00-\u0e7f]/.test(message) ? "คุณไม่มีสิทธิ์เข้าถึง KMM Business Intelligence" : "You do not have permission to access KMM Business Intelligence.", data: { denied: true } };
}
function unavailableOutput(kind: "target" | "salesperson" | "business", message: string): KaiToolOutput {
  const thai = /[\u0e00-\u0e7f]/.test(message);
  const answer = kind === "target"
    ? (thai ? "ข้อมูล Target ยังไม่ได้เชื่อมต่อกับ KAI" : "Target data is not available in KAI yet.")
    : kind === "salesperson"
      ? (thai ? "KAI ยังไม่เปิดใช้ข้อมูลผลการปฏิบัติงานรายบุคคล เนื่องจากระบบสิทธิ์ระดับพนักงานยังอยู่ระหว่างการจัดเตรียม" : "Individual performance data is not enabled while employee-level permissions are being prepared.")
      : (thai ? "KAI ไม่พบข้อมูล KMM สำหรับคำถามนี้" : "KAI could not find KMM data for this question.");
  return { answer, data: { unavailable: kind, source: "KMM Internal Data" } };
}
