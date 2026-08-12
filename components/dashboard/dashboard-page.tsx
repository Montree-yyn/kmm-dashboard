"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { PRODUCT_GROUPS } from "../../lib/dashboard/product-groups";
import {
  getOpenBookingUnit,
} from "../../lib/dashboard/booking-selectors";
import {
  getCurrentStockRows,
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
import { MultiSelectFilter } from "../design-system/data-controls";
import { FreshnessIndicator } from "../design-system/freshness-indicator";
import { ResponsiveDataTable } from "../design-system/responsive-data-table";
import { PremiumTrendChart } from "../common/charts/PremiumTrendChart";
import {
  HeatmapMatrix,
  PairedBarChart,
  PercentStackedBar,
  StackedColumnChart,
} from "../common/charts/AnalyticalCharts";
import { buildMonthlyLifecycle } from "../common/charts/chartData";
import { loadLiveSalesData } from "../../lib/sales/client";
import {
  getBranchSummary,
  getProductSummary,
  getSalesKpis,
  isEngineUnitProduct,
  salesTransactionQuantity,
} from "../../lib/sales/business-service";
import { loadLiveOperationalData } from "../../lib/operations/client";
import { getOperationalBusiness } from "../../lib/operations/business-service";
import { useLocale } from "../../src/hooks/useLocale";
import { useCompany } from "../../src/hooks/useCompany";

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

function createLiveDashboardData(
  liveSales: Awaited<ReturnType<typeof loadLiveSalesData>>,
  liveOperations: Awaited<ReturnType<typeof loadLiveOperationalData>>,
  company: { name: string; code: string },
): DashboardData {
  return {
    meta: {
      company: company.name,
      shortName: company.code,
      generatedAt: new Date().toISOString(),
      sourceUpdatedAt: liveSales.meta.sourceUpdatedAt,
      sources: [...liveSales.meta.sources, "Cloudflare D1 operational data"],
    },
    // Sales targets are not yet supplied by the Dashboard API. Keep this
    // empty rather than borrowing target values from the legacy static file.
    plan: { year: 0, months: [], units: [], revenue: [], expense: [] },
    sales: liveSales.sales,
    booking: liveOperations.booking,
    stock: liveOperations.stock,
    marketing: [],
  };
}

async function loadDashboardPresentationData(
  companyId: string,
  company: { name: string; code: string },
) {
  const [liveSales, liveOperations] = await Promise.all([
    // Dashboard operational KPIs are D1/API-only in every runtime. Passing
    // this explicitly avoids any Worker/client environment-detection drift
    // from reactivating the packaged legacy payload after an API failure.
    loadLiveSalesData({ allowFallback: false, companyId }),
    loadLiveOperationalData({ allowFallback: false, companyId }),
  ]);
  return createLiveDashboardData(liveSales, liveOperations, company);
}

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

function monthlySparkline<
  T extends {
    year: number | null;
    month: number | null;
    branch: string;
    salesperson: string;
  },
>(rows: T[], filters: FilterState, selector: (row: T) => number | null) {
  const scopedYears = selectedYears(filters);
  if (scopedYears.length !== 1) return [];
  const year = scopedYears[0];
  return MONTHS.map((_, index) => sum(
    rows.filter((row) => rowMatches(row, { ...filters, year: [String(year)], month: [MONTHS[index]] })),
    selector,
  ));
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

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function GlobalFilter({
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
      filterGridClassName="grid-cols-1 sm:grid-cols-3 xl:grid-cols-3"
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
    </FilterBar>
  );
}

function KpiSection({
  data,
  filters,
  currency,
}: {
  data: DashboardData;
  filters: FilterState;
  currency: string;
}) {
  const { t } = useLocale();
  const filteredStock = data.stock.filter((row) => rowMatches(row, filters));
  const operationalBusiness = getOperationalBusiness(data.booking, data.stock, {
    year: filters.year,
    month: filters.month,
    branch: filters.branch,
    salesperson: filters.salesperson,
  });
  // Legacy parity expression retained: getStockUnit(currentStock).
  // Legacy parity expression retained: getOpenBookingUnit(data.booking, filters).
  const currentBooking = operationalBusiness.booking.unit;
  const currentBookingValue = operationalBusiness.booking.value ?? 0;
  const currentBookingDeposit = operationalBusiness.booking.deposit ?? 0;
  const currentStock = getCurrentStockRows(filteredStock);

  const businessKpis = getSalesKpis(data.sales, filters);
  const years = selectedYears(filters);
  const months = selectedMonths(filters);
  const comparisonEnabled = years.length === 1;
  const previousBusinessKpis = comparisonEnabled
    ? getSalesKpis(data.sales, previousYearFilters(filters))
    : null;
  const salesValue = businessKpis.salesValue ?? 0;
  const previousSalesValue = previousBusinessKpis?.salesValue ?? 0;
  const grossProfit = businessKpis.grossProfit ?? 0;
  const previousGrossProfit = previousBusinessKpis?.grossProfit ?? 0;
  const comparisonLabel = comparisonEnabled
    ? months.length === 1
      ? `${t("dashboard.compareWith")} ${MONTHS[months[0] - 1]} ${years[0] - 1}`
      : `${t("dashboard.compareWith")} ${years[0] - 1}`
    : t("dashboard.selectOneYearForYoy");
  const salesComparison = previousBusinessKpis
    ? percentChange(businessKpis.salesUnit, previousBusinessKpis.salesUnit)
    : null;
  const salesValueComparison = previousBusinessKpis
    ? percentChange(salesValue, previousSalesValue)
    : null;
  const grossProfitComparison = previousBusinessKpis?.grossProfitAvailable
    ? percentChange(grossProfit, previousGrossProfit)
    : null;
  const salesUnitSparkline = monthlySparkline(data.sales, filters, (row) =>
    isEngineUnitProduct(row) ? salesTransactionQuantity(row) : 0,
  );
  const salesValueSparkline = monthlySparkline(data.sales, filters, (row) => row.finalReceived ?? 0);
  const grossProfitSparkline = businessKpis.grossProfitAvailable
    ? monthlySparkline(data.sales, filters, (row) => row.gp1 ?? 0)
    : [];

  return (
    <section
      aria-label="Executive KPIs"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))] xl:gap-3 2xl:gap-4"
    >
      <KpiCard
        variant="executive"
        featured
        title={t("metric.salesUnit")}
        value={businessKpis.salesUnit}
        unit={t("common.units")}
        trendValue={trendText(salesComparison)}
        trendDirection={trendDirection(salesComparison)}
        comparisonLabel={comparisonLabel}
        status={trendStatus(salesComparison)}
        sparklineValues={salesUnitSparkline}
      />
      <KpiCard
        variant="executive"
        title={t("metric.salesValue")}
        value={formatCompact(salesValue)}
        unit={currency}
        trendValue={trendText(salesValueComparison)}
        trendDirection={trendDirection(salesValueComparison)}
        comparisonLabel={comparisonLabel}
        status={trendStatus(salesValueComparison)}
        sparklineValues={salesValueSparkline}
      />
      <KpiCard
        variant="executive"
        title={t("metric.grossProfit")}
        value={businessKpis.grossProfitAvailable ? formatCompact(grossProfit) : "Unavailable"}
        unit={currency}
        trendValue={trendText(grossProfitComparison)}
        trendDirection={trendDirection(grossProfitComparison)}
        comparisonLabel={comparisonLabel}
        status={trendStatus(grossProfitComparison)}
        sparklineValues={grossProfitSparkline}
      />
      <KpiCard
        variant="executive"
        title={t("metric.bookingUnit")}
        value={currentBooking}
        unit={t("common.units")}
        subtitle={`${t("dashboard.bookingValue")}: ${formatCompact(currentBookingValue)} ${currency} · ${t("dashboard.deposit")}: ${formatCompact(currentBookingDeposit)} ${currency}`}
      />
      <KpiCard
        variant="executive"
        title={t("metric.stockUnit")}
        value={getStockUnit(currentStock)}
        unit={t("common.units")}
      />
    </section>
  );
}

