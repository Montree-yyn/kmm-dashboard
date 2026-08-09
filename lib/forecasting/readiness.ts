/**
 * Phase 4C is deliberately offline/read-only. These transparent baselines are
 * for readiness and backtesting only; no caller may present a forecast to KAI.
 */
export const FORECAST_READINESS_RULES = Object.freeze({
  minCompletedMonths: 24,
  minNonZeroMonths: 12,
  maxMissingMonthRatio: 0.1,
  wape: { high: 0.15, moderate: 0.25, low: 0.35 },
});

export type ForecastSourceRow = {
  date: string;
  quantity: number;
  salesValue: number;
  gp: number | null;
  product: string;
  branch: string;
};

export type MonthlyActual = {
  month: string;
  salesUnits: number;
  salesValue: number;
  gp: number;
  gpPercent: number | null;
  rowCount: number;
};

export type ForecastMethod = "naive" | "movingAverage3" | "movingAverage6" | "seasonalNaive" | "weightedMovingAverage" | "median3" | "median6" | "trimmedMean6" | "ewma" | "seasonalWeighted" | "seasonalMedian";
export type ForecastMetrics = { mae: number | null; rmse: number | null; mape: number | null; wape: number | null; samples: number; skippedZeroActuals: number };
export type Readiness = "HIGH_CONFIDENCE" | "MODERATE_CONFIDENCE" | "LOW_CONFIDENCE" | "NOT_RELIABLE" | "INSUFFICIENT_DATA";

const ENGINE_PRODUCTS = new Set(["TT", "CH", "EX", "TP"]);

export function normalizeForecastProduct(value: string) {
  const text = value.trim().toUpperCase();
  const match = text.match(/(?:^|[-\s])(TT|CH|EX|TP)(?:$|[-\s])/);
  return match?.[1] ?? text;
}

export function monthKey(date: string) { return date.slice(0, 7); }
export function monthEnd(month: string) { return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10); }
export function isCompletedMonth(month: string, asOf: string) { return monthEnd(month) < asOf.slice(0, 10); }

/** Builds actuals only. Target values are intentionally absent from this type. */
export function buildMonthlyActuals(rows: ForecastSourceRow[], asOf: string, filter: (row: ForecastSourceRow) => boolean = () => true): MonthlyActual[] {
  const grouped = new Map<string, MonthlyActual>();
  for (const row of rows) {
    const month = monthKey(row.date);
    if (!isCompletedMonth(month, asOf) || !filter(row)) continue;
    const current = grouped.get(month) ?? { month, salesUnits: 0, salesValue: 0, gp: 0, gpPercent: null, rowCount: 0 };
    const product = normalizeForecastProduct(row.product);
    // Canonical Sales rule: only engine products contribute Sales Units; every
    // valid row remains in Sales Value and GP.
    if (ENGINE_PRODUCTS.has(product)) current.salesUnits += row.quantity;
    current.salesValue += row.salesValue;
    current.gp += row.gp ?? 0;
    current.rowCount += 1;
    grouped.set(month, current);
  }
  return [...grouped.values()].sort((a, b) => a.month.localeCompare(b.month)).map((row) => ({ ...row, gpPercent: row.salesValue > 0 ? (row.gp / row.salesValue) * 100 : null }));
}

export function missingMonths(months: readonly string[]) {
  if (!months.length) return [];
  const set = new Set(months);
  const missing: string[] = [];
  const cursor = new Date(`${months[0]}-01T00:00:00Z`);
  const end = new Date(`${months.at(-1)}-01T00:00:00Z`);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 7);
    if (!set.has(key)) missing.push(key);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return missing;
}

/** Longest contiguous actual run is the only series eligible for backtesting. */
export function longestContiguousRun<T extends { month: string }>(rows: readonly T[]) {
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month));
  let best: T[] = []; let current: T[] = [];
  for (const row of sorted) {
    const expected = current.length ? addMonths(current.at(-1)!.month, 1) : row.month;
    if (row.month !== expected) current = [];
    current.push(row);
    if (current.length > best.length) best = [...current];
  }
  return best;
}

