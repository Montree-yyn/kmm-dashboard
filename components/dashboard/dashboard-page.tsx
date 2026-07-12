"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, Menu, RefreshCw, RotateCcw, Search } from "lucide-react";
import { AppSidebar } from "../navigation/app-sidebar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { PRODUCT_GROUPS, filterByProductGroups, productCategory } from "../../lib/dashboard/product-groups";
import { ChartCard } from "../design-system/chart-card";
import { ErrorState } from "../design-system/error-state";
import { ExportButton } from "../design-system/export-button";
import { FilterBar } from "../design-system/filter-bar";
import { KpiCard } from "../design-system/kpi-card";
import { LoadingSkeleton } from "../design-system/loading-skeleton";
import { PremiumTrendChart } from "../common/charts/PremiumTrendChart";
import { HeaderPresentationTrigger } from "../presentation/HeaderPresentationTrigger";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  finalReceived: number;
  netReceived: number;
  gp1: number;
  expense: number;
};

type BookingRow = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  productType: string;
  model: string;
  price: number;
  status: string;
};

type StockRow = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  productType: string;
  model: string;
  ageBucket: string;
  msrp: number;
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
  year: ["2026"],
  month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  branch: [],
  salesperson: [],
};

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function sum<T>(rows: T[], selector: (row: T) => number) {
  return rows.reduce((total, row) => total + selector(row), 0);
}

function selectedYears(filters: FilterState) {
  return filters.year.map(Number).filter(Number.isFinite);
}

function selectedMonths(filters: FilterState) {
  return filters.month.map((month) => MONTHS.indexOf(month) + 1).filter((month) => month > 0);
}

function previousYearFilters(filters: FilterState): FilterState {
  const years = selectedYears(filters);
  return { ...filters, year: years.length ? years.map((year) => String(year - 1)) : [] };
}

function rowMatches(row: { year: number | null; month: number | null; branch: string; salesperson: string }, filters: FilterState) {
  const years = selectedYears(filters);
  const months = selectedMonths(filters);
  if (years.length && (!row.year || !years.includes(row.year))) return false;
  if (months.length && (!row.month || !months.includes(row.month))) return false;
  if (filters.branch.length && !filters.branch.includes(row.branch)) return false;
  if (filters.salesperson.length && !filters.salesperson.includes(row.salesperson)) return false;
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

function getTrendArrow(value: number | null, lowerIsBetter = false) {
  if (value === null) return "";
  const positive = lowerIsBetter ? value <= 0 : value >= 0;
  return positive ? "▲" : "▼";
}

function trendDirection(value: number | null): "positive" | "negative" | "neutral" {
  if (value === null) return "neutral";
  return value >= 0 ? "positive" : "negative";
}

function topGroups<T>(rows: T[], selector: (row: T) => string, limit?: number) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = selector(row) || "Missing";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const groups = Array.from(counts, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  return typeof limit === "number" ? groups.slice(0, limit) : groups;
}

function MultiSelectFilter({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filteredOptions = useMemo(() => options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase())), [options, query]);

  function toggleValue(value: string) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  const displayValue = values.length === 0 ? "All" : values.length === 1 ? values[0] : `${values.length} selected`;

  return (
    <div className="relative min-w-0">
      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A8E96]">{label}</label>
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white px-3 text-left text-sm font-semibold text-[#1F2937] shadow-[0_1px_2px_rgba(31,41,55,0.04)] transition hover:border-[#D1D5DB] focus:border-[#FFB46E] focus:ring-4 focus:ring-[#FF8615]/10" aria-expanded={open}>
        <span className="truncate">{displayValue}</span>
        <ChevronDown size={16} className={cn("shrink-0 text-[#9CA3AF] transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <Card className="absolute left-0 right-0 top-[72px] z-50 p-2 shadow-xl">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] pl-9 pr-3 text-sm outline-none focus:border-[#FFB46E] focus:bg-white" placeholder={`Search ${label.toLowerCase()}`} />
          </div>
          <div className="max-h-52 space-y-1 overflow-y-auto">
            {filteredOptions.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-[#55565A] hover:bg-[#FFF7EF]">
                <input type="checkbox" checked={values.includes(option)} onChange={() => toggleValue(option)} className="size-4 rounded border-[#D1D5DB] accent-[#FF8615]" />
                <span className="truncate">{option}</span>
              </label>
            ))}
            {filteredOptions.length === 0 && <p className="px-2 py-4 text-center text-sm text-[#9CA3AF]">No options found</p>}
          </div>
        </Card>
      )}
    </div>
  );
}

