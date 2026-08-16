"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { PRODUCT_GROUPS } from "../../lib/dashboard/product-groups";
import { ChartCard } from "../design-system/chart-card";
import { EmptyState } from "../design-system/empty-state";
import { ErrorState } from "../design-system/error-state";
import { ExportButton } from "../design-system/export-button";
import { LoadingSkeleton } from "../design-system/loading-skeleton";
import { KpiCard } from "../design-system/kpi-card";
import { ProductBadge } from "../design-system/product-badge";
import { FilterBar } from "../design-system/filter-bar";
import { MultiSelectFilter } from "../design-system/data-controls";
import { FreshnessIndicator } from "../design-system/freshness-indicator";
import { ResponsiveDataTable } from "../design-system/responsive-data-table";
import { PremiumTrendChart } from "../common/charts/PremiumTrendChart";
import type { StandardLineSeries } from "../common/charts/StandardLineChart";
import {
  BulletChart,
  CumulativeRankChart,
  LollipopChart,
  PercentStackedBar,
} from "../common/charts/AnalyticalCharts";
import { chartProductColor, chartTheme } from "../common/charts/chartTheme";
import { loadLiveSalesData } from "../../lib/sales/client";
import {
  getBranchSummary,
  getModelSummary,
  getProductSummary,
  getSalesAsp,
  getSalesKpis,
  getSalespersonSummary,
  getTargetAvailability,
  salesProductGroup,
} from "../../lib/sales/business-service";
import { useLocale } from "../../src/hooks/useLocale";
import { useCompany } from "../../src/hooks/useCompany";

// Legacy QA fallback contract remains available through fetch(`/dashboard-data.json?ts=${Date.now()}`).

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
const PRODUCT_FILTER_OPTIONS = [
  "All Products",
  ...PRODUCT_GROUPS.UNIT_PRODUCTS,
];
type FilterKey = "year" | "month" | "branch" | "salesperson" | "productGroup";
type FilterState = Record<FilterKey, string[]>;

type SalesRow = {
  date: string;
  year: number;
  month: number | null;
  branch: string;
  salesperson: string;
  productType: string;
  model: string;
  quantity?: number;
  finalReceived: number | null;
  netReceived: number | null;
  gp1: number | null;
  expense: number | null;
};

type SalesData = {
  meta: { sourceUpdatedAt: string; sources: string[] };
  plan: { year: number; months: string[]; units: number[] };
  sales: SalesRow[];
};

type TrendMetric = "unit" | "value";
type MonthRange = "full" | "q1" | "q2" | "q3" | "q4" | "custom";
type TrendPoint = {
  month: number;
  label: string;
  values: Record<number, number | null>;
  target: number | null;
};