export function forecast(method: ForecastMethod, history: readonly number[]): number | null {
  if (!history.length) return null;
  if (method === "naive") return history.at(-1) ?? null;
  if (method === "movingAverage3") return mean(history.slice(-3));
  if (method === "movingAverage6") return history.length >= 6 ? mean(history.slice(-6)) : null;
  if (method === "seasonalNaive") return history.length >= 12 ? history.at(-12) ?? null : null;
  if (method === "median3") return history.length >= 3 ? median(history.slice(-3)) : null;
  if (method === "median6") return history.length >= 6 ? median(history.slice(-6)) : null;
  if (method === "trimmedMean6") { const recent = history.slice(-6); return recent.length >= 4 ? mean(recent.slice().sort((a, b) => a - b).slice(1, -1)) : null; }
  if (method === "ewma") return history.reduce((value, next) => value === null ? next : 0.5 * next + 0.5 * value, null as number | null);
  if (method === "seasonalWeighted") return history.length >= 12 ? 0.5 * (history.at(-12) ?? 0) + 0.5 * mean(history.slice(-3)) : null;
  if (method === "seasonalMedian") {
    if (history.length < 24) return null;
    const targetMonth = history.length % 12;
    const matching = history.filter((_, index) => index % 12 === targetMonth);
    return matching.length >= 2 ? median(matching) : null;
  }
  if (history.length < 3) return null;
  const recent = history.slice(-3);
  return recent[2] * 0.5 + recent[1] * 0.3 + recent[0] * 0.2;
}

export type ForecastStability = { bias: number | null; medianAbsoluteError: number | null; worstQuarterWape: number | null; within20Percent: number | null; within30Percent: number | null };
export function walkForwardStability(values: readonly number[], method: ForecastMethod, horizon = 1, minTrainingMonths = 12): ForecastStability {
  const samples: Array<{ error: number; actual: number }> = [];
  for (let origin = minTrainingMonths; origin + horizon <= values.length; origin += 1) {
    const prediction = forecast(method, values.slice(0, origin)); const actual = values[origin + horizon - 1];
    if (prediction === null || actual === undefined) continue;
    samples.push({ error: prediction - actual, actual });
  }
  const abs = samples.map((sample) => Math.abs(sample.error));
  const nonZero = samples.filter((sample) => sample.actual !== 0);
  const quarters = Array.from({ length: Math.ceil(samples.length / 3) }, (_, index) => samples.slice(index * 3, index * 3 + 3)).filter(Boolean);
  const quarterWapes = quarters.map((quarter) => quarter.reduce((sum, sample) => sum + Math.abs(sample.error), 0) / quarter.reduce((sum, sample) => sum + Math.abs(sample.actual), 0)).filter(Number.isFinite);
  return { bias: samples.length ? mean(samples.map((sample) => sample.error)) : null, medianAbsoluteError: abs.length ? median(abs) : null, worstQuarterWape: quarterWapes.length ? Math.max(...quarterWapes) : null, within20Percent: nonZero.length ? nonZero.filter((sample) => Math.abs(sample.error / sample.actual) <= .2).length / nonZero.length : null, within30Percent: nonZero.length ? nonZero.filter((sample) => Math.abs(sample.error / sample.actual) <= .3).length / nonZero.length : null };
}

export function structuralBreakDiagnostics(values: readonly number[]) {
  if (values.length < 12) return { possibleRegimeChange: false, recentMean: null, priorMean: null, meanShift: null, varianceRatio: null };
  const recent = values.slice(-6); const prior = values.slice(-12, -6); const recentMean = mean(recent); const priorMean = mean(prior);
  const variance = (items: readonly number[]) => mean(items.map((item) => (item - mean(items)) ** 2));
  const meanShift = priorMean ? (recentMean - priorMean) / priorMean : null; const varianceRatio = variance(prior) ? variance(recent) / variance(prior) : null;
  return { possibleRegimeChange: Math.abs(meanShift ?? 0) >= .3 || (varianceRatio ?? 0) >= 2, recentMean, priorMean, meanShift, varianceRatio };
}

export function walkForward(values: readonly number[], method: ForecastMethod, horizon: number = 1, minTrainingMonths: number = 12): ForecastMetrics {
  const errors: number[] = []; let squared = 0; let absoluteActual = 0; let skippedZeroActuals = 0;
  for (let origin = minTrainingMonths; origin + horizon <= values.length; origin += 1) {
    const prediction = forecast(method, values.slice(0, origin));
    const actual = values[origin + horizon - 1];
    if (prediction === null || actual === undefined) continue;
    const error = Math.abs(prediction - actual);
    errors.push(error); squared += error ** 2; absoluteActual += Math.abs(actual);
    if (actual === 0) skippedZeroActuals += 1;
  }
  const mapeTerms = errors.map((error, index) => ({ error, actual: values[minTrainingMonths + index + horizon - 1] })).filter(({ actual }) => actual !== 0).map(({ error, actual }) => error / Math.abs(actual));
  return { mae: errors.length ? mean(errors) : null, rmse: errors.length ? Math.sqrt(squared / errors.length) : null, mape: mapeTerms.length ? mean(mapeTerms) : null, wape: absoluteActual > 0 ? errors.reduce((sum, error) => sum + error, 0) / absoluteActual : null, samples: errors.length, skippedZeroActuals };
}