function GlobalFilter({ filters, options, onChange, onRefresh, onReset, onExport }: { filters: FilterState; options: FilterState; onChange: (key: FilterKey, values: string[]) => void; onRefresh: () => void; onReset: () => void; onExport: () => void }) {
  return (
    <FilterBar
      actions={
        <>
          <Button className="h-11" variant="outline" onClick={onRefresh}><RefreshCw size={16} />Refresh</Button>
          <Button className="h-11" variant="outline" onClick={onReset}><RotateCcw size={16} />Reset</Button>
          <ExportButton onClick={onExport} />
        </>
      }
    >
      <MultiSelectFilter label="Year" options={options.year} values={filters.year} onChange={(values) => onChange("year", values)} />
      <MultiSelectFilter label="Month" options={options.month} values={filters.month} onChange={(values) => onChange("month", values)} />
      <MultiSelectFilter label="Branch" options={options.branch} values={filters.branch} onChange={(values) => onChange("branch", values)} />
      <MultiSelectFilter label="Salesperson" options={options.salesperson} values={filters.salesperson} onChange={(values) => onChange("salesperson", values)} />
    </FilterBar>
  );
}

function KpiSection({ data, filters }: { data: DashboardData; filters: FilterState }) {
  const filteredSales = data.sales.filter((row) => rowMatches(row, filters));
  const filteredBooking = data.booking.filter((row) => rowMatches(row, filters));
  const filteredStock = data.stock.filter((row) => rowMatches(row, filters));
  const currentSales = filterByProductGroups(filteredSales, PRODUCT_GROUPS.UNIT_PRODUCTS);
  const currentSalesValueRows = filterByProductGroups(filteredSales, PRODUCT_GROUPS.VALUE_PRODUCTS);
  const currentBooking = filterByProductGroups(filteredBooking, PRODUCT_GROUPS.UNIT_PRODUCTS);
  const currentStock = filterByProductGroups(filteredStock, PRODUCT_GROUPS.UNIT_PRODUCTS);

  const previousFilters = previousYearFilters(filters);
  const previousFilteredSales = data.sales.filter((row) => rowMatches(row, previousFilters));
  const previousSales = filterByProductGroups(previousFilteredSales, PRODUCT_GROUPS.UNIT_PRODUCTS);
  const previousSalesValueRows = filterByProductGroups(previousFilteredSales, PRODUCT_GROUPS.VALUE_PRODUCTS);
  const salesValue = sum(currentSalesValueRows, (row) => row.finalReceived);
  const previousSalesValue = sum(previousSalesValueRows, (row) => row.finalReceived);
  const grossProfit = sum(currentSalesValueRows, (row) => row.gp1);
  const previousGrossProfit = sum(previousSalesValueRows, (row) => row.gp1);
  const years = selectedYears(filters);
  const months = selectedMonths(filters);
  const comparisonLabel = years.length === 1 && months.length === 1 ? `vs ${MONTHS[months[0] - 1]} ${years[0] - 1}` : "vs same period last year";
  const salesComparison = percentChange(currentSales.length, previousSales.length);
  const salesValueComparison = percentChange(salesValue, previousSalesValue);
  const grossProfitComparison = percentChange(grossProfit, previousGrossProfit);

  return (
    <section aria-label="Executive KPIs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))] xl:gap-3 2xl:gap-4">
      <KpiCard title="Sales Unit" value={currentSales.length} unit="Unit" comparison={{ value: `${getTrendArrow(salesComparison)} ${trendText(salesComparison)}`, direction: trendDirection(salesComparison), label: comparisonLabel }} />
      <KpiCard title="Sales Value" value={formatCompact(salesValue)} unit="MMK" comparison={{ value: `${getTrendArrow(salesValueComparison)} ${trendText(salesValueComparison)}`, direction: trendDirection(salesValueComparison), label: comparisonLabel }} />
      <KpiCard title="Gross Profit" value={formatCompact(grossProfit)} unit="MMK" comparison={{ value: `${getTrendArrow(grossProfitComparison)} ${trendText(grossProfitComparison)}`, direction: trendDirection(grossProfitComparison), label: comparisonLabel }} />
      <KpiCard title="Booking Unit" value={currentBooking.length} unit="Total Unit" />
      <KpiCard title="Stock Unit" value={currentStock.length} unit="Total Unit" />
    </section>
  );
}

