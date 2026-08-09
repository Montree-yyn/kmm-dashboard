import { adaptBookingRow, adaptStockRow } from "../operations/adapters";
import { listBookingTransactions, listStockTransactions } from "../operations/repository";
import { getBookingValue, getOpenBookingUnit, normalizeBookingProduct } from "../dashboard/booking-selectors";
import { getCurrentStockRows, getStockUnit, getStockValue, normalizeProductType } from "../dashboard/stock-selectors";
import { toCanonicalSalesRow } from "../sales/compatibility-adapter";
import { filterSalesRows, getSalesKpis } from "../sales/business-service";
import { listSalesTransactions } from "../sales/repository";
import { getCompanyMonthlyTarget, targetProgress } from "../targets/business-service";

type Period = { start: string; end: string; scopeLabel: string };
type Product = "TT" | "CH" | "EX" | "TP";
type Metric = { units: number; value: number; gp: number; gpPercent: number | null };

export const EXECUTIVE_THRESHOLDS = Object.freeze({
  achievement: { achieved: 100, near: 90, attention: 70 },
  momentumPercent: 5,
  stockCoverMonths: 3,
});

export type ExecutiveSignal = {
  code: "TARGET_AHEAD" | "TARGET_NEAR" | "TARGET_GAP" | "TARGET_MATERIAL_GAP" | "POSITIVE_MOMENTUM" | "NEGATIVE_MOMENTUM" | "HIGH_STOCK_LOW_SALES" | "ZERO_SALES_WITH_STOCK" | "GP_PRESSURE" | "BOOKING_IMPROVING" | "BOOKING_WEAKENING" | "SALES_GAP_BOOKING_IMPROVING" | "SALES_GAP_BOOKING_WEAKENING" | "INVENTORY_PRESSURE_BOOKING_IMPROVING" | "SALES_UP_BOOKING_DOWN";
  severity: "positive" | "attention" | "high" | "neutral";
  detail: string;
  values: Record<string, number | string | null>;
};

export type ExecutivePriority = {
  rank: number;
  signal: ExecutiveSignal["code"];
  severity: "critical" | "high" | "medium" | "low" | "positive";
  evidence: Record<string, number | string | null>;
  reason: string;
};

export type ExecutiveSignalGroup = {
  code: ExecutiveSignal["code"];
  severity: ExecutiveSignal["severity"];
  subjects: string[];
  signals: ExecutiveSignal[];
};

export type ExecutiveRecommendation = { text: string; reason: string };

function number(value: number | null) { return value ?? 0; }
function percent(current: number, previous: number) { return previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100; }
function dateRows<T extends { date: string }>(rows: T[], period: Period) { return rows.filter((row) => row.date >= period.start && row.date <= period.end); }
function metric(rows: ReturnType<typeof toCanonicalSalesRow>[]): Metric {
  const kpis = getSalesKpis(rows);
  const value = number(kpis.salesValue);
  const gp = number(kpis.grossProfit);
  return { units: kpis.salesUnit, value, gp, gpPercent: value > 0 && kpis.grossProfitAvailable ? (gp / value) * 100 : null };
}
function previousMonth(period: Period): Period {
  const date = new Date(`${period.start}T00:00:00Z`);
  const previous = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  const year = previous.getUTCFullYear(); const month = previous.getUTCMonth() + 1;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start, end, scopeLabel: `${year}-${String(month).padStart(2, "0")}` };
}

