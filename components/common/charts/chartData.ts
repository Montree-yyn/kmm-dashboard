import type { StackedColumnSeries } from "./AnalyticalCharts";
import { chartTheme } from "./chartTheme";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type LifecycleRow = {
  year: number | null;
  month: number | null;
  status?: string | null;
};

export const businessStatusColor = (label: string, index: number) => {
  const status = label.trim().toLowerCase();
  if (status === "delivered" || status.includes("complete")) return chartTheme.status.positive;
  if (status === "cancelled" || status === "canceled") return chartTheme.status.negative;
  if (status === "open" || status.includes("confirm") || status.includes("pending")) return chartTheme.status.warning;
  return [chartTheme.previous, chartTheme.product.muted, chartTheme.product.neutral][index % 3];
};

export function buildMonthlyLifecycle(
  rows: LifecycleRow[],
  { maxPeriods = 12, maxSeries = 4 }: { maxPeriods?: number; maxSeries?: number } = {},
) {
  const validRows = rows.filter(
    (row): row is LifecycleRow & { year: number; month: number } =>
      row.year !== null &&
      row.month !== null &&
      Number.isFinite(row.year) &&
      row.month >= 1 &&
      row.month <= 12,
  );
  const periodKeys = Array.from(
    new Set(validRows.map((row) => row.year * 100 + row.month)),
  )
    .sort((left, right) => left - right)
    .slice(-maxPeriods);
  const periodSet = new Set(periodKeys);
  const periodRows = validRows.filter((row) =>
    periodSet.has(row.year * 100 + row.month),
  );
  const statusCounts = new Map<string, number>();
  periodRows.forEach((row) => {
    const label = row.status?.trim() || "Status unavailable";
    statusCounts.set(label, (statusCounts.get(label) ?? 0) + 1);
  });
  const rankedStatuses = [...statusCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([label]) => label);
  const primaryStatuses = rankedStatuses.slice(0, maxSeries);
  const hasOther = rankedStatuses.length > maxSeries;
  const statusLabels = hasOther ? [...primaryStatuses, "Other"] : primaryStatuses;
  const spansYears = new Set(periodKeys.map((key) => Math.floor(key / 100))).size > 1;
  const labels = periodKeys.map((key) => {
    const year = Math.floor(key / 100);
    const month = key % 100;
    return spansYears ? `${MONTHS[month - 1]} '${String(year).slice(-2)}` : MONTHS[month - 1];
  });
  const series: StackedColumnSeries[] = statusLabels.map((label, index) => ({
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `status-${index}`,
    label,
    color: businessStatusColor(label, index),
    values: periodKeys.map((periodKey) =>
      periodRows.filter((row) => {
        const rowStatus = row.status?.trim() || "Status unavailable";
        const matchesStatus = label === "Other"
          ? !primaryStatuses.includes(rowStatus)
          : rowStatus === label;
        return row.year * 100 + row.month === periodKey && matchesStatus;
      }).length,
    ),
  }));

  return { labels, series };
}