const PRODUCT_COLORS: Record<string, string> = {
  TT: "#FF7A00",
  CH: "#4B5563",
  EX: "#9CA3AF",
  TP: "#D1D5DB",
  MAX: "#F3F4F6",
};

function filterForCharts<T extends { year: number | null; month: number | null; branch: string; salesperson: string }>(rows: T[], filters: FilterState, includeMonth = true) {
  const chartFilters = includeMonth ? filters : { ...filters, month: [] };
  return rows.filter((row) => rowMatches(row, chartFilters));
}

type TrendDatum = { label: string; value: number | null };
type ChartPoint = TrendDatum & { x: number; y: number | null };

function monthSeries<T extends { month: number | null }>(rows: T[], selector: (row: T) => number): TrendDatum[] {
  return MONTHS.map((label, index) => ({
    label,
    value: rows.some((row) => row.month === index + 1) ? rows.filter((row) => row.month === index + 1).reduce((total, row) => total + selector(row), 0) : null,
  }));
}

function productSeries<T extends { productType: string; model?: string }>(rows: T[], labels: readonly string[], selector: (row: T) => number) {
  return labels.map((label) => ({
    label,
    value: rows.filter((row) => productCategory(row) === label).reduce((total, row) => total + selector(row), 0),
  }));
}

