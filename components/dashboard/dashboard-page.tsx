"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { PRODUCT_GROUPS } from "../../lib/dashboard/product-groups";
import {
  getBookingByProduct,
  getBookingValue,
  getDepositAmount,
  getOpenBookingUnit,
  getOpenBookingUnitRows,
} from "../../lib/dashboard/booking-selectors";
import {
  getCurrentStockRows,
  getStockByProduct,
  getStockUnit,
  normalizeProductType,
  STOCK_UNIT_PRODUCTS,
} from "../../lib/dashboard/stock-selectors";
import { ChartCard } from "../design-system/chart-card";
import { ErrorState } from "../design-system/error-state";
import { ExportButton } from "../design-system/export-button";
import { LoadingSkeleton } from "../design-system/loading-skeleton";
import { KpiCard } from "../design-system/kpi-card";
import { FilterBar } from "../design-system/filter-bar";
import { ActiveFilterSummary, MultiSelectFilter } from "../design-system/data-controls";
import { FreshnessIndicator } from "../design-system/freshness-indicator";
import { PremiumTrendChart } from "../common/charts/PremiumTrendChart";
import { loadLiveSalesData } from "../../lib/sales/client";
import {
  getBranchSummary,
  getProductSummary,
  getSalesKpis,
  isEngineUnitProduct,
  salesTransactionQuantity,
  getTargetAvailability,
} from "../../lib/sales/business-service";
import { loadLiveOperationalData } from "../../lib/operations/client";
import { getOperationalBusiness } from "../../lib/operations/business-service";

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

type FilterKey = "year" | "month" | "branch" | "salesperson";
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

type BookingRow = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  productType: string;
  model: string;
  price: number | null;
  deposit?: number | null;
  purchaseStatus?: string;
  status: string;
};

type StockRow = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  productType: string;
  kmm?: number | string | null;
  productGroup?: string;
  model: string;
  ageBucket: string;
  msrp: number | null;
  currentStatus?: string;
  stockId?: string | null;
  serialNumber?: string | null;
  engineNumber?: string | null;
  chassisNumber?: string | null;
};

type MarketingRow = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  activity: string;
  participants: number;
  bookingCount: number;
  prospectCount: number;
  expense: number;
};

type DashboardData = {
  meta: {
    company: string;
    shortName: string;
    generatedAt: string;
    sourceUpdatedAt: string;
    sources: string[];
  };
  plan: {
    year: number;
    months: string[];
    units: number[];
    revenue: number[];
    expense: number[];
  };
  sales: SalesRow[];
  booking: BookingRow[];
  stock: StockRow[];
  marketing: MarketingRow[];
};

type ActivityRow = {
  date: string;
  branch: string;
  salesperson: string;
  activity: string;
  status: string;
};

const defaultFilters: FilterState = {
  year: [],
  month: [],
  branch: [],
  salesperson: [],
};

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000_000)
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function sum<T>(rows: T[], selector: (row: T) => number | null) {
  return rows.reduce((total, row) => total + (selector(row) ?? 0), 0);
}

function selectedYears(filters: FilterState) {
  return filters.year.map(Number).filter(Number.isFinite);
}

function selectedMonths(filters: FilterState) {
  return filters.month
    .map((month) => MONTHS.indexOf(month) + 1)
    .filter((month) => month > 0);
}

function previousYearFilters(filters: FilterState): FilterState {
  const years = selectedYears(filters);
  return {
    ...filters,
    year: years.length ? years.map((year) => String(year - 1)) : [],
  };
}

function rowMatches(
  row: {
    year: number | null;
    month: number | null;
    branch: string;
    salesperson: string;
  },
  filters: FilterState,
) {
  const years = selectedYears(filters);
  const months = selectedMonths(filters);
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
  return true;
}