/** One controlled read-only payload for an executive question. Raw rows never reach Qwen. */
export async function buildExecutiveSnapshot(companyId: string, period: Period, comparisonPeriod?: Period) {
  const previous = comparisonPeriod ?? previousMonth(period);
  const [salesRaw, bookingRaw, stockRaw] = await Promise.all([listSalesTransactions(companyId), listBookingTransactions(companyId), listStockTransactions(companyId)]);
  const sales = salesRaw.map(toCanonicalSalesRow);
  const booking = bookingRaw.map((row) => adaptBookingRow(row as unknown as Record<string, unknown>));
  const stock = getCurrentStockRows(stockRaw.map((row) => adaptStockRow(row as unknown as Record<string, unknown>)));
  const currentSales = dateRows(sales, period); const priorSales = dateRows(sales, previous);
  const currentBooking = dateRows(booking, period); const priorBooking = dateRows(booking, previous);
  const current = metric(currentSales); const prior = metric(priorSales);
  const bookingMetric = { units: getOpenBookingUnit(currentBooking), value: getBookingValue(currentBooking) };
  const priorBookingMetric = { units: getOpenBookingUnit(priorBooking), value: getBookingValue(priorBooking) };
  const year = Number(period.start.slice(0, 4)); const month = Number(period.start.slice(5, 7));
  const target = await getCompanyMonthlyTarget({ companyId, year, month, metric: "SALES_UNITS" });
  const progress = target ? targetProgress(current.units, target.target) : null;
  const products = await Promise.all((["TT", "CH", "EX", "TP"] as Product[]).map(async (product) => {
    const salesRows = filterSalesRows(currentSales, { productGroup: [product] });
    const salesMetric = metric(salesRows);
    const bookingRows = currentBooking.filter((row) => normalizeBookingProduct(row.productType) === product);
    const stockRows = stock.filter((row) => normalizeProductType(row) === product);
    const productTarget = product === "TT" || product === "CH"
      ? await getCompanyMonthlyTarget({ companyId, year, month, metric: "SALES_UNITS", productGroup: product })
      : null;
    return { product, sales: salesMetric, booking: { units: getOpenBookingUnit(bookingRows), value: getBookingValue(bookingRows) }, stock: { units: getStockUnit(stockRows), value: getStockValue(stockRows) }, target: productTarget?.target ?? null, stockCoverProxy: salesMetric.units > 0 ? getStockUnit(stockRows) / salesMetric.units : null };
  }));
  const branches = [...new Set([...currentSales.map((row) => row.branch), ...currentBooking.map((row) => row.branch), ...stock.map((row) => row.branch)].filter(Boolean))].map((branch) => {
    const rowMetric = metric(currentSales.filter((row) => row.branch === branch));
    const bookingRows = currentBooking.filter((row) => row.branch === branch);
    const stockRows = stock.filter((row) => row.branch === branch);
    return { branch, sales: rowMetric, booking: { units: getOpenBookingUnit(bookingRows), value: getBookingValue(bookingRows) }, stock: { units: getStockUnit(stockRows), value: getStockValue(stockRows) } };
  }).sort((a, b) => b.sales.units - a.sales.units || b.sales.value - a.sales.value);
  return { period, previous, sales: current, priorSales: prior, booking: bookingMetric, priorBooking: priorBookingMetric, stock: { units: getStockUnit(stock), value: getStockValue(stock), snapshotDate: stock.map((row) => row.snapshotDate).filter(Boolean).sort().at(-1) ?? null }, target, progress, products, branches };
}