function chartPoints(data: TrendDatum[], max: number, width: number, height: number, padX: number, padY: number): ChartPoint[] {
  return data.map((item, index) => {
    const x = padX + (index * (width - padX * 2)) / Math.max(data.length - 1, 1);
    const y = item.value === null ? null : height - padY - (item.value / max) * (height - padY * 2);
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

  return segments.filter((segment) => segment.length > 0).map((segment) => {
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
  const [tooltip, setTooltip] = useState<{ label: string; x: number; unit: number | null; value?: number | null } | null>(null);
  const width = 920;
  const height = minPlotHeight;
  const padX = 78;
  const padY = 42;
  const unitMax = Math.max(...unitData.map((item) => item.value ?? 0), 1);
  const valueMax = Math.max(...(valueData ?? []).map((item) => item.value ?? 0), 1);
  const unitPoints = chartPoints(unitData, unitMax, width, height, padX, padY);
  const valuePoints = valueData ? chartPoints(valueData, valueMax, width, height, padX, padY) : [];
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
        <span className="flex items-center gap-2"><i className="h-[3px] w-7 rounded-full" style={{ backgroundColor: lineColor }} />{unitLabel}</span>
        {valueData && <span className="flex items-center gap-2"><i className="h-0 w-7 border-t-[3px] border-dashed border-[#4B5563]" />{valueLabel}</span>}
      </div>
      <div className="relative">
        <svg className="w-full" style={{ minHeight: `${minPlotHeight}px` }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" onMouseLeave={() => setTooltip(null)}>
          <title>Line chart for monthly dashboard trend</title>
          {yTicks.map((tick) => <line key={tick.ratio} x1={padX} x2={width - padX} y1={tick.y} y2={tick.y} stroke="#F3F4F6" strokeWidth="1" />)}
          {guideMonth && (() => {
            const point = unitPoints[guideMonth - 1];
            return point ? <line x1={point.x} x2={point.x} y1={padY - 8} y2={height - padY + 8} stroke="#D1D5DB" strokeWidth="1" strokeDasharray="4 6" /> : null;
          })()}
          {yTicks.map((tick) => (
            <g key={`axis-${tick.ratio}`}>
              <text x={padX - 14} y={tick.y + 4} textAnchor="end" fill="#4B5563" fontSize="12" fontWeight="600">{formatCompact(tick.unit)}</text>
              {valueData && <text x={width - padX + 14} y={tick.y + 4} textAnchor="start" fill="#4B5563" fontSize="12" fontWeight="600">{formatCompact(tick.value)}</text>}
            </g>
          ))}
          <text x={padX - 34} y={padY - 18} fill="#4B5563" fontSize="12" fontWeight="700">Unit</text>
          {valueData && <text x={width - padX + 8} y={padY - 18} fill="#4B5563" fontSize="12" fontWeight="700">MMK</text>}
          {linePath(unitPoints).map((path, index) => <path key={`unit-path-${index}`} d={path} fill="none" stroke={lineColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
          {valueData && linePath(valuePoints).map((path, index) => <path key={`value-path-${index}`} d={path} fill="none" stroke="#4B5563" strokeWidth="2.75" strokeDasharray="8 8" strokeLinecap="round" strokeLinejoin="round" />)}
          {unitPoints.map((point, index) => {
            if (point.y === null) return null;
            const active = tooltip?.label === point.label || guideMonth === index + 1;
            return (
              <g key={`unit-${point.label}`} onMouseEnter={() => setTooltip({ label: point.label, x: (point.x / width) * 100, unit: point.value, value: valuePoints[index]?.value })}>
                <title>{`${point.label}: ${formatCompact(point.value ?? 0)} ${unitLabel}${valueData ? `, ${formatCompact(valuePoints[index]?.value ?? 0)} ${valueLabel}` : ""}`}</title>
                <circle cx={point.x} cy={point.y} r={active ? 6 : 4.5} fill="white" stroke={lineColor} strokeWidth="2.75" />
              </g>
            );
          })}
          {valueData && valuePoints.map((point, index) => {
            if (point.y === null) return null;
            const active = tooltip?.label === point.label || guideMonth === index + 1;
            return (
              <g key={`value-${point.label}`} onMouseEnter={() => setTooltip({ label: point.label, x: (point.x / width) * 100, unit: unitPoints[index]?.value, value: point.value })}>
                <title>{`${point.label}: ${formatCompact(point.value ?? 0)} ${valueLabel}`}</title>
                <circle cx={point.x} cy={point.y} r={active ? 6 : 4.25} fill="white" stroke="#4B5563" strokeWidth="2.5" />
              </g>
            );
          })}
          {unitPoints.map((point) => <text key={`x-${point.label}`} x={point.x} y={height - 10} textAnchor="middle" fill="#4B5563" fontSize="12" fontWeight="600">{point.label}</text>)}
        </svg>
        {tooltip && (
          <div className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#4B5563] shadow-[0_10px_28px_rgba(31,41,55,0.10)]" style={{ left: `${Math.min(Math.max(tooltip.x, 12), 78)}%` }}>
            <p className="font-bold text-[#1F2937]">{tooltip.label}</p>
            <p className="mt-1">{unitLabel}: <strong>{tooltip.unit === null ? "No data" : formatCompact(tooltip.unit)}</strong></p>
            {valueData && <p>{valueLabel}: <strong>{tooltip.value === null || tooltip.value === undefined ? "No data" : formatCompact(tooltip.value)}</strong></p>}
          </div>
        )}
      </div>
    </div>
  );
}

void LegacyLineChart;

function LineChart({ title, unitData, valueData, unitLabel = "Unit", valueLabel = "Sales Value" }: { title: string; unitData: TrendDatum[]; valueData?: TrendDatum[]; selectedMonths: number[]; variant?: "orange" | "gray"; unitLabel?: string; valueLabel?: string; minPlotHeight?: number }) {
  return <PremiumTrendChart title={title} labels={unitData.map((item) => item.label)} unit={valueData ? "MMK" : unitLabel} formatValue={formatCompact} series={[{ id: "current", label: unitLabel, values: unitData.map((item) => item.value), kind: "current" }, ...(valueData ? [{ id: "previous", label: valueLabel, values: valueData.map((item) => item.value), kind: "previous" as const }] : [])]} />;
}

function HorizontalBarChart({ data, color = "#FF7A00" }: { data: { label: string; value: number }[]; color?: string }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {sorted.map((item) => (
        <div key={item.label} className="grid grid-cols-[minmax(64px,88px)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <span className="min-w-0 font-semibold leading-tight text-[#4B5563]" title={item.label}>{item.label}</span>
          <div className="h-3 rounded-full bg-[#F3F4F6]">
            <div className="h-3 rounded-full" style={{ width: `${Math.max((item.value / max) * 100, item.value ? 5 : 0)}%`, backgroundColor: color }} />
          </div>
          <span className="min-w-10 text-right text-xs font-bold text-[#4B5563]">{formatCompact(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data }: { data: { label: string; value: number }[] }) {
  const total = sum(data, (item) => item.value);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const segments = data.reduce<{ label: string; value: number; length: number; offset: number }[]>((items, item) => {
    const offset = items.reduce((totalOffset, segment) => totalOffset + segment.length, 0);
    const length = total ? (item.value / total) * circumference : 0;
    return [...items, { ...item, length, offset }];
  }, []);

  return (
    <div className="grid gap-6 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
      <div className="relative mx-auto size-[150px]">
        <svg className="size-[150px] -rotate-90" viewBox="0 0 150 150" role="img">
          <title>Product mix donut chart</title>
          <circle cx="75" cy="75" r={radius} fill="none" stroke="#F3F4F6" strokeWidth="18" />
          {segments.map((item) => <circle key={item.label} cx="75" cy="75" r={radius} fill="none" stroke={PRODUCT_COLORS[item.label] ?? "#D1D5DB"} strokeWidth="18" strokeDasharray={`${item.length} ${circumference - item.length}`} strokeDashoffset={-item.offset} strokeLinecap="butt" />)}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <strong className="block text-2xl tracking-[-0.04em] text-[#1F2937]">{formatCompact(total)}</strong>
            <span className="text-[11px] font-semibold text-[#4B5563]">Sales Unit</span>
          </div>
        </div>
      </div>
      <div className="min-w-0 space-y-2.5">
        {data.map((item) => (
          <div key={item.label} className="flex min-w-0 items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-semibold text-[#4B5563]"><i className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: PRODUCT_COLORS[item.label] ?? "#D1D5DB" }} />{item.label}</span>
            <span className="shrink-0 text-xs font-bold text-[#4B5563]">{formatCompact(item.value)} · {total ? Math.round((item.value / total) * 100) : 0}%</span>
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
  const monthIndexes = months.length ? months.map((month) => month - 1) : data.plan.months.map((_, index) => index);
  const value = monthIndexes.reduce((total, index) => total + (data.plan.units[index] ?? 0), 0);
  return value > 0 ? value : null;
}

function TargetProgressItem({ name, actual, target }: { name: string; actual: number; target: number | null }) {
  const achievement = target && target > 0 ? (actual / target) * 100 : null;
  const remaining = target && target > 0 ? Math.max(target - actual, 0) : null;
  const progressWidth = achievement === null ? 0 : Math.min(achievement, 100);
  const percentageTone = achievement === null ? "text-[#4B5563]" : achievement >= 100 ? "text-[#16A34A]" : "text-[#DC2626]";

  return (
    <div className="rounded-xl border border-[#EEF0F3] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#4B5563]">{name}</p>
        <span className={cn("text-[15px] font-semibold", percentageTone)}>{achievement === null ? "N/A" : `${Math.round(achievement)}%`}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-[22px] font-semibold leading-none tracking-[-0.03em] text-[#1F2937]">
          {formatCompact(actual)} <span className="text-sm font-semibold text-[#6B7280]">/ {target === null ? "N/A" : formatCompact(target)} Unit</span>
        </p>
      </div>
      <p className="mt-3 text-xs font-medium text-[#6B7280]">Remaining {remaining === null ? "N/A" : formatCompact(remaining)} Unit</p>
      <div className="mt-3 h-2.5 rounded-full bg-[#F3F4F6]">
        <div className="h-2.5 rounded-full bg-[#FF7A00]" style={{ width: `${progressWidth}%` }} />
      </div>
    </div>
  );
}

function TargetProgress({ data, filters }: { data: DashboardData; filters: FilterState }) {
  const filteredSales = filterForCharts(data.sales, filters);
  const filteredBooking = filterForCharts(data.booking, filters);
  const filteredStock = filterForCharts(data.stock, filters);
  const salesActual = filterByProductGroups(filteredSales, PRODUCT_GROUPS.UNIT_PRODUCTS).length;
  const bookingActual = filterByProductGroups(filteredBooking, PRODUCT_GROUPS.UNIT_PRODUCTS).length;
  const landingActual = filteredStock.length;
  const salesTarget = targetValue(data, filters);

  return (
    <Card className="min-h-[420px] rounded-2xl border-[#E8EAED] bg-white p-5 shadow-[0_8px_24px_rgba(31,41,55,0.035)] sm:p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-[19px] font-semibold leading-tight tracking-[-0.015em] text-[#1F2937]">Target Progress</h2>
        <span className="rounded-full border border-[#E5E7EB] px-2.5 py-1 text-[11px] font-semibold text-[#6B7280]">Monthly</span>
      </div>
      <div className="space-y-4">
        <TargetProgressItem name="Sales Unit Target" actual={salesActual} target={salesTarget} />
        <TargetProgressItem name="Booking Unit Target" actual={bookingActual} target={null} />
        <TargetProgressItem name="Landing Unit Target" actual={landingActual} target={null} />
      </div>
    </Card>
  );
}

function ChartsSection({ data, filters }: { data: DashboardData; filters: FilterState }) {
  const selectedMonthNumbers = selectedMonths(filters);
  const trendSales = filterForCharts(data.sales, filters);
  const trendBooking = filterForCharts(data.booking, filters);
  const trendStock = filterForCharts(data.stock, filters);
  const filteredSales = filterForCharts(data.sales, filters);
  const filteredBooking = filterForCharts(data.booking, filters);
  const filteredStock = filterForCharts(data.stock, filters);
  const salesUnitRows = filterByProductGroups(trendSales, PRODUCT_GROUPS.UNIT_PRODUCTS);
  const salesValueRows = filterByProductGroups(trendSales, PRODUCT_GROUPS.VALUE_PRODUCTS);
  const bookingRows = filterByProductGroups(trendBooking, PRODUCT_GROUPS.UNIT_PRODUCTS);
  const stockRows = filterByProductGroups(trendStock, PRODUCT_GROUPS.UNIT_PRODUCTS);
  const salesTrend = monthSeries(salesUnitRows, () => 1);
  const salesValueTrend = monthSeries(salesValueRows, (row) => row.finalReceived);
  const bookingTrend = monthSeries(bookingRows, () => 1);
  const stockTrend = monthSeries(stockRows, () => 1);
  const salesUnitRowsForAnalysis = filterByProductGroups(filteredSales, PRODUCT_GROUPS.UNIT_PRODUCTS);
  const bookingRowsForAnalysis = filterByProductGroups(filteredBooking, PRODUCT_GROUPS.UNIT_PRODUCTS);
  const stockRowsForAnalysis = filterByProductGroups(filteredStock, PRODUCT_GROUPS.UNIT_PRODUCTS);
  const salesByBranch = topGroups(salesUnitRowsForAnalysis, (row) => row.branch);
  const productMix = productSeries(salesUnitRowsForAnalysis, PRODUCT_GROUPS.UNIT_PRODUCTS, () => 1);
  const bookingByProduct = productSeries(bookingRowsForAnalysis, PRODUCT_GROUPS.UNIT_PRODUCTS, () => 1);
  const stockByProduct = productSeries(stockRowsForAnalysis, PRODUCT_GROUPS.UNIT_PRODUCTS, () => 1);

  return (
    <section className="space-y-5" aria-label="Executive charts">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,29%)]">
        <LineChart title="Sales Trend" unitData={salesTrend} valueData={salesValueTrend} selectedMonths={selectedMonthNumbers} unitLabel="Sales Unit" valueLabel="Sales Value" />
        <TargetProgress data={data} filters={filters} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <LineChart title="Booking Trend" unitData={bookingTrend} selectedMonths={selectedMonthNumbers} unitLabel="Booking Unit" />
        <LineChart title="Stock Trend" unitData={stockTrend} selectedMonths={selectedMonthNumbers} variant="gray" unitLabel="Stock Unit" />
      </div>

      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
        <ChartCard title="Sales by Branch">
          <HorizontalBarChart data={salesByBranch} />
        </ChartCard>
        <ChartCard title="Product Mix">
          <DonutChart data={productMix} />
        </ChartCard>
        <ChartCard title="Booking by Product">
          <HorizontalBarChart data={bookingByProduct} />
        </ChartCard>
        <ChartCard title="Stock by Product">
          <HorizontalBarChart data={stockByProduct} color="#4B5563" />
        </ChartCard>
      </div>
    </section>
  );
}

function buildRecentActivities(data: DashboardData, filters: FilterState): ActivityRow[] {
  const sales = data.sales.filter((row) => rowMatches(row, filters)).map((row) => ({
    date: row.date,
    branch: row.branch,
    salesperson: row.salesperson || "-",
    activity: `Sales delivery: ${row.model || row.productType || "Unknown model"}`,
    status: "Completed",
  }));
  const booking = data.booking.filter((row) => rowMatches(row, filters)).map((row) => ({
    date: row.date,
    branch: row.branch,
    salesperson: row.salesperson || "-",
    activity: `Booking: ${row.model || row.productType || "Unknown model"}`,
    status: row.status,
  }));
  const marketing = data.marketing.filter((row) => rowMatches(row, filters)).map((row) => ({
    date: row.date,
    branch: row.branch,
    salesperson: "-",
    activity: `Marketing: ${row.activity || "Activity"}`,
    status: `${row.participants} participants`,
  }));
  return [...sales, ...booking, ...marketing].filter((row) => row.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
}

function buildFilterOptions(data: DashboardData): FilterState {
  const years = new Set<string>();
  const branches = new Set<string>();
  const salespeople = new Set<string>();
  const addRow = (row: { year: number | null; branch: string; salesperson: string }) => {
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboardData() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load dashboard-data.json (${response.status})`);
      setDashboardData(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load dashboard-data.json (${response.status})`);
        return response.json() as Promise<DashboardData>;
      })
      .then((data) => {
        if (!ignore) setDashboardData(data);
      })
      .catch((loadError: unknown) => {
        if (!ignore) setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard data");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  function updateFilter(key: FilterKey, values: string[]) {
    setFilters((current) => ({ ...current, [key]: values }));
  }

  function exportDashboard() {
    if (!dashboardData) return;
    const rows = buildRecentActivities(dashboardData, filters);
    const csv = [["Date", "Branch", "Salesperson", "Activity", "Status"], ...rows.map((item) => [item.date, item.branch, item.salesperson, item.activity, item.status])];
    const blob = new Blob([csv.map((row) => row.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kmm-executive-dashboard-activity.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filterOptions = dashboardData ? buildFilterOptions(dashboardData) : defaultFilters;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1F2937]">
      <AppSidebar collapsed={collapsed} mobileOpen={mobileOpen} onCollapsedChange={setCollapsed} onMobileOpenChange={setMobileOpen} />

      <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]")}>
        <header className="sticky top-0 z-30 flex h-[82px] items-center gap-3 border-b border-[#E5E7EB] bg-white/95 px-4 backdrop-blur-md sm:px-6 xl:px-8">
          <button className="rounded-xl border border-[#E5E7EB] p-2.5 text-[#55565A] hover:bg-[#F8FAFC] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={17} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] pl-10 pr-4 text-sm text-[#1F2937] outline-none transition focus:border-[#FFB46E] focus:bg-white focus:ring-4 focus:ring-[#FF8615]/10" placeholder="Search branch or action..." aria-label="Search dashboard" />
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <HeaderPresentationTrigger />
            <div className="relative">
              <button className="relative grid size-10 place-items-center rounded-xl border border-[#E5E7EB] text-[#55565A] transition hover:border-[#D1D5DB] hover:bg-[#F8FAFC]" onClick={() => setNotificationsOpen((v) => !v)} aria-label="Open notifications" aria-expanded={notificationsOpen}>
                <Bell size={18} /><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#EF4444]" />
              </button>
              {notificationsOpen && (
                <Card className="absolute right-0 top-12 z-50 w-[310px] p-2 shadow-xl">
                  <div className="flex items-center justify-between px-3 py-2"><strong className="text-sm">Attention needed</strong><Badge variant="danger">2</Badge></div>
                  <div className="rounded-xl p-3 hover:bg-[#F8FAFC]"><p className="text-sm font-semibold">Aged stock is above guardrail</p><p className="mt-1 text-xs leading-5 text-[#6B7280]">Source-backed inventory rows are loaded from the stock workbook.</p></div>
                  <div className="rounded-xl p-3 hover:bg-[#F8FAFC]"><p className="text-sm font-semibold">Finance definition pending</p><p className="mt-1 text-xs leading-5 text-[#6B7280]">Revenue and GP fields come from CPI workbook columns.</p></div>
                </Card>
              )}
            </div>
            <button className="flex items-center gap-2 rounded-xl p-1.5 pr-2 transition hover:bg-[#F8FAFC]" aria-label="Open profile menu">
              <span className="grid size-9 place-items-center rounded-xl bg-[#55565A] text-xs font-bold text-white">KM</span>
              <span className="hidden text-left xl:block"><span className="block text-xs font-semibold">KMM Admin</span><span className="block text-[10px] text-[#9CA3AF]">Executive view</span></span>
              <ChevronDown className="hidden text-[#9CA3AF] xl:block" size={15} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6 2xl:p-6">
          <div className="space-y-6">
            <section className="space-y-5">
              
              <GlobalFilter filters={filters} options={filterOptions} onChange={updateFilter} onRefresh={loadDashboardData} onReset={() => setFilters(defaultFilters)} onExport={exportDashboard} />
            </section>

            {loading && <Card className="grid min-h-[320px] place-items-center rounded-2xl p-8 text-center text-sm font-semibold text-[#6B7280]"><div className="w-full max-w-xl space-y-4"><LoadingSkeleton variant="chart" /><p>Loading real dashboard data...</p></div></Card>}
            {error && !loading && <Card className="grid min-h-[320px] place-items-center rounded-2xl border-[#FECACA] p-8"><ErrorState message={error} onRetry={loadDashboardData} /></Card>}
            {dashboardData && !loading && !error && (
              <>
                <KpiSection data={dashboardData} filters={filters} />
                <ChartsSection data={dashboardData} filters={filters} />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
