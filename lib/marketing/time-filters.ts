export type PeriodMode = "this-month" | "previous-month" | "this-quarter" | "previous-quarter" | "this-year" | "ytd" | "rolling-12-months" | "custom";
export type ComparisonMode = "none" | "previous-period" | "same-period-last-year" | "previous-year" | "custom";
export type ExecutiveMetricKey = "salesUnit" | "salesValue" | "achievement" | "gpValue" | "bookingUnit" | "installedBase" | "activities";

export type DateRange = { dateFrom: string; dateTo: string };
export type ExecutiveGisFilters = DateRange & {
  periodMode: PeriodMode;
  comparisonMode: ComparisonMode;
  comparisonDateFrom: string;
  comparisonDateTo: string;
  activeMetric: ExecutiveMetricKey;
};

export const PROJECT_TIMEZONE = "Asia/Bangkok";

const pad = (value: number) => String(value).padStart(2, "0");
const key = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const localDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const addDays = (dateKey: string, days: number) => {
  const date = localDate(dateKey);
  date.setDate(date.getDate() + days);
  return key(date);
};
const addMonths = (dateKey: string, months: number) => {
  const date = localDate(dateKey);
  date.setMonth(date.getMonth() + months);
  return key(date);
};
const startOfMonth = (year: number, month: number) => `${year}-${pad(month)}-01`;
const endOfMonth = (year: number, month: number) => key(new Date(year, month, 0));
const startOfQuarter = (year: number, month: number) => startOfMonth(year, Math.floor((month - 1) / 3) * 3 + 1);
const endOfQuarter = (year: number, month: number) => endOfMonth(year, Math.floor((month - 1) / 3) * 3 + 3);

export function defaultExecutiveGisFilters(): ExecutiveGisFilters {
  const dateFrom = "2026-01-01";
  const dateTo = "2026-06-30";
  const comparison = resolveComparison("previous-year", { dateFrom, dateTo });
  return { periodMode: "ytd", dateFrom, dateTo, comparisonMode: "previous-year", comparisonDateFrom: comparison.dateFrom, comparisonDateTo: comparison.dateTo, activeMetric: "salesUnit" };
}

export function dateKeyFromRow(row: { date?: string; year: number | null; month: number | null }) {
  const direct = row.date?.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (direct) return `${direct[1]}-${pad(Number(direct[2]))}-${pad(Number(direct[3]))}`;
  if (row.year !== null && row.month !== null) return startOfMonth(row.year, row.month);
  return null;
}

export function rowInDateRange(row: { date?: string; year: number | null; month: number | null }, range: DateRange) {
  const value = dateKeyFromRow(row);
  if (!value) return false;
  if (!row.date && row.year !== null && row.month !== null) return endOfMonth(row.year, row.month) >= range.dateFrom && startOfMonth(row.year, row.month) <= range.dateTo;
  return value >= range.dateFrom && value <= range.dateTo;
}

export function resolvePeriod(mode: PeriodMode, anchorDate: string, custom?: DateRange): DateRange {
  if (mode === "custom" && custom && custom.dateFrom <= custom.dateTo) return custom;
  const anchor = localDate(anchorDate);
  const year = anchor.getFullYear();
  const month = anchor.getMonth() + 1;
  if (mode === "this-month") return { dateFrom: startOfMonth(year, month), dateTo: endOfMonth(year, month) };
  if (mode === "previous-month") {
    const previous = localDate(startOfMonth(year, month));
    previous.setMonth(previous.getMonth() - 1);
    return { dateFrom: startOfMonth(previous.getFullYear(), previous.getMonth() + 1), dateTo: endOfMonth(previous.getFullYear(), previous.getMonth() + 1) };
  }
  if (mode === "this-quarter") return { dateFrom: startOfQuarter(year, month), dateTo: endOfQuarter(year, month) };
  if (mode === "previous-quarter") {
    const previous = localDate(startOfQuarter(year, month));
    previous.setMonth(previous.getMonth() - 3);
    return { dateFrom: startOfQuarter(previous.getFullYear(), previous.getMonth() + 1), dateTo: endOfQuarter(previous.getFullYear(), previous.getMonth() + 1) };
  }
  if (mode === "this-year") return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
  if (mode === "rolling-12-months") return { dateFrom: addDays(addMonths(anchorDate, -12), 1), dateTo: anchorDate };
  return { dateFrom: `${year}-01-01`, dateTo: anchorDate };
}

export function resolveComparison(mode: ComparisonMode, current: DateRange, custom?: DateRange): DateRange {
  if (mode === "none") return { dateFrom: "", dateTo: "" };
  if (mode === "custom" && custom && custom.dateFrom <= custom.dateTo) return custom;
  const from = localDate(current.dateFrom);
  const to = localDate(current.dateTo);
  if (mode === "same-period-last-year" || mode === "previous-year") {
    from.setFullYear(from.getFullYear() - 1);
    to.setFullYear(to.getFullYear() - 1);
    return { dateFrom: key(from), dateTo: key(to) };
  }
  const durationDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const comparisonDateTo = addDays(current.dateFrom, -1);
  return { dateFrom: addDays(comparisonDateTo, 1 - durationDays), dateTo: comparisonDateTo };
}

export function formatPeriodLabel(range: DateRange) {
  if (!range.dateFrom || !range.dateTo) return "No comparison";
  const from = localDate(range.dateFrom);
  const to = localDate(range.dateTo);
  const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth() && from.getDate() === 1 && range.dateTo === endOfMonth(to.getFullYear(), to.getMonth() + 1);
  if (sameMonth) return from.toLocaleString("en-US", { month: "short", year: "numeric" });
  return `${from.toLocaleString("en-US", { day: "numeric", month: "short" })} - ${to.toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric" })}`;
}

export function changeSummary(current: number, comparison: number) {
  const delta = current - comparison;
  return { delta, percent: comparison === 0 ? null : (delta / comparison) * 100, direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat" as "up" | "down" | "flat" };
}