function percentChange(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function trendText(value: number | null) {
  if (value === null) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function trendDirection(value: number | null): "up" | "down" | "neutral" {
  if (value === null) return "neutral";
  return value >= 0 ? "up" : "down";
}

function trendStatus(
  value: number | null,
): "positive" | "negative" | "neutral" {
  if (value === null) return "neutral";
  return value >= 0 ? "positive" : "negative";
}

function GlobalFilter({
  filters,
  options,
  onChange,
  onRefresh,
  onReset,
  onExport,
}: {
  filters: FilterState;
  options: FilterState;
  onChange: (key: FilterKey, values: string[]) => void;
  onRefresh: () => void;
  onReset: () => void;
  onExport: () => void;
}) {
  return (
    <FilterBar
      filterGridClassName="sm:grid-cols-2 xl:grid-cols-4"
      ariaLabel="Dashboard filters"
      actions={
        <>
          <Button
            className="h-11 border-[var(--border-default)] bg-[var(--surface-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            variant="outline"
            onClick={onRefresh}
          >
            <RefreshCw size={16} />
            Refresh
          </Button>
          <Button
            className="h-11 border-[var(--border-default)] bg-[var(--surface-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            variant="outline"
            onClick={onReset}
          >
            <RotateCcw size={16} />
            Reset
          </Button>
          <ExportButton onClick={onExport} />
        </>
      }
    >
          <MultiSelectFilter
            label="Year"
            options={options.year}
            values={filters.year}
            onChange={(values) => onChange("year", values)}
          />
          <MultiSelectFilter
            label="Month"
            options={options.month}
            values={filters.month}
            onChange={(values) => onChange("month", values)}
          />
          <MultiSelectFilter
            label="Branch"
            options={options.branch}
            values={filters.branch}
            onChange={(values) => onChange("branch", values)}
          />
          <MultiSelectFilter
            label="Salesperson"
            options={options.salesperson}
            values={filters.salesperson}
            onChange={(values) => onChange("salesperson", values)}
          />
    </FilterBar>
  );
}

function KpiSection({
  data,
  filters,
}: {
  data: DashboardData;
  filters: FilterState;
}) {
  const filteredStock = data.stock.filter((row) => rowMatches(row, filters));
  const operationalBusiness = getOperationalBusiness(data.booking as unknown as Record<string, unknown>[], data.stock as unknown as Record<string, unknown>[], { year: filters.year, month: filters.month, branch: filters.branch });
  // Legacy parity expression retained: getStockUnit(currentStock).
  // Legacy parity expression retained: getOpenBookingUnit(data.booking, filters).
  const currentBooking = operationalBusiness.booking.unit;
  const currentBookingValue = operationalBusiness.booking.value ?? 0;
  const currentBookingDeposit = operationalBusiness.booking.deposit ?? 0;
  const currentStock = getCurrentStockRows(filteredStock);

  const previousFilters = previousYearFilters(filters);
  const businessKpis = getSalesKpis(data.sales, filters);
  const previousBusinessKpis = getSalesKpis(data.sales, previousFilters);
  const salesValue = businessKpis.salesValue ?? 0;
  const previousSalesValue = previousBusinessKpis.salesValue ?? 0;
  const grossProfit = businessKpis.grossProfit ?? 0;
  const previousGrossProfit = previousBusinessKpis.grossProfit ?? 0;
  const years = selectedYears(filters);
  const months = selectedMonths(filters);
  const comparisonLabel =
    years.length === 1 && months.length === 1
      ? `vs ${MONTHS[months[0] - 1]} ${years[0] - 1}`
      : "vs same period last year";
  const salesComparison = percentChange(
    businessKpis.salesUnit,
    previousBusinessKpis.salesUnit,
  );
  const salesValueComparison = percentChange(salesValue, previousSalesValue);
  const grossProfitComparison = percentChange(grossProfit, previousGrossProfit);

  return (
    <section
      aria-label="Executive KPIs"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))] xl:gap-3 2xl:gap-4"
    >
      <KpiCard
        variant="executive"
        title="Sales Unit"
        value={businessKpis.salesUnit}
        unit="Unit"
        trendValue={trendText(salesComparison)}
        trendDirection={trendDirection(salesComparison)}
        comparisonLabel={comparisonLabel}
        status={trendStatus(salesComparison)}
      />
      <KpiCard
        variant="executive"
        title="Sales Value"
        value={formatCompact(salesValue)}
        unit="MMK"
        trendValue={trendText(salesValueComparison)}
        trendDirection={trendDirection(salesValueComparison)}
        comparisonLabel={comparisonLabel}
        status={trendStatus(salesValueComparison)}
      />
      <KpiCard
        variant="executive"
        title="Gross Profit"
        value={businessKpis.grossProfitAvailable ? formatCompact(grossProfit) : "Unavailable"}
        unit="MMK"
        trendValue={trendText(grossProfitComparison)}
        trendDirection={trendDirection(grossProfitComparison)}
        comparisonLabel={comparisonLabel}
        status={trendStatus(grossProfitComparison)}
      />
      <KpiCard
        variant="executive"
        title="Open Booking Unit"
        value={currentBooking}
        unit="Units"
        subtitle={`Booking value: ${formatCompact(currentBookingValue)} MMK · Deposit: ${formatCompact(currentBookingDeposit)} MMK`}
      />
      <KpiCard
        variant="executive"
        title="Stock Unit"
        value={operationalBusiness.stock.unit}
        unit="Total Unit"
      />
    </section>
  );
}

const PRODUCT_COLORS: Record<string, string> = {
  TT: "#C24700",
  CH: "#2563A8",
  EX: "#475569",
  TP: "#0F766E",
  MAX: "#64748B",
};