export function deriveExecutiveSignals(snapshot: Awaited<ReturnType<typeof buildExecutiveSnapshot>>): ExecutiveSignal[] {
  const signals: ExecutiveSignal[] = [];
  const achievement = snapshot.progress?.achievementPercent ?? null;
  if (achievement !== null) {
    if (achievement >= EXECUTIVE_THRESHOLDS.achievement.achieved) signals.push({ code: "TARGET_AHEAD", severity: "positive", detail: "Sales is at or above the approved company Target.", values: { achievement, gap: snapshot.progress?.gap ?? null } });
    else if (achievement >= EXECUTIVE_THRESHOLDS.achievement.near) signals.push({ code: "TARGET_NEAR", severity: "attention", detail: "Sales is close to the approved company Target.", values: { achievement, gap: snapshot.progress?.gap ?? null } });
    else if (achievement >= EXECUTIVE_THRESHOLDS.achievement.attention) signals.push({ code: "TARGET_GAP", severity: "attention", detail: "Sales is below Target and needs attention.", values: { achievement, gap: snapshot.progress?.gap ?? null } });
    else signals.push({ code: "TARGET_MATERIAL_GAP", severity: "high", detail: "Sales is materially below the approved company Target.", values: { achievement, gap: snapshot.progress?.gap ?? null } });
  }
  const salesChange = percent(snapshot.sales.units, snapshot.priorSales.units);
  if (salesChange !== null && salesChange >= EXECUTIVE_THRESHOLDS.momentumPercent) signals.push({ code: "POSITIVE_MOMENTUM", severity: "positive", detail: "Sales Units increased versus the prior comparable period.", values: { salesChange } });
  if (salesChange !== null && salesChange <= -EXECUTIVE_THRESHOLDS.momentumPercent) signals.push({ code: "NEGATIVE_MOMENTUM", severity: "attention", detail: "Sales Units declined versus the prior comparable period.", values: { salesChange } });
  const bookingChange = percent(snapshot.booking.units, snapshot.priorBooking.units);
  if (bookingChange !== null && bookingChange >= EXECUTIVE_THRESHOLDS.momentumPercent) signals.push({ code: "BOOKING_IMPROVING", severity: "positive", detail: "Open Booking Units improved versus the prior comparable period.", values: { bookingChange } });
  if (bookingChange !== null && bookingChange <= -EXECUTIVE_THRESHOLDS.momentumPercent) signals.push({ code: "BOOKING_WEAKENING", severity: "attention", detail: "Open Booking Units weakened versus the prior comparable period.", values: { bookingChange } });
  const gpChange = snapshot.sales.gpPercent !== null && snapshot.priorSales.gpPercent !== null ? snapshot.sales.gpPercent - snapshot.priorSales.gpPercent : null;
  if (gpChange !== null && gpChange <= -2) signals.push({ code: "GP_PRESSURE", severity: "attention", detail: "GP% declined by at least two percentage points versus the prior comparable period.", values: { gpChange } });
  for (const product of snapshot.products) {
    if (product.stock.units > 0 && product.sales.units === 0) signals.push({ code: "ZERO_SALES_WITH_STOCK", severity: "high", detail: `${product.product} has current Stock but no Sales Units in the selected period.`, values: { product: product.product, stock: product.stock.units, sales: product.sales.units } });
    else if (product.stockCoverProxy !== null && product.stockCoverProxy >= EXECUTIVE_THRESHOLDS.stockCoverMonths) signals.push({ code: "HIGH_STOCK_LOW_SALES", severity: "attention", detail: `${product.product} Stock Cover Proxy is elevated.`, values: { product: product.product, stock: product.stock.units, sales: product.sales.units, stockCoverProxy: product.stockCoverProxy } });
  }
  // Relationships are deterministic observations only. They explicitly do not
  // assert that one KPI caused another KPI to move.
  const hasSalesGap = signals.some((signal) => signal.code === "TARGET_GAP" || signal.code === "TARGET_MATERIAL_GAP");
  const bookingImproving = signals.some((signal) => signal.code === "BOOKING_IMPROVING");
  const bookingWeakening = signals.some((signal) => signal.code === "BOOKING_WEAKENING");
  const inventoryPressure = signals.some((signal) => signal.code === "HIGH_STOCK_LOW_SALES" || signal.code === "ZERO_SALES_WITH_STOCK");
  const salesImproving = signals.some((signal) => signal.code === "POSITIVE_MOMENTUM");
  if (hasSalesGap && bookingImproving) signals.push({ code: "SALES_GAP_BOOKING_IMPROVING", severity: "attention", detail: "Sales is below Target while the forward Booking pipeline improved.", values: { sales: snapshot.sales.units, booking: snapshot.booking.units } });
  if (hasSalesGap && bookingWeakening) signals.push({ code: "SALES_GAP_BOOKING_WEAKENING", severity: "high", detail: "Sales is below Target and the Booking pipeline weakened in the same comparison.", values: { sales: snapshot.sales.units, booking: snapshot.booking.units } });
  if (inventoryPressure && bookingImproving) signals.push({ code: "INVENTORY_PRESSURE_BOOKING_IMPROVING", severity: "attention", detail: "Inventory pressure remains, while Booking improved and should be monitored for conversion.", values: { stock: snapshot.stock.units, booking: snapshot.booking.units } });
  if (salesImproving && bookingWeakening) signals.push({ code: "SALES_UP_BOOKING_DOWN", severity: "attention", detail: "Current Sales improved while the forward Booking pipeline weakened.", values: { sales: snapshot.sales.units, booking: snapshot.booking.units } });
  return signals;
}