export function classifyReadiness(input: { completedMonths: number; nonZeroMonths: number; missingRatio: number; metrics: ForecastMetrics | null; recentMetrics?: ForecastMetrics | null; stability?: ForecastStability | null; possibleRegimeChange?: boolean }): Readiness {
  const { completedMonths, nonZeroMonths, missingRatio, metrics, recentMetrics, stability, possibleRegimeChange } = input;
  if (completedMonths < FORECAST_READINESS_RULES.minCompletedMonths || nonZeroMonths < FORECAST_READINESS_RULES.minNonZeroMonths || missingRatio > FORECAST_READINESS_RULES.maxMissingMonthRatio || !metrics?.wape) return "INSUFFICIENT_DATA";
  // Do not let a favorable full-history average hide a deteriorating current
  // regime or a severely unstable quarter. This remains a conservative gate.
  if ((recentMetrics?.wape ?? 0) > FORECAST_READINESS_RULES.wape.low || (stability?.worstQuarterWape ?? 0) > .6 || (possibleRegimeChange && (recentMetrics?.wape ?? 0) > FORECAST_READINESS_RULES.wape.moderate)) return "NOT_RELIABLE";
  if (metrics.wape < FORECAST_READINESS_RULES.wape.high) return "HIGH_CONFIDENCE";
  if (metrics.wape < FORECAST_READINESS_RULES.wape.moderate) return "MODERATE_CONFIDENCE";
  if (metrics.wape < FORECAST_READINESS_RULES.wape.low) return "LOW_CONFIDENCE";
  return "NOT_RELIABLE";
}

export function compareBaselines(values: readonly number[], horizons: readonly number[] = [1, 2, 3]) {
  const methods: ForecastMethod[] = ["naive", "movingAverage3", "movingAverage6", "seasonalNaive", "weightedMovingAverage", "median3", "median6", "trimmedMean6", "ewma", "seasonalWeighted", "seasonalMedian"];
  return Object.fromEntries(horizons.map((horizon) => {
    const results = methods.map((method) => ({ method, metrics: walkForward(values, method, horizon) }));
    const usable = results.filter((result) => result.metrics.wape !== null).sort((a, b) => (a.metrics.wape ?? Infinity) - (b.metrics.wape ?? Infinity));
    return [horizon, { results, best: usable[0] ?? null }];
  }));
}

export function detectOutliers(values: readonly MonthlyActual[]) {
  const units = values.map((row) => row.salesUnits); const average = mean(units); const deviation = Math.sqrt(mean(units.map((value) => (value - average) ** 2)));
  return values.filter((row) => deviation > 0 && Math.abs(row.salesUnits - average) > deviation * 2).map((row) => row.month);
}

export function seasonalitySummary(rows: readonly MonthlyActual[]) {
  const nonZeroMonths = rows.filter((row) => row.salesUnits > 0).length;
  if (rows.length < 24) return { sufficient: false, nonZeroMonths, monthOfYear: [] as Array<{ month: number; average: number; observations: number }> };
  const buckets = new Map<number, number[]>();
  for (const row of rows) { const month = Number(row.month.slice(5)); buckets.set(month, [...(buckets.get(month) ?? []), row.salesUnits]); }
  const monthOfYear = [...buckets.entries()].map(([month, values]) => ({ month, average: mean(values), observations: values.length })).sort((a, b) => a.month - b.month);
  // Calendar coverage alone is not evidence of seasonality for a sparse
  // product. Require two full years of non-zero monthly observations too.
  return { sufficient: nonZeroMonths >= 24 && monthOfYear.every((row) => row.observations >= 2), nonZeroMonths, monthOfYear };
}

function addMonths(month: string, count: number) { const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + count); return date.toISOString().slice(0, 7); }
function mean(values: readonly number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function median(values: readonly number[]) { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