function filterForCharts<
  T extends {
    year: number | null;
    month: number | null;
    branch: string;
    salesperson: string;
  },
>(rows: T[], filters: FilterState, includeMonth = true) {
  const chartFilters = includeMonth ? filters : { ...filters, month: [] };
  return rows.filter((row) => rowMatches(row, chartFilters));
}

type TrendDatum = { label: string; value: number | null };
type ChartPoint = TrendDatum & { x: number; y: number | null };

function chartPoints(
  data: TrendDatum[],
  max: number,
  width: number,
  height: number,
  padX: number,
  padY: number,
): ChartPoint[] {
  return data.map((item, index) => {
    const x =
      padX + (index * (width - padX * 2)) / Math.max(data.length - 1, 1);
    const y =
      item.value === null
        ? null
        : height - padY - (item.value / max) * (height - padY * 2);
    return { ...item, x, y };
  });
}

function linePath(points: ChartPoint[]) {
  const segments: ChartPoint[][] = [];
  for (const point of points) {
    if (point.y === null) {
      if (segments[segments.length - 1]?.length) segments.push([]);
      continue;
    }
    if (!segments.length) segments.push([]);
    segments[segments.length - 1].push(point);
  }

  return segments
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      if (segment.length === 1) return `M ${segment[0].x} ${segment[0].y}`;
      return segment.reduce((path, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        const previous = segment[index - 1];
        const midX = (previous.x + point.x) / 2;
        return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
      }, "");
    });
}