/**
 * Explainable ordering, not an AI score. Severity is determined from the
 * approved signal type, then ties are resolved by the observed exposure.
 */
export function rankExecutivePriorities(signals: ExecutiveSignal[]): ExecutivePriority[] {
  const weight: Record<ExecutiveSignal["code"], number> = {
    TARGET_MATERIAL_GAP: 500, ZERO_SALES_WITH_STOCK: 450, SALES_GAP_BOOKING_WEAKENING: 420,
    HIGH_STOCK_LOW_SALES: 350, GP_PRESSURE: 300, BOOKING_WEAKENING: 280,
    SALES_GAP_BOOKING_IMPROVING: 250, INVENTORY_PRESSURE_BOOKING_IMPROVING: 230,
    SALES_UP_BOOKING_DOWN: 220, TARGET_GAP: 210, TARGET_NEAR: 120, NEGATIVE_MOMENTUM: 110,
    TARGET_AHEAD: -100, POSITIVE_MOMENTUM: -90, BOOKING_IMPROVING: -80,
  };
  const severityFor = (signal: ExecutiveSignal): ExecutivePriority["severity"] => {
    if (signal.code === "TARGET_AHEAD" || signal.code === "POSITIVE_MOMENTUM" || signal.code === "BOOKING_IMPROVING") return "positive";
    if (signal.code === "TARGET_MATERIAL_GAP" || signal.code === "ZERO_SALES_WITH_STOCK") return "critical";
    if (signal.severity === "high") return "high";
    return signal.severity === "attention" ? "medium" : "low";
  };
  return [...signals]
    .sort((a, b) => (weight[b.code] + numericExposure(b.values)) - (weight[a.code] + numericExposure(a.values)))
    .map((signal, index) => ({ rank: index + 1, signal: signal.code, severity: severityFor(signal), evidence: signal.values, reason: signal.detail }));
}

/** Presentation-only grouping retains every original signal for audit/Ask Why. */
export function groupExecutiveSignals(signals: ExecutiveSignal[]): ExecutiveSignalGroup[] {
  const grouped = new Map<string, ExecutiveSignalGroup>();
  for (const signal of signals) {
    const subject = typeof signal.values.product === "string"
      ? signal.values.product
      : typeof signal.values.branch === "string"
        ? signal.values.branch
        : null;
    const key = `${signal.code}:${subject ? "subject" : "company"}`;
    const existing = grouped.get(key) ?? { code: signal.code, severity: signal.severity, subjects: [], signals: [] };
    if (subject && !existing.subjects.includes(subject)) existing.subjects.push(subject);
    existing.signals.push(signal);
    grouped.set(key, existing);
  }
  return [...grouped.values()];
}