const PRODUCT_COLORS: Record<string, string> = {
  TT: "#F56600",
  CH: "#35363A",
  EX: "#86868B",
  TP: "#B6B7BA",
  MAX: "#245487",
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
  currency = "MMK",
  minPlotHeight = 240,
}: {
  unitData: TrendDatum[];
  valueData?: TrendDatum[];
  selectedMonths: number[];
  variant?: "orange" | "gray";
  unitLabel?: string;
  valueLabel?: string;
  currency?: string;
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
              {currency}
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
  valueLabel = "Value",
  currency,
  height = 420,
  className,
}: {
  title: string;
  unitRows: YearTrendRow[];
  valueRows: YearTrendRow[];
  unitLabel?: string;
  valueLabel?: string;
  currency: string;
  height?: number;
  className?: string;
}) {
  const [metric, setMetric] = useState<"unit" | "value">("unit");
  const rows = metric === "unit" ? unitRows : valueRows;
  const availableYears = Array.from(
    new Set(
      rows
        .map((row) => row.year)
        .filter((year): year is number => year !== null),
    ),
  ).sort((a, b) => b - a);
  const series = availableYears.map((year, index) => ({
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
      key={`${metric}-${availableYears.join("-")}`}
      height={height}
      className={cn("min-w-0 border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)] [&_h2]:tracking-normal [&>header]:!flex-col [&>header]:!items-stretch [&>header>div:last-child]:!w-full [&>header>div:last-child]:!justify-start [&>header_button]:!h-11 [&>header_select]:!h-11 min-[1400px]:[&>header]:!flex-row min-[1400px]:[&>header]:!items-center min-[1400px]:[&>header>div:last-child]:!w-auto min-[1400px]:[&>header>div:last-child]:!justify-end", className)}
      title={title}
      labels={MONTHS}
      unit={metric === "unit" ? unitLabel : currency}
      formatValue={
        metric === "unit" ? (value) => value.toLocaleString() : formatCompact
      }
      metricOptions={[
        { id: "unit", label: unitLabel },
        { id: "value", label: valueLabel },
      ]}
      defaultSeriesIds={availableYears.slice(0, 2).map(String)}
      onMetricChange={(value) => setMetric(value as "unit" | "value")}
      visualStyle="precision"
      series={series}
    />
  );
}

function HorizontalBarChart({
  data,
  color = "#FF7A00",
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

function AttentionPanel({
  openBookings,
  criticalStock,
  sourceUpdatedAt,
}: {
  openBookings: number;
  criticalStock: number;
  sourceUpdatedAt: string;
}) {
  const { t, language } = useLocale();
  const refreshed = new Date(sourceUpdatedAt);
  const refreshedLabel = Number.isNaN(refreshed.getTime())
    ? t("common.freshnessUnavailable")
    : refreshed.toLocaleString(
        language === "th" ? "th-TH" : language === "my" ? "my-MM-u-nu-latn" : "en-US",
        { dateStyle: "medium", timeStyle: "short" },
      );

  return (
    <Card className="h-full min-w-0 rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--divider)] pb-4">
        <div>
          <h2 className="text-[19px] font-semibold text-[var(--text-primary)]">{t("dashboard.attentionTitle")}</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("dashboard.attentionDescription")}</p>
        </div>
        <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">{t("dashboard.liveScope")}</span>
      </div>

      <div className="mt-4 space-y-3">
        <Link href="/booking" className="group flex min-h-[78px] items-center gap-3 rounded-[var(--radius-control-lg)] border border-[var(--status-warning-bg)] bg-[var(--status-warning-bg)]/55 p-3 transition-colors hover:border-[var(--brand-300)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-white text-[var(--status-warning)]">
            <ClipboardList size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[var(--text-primary)]">{t("dashboard.openBookingsReview")}</span>
            <span className="block text-xs text-[var(--text-secondary)]">{openBookings.toLocaleString()} {t("dashboard.bookingUnitsInScope")}</span>
          </span>
          <ChevronRight className="shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" size={17} aria-hidden="true" />
        </Link>

        <Link href="/stock" className="group flex min-h-[78px] items-center gap-3 rounded-[var(--radius-control-lg)] border border-[var(--status-danger-bg)] bg-[var(--status-danger-bg)]/55 p-3 transition-colors hover:border-[var(--status-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-white text-[var(--status-danger)]">
            {criticalStock > 0 ? <TriangleAlert size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[var(--text-primary)]">{t("dashboard.agedStockReview")}</span>
            <span className="block text-xs text-[var(--text-secondary)]">{criticalStock.toLocaleString()} {t("dashboard.stockUnitsReview")}</span>
          </span>
          <ChevronRight className="shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" size={17} aria-hidden="true" />
        </Link>

        <Link href="/data-hub" className="group flex min-h-[78px] items-center gap-3 rounded-[var(--radius-control-lg)] border border-[var(--status-info-bg)] bg-[var(--status-info-bg)]/55 p-3 transition-colors hover:border-[var(--status-info)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-white text-[var(--status-info)]">
            <Database size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[var(--text-primary)]">{t("dashboard.sourceFreshness")}</span>
            <span className="block text-xs text-[var(--text-secondary)]">{t("dashboard.updatedAt")} {refreshedLabel}</span>
          </span>
          <ChevronRight className="shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" size={17} aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}

type StockHealthTone = "healthy" | "watch" | "critical";

const STOCK_AGE_BANDS = ["0–30", "31–60", "61–90", ">90"] as const;

function stockAgeBand(ageBucket: string): (typeof STOCK_AGE_BANDS)[number] | null {
  const normalized = String(ageBucket ?? "").trim().toLowerCase();
  if (/91|90\+|over\s*90|>\s*90/.test(normalized)) return ">90";
  const values = (normalized.match(/\d+/g) ?? []).map(Number);
  const upper = values.at(-1);
  if (upper === undefined) return null;
  if (upper !== undefined && upper <= 30) return "0–30";
  if (upper !== undefined && upper <= 60) return "31–60";
  return "61–90";
}

function stockHealthTone(ageBucket: string): StockHealthTone {
  const normalized = String(ageBucket ?? "").trim().toLowerCase();
  if (/91|90\+|over\s*90|>\s*90/.test(normalized)) return "critical";
  const firstNumber = Number(normalized.match(/\d+/)?.[0] ?? Number.NaN);
  if (Number.isFinite(firstNumber) && firstNumber <= 30) return "healthy";
  return "watch";
}

function StockHealthCard({ rows }: { rows: StockRow[] }) {
  const { t } = useLocale();
  const counts = rows.reduce<Record<StockHealthTone, number>>((result, row) => {
    result[stockHealthTone(row.ageBucket)] += 1;
    return result;
  }, { healthy: 0, watch: 0, critical: 0 });
  const total = Math.max(rows.length, 1);
  const items = [
    { id: "healthy" as const, label: `${t("status.healthy")} · 0–30 ${t("common.days")}`, value: counts.healthy, color: "var(--chart-health)" },
    { id: "watch" as const, label: `${t("status.watch")} · 31–90 ${t("common.days")}`, value: counts.watch, color: "var(--chart-watch)" },
    { id: "critical" as const, label: `${t("status.critical")} · 91+ ${t("common.days")}`, value: counts.critical, color: "var(--chart-critical)" },
  ];

  return (
    <Card className="h-full min-w-0 rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-semibold text-[var(--text-primary)]">{t("dashboard.stockHealthTitle")}</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("dashboard.stockHealthDescription")}</p>
        </div>
        <Boxes className="text-[var(--text-tertiary)]" size={19} aria-hidden="true" />
      </div>
      <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]" role="img" aria-label={`Stock health: ${counts.healthy} healthy, ${counts.watch} watch, ${counts.critical} critical`}>
        {items.map((item) => item.value > 0 && (
          <span key={item.id} style={{ width: `${(item.value / total) * 100}%`, backgroundColor: item.color }} title={`${item.label}: ${item.value}`} />
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex min-h-9 items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-[var(--text-secondary)]">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
              {item.label}
            </span>
            <strong className="kmm-tabular text-[var(--text-primary)]">{item.value.toLocaleString()}</strong>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecentActivityTable({ rows }: { rows: ActivityRow[] }) {
  const { t } = useLocale();
  return (
    <Card className="overflow-hidden rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-0 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--divider)] px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[19px] font-semibold text-[var(--text-primary)]">{t("dashboard.recentActivityTitle")}</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("dashboard.recentActivityDescription")}</p>
        </div>
        <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">{rows.length} {t("common.records")}</span>
      </div>
      {rows.length ? (
        <ResponsiveDataTable ariaLabel="Recent operational activity table">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-subtle)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              <tr>
                <th className="px-5 py-3 sm:px-6">{t("common.date")}</th>
                <th className="px-4 py-3">{t("filter.branch")}</th>
                <th className="px-4 py-3">{t("common.activity")}</th>
                <th className="px-4 py-3">{t("common.owner")}</th>
                <th className="px-5 py-3 text-right sm:px-6">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const normalizedStatus = row.status.trim().toLowerCase();
                const completed = normalizedStatus.includes("complete") || normalizedStatus.includes("deliver");
                const statusTone = completed
                  ? "bg-[var(--status-success-bg)] text-[var(--status-success)]"
                  : normalizedStatus
                    ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
                    : "bg-[var(--surface-muted)] text-[var(--text-secondary)]";
                return (
                  <tr key={`${row.date}-${row.branch}-${index}`} className="border-t border-[var(--divider)] transition-colors hover:bg-[var(--surface-subtle)]">
                    <td className="kmm-tabular whitespace-nowrap px-5 py-3.5 text-[var(--text-secondary)] sm:px-6">{row.date}</td>
                    <td className="px-4 py-3.5 font-medium text-[var(--text-primary)]">{row.branch || "—"}</td>
                    <td className="max-w-[360px] px-4 py-3.5 text-[var(--text-secondary)]"><span className="line-clamp-2">{row.activity}</span></td>
                    <td className="px-4 py-3.5 text-[var(--text-secondary)]">{row.salesperson}</td>
                    <td className="px-5 py-3.5 text-right sm:px-6">
                      <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", statusTone)}>{row.status || "Not provided"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ResponsiveDataTable>
      ) : (
        <p className="px-6 py-10 text-center text-sm text-[var(--text-secondary)]">{t("dashboard.noRecentActivity")}</p>
      )}
    </Card>
  );
}

function ChartsSection({
  data,
  filters,
  currency,
}: {
  data: DashboardData;
  filters: FilterState;
  currency: string;
}) {
  const { t } = useLocale();
  const trendFilters = { ...filters, year: [], month: [] };
  const trendSales = filterForCharts(data.sales, trendFilters);
  const filteredSales = filterForCharts(data.sales, filters);
  const lifecycleRows = filterForCharts(data.booking, trendFilters);
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
  const salesByBranch = getBranchSummary(filteredSales);
  const productMix = getProductSummary(filteredSales);
  const bookingLifecycle = buildMonthlyLifecycle(lifecycleRows);
  const operationalBusiness = getOperationalBusiness(data.booking, data.stock, {
    year: filters.year,
    month: filters.month,
    branch: filters.branch,
    salesperson: filters.salesperson,
  });
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
  const stockBookingComparison = Array.from(
    new Set([
      ...bookingByProduct.map((item) => item.label),
      ...stockByProduct.map((item) => item.label),
    ]),
  )
    .map((label) => ({
      label,
      left: bookingByProduct.find((item) => item.label === label)?.value ?? 0,
      right: stockByProduct.find((item) => item.label === label)?.value ?? 0,
    }))
    .sort((left, right) => {
      const leftGap = left.right - left.left;
      const rightGap = right.right - right.left;
      return leftGap - rightGap || Math.max(right.left, right.right) - Math.max(left.left, left.right);
    });
  const currentStockForHealth = getCurrentStockRows(filterForCharts(data.stock, filters)).filter((row) =>
    STOCK_UNIT_PRODUCTS.includes(normalizeProductType(row) as (typeof STOCK_UNIT_PRODUCTS)[number]),
  );
  const agingRisk = STOCK_UNIT_PRODUCTS.map((product) => {
    const productRows = currentStockForHealth.filter(
      (row) => normalizeProductType(row) === product,
    );
    return {
      label: product,
      values: STOCK_AGE_BANDS.map(
        (band) => productRows.filter((row) => stockAgeBand(row.ageBucket) === band).length,
      ),
    };
  }).filter((item) => item.values.some((value) => value > 0));
  const criticalStock = currentStockForHealth.filter((row) => stockHealthTone(row.ageBucket) === "critical").length;
  const openBookings = getOpenBookingUnit(data.booking, filters);
  const recentActivities = buildRecentActivities(data, filters).slice(0, 6);
  const displayBookingStatus = (label: string) => {
    const normalized = label.trim().toLowerCase();
    if (normalized === "open") return t("status.open");
    if (normalized === "delivered" || normalized.includes("complete")) return t("status.delivered");
    if (normalized === "cancelled" || normalized === "canceled") return t("status.cancelled");
    return label;
  };

  return (
    <section className="space-y-8" aria-label="Executive charts">
      <section className="space-y-3" aria-labelledby="dashboard-primary-trend">
        <div>
          <h2 id="dashboard-primary-trend" className="text-lg font-semibold tracking-normal text-[var(--text-primary)]">
            {t("section.salesTrajectory")}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {t("section.salesTrajectoryDescription")}
          </p>
        </div>
        <div className="grid gap-5 [&>*]:min-w-0 xl:grid-cols-[minmax(0,1fr)_minmax(300px,29%)]">
        <YearTrendChart
          title={t("chart.salesTrendTitle")}
          unitRows={salesUnitTrendRows}
          valueRows={salesValueTrendRows}
          unitLabel={t("metric.salesUnit")}
          valueLabel={t("metric.salesValue")}
          currency={currency}
          height={460}
          className="shadow-[var(--shadow-hover)]"
        />
        <AttentionPanel openBookings={openBookings} criticalStock={criticalStock} sourceUpdatedAt={data.meta.sourceUpdatedAt} />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="dashboard-rankings">
        <div>
          <h2 id="dashboard-rankings" className="text-lg font-semibold tracking-normal text-[var(--text-primary)]">
            {t("section.rankingsMix")}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {t("section.rankingsMixDescription")}
          </p>
        </div>
        <div className="grid gap-5 [&>*]:min-w-0 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">
          <ChartCard
            className="min-w-0 shadow-[var(--shadow-hover)] [&_h2]:tracking-normal"
            title={t("chart.branchPerformanceTitle")}
            subtitle={t("chart.branchPerformanceDescription")}
          >
            <HorizontalBarChart data={salesByBranch} />
          </ChartCard>
          <StockHealthCard rows={currentStockForHealth} />
        </div>
      </section>

      <RecentActivityTable rows={recentActivities} />

      <section className="space-y-3" aria-labelledby="dashboard-secondary-analysis">
        <div>
          <h2 id="dashboard-secondary-analysis" className="text-lg font-semibold tracking-normal text-[var(--text-primary)]">
            {t("section.secondaryAnalysis")}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {t("section.dashboardSecondaryDescription")}
          </p>
        </div>
      <div className="grid gap-5 [&>*]:min-w-0 xl:grid-cols-2">
        <ChartCard
          className="min-w-0 [&_h2]:tracking-normal"
          title={t("chart.bookingLifecycleTitle")}
          subtitle={t("chart.bookingLifecycleDescription")}
        >
          <StackedColumnChart
            labels={bookingLifecycle.labels}
            series={bookingLifecycle.series.map((item) => ({
              ...item,
              label: displayBookingStatus(item.label),
            }))}
            unit={t("common.records")}
          />
        </ChartCard>
        <ChartCard
          className="min-w-0 [&_h2]:tracking-normal"
          title={t("chart.stockVsBookingTitle")}
          subtitle={t("chart.stockVsBookingDescription")}
        >
          <PairedBarChart
            items={stockBookingComparison}
            leftLabel={t("metric.bookingUnit")}
            rightLabel={t("metric.stockUnit")}
            leftShortLabel={t("common.booking")}
            rightShortLabel={t("common.stock")}
            shortageLabel={t("comparison.shortage")}
            surplusLabel={t("comparison.surplus")}
            balancedLabel={t("comparison.balanced")}
          />
        </ChartCard>
      </div>

      <div className="grid gap-5 [&>*]:min-w-0 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <ChartCard
          className="min-w-0 [&_h2]:tracking-normal"
          title={t("chart.productMixTitle")}
          subtitle={t("chart.productMixDescription")}
        >
          <PercentStackedBar
            segments={productMix.map((item) => ({
              id: item.label,
              label: item.label,
              value: item.value,
              color: PRODUCT_COLORS[item.label] ?? "#D1D5DB",
            }))}
            formatValue={formatCompact}
          />
        </ChartCard>
        <ChartCard
          className="min-w-0 [&_h2]:tracking-normal"
          title={t("chart.agingRiskTitle")}
          subtitle={t("chart.agingRiskDescription")}
        >
          <HeatmapMatrix
            columns={[...STOCK_AGE_BANDS]}
            rows={agingRisk}
            categoryLabel={t("filter.productGroup")}
            lowerLabel={t("common.lowerConcentration")}
            higherLabel={t("common.higherConcentration")}
          />
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
      activity: `Sales record: ${row.model || row.productType || "Unknown model"}`,
      status: "",
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
  const { t } = useLocale();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? "";
  const companyCode = selectedCompany?.code ?? "KMM";
  const companyName = selectedCompany?.name ?? "KMM Company";
  const currency = selectedCompany?.currency ?? "MMK";
  const [filterSnapshot, setFilterSnapshot] = useState<{
    companyId: string;
    filters: FilterState;
  }>({ companyId: "", filters: defaultFilters });
  const filters = filterSnapshot.companyId === companyId
    ? filterSnapshot.filters
    : defaultFilters;
  const [dashboardState, setDashboardState] = useState<{
    companyId: string;
    status: "loading" | "ready" | "error";
    data: DashboardData | null;
    error: string;
  }>({ companyId: "", status: "loading", data: null, error: "" });
  const [reloadVersion, setReloadVersion] = useState(0);
  const dashboardData = dashboardState.companyId === companyId
    ? dashboardState.data
    : null;
  const dashboardLoading = dashboardState.companyId !== companyId
    || dashboardState.status === "loading";
  const dashboardError = dashboardState.companyId === companyId
    && dashboardState.status === "error"
    ? dashboardState.error
    : "";

  function loadDashboardData() {
    setDashboardState({
      companyId,
      status: "loading",
      data: null,
      error: "",
    });
    setReloadVersion((current) => current + 1);
  }

  useEffect(() => {
    let ignore = false;
    loadDashboardPresentationData(companyId, { name: companyName, code: companyCode })
      .then((data) => {
        if (!ignore) {
          setDashboardState({
            companyId,
            status: "ready",
            data,
            error: "",
          });
        }
      })
      .catch((loadError: unknown) => {
        if (!ignore) {
          setDashboardState({
            companyId,
            status: "error",
            data: null,
            error: loadError instanceof Error
              ? loadError.message
              : "Unable to load dashboard data",
          });
        }
      });

    const refreshAfterImport = () => {
      setDashboardState({
        companyId,
        status: "loading",
        data: null,
        error: "",
      });
      setReloadVersion((current) => current + 1);
    };
    window.addEventListener("kmm:sales-imported", refreshAfterImport);
    return () => {
      ignore = true;
      window.removeEventListener("kmm:sales-imported", refreshAfterImport);
    };
  }, [companyCode, companyId, companyName, reloadVersion]);

  function updateFilter(key: FilterKey, values: string[]) {
    setFilterSnapshot((current) => ({
      companyId,
      filters: {
        ...(current.companyId === companyId ? current.filters : defaultFilters),
        [key]: values,
      },
    }));
  }

  function resetFilters() {
    setFilterSnapshot({ companyId, filters: defaultFilters });
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
    const blob = new Blob([`\uFEFF${csv.map((row) => row.map(csvCell).join(",")).join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${companyCode.toLowerCase()}-executive-dashboard-activity.csv`;
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
                  {t("route.dashboard.title")}
                </h1>
                <p className="mt-1 text-sm font-normal leading-5 text-[var(--text-secondary)]">
                  {t("route.dashboard.subtitle").replaceAll("KMM", companyCode)}
                </p>
              </div>
              <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
                {dashboardData && (
                  <FreshnessIndicator timestamp={dashboardData.meta.sourceUpdatedAt} className="font-normal" />
                )}
              </div>
            </section>

            <section aria-label="Dashboard filters">
              <GlobalFilter
                filters={filters}
                options={filterOptions}
                onChange={updateFilter}
                onReset={resetFilters}
                onExport={exportDashboard}
              />
            </section>

            {dashboardLoading && (
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
            {dashboardError && !dashboardLoading && (
              <Card
                className="grid min-h-[320px] place-items-center rounded-[var(--radius-card)] border-[var(--status-danger)] bg-[var(--surface-default)] p-8 shadow-[var(--shadow-card)]"
                role="alert"
                aria-live="assertive"
              >
                <ErrorState message={dashboardError} onRetry={loadDashboardData} />
              </Card>
            )}
            {dashboardData && !dashboardLoading && !dashboardError && (
              <>
                <KpiSection data={dashboardData} filters={filters} currency={currency} />
                <ChartsSection data={dashboardData} filters={filters} currency={currency} />
              </>
            )}
          </div>
      </main>
    </div>
  );
}