function LegacyLineChart({
  unitData,
  valueData,
  selectedMonths,
  variant = "orange",
  unitLabel = "Unit",
  valueLabel = "Sales Value",
  minPlotHeight = 240,
}: {
  unitData: TrendDatum[];
  valueData?: TrendDatum[];
  selectedMonths: number[];
  variant?: "orange" | "gray";
  unitLabel?: string;
  valueLabel?: string;
  minPlotHeight?: number;
}) {
  const [tooltip, setTooltip] = useState<{
    label: string;
    x: number;
    unit: number | null;
    value?: number | null;
  } | null>(null);
  const width = 920;
  const height = minPlotHeight;
  const padX = 78;
  const padY = 42;
  const unitMax = Math.max(...unitData.map((item) => item.value ?? 0), 1);
  const valueMax = Math.max(
    ...(valueData ?? []).map((item) => item.value ?? 0),
    1,
  );
  const unitPoints = chartPoints(unitData, unitMax, width, height, padX, padY);
  const valuePoints = valueData
    ? chartPoints(valueData, valueMax, width, height, padX, padY)
    : [];
  const lineColor = variant === "orange" ? "#FF7A00" : "#4B5563";
  const guideMonth = selectedMonths.length === 1 ? selectedMonths[0] : null;
  const yTicks = [0, 0.5, 1].map((ratio) => ({
    ratio,
    y: height - padY - ratio * (height - padY * 2),
    unit: Math.round(unitMax * ratio),
    value: valueMax * ratio,
  }));

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center gap-6 text-[13px] font-semibold text-[#4B5563]">
        <span className="flex items-center gap-2">
          <i
            className="h-[3px] w-7 rounded-full"
            style={{ backgroundColor: lineColor }}
          />
          {unitLabel}
        </span>
        {valueData && (
          <span className="flex items-center gap-2">
            <i className="h-0 w-7 border-t-[3px] border-dashed border-[#4B5563]" />
            {valueLabel}
          </span>
        )}
      </div>
      <div className="relative">
        <svg
          className="w-full"
          style={{ minHeight: `${minPlotHeight}px` }}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          onMouseLeave={() => setTooltip(null)}
        >
          <title>Line chart for monthly dashboard trend</title>
          {yTicks.map((tick) => (
            <line
              key={tick.ratio}
              x1={padX}
              x2={width - padX}
              y1={tick.y}
              y2={tick.y}
              stroke="#F3F4F6"
              strokeWidth="1"
            />
          ))}
          {guideMonth &&
            (() => {
              const point = unitPoints[guideMonth - 1];
              return point ? (
                <line
                  x1={point.x}
                  x2={point.x}
                  y1={padY - 8}
                  y2={height - padY + 8}
                  stroke="#D1D5DB"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              ) : null;
            })()}
          {yTicks.map((tick) => (
            <g key={`axis-${tick.ratio}`}>
              <text
                x={padX - 14}
                y={tick.y + 4}
                textAnchor="end"
                fill="#4B5563"
                fontSize="12"
                fontWeight="600"
              >
                {formatCompact(tick.unit)}
              </text>
              {valueData && (
                <text
                  x={width - padX + 14}
                  y={tick.y + 4}
                  textAnchor="start"
                  fill="#4B5563"
                  fontSize="12"
                  fontWeight="600"
                >
                  {formatCompact(tick.value)}
                </text>
              )}
            </g>
          ))}
          <text
            x={padX - 34}
            y={padY - 18}
            fill="#4B5563"
            fontSize="12"
            fontWeight="700"
          >
            Unit
          </text>
          {valueData && (
            <text
              x={width - padX + 8}
              y={padY - 18}
              fill="#4B5563"
              fontSize="12"
              fontWeight="700"
            >
              MMK
            </text>
          )}
          {linePath(unitPoints).map((path, index) => (
            <path
              key={`unit-path-${index}`}
              d={path}
              fill="none"
              stroke={lineColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {valueData &&
            linePath(valuePoints).map((path, index) => (
              <path
                key={`value-path-${index}`}
                d={path}
                fill="none"
                stroke="#4B5563"
                strokeWidth="2.75"
                strokeDasharray="8 8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          {unitPoints.map((point, index) => {
            if (point.y === null) return null;
            const active =
              tooltip?.label === point.label || guideMonth === index + 1;
            return (
              <g
                key={`unit-${point.label}`}
                onMouseEnter={() =>
                  setTooltip({
                    label: point.label,
                    x: (point.x / width) * 100,
                    unit: point.value,
                    value: valuePoints[index]?.value,
                  })
                }
              >
                <title>{`${point.label}: ${formatCompact(point.value ?? 0)} ${unitLabel}${valueData ? `, ${formatCompact(valuePoints[index]?.value ?? 0)} ${valueLabel}` : ""}`}</title>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={active ? 6 : 4.5}
                  fill="white"
                  stroke={lineColor}
                  strokeWidth="2.75"
                />
              </g>
            );
          })}
          {valueData &&
            valuePoints.map((point, index) => {
              if (point.y === null) return null;
              const active =
                tooltip?.label === point.label || guideMonth === index + 1;
              return (
                <g
                  key={`value-${point.label}`}
                  onMouseEnter={() =>
                    setTooltip({
                      label: point.label,
                      x: (point.x / width) * 100,
                      unit: unitPoints[index]?.value,
                      value: point.value,
                    })
                  }
                >
                  <title>{`${point.label}: ${formatCompact(point.value ?? 0)} ${valueLabel}`}</title>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={active ? 6 : 4.25}
                    fill="white"
                    stroke="#4B5563"
                    strokeWidth="2.5"
                  />
                </g>
              );
            })}
          {unitPoints.map((point) => (
            <text
              key={`x-${point.label}`}
              x={point.x}
              y={height - 10}
              textAnchor="middle"
              fill="#4B5563"
              fontSize="12"
              fontWeight="600"
            >
              {point.label}
            </text>
          ))}
        </svg>
        {tooltip && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#4B5563] shadow-[0_10px_28px_rgba(31,41,55,0.10)]"
            style={{ left: `${Math.min(Math.max(tooltip.x, 12), 78)}%` }}
          >
            <p className="font-bold text-[#1F2937]">{tooltip.label}</p>
            <p className="mt-1">
              {unitLabel}:{" "}
              <strong>
                {tooltip.unit === null
                  ? "No data"
                  : formatCompact(tooltip.unit)}
              </strong>
            </p>
            {valueData && (
              <p>
                {valueLabel}:{" "}
                <strong>
                  {tooltip.value === null || tooltip.value === undefined
                    ? "No data"
                    : formatCompact(tooltip.value)}
                </strong>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

void LegacyLineChart;

type YearTrendRow = {
  year: number | null;
  month: number | null;
  value: number;
};

function YearTrendChart({
  title,
  unitRows,
  valueRows,
  unitLabel = "Unit",
  height = 420,
  className,
}: {
  title: string;
  unitRows: YearTrendRow[];
  valueRows: YearTrendRow[];
  unitLabel?: string;
  height?: number;
  className?: string;
}) {
  const [metric, setMetric] = useState<"unit" | "value">("unit");
  const rows = metric === "unit" ? unitRows : valueRows;
  const series = [2026, 2025, 2024, 2023, 2022].map((year, index) => ({
    id: String(year),
    year,
    label: String(year),
    kind:
      index === 0
        ? ("current" as const)
        : index === 1
          ? ("previous" as const)
          : ("older" as const),
    values: MONTHS.map((_, month) => {
      const monthRows = rows.filter(
        (row) => row.year === year && row.month === month + 1,
      );
      return monthRows.length
        ? monthRows.reduce((total, row) => total + row.value, 0)
        : null;
    }),
  }));
  return (
    <PremiumTrendChart
      height={height}
      className={cn("min-w-0 border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)] [&_h2]:tracking-normal [&>header]:!flex-col [&>header]:!items-stretch [&>header>div:last-child]:!w-full [&>header>div:last-child]:!justify-start [&>header_button]:!h-11 [&>header_select]:!h-11 min-[1400px]:[&>header]:!flex-row min-[1400px]:[&>header]:!items-center min-[1400px]:[&>header>div:last-child]:!w-auto min-[1400px]:[&>header>div:last-child]:!justify-end", className)}
      title={title}
      labels={MONTHS}
      unit={metric === "unit" ? unitLabel : "MMK"}
      formatValue={
        metric === "unit" ? (value) => value.toLocaleString() : formatCompact
      }
      defaultSeriesIds={["2026", "2025"]}
      onMetricChange={(value) => setMetric(value as "unit" | "value")}
      series={series}
    />
  );
}

function HorizontalBarChart({
  data,
  color = "#C24700",
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {sorted.map((item, index) => (
        <div
          key={item.label}
          className="grid grid-cols-[24px_minmax(64px,88px)_minmax(0,1fr)_auto] items-center gap-3 text-sm"
        >
          <span className="kmm-tabular text-xs font-semibold text-[var(--text-tertiary)]" aria-label={`Rank ${index + 1}`}>
            {index + 1}
          </span>
          <span
            className="min-w-0 font-semibold leading-tight text-[#4B5563]"
            title={item.label}
          >
            {item.label}
          </span>
          <div className="h-3 rounded-full bg-[#F3F4F6]">
            <div
              className="h-3 rounded-full"
              style={{
                width: `${Math.max((item.value / max) * 100, item.value ? 5 : 0)}%`,
                backgroundColor: color,
              }}
            />
          </div>
          <span className="min-w-10 text-right text-xs font-bold text-[#4B5563]">
            {formatCompact(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data }: { data: { label: string; value: number }[] }) {
  const total = sum(data, (item) => item.value);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const segments = data.reduce<
    { label: string; value: number; length: number; offset: number }[]
  >((items, item) => {
    const offset = items.reduce(
      (totalOffset, segment) => totalOffset + segment.length,
      0,
    );
    const length = total ? (item.value / total) * circumference : 0;
    return [...items, { ...item, length, offset }];
  }, []);

  return (
    <div className="grid gap-6 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
      <div className="relative mx-auto size-[150px]">
        <svg
          className="size-[150px] -rotate-90"
          viewBox="0 0 150 150"
          role="img"
        >
          <title>Product mix donut chart</title>
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth="18"
          />
          {segments.map((item) => (
            <circle
              key={item.label}
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke={PRODUCT_COLORS[item.label] ?? "#D1D5DB"}
              strokeWidth="18"
              strokeDasharray={`${item.length} ${circumference - item.length}`}
              strokeDashoffset={-item.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <strong className="block text-2xl tracking-[-0.04em] text-[#1F2937]">
              {formatCompact(total)}
            </strong>
            <span className="text-[11px] font-semibold text-[#4B5563]">
              Sales Unit
            </span>
          </div>
        </div>
      </div>
      <div className="min-w-0 space-y-2.5">
        {data.map((item) => (
          <div
            key={item.label}
            className="flex min-w-0 items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2 font-semibold text-[#4B5563]">
              <i
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: PRODUCT_COLORS[item.label] ?? "#D1D5DB",
                }}
              />
              {item.label}
            </span>
            <span className="shrink-0 text-xs font-bold text-[#4B5563]">
              {formatCompact(item.value)} ·{" "}
              {total ? Math.round((item.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function targetValue(data: DashboardData, filters: FilterState) {
  const years = selectedYears(filters);
  if (years.length !== 1 || years[0] !== data.plan.year) return null;

  const months = selectedMonths(filters);
  const monthIndexes = months.length
    ? months.map((month) => month - 1)
    : data.plan.months.map((_, index) => index);
  const value = monthIndexes.reduce(
    (total, index) => total + (data.plan.units[index] ?? 0),
    0,
  );
  return value > 0 ? value : null;
}

function TargetProgressItem({
  name,
  actual,
  target,
}: {
  name: string;
  actual: number;
  target: number | null;
}) {
  const achievement = target && target > 0 ? (actual / target) * 100 : null;
  const remaining = target && target > 0 ? Math.max(target - actual, 0) : null;
  const progressWidth = achievement === null ? 0 : Math.min(achievement, 100);
  const percentageTone =
    achievement === null
      ? "text-[#4B5563]"
      : achievement >= 100
        ? "text-[#16A34A]"
        : "text-[#DC2626]";

  return (
    <div className="rounded-[var(--radius-control-lg)] border border-[var(--divider)] bg-[var(--surface-subtle)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          {name}
        </p>
        <span className={cn("text-[15px] font-semibold", percentageTone)}>
          {achievement === null ? "Target not configured" : `${Math.round(achievement)}%`}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="kmm-tabular text-[22px] font-semibold leading-none tracking-normal text-[var(--text-primary)]">
          {formatCompact(actual)}{" "}
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            / {target === null ? "Target not configured" : `${formatCompact(target)} Unit`}
          </span>
        </p>
      </div>
      <p className="mt-3 text-xs font-normal text-[var(--text-secondary)]">
        Remaining {remaining === null ? "Target not configured" : `${formatCompact(remaining)} Unit`}
      </p>
      <div className="mt-3 h-2 rounded-full bg-[var(--divider)]">
        <div
          className="h-2 rounded-full bg-[var(--brand-500)] transition-[width] duration-200"
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    </div>
  );
}

function TargetProgress({
  data,
  filters,
}: {
  data: DashboardData;
  filters: FilterState;
}) {
  const filteredSales = filterForCharts(data.sales, filters);
  const filteredStock = filterForCharts(data.stock, filters);
  const salesActual = getSalesKpis(filteredSales).salesUnit;
  const bookingActual = getOpenBookingUnit(data.booking, filters);
  const landingActual = getStockUnit(filteredStock);
  const salesTarget = getTargetAvailability(filters, null).available ? targetValue(data, filters) : null;

  return (
    <Card className="min-h-[420px] min-w-0 rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-[19px] font-semibold leading-tight tracking-normal text-[var(--text-primary)]">
          Target Progress
        </h2>
        <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
          Monthly
        </span>
      </div>
      <div className="space-y-4">
        <TargetProgressItem
          name="Sales Unit Target"
          actual={salesActual}
          target={salesTarget}
        />
        <TargetProgressItem
          name="Booking Unit Target"
          actual={bookingActual}
          target={null}
        />
        <TargetProgressItem
          name="Landing Unit Target"
          actual={landingActual}
          target={null}
        />
      </div>
    </Card>
  );
}

function ChartsSection({
  data,
  filters,
}: {
  data: DashboardData;
  filters: FilterState;
}) {
  const trendFilters = { ...filters, year: [], month: [] };
  const trendSales = filterForCharts(data.sales, trendFilters);
  const trendStock = filterForCharts(data.stock, trendFilters);
  const filteredSales = filterForCharts(data.sales, filters);
  const bookingRows = getOpenBookingUnitRows(data.booking, trendFilters);
  const stockRows = getCurrentStockRows(trendStock).filter((row) =>
    STOCK_UNIT_PRODUCTS.includes(
      normalizeProductType(row) as (typeof STOCK_UNIT_PRODUCTS)[number],
    ),
  );
  const salesUnitTrendRows = trendSales.map((row) => ({
    year: row.year,
    month: row.month,
    value: isEngineUnitProduct(row) ? salesTransactionQuantity(row) : 0,
  }));
  const salesValueTrendRows = trendSales.map((row) => ({
    year: row.year,
    month: row.month,
    value: row.finalReceived ?? 0,
  }));
  const bookingUnitTrendRows = bookingRows.map((row) => ({
    year: row.year,
    month: row.month,
    value: 1,
  }));
  const bookingValueTrendRows = bookingRows.map((row) => ({
    year: row.year,
    month: row.month,
    value: row.price ?? 0,
  }));
  const stockUnitTrendRows = stockRows.map((row) => ({
    year: row.year,
    month: row.month,
    value: 1,
  }));
  const stockValueTrendRows = stockRows.map((row) => ({
    year: row.year,
    month: row.month,
    value: row.msrp ?? 0,
  }));
  const salesByBranch = getBranchSummary(filteredSales);
  const productMix = getProductSummary(filteredSales);
  const operationalBusiness = getOperationalBusiness(data.booking as unknown as Record<string, unknown>[], data.stock as unknown as Record<string, unknown>[], { year: filters.year, month: filters.month, branch: filters.branch });
  const bookingByProduct = operationalBusiness.booking.byProduct
    .filter((item) =>
      (PRODUCT_GROUPS.UNIT_PRODUCTS as readonly string[]).includes(
        item.product,
      ),
    )
    .map((item) => ({ label: item.product, value: item.unit }));
  const stockByProduct = operationalBusiness.stock.byProduct
    .filter((item) =>
      STOCK_UNIT_PRODUCTS.includes(
        item.product as (typeof STOCK_UNIT_PRODUCTS)[number],
      ),
    )
    .map((item) => ({ label: item.product, value: item.unit }));

  return (
    <section className="space-y-8" aria-label="Executive charts">
      <section className="space-y-3" aria-labelledby="dashboard-primary-trend">
        <div>
          <h2 id="dashboard-primary-trend" className="text-lg font-semibold tracking-normal text-[var(--text-primary)]">
            Sales trajectory
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Current sales performance and target variance for the active scope.
          </p>
        </div>
        <div className="grid gap-5 [&>*]:min-w-0 xl:grid-cols-[minmax(0,1fr)_minmax(300px,29%)]">
        <YearTrendChart
          title="Sales Trend"
          unitRows={salesUnitTrendRows}
          valueRows={salesValueTrendRows}
          unitLabel="Sales Unit"
          height={460}
          className="shadow-[var(--shadow-hover)]"
        />
        <TargetProgress data={data} filters={filters} />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="dashboard-rankings">
        <div>
          <h2 id="dashboard-rankings" className="text-lg font-semibold tracking-normal text-[var(--text-primary)]">
            Rankings
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Branch performance ranked within the active filter scope.
          </p>
        </div>
        <div className="grid gap-5 [&>*]:min-w-0 xl:grid-cols-[minmax(0,1fr)_minmax(300px,29%)]">
          <ChartCard
            className="min-w-0 shadow-[var(--shadow-hover)] [&_h2]:tracking-normal"
            title="Sales by Branch"
            subtitle="Sales Unit by branch"
          >
            <HorizontalBarChart data={salesByBranch} />
          </ChartCard>
          <ChartCard
            className="min-w-0 [&_h2]:tracking-normal"
            title="Product Mix"
            subtitle="Sales Unit by product group"
          >
            <DonutChart data={productMix} />
          </ChartCard>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="dashboard-secondary-analysis">
        <div>
          <h2 id="dashboard-secondary-analysis" className="text-lg font-semibold tracking-normal text-[var(--text-primary)]">
            Secondary analysis
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Booking, stock, and product context for operational follow-up.
          </p>
        </div>
      <div className="grid gap-5 [&>*]:min-w-0 xl:grid-cols-2">
        <YearTrendChart
          title="Booking Trend"
          unitRows={bookingUnitTrendRows}
          valueRows={bookingValueTrendRows}
          unitLabel="Booking Unit"
        />
        <YearTrendChart
          title="Stock Trend"
          unitRows={stockUnitTrendRows}
          valueRows={stockValueTrendRows}
          unitLabel="Stock Unit"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        <ChartCard
          className="min-w-0 [&_h2]:tracking-normal"
          title="Booking by Product"
          subtitle="Open booking units by product group"
        >
          <HorizontalBarChart data={bookingByProduct} />
        </ChartCard>
        <ChartCard
          className="min-w-0 [&_h2]:tracking-normal"
          title="Stock by Product"
          subtitle="Current stock units by product group"
        >
          <HorizontalBarChart data={stockByProduct} color="#4B5563" />
        </ChartCard>
      </div>
      </section>
    </section>
  );
}

function buildRecentActivities(
  data: DashboardData,
  filters: FilterState,
): ActivityRow[] {
  const sales = data.sales
    .filter((row) => rowMatches(row, filters))
    .map((row) => ({
      date: row.date,
      branch: row.branch,
      salesperson: row.salesperson || "-",
      activity: `Sales delivery: ${row.model || row.productType || "Unknown model"}`,
      status: "Completed",
    }));
  const booking = data.booking
    .filter((row) => rowMatches(row, filters))
    .map((row) => ({
      date: row.date,
      branch: row.branch,
      salesperson: row.salesperson || "-",
      activity: `Booking: ${row.model || row.productType || "Unknown model"}`,
      status: row.status,
    }));
  const marketing = data.marketing
    .filter((row) => rowMatches(row, filters))
    .map((row) => ({
      date: row.date,
      branch: row.branch,
      salesperson: "-",
      activity: `Marketing: ${row.activity || "Activity"}`,
      status: `${row.participants} participants`,
    }));
  return [...sales, ...booking, ...marketing]
    .filter((row) => row.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);
}

function buildFilterOptions(data: DashboardData): FilterState {
  const years = new Set<string>();
  const branches = new Set<string>();
  const salespeople = new Set<string>();
  const addRow = (row: {
    year: number | null;
    branch: string;
    salesperson: string;
  }) => {
    if (row.year) years.add(String(row.year));
    if (row.branch) branches.add(row.branch);
    if (row.salesperson) salespeople.add(row.salesperson);
  };
  data.sales.forEach(addRow);
  data.booking.forEach(addRow);
  data.stock.forEach(addRow);
  data.marketing.forEach(addRow);
  return {
    year: Array.from(years).sort((a, b) => Number(b) - Number(a)),
    month: MONTHS,
    branch: Array.from(branches).sort(),
    salesperson: Array.from(salespeople).sort(),
  };
}

export function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboardData() {
    setLoading(true);
    setError("");
    try {
      const [liveSales, liveOperations, fallbackResponse] = await Promise.all([
        loadLiveSalesData(),
        loadLiveOperationalData(),
        fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" }),
      ]);
      if (!fallbackResponse.ok) throw new Error(`Unable to load Dashboard fallback (${fallbackResponse.status})`);
      const fallback = await fallbackResponse.json() as DashboardData;
      setDashboardData({ ...fallback, sales: liveSales.sales, booking: liveOperations.booking, stock: liveOperations.stock, meta: { ...fallback.meta, sourceUpdatedAt: liveSales.meta.sourceUpdatedAt, sources: [...liveSales.meta.sources, "Cloudflare D1 operational data"] } });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load dashboard data",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    Promise.all([
      loadLiveSalesData(),
      loadLiveOperationalData(),
      fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" }).then((response) => { if (!response.ok) throw new Error(`Unable to load Dashboard fallback (${response.status})`); return response.json() as Promise<DashboardData>; }),
    ])
      .then(([liveSales, liveOperations, fallback]) => {
        if (!ignore) setDashboardData({ ...fallback, sales: liveSales.sales, booking: liveOperations.booking, stock: liveOperations.stock, meta: { ...fallback.meta, sourceUpdatedAt: liveSales.meta.sourceUpdatedAt, sources: [...liveSales.meta.sources, "Cloudflare D1 operational data"] } });
      })
      .catch((loadError: unknown) => {
        if (!ignore)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load dashboard data",
          );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    const refreshAfterImport = () => { void loadDashboardData(); };
    window.addEventListener("kmm:sales-imported", refreshAfterImport);
    return () => {
      ignore = true;
      window.removeEventListener("kmm:sales-imported", refreshAfterImport);
    };
  }, []);

  function updateFilter(key: FilterKey, values: string[]) {
    setFilters((current) => ({ ...current, [key]: values }));
  }

  function exportDashboard() {
    if (!dashboardData) return;
    const rows = buildRecentActivities(dashboardData, filters);
    const csv = [
      ["Date", "Branch", "Salesperson", "Activity", "Status"],
      ...rows.map((item) => [
        item.date,
        item.branch,
        item.salesperson,
        item.activity,
        item.status,
      ]),
    ];
    const blob = new Blob([csv.map((row) => row.join(",")).join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kmm-executive-dashboard-activity.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filterOptions = dashboardData
    ? buildFilterOptions(dashboardData)
    : defaultFilters;

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6">
          <div className="space-y-5 xl:space-y-6">
            <section
              className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
              aria-labelledby="dashboard-title"
            >
              <div className="min-w-0">
                <div
                  className="mb-2 h-1 w-8 rounded-full bg-[var(--brand-500)]"
                  aria-hidden="true"
                />
                <h1
                  id="dashboard-title"
                  className="text-[28px] font-semibold leading-tight tracking-normal text-[var(--text-primary)] sm:text-[30px]"
                >
                  Executive Dashboard
                </h1>
                <p className="mt-1 text-sm font-normal leading-5 text-[var(--text-secondary)]">
                  Sales, booking, stock, and target performance
                </p>
              </div>
              <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
                {dashboardData && (
                  <FreshnessIndicator timestamp={dashboardData.meta.sourceUpdatedAt} className="font-normal" />
                )}
                <ActiveFilterSummary
                  filters={filters}
                  labels={{ year: "Year", month: "Month", branch: "Branch", salesperson: "Salesperson" }}
                  onChange={updateFilter}
                  onReset={() => setFilters(defaultFilters)}
                  className="mt-0 max-w-full justify-start sm:justify-end"
                />
              </div>
            </section>

            <section aria-label="Dashboard filters">
              <GlobalFilter
                filters={filters}
                options={filterOptions}
                onChange={updateFilter}
                onRefresh={loadDashboardData}
                onReset={() => setFilters(defaultFilters)}
                onExport={exportDashboard}
              />
            </section>

            {loading && (
              <Card
                className="grid min-h-[320px] place-items-center rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-8 text-center text-sm font-medium text-[var(--text-secondary)] shadow-[var(--shadow-card)]"
                aria-busy="true"
                aria-label="Loading dashboard data"
              >
                <div className="w-full max-w-xl space-y-4">
                  <LoadingSkeleton variant="chart" />
                  <p>Loading real dashboard data...</p>
                </div>
              </Card>
            )}
            {error && !loading && (
              <Card
                className="grid min-h-[320px] place-items-center rounded-[var(--radius-card)] border-[var(--status-danger)] bg-[var(--surface-default)] p-8 shadow-[var(--shadow-card)]"
                role="alert"
                aria-live="assertive"
              >
                <ErrorState message={error} onRetry={loadDashboardData} />
              </Card>
            )}
            {dashboardData && !loading && !error && (
              <>
                <KpiSection data={dashboardData} filters={filters} />
                <ChartsSection data={dashboardData} filters={filters} />
              </>
            )}
          </div>
      </main>
    </div>
  );
}