export function selectExecutiveSignalGroups(groups: ExecutiveSignalGroup[], limit = 3) {
  const category = (code: ExecutiveSignal["code"]) => {
    if (code === "HIGH_STOCK_LOW_SALES" || code === "ZERO_SALES_WITH_STOCK" || code === "INVENTORY_PRESSURE_BOOKING_IMPROVING") return "inventory";
    if (code === "GP_PRESSURE") return "gp";
    if (code === "BOOKING_WEAKENING" || code === "SALES_GAP_BOOKING_WEAKENING" || code === "SALES_UP_BOOKING_DOWN") return "booking";
    return "sales";
  };
  const severity = { high: 4, attention: 3, neutral: 2, positive: 1 } as const;
  const sorted = [...groups].sort((a, b) => severity[b.severity] - severity[a.severity] || b.signals.length - a.signals.length);
  const selected: ExecutiveSignalGroup[] = [];
  const seen = new Set<string>();
  for (const group of sorted) {
    const key = category(group.code);
    if (seen.has(key)) continue;
    selected.push(group); seen.add(key);
    if (selected.length === limit) break;
  }
  return selected;
}

function numericExposure(values: ExecutiveSignal["values"]) {
  return Object.values(values).reduce<number>((sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? Math.min(Math.abs(value), 100) : 0), 0);
}

export function recommendationsFor(signals: ExecutiveSignal[]) {
  const recommendations: string[] = [];
  if (signals.some((signal) => signal.code === "TARGET_MATERIAL_GAP" || signal.code === "TARGET_GAP")) recommendations.push("Prioritize the largest current sales gap and review the near-term Booking pipeline.");
  if (signals.some((signal) => signal.code === "HIGH_STOCK_LOW_SALES" || signal.code === "ZERO_SALES_WITH_STOCK")) recommendations.push("Prioritize sales activity for products with elevated Stock Cover Proxy or zero period Sales.");
  if (signals.some((signal) => signal.code === "BOOKING_WEAKENING")) recommendations.push("Review Booking follow-up and conversion discipline; this is a signal, not a causal finding.");
  if (signals.some((signal) => signal.code === "GP_PRESSURE")) recommendations.push("Review the lower-GP product and branch mix before changing commercial actions.");
  return recommendations.slice(0, 3);
}

export function executiveRecommendations(snapshot: Awaited<ReturnType<typeof buildExecutiveSnapshot>>, groups: ExecutiveSignalGroup[]): ExecutiveRecommendation[] {
  const recommendations: ExecutiveRecommendation[] = [];
  const inventory = groups.find((group) => group.code === "ZERO_SALES_WITH_STOCK" || group.code === "HIGH_STOCK_LOW_SALES");
  if (inventory) {
    const subject = inventory.subjects.join(" และ ");
    recommendations.push({ text: subject ? `เร่งติดตามการขาย ${subject} ตามสัญญาณ Stock` : "เร่งติดตามสินค้าที่มีสัญญาณ Stock", reason: subject ? `${subject} มี Stock แต่ยอดขายในงวดยังต้องติดตาม` : "Stock Cover Proxy อยู่ในระดับที่ควรจับตา" });
  }
  if (groups.some((group) => group.code === "TARGET_MATERIAL_GAP" || group.code === "TARGET_GAP")) recommendations.push({ text: "โฟกัสช่องว่างยอดขายระดับบริษัท", reason: "ยอดขายยังต่ำกว่า Target ที่อนุมัติ" });
  if (groups.some((group) => group.code === "BOOKING_WEAKENING" || group.code === "SALES_GAP_BOOKING_WEAKENING" || group.code === "SALES_UP_BOOKING_DOWN")) recommendations.push({ text: "ทบทวนการติดตาม Booking และการเปลี่ยนเป็นยอดขาย", reason: "Booking เป็นสัญญาณของ pipeline ที่ควรติดตาม ไม่ใช่ข้อสรุปเชิงสาเหตุ" });
  if (groups.some((group) => group.code === "GP_PRESSURE")) recommendations.push({ text: "ติดตาม GP% ระดับบริษัทควบคู่กับยอดขาย", reason: "ข้อมูลยืนยันแรงกดดัน GP% ระดับบริษัท แต่ยังไม่ระบุสาเหตุรายสินค้า/สาขา" });
  return recommendations.slice(0, 3);
}