const defaultFilters: FilterState = {
  year: ["2026"],
  month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  branch: [],
  salesperson: [],
  productGroup: ["All Products"],
};

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000_000)
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatMoney(value: number) {
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function selectedYears(filters: FilterState) {
  return filters.year.map(Number).filter(Number.isFinite);
}

function selectedMonths(filters: FilterState) {
  return filters.month
    .map((month) => MONTHS.indexOf(month) + 1)
    .filter((month) => month > 0);
}

function selectedProductGroups(filters: FilterState) {
  const selected = filters.productGroup.filter(
    (group) => group !== "All Products",
  );
  return filters.productGroup.length === 0 ||
    filters.productGroup.includes("All Products")
    ? []
    : selected;
}

function rowMatches(
  row: {
    year: number | null;
    month: number | null;
    branch: string;
    salesperson: string;
    productType: string;
    model?: string;
  },
  filters: FilterState,
) {
  const years = selectedYears(filters);
  const months = selectedMonths(filters);
  const productGroups = selectedProductGroups(filters);
  if (years.length && (!row.year || !years.includes(row.year))) return false;
  if (months.length && (!row.month || !months.includes(row.month)))
    return false;
  if (filters.branch.length && !filters.branch.includes(row.branch))
    return false;
  if (
    filters.salesperson.length &&
    !filters.salesperson.includes(row.salesperson)
  )
    return false;
  if (productGroups.length && !productGroups.includes(salesProductGroup(row)))
    return false;
  return true;
}

function percentChange(current: number, previous: number) {
  return previous ? ((current - previous) / previous) * 100 : null;
}

function trendValue(value: number | null) {
  return value === null
                      ? "N/A"
    : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function trendDirection(
  value: number | null,
): "positive" | "negative" | "neutral" {
  if (value === null) return "neutral";
  return value >= 0 ? "positive" : "negative";
}

function previousYearFilters(filters: FilterState): FilterState {
  const years = selectedYears(filters);
  return {
    ...filters,
    year: years.length ? years.map((year) => String(year - 1)) : [],
  };
}

function targetValue(data: SalesData, filters: FilterState) {
  const years = selectedYears(filters);
  const hasDimensionTargetGap =
    filters.branch.length > 0 ||
    filters.salesperson.length > 0 ||
    selectedProductGroups(filters).length > 0;
  if (
    years.length !== 1 ||
    years[0] !== data.plan.year ||
    hasDimensionTargetGap
  )
    return null;
  const months = selectedMonths(filters);
  const indexes = months.length
    ? months.map((month) => month - 1)
    : data.plan.months.map((_, index) => index);
  const target = indexes.reduce(
    (total, index) => total + (data.plan.units[index] ?? 0),
    0,
  );
  return target > 0 ? target : null;
}

function KpiComparison({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  const direction = trendDirection(value);
  return {
    trendValue: trendValue(value),
    trendDirection:
      direction === "positive"
        ? ("up" as const)
        : direction === "negative"
          ? ("down" as const)
          : ("neutral" as const),
    comparisonLabel: label,
    status: direction,
  };
}

function SalesFilters({
  filters,
  options,
  onChange,
  onReset,
  onExport,
}: {
  filters: FilterState;
  options: FilterState;
  onChange: (key: FilterKey, values: string[]) => void;
  onReset: () => void;
  onExport: () => void;
}) {
  const { t } = useLocale();
  return (
    <FilterBar
      filterGridClassName="sm:grid-cols-2 xl:grid-cols-4"
      ariaLabel={t("common.filters")}
      actions={
        <>
          <Button
            className="h-11 border-[var(--border-default)] bg-[var(--surface-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            variant="outline"
            onClick={onReset}
          >
            <RotateCcw size={16} />
            {t("common.reset")}
          </Button>
          <ExportButton onClick={onExport} />
        </>
      }
    >
          <MultiSelectFilter
            label={t("filter.year")}
            options={options.year}
            values={filters.year}
            onChange={(values) => onChange("year", values)}
          />
          <MultiSelectFilter
            label={t("filter.month")}
            options={options.month}
            values={filters.month}
            onChange={(values) => onChange("month", values)}
          />
          <MultiSelectFilter
            label={t("filter.branch")}
            options={options.branch}
            values={filters.branch}
            onChange={(values) => onChange("branch", values)}
          />
          <MultiSelectFilter
            label={t("filter.productGroup")}
            options={options.productGroup}
            values={filters.productGroup}
            onChange={(values) => onChange("productGroup", values)}
            allValues={["All Products"]}
            allLabel={t("filter.allProducts")}
            getNextValues={(option, current) => {
              if (option === "All Products") return ["All Products"];
              const next = current.includes(option)
                ? current.filter((item) => item !== option)
                : [...current.filter((item) => item !== "All Products"), option];
              return next.length ? next : ["All Products"];
            }}
          />
    </FilterBar>
  );
}

function BarChart({
  data,
  limit,
  onViewAll,
}: {
  data: { label: string; value: number }[];
  limit?: number;
  onViewAll?: () => void;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const visible = limit ? sorted.slice(0, limit) : sorted;
  const max = Math.max(...visible.map((item) => item.value), 1);
  return (
    <div className="space-y-3.5">
      {visible.length ? (
        visible.map((item, index) => (
          <div
            key={item.label}
            className="grid grid-cols-[24px_minmax(88px,120px)_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--divider)] pb-3 text-sm last:border-b-0 last:pb-0"
          >
            <span className="kmm-tabular text-xs font-semibold text-[var(--text-tertiary)]" aria-label={`Rank ${index + 1}`}>
              {index + 1}
            </span>
            <span
              className="min-w-0 truncate font-medium text-[var(--text-primary)]"
              title={item.label}
            >
              {item.label}
            </span>
            <div className="h-2 rounded-full bg-[var(--surface-muted)]">
              <div
                className="h-2 rounded-full bg-[var(--brand-500)] transition-[width] duration-200"
                style={{
                  width: `${Math.max((item.value / max) * 100, item.value ? 5 : 0)}%`,
                }}
              />
            </div>
            <span className="kmm-tabular min-w-10 text-right text-xs font-semibold text-[var(--text-primary)]">
              {formatCompact(item.value)}
            </span>
          </div>
        ))
      ) : (
        <EmptyState />
      )}
      {limit && sorted.length > limit && (
        <button
          type="button"
          onClick={onViewAll}
          className="min-h-11 rounded-[var(--radius-control)] px-2 text-xs font-semibold text-[var(--brand-600)] hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
        >
          View All
        </button>
      )}
    </div>
  );
}

function cleanTicks(maxValue: number) {
  const rawStep = Math.max(maxValue, 1) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const nice =
    normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : 10;
  const step = nice * magnitude;
  return [0, step, step * 2, step * 3];
}

function SalesTrendChart({
  sales,
  filters,
  plan,
  currency = "MMK",
}: {
  sales: SalesRow[];
  filters: FilterState;
  plan: SalesData["plan"];
  currency?: string;
}) {
  const availableYears = useMemo(
    () => [...new Set(sales.map((row) => row.year))].sort((a, b) => b - a),
    [sales],
  );
  const currentYear = selectedYears(filters)[0] ?? availableYears[0];
  const [metric, setMetric] = useState<TrendMetric>("unit");
  const [years, setYears] = useState<number[]>(() =>
    [
      currentYear,
      ...availableYears.filter((year) => year < currentYear).slice(0, 1),
    ].filter((year, index, list) => list.indexOf(year) === index),
  );
  const [range, setRange] = useState<MonthRange>("full");
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(12);
  const [yearsOpen, setYearsOpen] = useState(false);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const rangeMonths =
    range === "full"
      ? MONTHS.map((_, index) => index + 1)
      : range === "custom"
        ? MONTHS.map((_, index) => index + 1).filter(
            (month) =>
              month >= Math.min(startMonth, endMonth) &&
              month <= Math.max(startMonth, endMonth),
          )
        : { q1: [1, 2, 3], q2: [4, 5, 6], q3: [7, 8, 9], q4: [10, 11, 12] }[
            range
          ];
  const scopedRows = sales.filter((row) =>
    rowMatches(row, { ...filters, year: [], month: [] }),
  );
  const visibleYears = years.filter((year) => availableYears.includes(year));
  const targetYear = visibleYears.includes(currentYear)
    ? currentYear
    : visibleYears[0];
  const targetAllowed =
    metric === "unit" &&
    targetYear === plan.year &&
    filters.branch.length === 0 &&
    filters.salesperson.length === 0 &&
    selectedProductGroups(filters).length === 0;
  const points: TrendPoint[] = rangeMonths.map((month) => ({
    month,
    label: MONTHS[month - 1],
    values: Object.fromEntries(
      visibleYears.map((year) => {
        const monthRows = scopedRows.filter(
          (row) => row.year === year && row.month === month,
        );
        const kpis = getSalesKpis(monthRows);
        return [
          year,
          monthRows.length
            ? metric === "unit"
              ? kpis.salesUnit
              : kpis.salesValue
            : null,
        ];
      }),
    ),
    target:
      targetAllowed && (plan.units[month - 1] ?? 0) > 0
        ? plan.units[month - 1]
        : null,
  }));
  const maxValue = Math.max(
    ...points.flatMap((point) => [
      ...Object.values(point.values).map((value) => value ?? 0),
      point.target ?? 0,
    ]),
    1,
  );
  const ticks = cleanTicks(maxValue);
  const maxTick = ticks.at(-1) ?? 1;
  const width = 920;
  const height = 365;
  const padX = 74;
  const padY = 42;
  const xFor = (index: number) =>
    padX + (index * (width - padX * 2)) / Math.max(points.length - 1, 1);
  const yFor = (value: number) =>
    height - padY - (value / maxTick) * (height - padY * 2);
  const path = (values: (number | null)[]) =>
    values.reduce((result, value, index) => {
      if (value === null) return result;
      const previous = values[index - 1];
      if (previous === null || previous === undefined)
        return `${result} M ${xFor(index)} ${yFor(value)}`;
      const middle = (xFor(index - 1) + xFor(index)) / 2;
      return `${result} C ${middle} ${yFor(previous)}, ${middle} ${yFor(value)}, ${xFor(index)} ${yFor(value)}`;
    }, "");
  const styles = [
    { color: chartTheme.current, dash: undefined, label: "Current" },
    { color: chartTheme.previous, dash: undefined, label: "Previous" },
    { color: chartTheme.older[0], dash: undefined, label: "Comparison" },
  ];
  const valueLabel = metric === "unit" ? "Sales Unit" : "Sales Value";
  const formatMetric = (value: number | null) =>
    value === null
      ? "No data"
      : metric === "unit"
        ? value.toLocaleString()
        : `${formatCompact(value)} ${currency}`;
  const hovered = hoveredMonth === null ? null : points[hoveredMonth];
  const baseYear = visibleYears[0];
  const comparisonYear = visibleYears[1];

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-wrap gap-4 text-xs font-semibold text-[#4B5563]">
          {visibleYears.map((year, index) => (
            <span key={year} className="flex items-center gap-2">
              <i
                className="h-0 w-7 border-t-[3px]"
                style={{
                  borderColor: styles[index]?.color ?? chartTheme.target,
                  borderStyle: styles[index]?.dash ? "dashed" : "solid",
                }}
              />
              {year} Actual
            </span>
          ))}
          {points.some((point) => point.target !== null) && (
            <span className="flex items-center gap-2">
              <i className="h-0 w-7 border-t-[3px] border-dotted" style={{ borderColor: chartTheme.target }} />
              {targetYear} Target
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="sales-trend-metric">
            Metric
          </label>
          <select
            id="sales-trend-metric"
            value={metric}
            onChange={(event) => setMetric(event.target.value as TrendMetric)}
            className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-semibold outline-none focus:border-[#FFB46E]"
          >
            <option value="unit">Sales Unit</option>
            <option value="value">Sales Value</option>
          </select>
          <div className="relative">
            <button
              type="button"
              onClick={() => setYearsOpen((open) => !open)}
              className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-semibold"
              aria-expanded={yearsOpen}
            >
              {visibleYears.length
                ? `${visibleYears.length} year${visibleYears.length === 1 ? "" : "s"}`
                : "Compare year"}
            </button>
            {yearsOpen && (
              <Card className="absolute right-0 top-10 z-30 w-40 p-2 shadow-xl">
                {availableYears.map((year) => (
                  <label
                    key={year}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-[#FFF7EF]"
                  >
                    <input
                      type="checkbox"
                      checked={visibleYears.includes(year)}
                      onChange={() =>
                        setYears((current) =>
                          current.includes(year)
                            ? current.filter((item) => item !== year)
                            : [...current, year].sort((a, b) => b - a),
                        )
                      }
                      className="accent-[#FF8615]"
                    />
                    {year}
                  </label>
                ))}
              </Card>
            )}
          </div>
          <label className="sr-only" htmlFor="sales-trend-range">
            Month range
          </label>
          <select
            id="sales-trend-range"
            value={range}
            onChange={(event) => setRange(event.target.value as MonthRange)}
            className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-semibold outline-none focus:border-[#FFB46E]"
          >
            <option value="full">Full Year</option>
            <option value="q1">Q1 · Jan–Mar</option>
            <option value="q2">Q2 · Apr–Jun</option>
            <option value="q3">Q3 · Jul–Sep</option>
            <option value="q4">Q4 · Oct–Dec</option>
            <option value="custom">Custom Range</option>
          </select>
          {range === "custom" && (
            <>
              <select
                value={startMonth}
                onChange={(event) => setStartMonth(Number(event.target.value))}
                aria-label="Start month"
                className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs"
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
              <select
                value={endMonth}
                onChange={(event) => setEndMonth(Number(event.target.value))}
                aria-label="End month"
                className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs"
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>
      <div className="relative">
        <svg
          className="h-[400px] w-full sm:h-[440px]"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Sales comparison trend by year"
          onMouseLeave={() => setHoveredMonth(null)}
        >
          <title>Sales comparison trend</title>
          {ticks.map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  stroke={chartTheme.grid}
                />
                <text
                  x={padX - 12}
                  y={y + 4}
                  textAnchor="end"
                  fill={chartTheme.text}
                  fontSize="12"
                  fontWeight="600"
                >
                  {metric === "unit"
                    ? tick.toLocaleString()
                    : formatCompact(tick)}
                </text>
              </g>
            );
          })}
          <text x={padX} y={18} fill={chartTheme.text} fontSize="12" fontWeight="700">
            {metric === "unit" ? "Unit" : currency}
          </text>
          {visibleYears.map((year, index) => (
            <g key={year}>
              <path
                d={path(points.map((point) => point.values[year]))}
                fill="none"
                stroke={styles[index]?.color ?? chartTheme.target}
                strokeWidth={index === 0 ? 4 : 3}
                strokeDasharray={styles[index]?.dash}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((point, pointIndex) =>
                point.values[year] === null ? null : (
                  <circle
                    key={`${year}-${point.month}`}
                    cx={xFor(pointIndex)}
                    cy={yFor(point.values[year] ?? 0)}
                    r={hoveredMonth === pointIndex ? 5.5 : 3.5}
                    fill={chartTheme.surface}
                    stroke={styles[index]?.color ?? chartTheme.target}
                    strokeWidth={2.5}
                    onMouseEnter={() => setHoveredMonth(pointIndex)}
                  />
                ),
              )}
            </g>
          ))}
          {points.some((point) => point.target !== null) && (
            <path
              d={path(points.map((point) => point.target))}
              fill="none"
              stroke={chartTheme.target}
              strokeWidth={2.25}
              strokeDasharray="2 7"
              strokeLinecap="round"
            />
          )}
          {points.map((point, index) => (
            <text
              key={point.month}
              x={xFor(index)}
              y={height - 10}
              textAnchor="middle"
              fill={chartTheme.text}
              fontSize="12"
              fontWeight="600"
            >
              {point.label}
            </text>
          ))}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-52 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#4B5563] shadow-[0_10px_28px_rgba(31,41,55,0.10)]"
            style={{
              left: `${Math.min(Math.max((xFor(hoveredMonth ?? 0) / width) * 100, 8), 72)}%`,
            }}
          >
            <p className="font-bold text-[#1F2937]">{hovered.label}</p>
            {visibleYears.map((year) => (
              <p key={year} className="mt-1">
                {year} {valueLabel}:{" "}
                <strong>{formatMetric(hovered.values[year])}</strong>
              </p>
            ))}
            {hovered.target !== null && (
              <>
                <p>
                  {targetYear} Target:{" "}
                  <strong>{formatMetric(hovered.target)}</strong>
                </p>
                <p>
                  Variance:{" "}
                  <strong>
                    {formatMetric(
                      (hovered.values[targetYear] ?? 0) - hovered.target,
                    )}
                  </strong>
                </p>
              </>
            )}
            {baseYear &&
              comparisonYear &&
              hovered.values[baseYear] !== null &&
              hovered.values[comparisonYear] !== null &&
              hovered.values[comparisonYear] !== 0 && (
                <p>
                  vs {comparisonYear}:{" "}
                  <strong>
                    {percentChange(
                      hovered.values[baseYear] ?? 0,
                      hovered.values[comparisonYear] ?? 0,
                    )?.toFixed(1)}
                    %
                  </strong>
                </p>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function ExecutiveSalesTrend({
  sales,
  filters,
  plan,
  currency,
}: {
  sales: SalesRow[];
  filters: FilterState;
  plan: SalesData["plan"];
  currency: string;
}) {
  const { t } = useLocale();
  const [metric, setMetric] = useState<TrendMetric>("unit");
  const availableYears = useMemo(
    () => [...new Set(sales.map((row) => row.year))].sort((a, b) => b - a),
    [sales],
  );
  const scopedRows = sales.filter((row) =>
    rowMatches(row, { ...filters, year: [], month: [] }),
  );
  const targetAllowed =
    metric === "unit" &&
    availableYears[0] === plan.year &&
    filters.branch.length === 0 &&
    filters.salesperson.length === 0 &&
    selectedProductGroups(filters).length === 0;
  const chartYears = [2026, 2025, 2024, 2023, 2022, ...availableYears].filter(
    (year, index, values) => values.indexOf(year) === index,
  );
  const series: StandardLineSeries[] = chartYears.map((year, index) => ({
    id: String(year),
    year,
    label: String(year),
    kind: index === 0 ? "current" : index === 1 ? "previous" : "older",
    values: MONTHS.map((_, month) => {
      const rows = scopedRows.filter(
        (row) => row.year === year && row.month === month + 1,
      );
      const kpis = getSalesKpis(rows);
      return rows.length
        ? metric === "unit"
          ? kpis.salesUnit
          : kpis.salesValue
        : null;
    }),
  }));
  if (targetAllowed)
    series.push({
      id: "target",
      year: plan.year,
      label: t("sales.target"),
      kind: "target",
      values: plan.units.map((value) => value || null),
    });
  return (
    <PremiumTrendChart
      title={t("chart.salesTrendTitle")}
      subtitle={t("chart.salesTrendDescription")}
      labels={MONTHS}
      unit={metric === "unit" ? t("common.units") : currency}
      formatValue={
        metric === "unit" ? (value) => value.toLocaleString() : formatCompact
      }
      metricOptions={[
        { id: "unit", label: t("metric.salesUnit") },
        { id: "value", label: t("metric.salesValue") },
      ]}
      defaultMetric="unit"
      onMetricChange={(value) => setMetric(value as TrendMetric)}
      defaultSeriesIds={["2026", "2025"]}
      series={series}
      className="min-w-0 !rounded-[var(--radius-card)] !border-[var(--border-default)] !bg-[var(--surface-default)] !shadow-[var(--shadow-card)] [&>header]:!border-[var(--divider)] [&>header]:!flex-col [&>header]:!items-stretch [&>header_h2]:!font-semibold [&>header_h2]:!tracking-normal [&>header_h2]:!text-[var(--text-primary)] [&>header_p]:!text-[var(--text-secondary)] [&>header>div:last-child]:!w-full [&>header>div:last-child]:!justify-start [&>header_button]:!h-11 [&>header_select]:!h-11 min-[1400px]:[&>header]:!flex-row min-[1400px]:[&>header]:!items-center min-[1400px]:[&>header>div:last-child]:!w-auto min-[1400px]:[&>header>div:last-child]:!justify-end"
    />
  );
}

function TargetProgressCard({
  target,
  actual,
}: {
  target: number | null;
  actual: number;
}) {
  const { t } = useLocale();

  return (
    <Card className="h-full min-h-[420px] min-w-0 rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[19px] font-semibold leading-tight tracking-normal text-[var(--text-primary)]">
            {t("sales.targetProgress")}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {t("sales.monthlyUnitPlan")}
          </p>
        </div>
        <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
          {t("metric.salesUnit")}
        </span>
      </div>
      <div className="mt-10">
        <BulletChart
          actual={actual}
          target={target}
          unit={t("common.units")}
          formatValue={formatCompact}
          actualLabel={t("sales.actual")}
          targetLabel={t("sales.target")}
          emptyMessage={t("sales.targetNotConfigured")}
        />
      </div>
    </Card>
  );
}

function SalesPageTable({
  rows,
  onExport,
}: {
  rows: SalesRow[];
  onExport: () => void;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<
    "date" | "branch" | "salesperson" | "model" | "value" | "gp"
  >("date");
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const searched = rows.filter((row) =>
    `${row.date} ${row.branch} ${row.salesperson} ${row.productType} ${row.model}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const sorted = [...searched].sort((a, b) => {
    const left =
      sortKey === "value"
        ? a.finalReceived
        : sortKey === "gp"
          ? a.gp1
          : sortKey === "model"
            ? a.model
            : a[sortKey];
    const right =
      sortKey === "value"
        ? b.finalReceived
        : sortKey === "gp"
          ? b.gp1
          : sortKey === "model"
            ? b.model
            : b[sortKey];
    const result =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right));
    return ascending ? result : -result;
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);
  function changeSort(key: typeof sortKey) {
    setPage(1);
    if (sortKey === key) setAscending((value) => !value);
    else {
      setSortKey(key);
      setAscending(false);
    }
  }
  const header = (label: string, key: typeof sortKey) => (
    <button
      type="button"
      onClick={() => changeSort(key)}
      className="min-h-11 whitespace-nowrap rounded-[var(--radius-control)] px-1 font-semibold text-[var(--text-secondary)] hover:bg-[var(--brand-50)] hover:text-[var(--brand-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
      aria-label={`Sort by ${label}`}
    >
      {label}
      {sortKey === key ? (ascending ? " ↑" : " ↓") : ""}
    </button>
  );

  return (
    <Card className="min-w-0 rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[19px] font-semibold leading-tight tracking-normal text-[var(--text-primary)]">
            {t("sales.transactionTableTitle")}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {t("sales.transactionTableDescription")}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-72">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              size={15}
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search transactions"
              aria-label="Search sales transactions"
              className="h-11 w-full rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-subtle)] pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--brand-500)] focus:bg-[var(--surface-default)]"
            />
          </div>
          <ExportButton onClick={onExport} />
        </div>
      </div>
      <div className="mt-6">
        {!rows.length ? (
          <EmptyState message="No sales transactions match the selected filters." />
        ) : (
          <ResponsiveDataTable
            ariaLabel="Sales transaction table"
            className="overflow-x-auto rounded-[var(--radius-control-lg)] border border-[var(--divider)]"
          >
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <th className="px-3 py-1">{header("Date", "date")}</th>
                  <th className="px-3 py-1">{header("Branch", "branch")}</th>
                  <th className="px-3 py-1">
                    {header("Salesperson", "salesperson")}
                  </th>
                  <th className="px-3 py-3 font-semibold">Product Group</th>
                  <th className="px-3 py-1">{header("Model", "model")}</th>
                  <th className="px-3 py-3 text-right font-semibold">
                    Quantity
                  </th>
                  <th className="px-3 py-1 text-right">
                    {header("Sales Value", "value")}
                  </th>
                  <th className="px-3 py-1 text-right">
                    {header("Gross Profit", "gp")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--divider)] text-[var(--text-secondary)]">
                {pageRows.map((row) => (
                  <tr
                    key={`${row.date}-${row.branch}-${row.salesperson}-${row.model}-${row.finalReceived}`}
                    className="transition-colors hover:bg-[var(--brand-50)]"
                  >
                    <td className="kmm-tabular whitespace-nowrap px-3 py-3.5">
                      {row.date}
                    </td>
                    <td className="px-3 py-3.5">{row.branch}</td>
                    <td className="px-3 py-3.5">{row.salesperson || "N/A"}</td>
                    <td className="px-3 py-3.5">
                      <ProductBadge
                        label={
                          salesProductGroup(row) === "Other"
                            ? "OT"
                            : salesProductGroup(row)
                        }
                      />
                    </td>
                    <td className="px-3 py-3.5">{row.model || "N/A"}</td>
                    <td className="px-3 py-3.5 text-right text-[var(--text-tertiary)]">
                      {row.quantity ?? 1}
                    </td>
                    <td className="kmm-tabular px-3 py-3.5 text-right font-semibold text-[var(--text-primary)]">
                      {row.finalReceived === null ? "Unavailable" : formatMoney(row.finalReceived)}
                    </td>
                    <td className="kmm-tabular px-3 py-3.5 text-right font-semibold text-[var(--text-primary)]">
                      {row.gp1 === null ? "Unavailable" : formatMoney(row.gp1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveDataTable>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
        <span className="kmm-tabular">{sorted.length} transactions</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
            className="grid size-11 place-items-center rounded-[var(--radius-control)] border border-[var(--border-default)] transition-colors hover:bg-[var(--surface-subtle)] disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="kmm-tabular min-w-12 text-center">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page === pageCount}
            onClick={() => setPage((value) => value + 1)}
            className="grid size-11 place-items-center rounded-[var(--radius-control)] border border-[var(--border-default)] transition-colors hover:bg-[var(--surface-subtle)] disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </Card>
  );
}

function exportRows(rows: SalesRow[], companyCode: string) {
  const csvRows = [
    [
      "Date",
      "Invoice",
      "Customer",
      "Branch",
      "Salesperson",
      "Product Group",
      "Model",
      "Quantity",
      "Sales Value",
      "Gross Profit",
      "Status",
    ],
    ...rows.map((row) => [
      row.date,
      "N/A",
      "N/A",
      row.branch,
      row.salesperson || "N/A",
      salesProductGroup(row),
      row.model || "N/A",
      String(row.quantity ?? 1),
      String(row.finalReceived),
      String(row.gp1),
      "N/A",
    ]),
  ];
  const csv = csvRows
    .map((row) =>
      row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${companyCode.toLowerCase()}-sales-transactions.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function filterOptions(rows: SalesRow[], filters: FilterState): FilterState {
  const availableRows = rows.filter((row) =>
    rowMatches(row, { ...filters, salesperson: [] }),
  );
  return {
    year: Array.from(new Set(rows.map((row) => String(row.year)))).sort(
      (a, b) => Number(b) - Number(a),
    ),
    month: MONTHS,
    branch: Array.from(new Set(rows.map((row) => row.branch)))
      .filter(Boolean)
      .sort(),
    salesperson: Array.from(
      new Set(availableRows.map((row) => row.salesperson)),
    )
      .filter(Boolean)
      .sort(),
    productGroup: PRODUCT_FILTER_OPTIONS,
  };
}

export function SalesPage() {
  const { t } = useLocale();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? "";
  const companyCode = selectedCompany?.code ?? "KMM";
  const currency = selectedCompany?.currency ?? "MMK";
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      setData(await loadLiveSalesData({ companyId }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load sales data",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    loadLiveSalesData({ companyId })
      .then((loadedData) => {
        if (!ignore) setData(loadedData);
      })
      .catch((loadError: unknown) => {
        if (!ignore)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load sales data",
          );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    const refreshAfterImport = () => { void loadData(); };
    window.addEventListener("kmm:sales-imported", refreshAfterImport);
    return () => {
      ignore = true;
      window.removeEventListener("kmm:sales-imported", refreshAfterImport);
    };
  }, [companyId]);

  const options = data
    ? filterOptions(data.sales, filters)
    : {
        year: ["2026"],
        month: MONTHS,
        branch: [],
        salesperson: [],
        productGroup: PRODUCT_FILTER_OPTIONS,
      };
  const rows = useMemo(
    () => data?.sales.filter((row) => rowMatches(row, filters)) ?? [],
    [data, filters],
  );
  const businessKpis = getSalesKpis(data?.sales ?? [], filters);
  const yearsForComparison = selectedYears(filters);
  const comparisonEnabled = yearsForComparison.length === 1;
  const previousBusinessKpis = comparisonEnabled
    ? getSalesKpis(data?.sales ?? [], previousYearFilters(filters))
    : null;
  const salesValue = businessKpis.salesValue ?? 0;
  const grossProfit = businessKpis.grossProfit ?? 0;
  const salesTarget = getTargetAvailability(filters, null).available ? (data ? targetValue(data, filters) : null) : null;
  const achievement =
    salesTarget && salesTarget > 0
      ? (businessKpis.salesUnit / salesTarget) * 100
      : null;
  const asp = getSalesAsp(data?.sales ?? [], filters);
  const selectedMonthNumbers = selectedMonths(filters);
  const comparisonLabel = comparisonEnabled
    ? selectedMonthNumbers.length === 1
      ? `${t("dashboard.compareWith")} ${MONTHS[selectedMonthNumbers[0] - 1]} ${yearsForComparison[0] - 1}`
      : `${t("dashboard.compareWith")} ${yearsForComparison[0] - 1}`
    : t("dashboard.selectOneYearForYoy");
  const byBranch = getBranchSummary(rows);
  const byProduct = getProductSummary(rows);
  const modelGroups = getModelSummary(rows);
  const peopleGroups = getSalespersonSummary(rows);

  function updateFilter(key: FilterKey, values: string[]) {
    setFilters((current) => ({
      ...current,
      [key]: values,
      ...(key === "branch" ? { salesperson: [] } : {}),
    }));
  }

  return (
    <div className="kmm-sales-page min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6">
          <div className="space-y-5 xl:space-y-6">
            <section
              className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
              aria-labelledby="sales-title"
            >
              <div className="min-w-0">
                <div
                  className="mb-2 h-1 w-8 rounded-full bg-[var(--brand-500)]"
                  aria-hidden="true"
                />
                <h1
                  id="sales-title"
                  className="text-[28px] font-semibold leading-tight tracking-normal text-[var(--text-primary)] sm:text-[30px]"
                >
                  {t("route.sales.title")}
                </h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {t("route.sales.subtitle").replaceAll("KMM", companyCode)}
                </p>
              </div>
              <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
                {data && <FreshnessIndicator timestamp={data.meta.sourceUpdatedAt} />}
              </div>
            </section>
            <section aria-label="Sales filters">
              <SalesFilters
                filters={filters}
                options={options}
                onChange={updateFilter}
                onReset={() => setFilters(defaultFilters)}
                onExport={() => exportRows(rows, companyCode)}
              />
            </section>
            {loading && (
              <Card
                className="grid min-h-[320px] place-items-center rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-8 shadow-[var(--shadow-card)]"
                aria-busy="true"
                aria-label="Loading sales data"
              >
                <div className="w-full max-w-xl space-y-4">
                  <LoadingSkeleton variant="chart" />
                  <p className="text-center text-sm font-medium text-[var(--text-secondary)]">
                    Loading real sales data...
                  </p>
                </div>
              </Card>
            )}
            {error && !loading && (
              <Card
                className="grid min-h-[320px] place-items-center rounded-[var(--radius-card)] border-[var(--status-danger)] bg-[var(--surface-default)] p-8 shadow-[var(--shadow-card)]"
                role="alert"
                aria-live="assertive"
              >
                <ErrorState message={error} onRetry={loadData} />
              </Card>
            )}
            {data && !loading && !error && (
              <>
                <section
                  aria-label="Sales KPIs"
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))] xl:gap-3 2xl:gap-4"
                >
                  <KpiCard
                    variant="executive"
                    title={t("metric.salesUnit")}
                    value={businessKpis.salesUnit}
                    unit={t("common.units")}
                    {...KpiComparison({
                      value: percentChange(
                      businessKpis.salesUnit,
                        previousBusinessKpis?.salesUnit ?? 0,
                      ),
                      label: comparisonLabel,
                    })}
                  />
                  <KpiCard
                    variant="executive"
                    title={t("metric.salesValue")}
                    value={formatCompact(salesValue)}
                    unit={currency}
                    {...KpiComparison({
                      value: percentChange(
                        salesValue,
                        previousBusinessKpis?.salesValue ?? 0,
                      ),
                      label: comparisonLabel,
                    })}
                  />
                  <KpiCard
                    variant="executive"
                    title={t("metric.grossProfit")}
                    value={businessKpis.grossProfitAvailable ? formatCompact(grossProfit) : "Unavailable"}
                    unit={currency}
                    {...KpiComparison({
                      value: percentChange(
                        grossProfit,
                        previousBusinessKpis?.grossProfit ?? 0,
                      ),
                      label: comparisonLabel,
                    })}
                  />
                  <KpiCard
                    variant="executive"
                    title={t("metric.achievement")}
                    value={
                      achievement === null
                        ? "N/A"
                        : `${achievement.toFixed(1)}%`
                    }
                    unit=""
                    subtitle={
                      achievement === null
                        ? t("sales.targetNotConfigured")
                        : achievement >= 100
                          ? t("sales.targetMet")
                          : t("sales.belowTarget")
                    }
                    status={
                      achievement === null
                        ? "neutral"
                        : achievement >= 100
                          ? "positive"
                          : "negative"
                    }
                  />
                  <KpiCard
                    variant="executive"
                    title={t("metric.averageSellingPrice")}
                    value={asp === null ? "N/A" : formatCompact(asp)}
                    unit={currency}
                  />
                </section>
                <section aria-labelledby="sales-trajectory" className="space-y-3">
                  <div>
                    <h2 id="sales-trajectory" className="text-lg font-semibold tracking-normal text-[var(--text-primary)]">
                      {t("section.salesTrajectory")}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {t("section.salesTrajectoryDescription")}
                    </p>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
                    <ExecutiveSalesTrend
                      sales={data.sales}
                      filters={filters}
                      plan={data.plan}
                      currency={currency}
                    />
                    <TargetProgressCard
                      target={salesTarget}
                      actual={businessKpis.salesUnit}
                    />
                  </div>
                </section>
                <section aria-labelledby="sales-rankings" className="space-y-3">
                  <div>
                    <h2 id="sales-rankings" className="text-lg font-semibold tracking-normal text-[var(--text-primary)]">
                      {t("section.rankingsMix")}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {t("section.rankingsMixDescription")}
                    </p>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2">
                  <ChartCard
                    title={t("chart.salesByBranchTitle")}
                    subtitle={t("chart.salesByBranchDescription")}
                    className="min-w-0 [&_h2]:tracking-normal"
                  >
                    <BarChart data={byBranch} />
                  </ChartCard>
                  <ChartCard
                    title={t("chart.salespersonConcentrationTitle")}
                    subtitle={t("chart.salespersonConcentrationDescription")}
                    className="min-w-0 [&_h2]:tracking-normal"
                  >
                    <CumulativeRankChart
                      items={peopleGroups}
                      categoryLabel={t("filter.salesperson")}
                      contributionLabel={t("common.contribution")}
                      valueLabel={t("common.value")}
                      cumulativeLabel={t("common.cumulative")}
                    />
                  </ChartCard>
                  <ChartCard
                    title={t("chart.salesProductGroupTitle")}
                    subtitle={t("chart.salesProductGroupDescription")}
                    className="min-w-0 [&_h2]:tracking-normal"
                  >
                    <PercentStackedBar
                      segments={byProduct.map((item) => ({
                        id: item.label,
                        label: item.label,
                        value: item.value,
                        color: chartProductColor(item.label),
                      }))}
                      formatValue={formatCompact}
                    />
                  </ChartCard>
                  <ChartCard
                    title={t("chart.topModelTitle")}
                    subtitle={t("chart.topModelDescription")}
                    className="min-w-0 [&_h2]:tracking-normal"
                  >
                    <LollipopChart items={modelGroups} suffix={` ${t("common.units")}`} />
                  </ChartCard>
                  </div>
                </section>
                <section aria-labelledby="sales-transactions" className="space-y-3">
                  <div>
                    <h2 id="sales-transactions" className="text-lg font-semibold tracking-normal text-[var(--text-primary)]">
                      {t("section.transactions")}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {t("section.transactionsDescription")}
                    </p>
                  </div>
                  <SalesPageTable rows={rows} onExport={() => exportRows(rows, companyCode)} />
                </section>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Source: {data.meta.sources.join(" · ")}
                </p>
              </>
            )}
          </div>
      </main>
    </div>
  );
}
