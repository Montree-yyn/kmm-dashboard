"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, ChevronLeft, ChevronRight, Menu, RefreshCw, RotateCcw, Search } from "lucide-react";
import { AppSidebar } from "../navigation/app-sidebar";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { PRODUCT_GROUPS, filterByProductGroups, productCategory } from "../../lib/dashboard/product-groups";
import { ChartCard } from "../design-system/chart-card";
import { EmptyState } from "../design-system/empty-state";
import { ErrorState } from "../design-system/error-state";
import { ExportButton } from "../design-system/export-button";
import { FilterBar } from "../design-system/filter-bar";
import { KpiCard } from "../design-system/kpi-card";
import { LoadingSkeleton } from "../design-system/loading-skeleton";
import { ProductBadge } from "../design-system/product-badge";
import { HeaderPresentationTrigger } from "../presentation/HeaderPresentationTrigger";
import { TableCard } from "../design-system/table-card";
import { PremiumTrendChart } from "../common/charts/PremiumTrendChart";
import type { StandardLineSeries } from "../common/charts/StandardLineChart";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PRODUCT_FILTER_OPTIONS = ["All Products", ...PRODUCT_GROUPS.UNIT_PRODUCTS];

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
  finalReceived: number;
  netReceived: number;
  gp1: number;
  expense: number;
};

type SalesData = {
  meta: { sourceUpdatedAt: string; sources: string[] };
  plan: { year: number; months: string[]; units: number[] };
  sales: SalesRow[];
};

type TrendMetric = "unit" | "value";
type MonthRange = "full" | "q1" | "q2" | "q3" | "q4" | "custom";
type TrendPoint = { month: number; label: string; values: Record<number, number | null>; target: number | null };

const defaultFilters: FilterState = {
  year: ["2026"],
  month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  branch: [],
  salesperson: [],
  productGroup: ["All Products"],
};

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
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
  return filters.month.map((month) => MONTHS.indexOf(month) + 1).filter((month) => month > 0);
}

function selectedProductGroups(filters: FilterState) {
  const selected = filters.productGroup.filter((group) => group !== "All Products");
  return filters.productGroup.length === 0 || filters.productGroup.includes("All Products") ? [] : selected;
}

function rowMatches(row: { year: number | null; month: number | null; branch: string; salesperson: string; productType: string; model?: string }, filters: FilterState) {
  const years = selectedYears(filters);
  const months = selectedMonths(filters);
  const productGroups = selectedProductGroups(filters);
  if (years.length && (!row.year || !years.includes(row.year))) return false;
  if (months.length && (!row.month || !months.includes(row.month))) return false;
  if (filters.branch.length && !filters.branch.includes(row.branch)) return false;
  if (filters.salesperson.length && !filters.salesperson.includes(row.salesperson)) return false;
  if (productGroups.length && !productGroups.includes(productCategory(row))) return false;
  return true;
}

function sum<T>(rows: T[], selector: (row: T) => number) {
  return rows.reduce((total, row) => total + selector(row), 0);
}

function percentChange(current: number, previous: number) {
  return previous ? ((current - previous) / previous) * 100 : null;
}

function trendValue(value: number | null) {
  return value === null ? "N/A" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function trendDirection(value: number | null): "positive" | "negative" | "neutral" {
  if (value === null) return "neutral";
  return value >= 0 ? "positive" : "negative";
}

function previousYearFilters(filters: FilterState): FilterState {
  const years = selectedYears(filters);
  return { ...filters, year: years.length ? years.map((year) => String(year - 1)) : [] };
}

function targetValue(data: SalesData, filters: FilterState) {
  const years = selectedYears(filters);
  const hasDimensionTargetGap = filters.branch.length > 0 || filters.salesperson.length > 0 || selectedProductGroups(filters).length > 0;
  if (years.length !== 1 || years[0] !== data.plan.year || hasDimensionTargetGap) return null;
  const months = selectedMonths(filters);
  const indexes = months.length ? months.map((month) => month - 1) : data.plan.months.map((_, index) => index);
  const target = indexes.reduce((total, index) => total + (data.plan.units[index] ?? 0), 0);
  return target > 0 ? target : null;
}

function KpiComparison({ value, label }: { value: number | null; label: string }) {
  return { value: trendValue(value), direction: trendDirection(value), label } as const;
}

function MultiSelectFilter({ label, options, values, onChange }: { label: string; options: string[]; values: string[]; onChange: (values: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));
  const displayValue = values.length === 0 ? "All" : values.length === 1 ? values[0] : `${values.length} selected`;

  function toggleOption(option: string) {
    if (option === "All Products") {
      onChange(["All Products"]);
      return;
    }
    const next = values.includes(option) ? values.filter((item) => item !== option) : [...values.filter((item) => item !== "All Products"), option];
    onChange(next.length ? next : ["All Products"]);
  }

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
                <input type="checkbox" checked={values.includes(option)} onChange={() => toggleOption(option)} className="size-4 rounded border-[#D1D5DB] accent-[#FF8615]" />
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

function SalesFilters({ filters, options, onChange, onRefresh, onReset, onExport }: { filters: FilterState; options: FilterState; onChange: (key: FilterKey, values: string[]) => void; onRefresh: () => void; onReset: () => void; onExport: () => void }) {
  return (
    <FilterBar actions={<><Button className="h-11" variant="outline" onClick={onReset}><RotateCcw size={16} />Reset</Button><Button className="h-11" variant="outline" onClick={onRefresh}><RefreshCw size={16} />Refresh</Button><ExportButton onClick={onExport} /></>}>
      <MultiSelectFilter label="Year" options={options.year} values={filters.year} onChange={(values) => onChange("year", values)} />
      <MultiSelectFilter label="Month" options={options.month} values={filters.month} onChange={(values) => onChange("month", values)} />
      <MultiSelectFilter label="Branch" options={options.branch} values={filters.branch} onChange={(values) => onChange("branch", values)} />
      <MultiSelectFilter label="Salesperson" options={options.salesperson} values={filters.salesperson} onChange={(values) => onChange("salesperson", values)} />
      <MultiSelectFilter label="Product Group" options={options.productGroup} values={filters.productGroup} onChange={(values) => onChange("productGroup", values)} />
    </FilterBar>
  );
}

function BarChart({ data, limit, onViewAll }: { data: { label: string; value: number }[]; limit?: number; onViewAll?: () => void }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const visible = limit ? sorted.slice(0, limit) : sorted;
  const max = Math.max(...visible.map((item) => item.value), 1);
  return (
    <div className="space-y-4">
      {visible.length ? visible.map((item) => (
        <div key={item.label} className="grid grid-cols-[minmax(82px,118px)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <span className="min-w-0 truncate font-semibold text-[#4B5563]" title={item.label}>{item.label}</span>
          <div className="h-3 rounded-full bg-[#F3F4F6]">
            <div className="h-3 rounded-full bg-[#FF7A00]" style={{ width: `${Math.max((item.value / max) * 100, item.value ? 5 : 0)}%` }} />
          </div>
          <span className="min-w-10 text-right text-xs font-bold text-[#4B5563]">{formatCompact(item.value)}</span>
        </div>
      )) : <EmptyState />}
      {limit && sorted.length > limit && <button type="button" onClick={onViewAll} className="text-xs font-semibold text-[#E86F00] hover:underline">View All</button>}
    </div>
  );
}

function cleanTicks(maxValue: number) {
  const rawStep = Math.max(maxValue, 1) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  const step = nice * magnitude;
  return [0, step, step * 2, step * 3];
}

function SalesTrendChart({ sales, filters, plan }: { sales: SalesRow[]; filters: FilterState; plan: SalesData["plan"] }) {
  const availableYears = useMemo(() => [...new Set(sales.map((row) => row.year))].sort((a, b) => b - a), [sales]);
  const currentYear = selectedYears(filters)[0] ?? availableYears[0];
  const [metric, setMetric] = useState<TrendMetric>("unit");
  const [years, setYears] = useState<number[]>(() => [currentYear, ...availableYears.filter((year) => year < currentYear).slice(0, 1)].filter((year, index, list) => list.indexOf(year) === index));
  const [range, setRange] = useState<MonthRange>("full");
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(12);
  const [yearsOpen, setYearsOpen] = useState(false);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const rangeMonths = range === "full" ? MONTHS.map((_, index) => index + 1) : range === "custom" ? MONTHS.map((_, index) => index + 1).filter((month) => month >= Math.min(startMonth, endMonth) && month <= Math.max(startMonth, endMonth)) : { q1: [1, 2, 3], q2: [4, 5, 6], q3: [7, 8, 9], q4: [10, 11, 12] }[range];
  const scopedRows = sales.filter((row) => rowMatches(row, { ...filters, year: [], month: [] }));
  const visibleYears = years.filter((year) => availableYears.includes(year));
  const targetYear = visibleYears.includes(currentYear) ? currentYear : visibleYears[0];
  const targetAllowed = metric === "unit" && targetYear === plan.year && filters.branch.length === 0 && filters.salesperson.length === 0 && selectedProductGroups(filters).length === 0;
  const points: TrendPoint[] = rangeMonths.map((month) => ({ month, label: MONTHS[month - 1], values: Object.fromEntries(visibleYears.map((year) => { const monthRows = scopedRows.filter((row) => row.year === year && row.month === month); const measureRows = metric === "unit" ? filterByProductGroups(monthRows, PRODUCT_GROUPS.UNIT_PRODUCTS) : filterByProductGroups(monthRows, PRODUCT_GROUPS.VALUE_PRODUCTS); return [year, measureRows.length ? metric === "unit" ? measureRows.length : sum(measureRows, (row) => row.finalReceived) : null]; })), target: targetAllowed && (plan.units[month - 1] ?? 0) > 0 ? plan.units[month - 1] : null }));
  const maxValue = Math.max(...points.flatMap((point) => [...Object.values(point.values).map((value) => value ?? 0), point.target ?? 0]), 1);
  const ticks = cleanTicks(maxValue);
  const maxTick = ticks.at(-1) ?? 1;
  const width = 920; const height = 365; const padX = 74; const padY = 42;
  const xFor = (index: number) => padX + (index * (width - padX * 2)) / Math.max(points.length - 1, 1);
  const yFor = (value: number) => height - padY - (value / maxTick) * (height - padY * 2);
  const path = (values: (number | null)[]) => values.reduce((result, value, index) => { if (value === null) return result; const previous = values[index - 1]; if (previous === null || previous === undefined) return `${result} M ${xFor(index)} ${yFor(value)}`; const middle = (xFor(index - 1) + xFor(index)) / 2; return `${result} C ${middle} ${yFor(previous)}, ${middle} ${yFor(value)}, ${xFor(index)} ${yFor(value)}`; }, "");
  const styles = [{ color: "#F57C00", dash: undefined, label: "Current" }, { color: "#FBC02D", dash: undefined, label: "Previous" }, { color: "#FFD54F", dash: undefined, label: "Comparison" }];
  const valueLabel = metric === "unit" ? "Sales Unit" : "Sales Value";
  const formatMetric = (value: number | null) => value === null ? "No data" : metric === "unit" ? value.toLocaleString() : `${formatCompact(value)} MMK`;
  const hovered = hoveredMonth === null ? null : points[hoveredMonth];
  const baseYear = visibleYears[0]; const comparisonYear = visibleYears[1];

  return <div><div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"><div className="flex flex-wrap gap-4 text-xs font-semibold text-[#4B5563]">{visibleYears.map((year, index) => <span key={year} className="flex items-center gap-2"><i className="h-0 w-7 border-t-[3px]" style={{ borderColor: styles[index]?.color ?? "#9CA3AF", borderStyle: styles[index]?.dash ? "dashed" : "solid" }} />{year} Actual</span>)}{points.some((point) => point.target !== null) && <span className="flex items-center gap-2"><i className="h-0 w-7 border-t-[3px] border-dotted border-[#9CA3AF]" />{targetYear} Target</span>}</div><div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="sales-trend-metric">Metric</label><select id="sales-trend-metric" value={metric} onChange={(event) => setMetric(event.target.value as TrendMetric)} className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-semibold outline-none focus:border-[#FFB46E]"><option value="unit">Sales Unit</option><option value="value">Sales Value</option></select><div className="relative"><button type="button" onClick={() => setYearsOpen((open) => !open)} className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-semibold" aria-expanded={yearsOpen}>{visibleYears.length ? `${visibleYears.length} year${visibleYears.length === 1 ? "" : "s"}` : "Compare year"}</button>{yearsOpen && <Card className="absolute right-0 top-10 z-30 w-40 p-2 shadow-xl">{availableYears.map((year) => <label key={year} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-[#FFF7EF]"><input type="checkbox" checked={visibleYears.includes(year)} onChange={() => setYears((current) => current.includes(year) ? current.filter((item) => item !== year) : [...current, year].sort((a, b) => b - a))} className="accent-[#FF8615]" />{year}</label>)}</Card>}</div><label className="sr-only" htmlFor="sales-trend-range">Month range</label><select id="sales-trend-range" value={range} onChange={(event) => setRange(event.target.value as MonthRange)} className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-semibold outline-none focus:border-[#FFB46E]"><option value="full">Full Year</option><option value="q1">Q1 · Jan–Mar</option><option value="q2">Q2 · Apr–Jun</option><option value="q3">Q3 · Jul–Sep</option><option value="q4">Q4 · Oct–Dec</option><option value="custom">Custom Range</option></select>{range === "custom" && <><select value={startMonth} onChange={(event) => setStartMonth(Number(event.target.value))} aria-label="Start month" className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs">{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select><select value={endMonth} onChange={(event) => setEndMonth(Number(event.target.value))} aria-label="End month" className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs">{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></>}</div></div><div className="relative"><svg className="h-[400px] w-full sm:h-[440px]" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales comparison trend by year" onMouseLeave={() => setHoveredMonth(null)}><title>Sales comparison trend</title>{ticks.map((tick) => { const y = yFor(tick); return <g key={tick}><line x1={padX} x2={width - padX} y1={y} y2={y} stroke="#E5E7EB" /><text x={padX - 12} y={y + 4} textAnchor="end" fill="#4B5563" fontSize="12" fontWeight="600">{metric === "unit" ? tick.toLocaleString() : formatCompact(tick)}</text></g>; })}<text x={padX} y={18} fill="#4B5563" fontSize="12" fontWeight="700">{metric === "unit" ? "Unit" : "MMK"}</text>{visibleYears.map((year, index) => <g key={year}><path d={path(points.map((point) => point.values[year]))} fill="none" stroke={styles[index]?.color ?? "#9CA3AF"} strokeWidth={index === 0 ? 4 : 3} strokeDasharray={styles[index]?.dash} strokeLinecap="round" strokeLinejoin="round" />{points.map((point, pointIndex) => point.values[year] === null ? null : <circle key={`${year}-${point.month}`} cx={xFor(pointIndex)} cy={yFor(point.values[year] ?? 0)} r={hoveredMonth === pointIndex ? 5.5 : 3.5} fill="white" stroke={styles[index]?.color ?? "#9CA3AF"} strokeWidth={2.5} onMouseEnter={() => setHoveredMonth(pointIndex)} />)}</g>)}{points.some((point) => point.target !== null) && <path d={path(points.map((point) => point.target))} fill="none" stroke="#9CA3AF" strokeWidth={2.25} strokeDasharray="2 7" strokeLinecap="round" />}{points.map((point, index) => <text key={point.month} x={xFor(index)} y={height - 10} textAnchor="middle" fill="#4B5563" fontSize="12" fontWeight="600">{point.label}</text>)}</svg>{hovered && <div className="pointer-events-none absolute top-2 z-10 min-w-52 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#4B5563] shadow-[0_10px_28px_rgba(31,41,55,0.10)]" style={{ left: `${Math.min(Math.max((xFor(hoveredMonth ?? 0) / width) * 100, 8), 72)}%` }}><p className="font-bold text-[#1F2937]">{hovered.label}</p>{visibleYears.map((year) => <p key={year} className="mt-1">{year} {valueLabel}: <strong>{formatMetric(hovered.values[year])}</strong></p>)}{hovered.target !== null && <><p>{targetYear} Target: <strong>{formatMetric(hovered.target)}</strong></p><p>Variance: <strong>{formatMetric((hovered.values[targetYear] ?? 0) - hovered.target)}</strong></p></>}{baseYear && comparisonYear && hovered.values[baseYear] !== null && hovered.values[comparisonYear] !== null && hovered.values[comparisonYear] !== 0 && <p>vs {comparisonYear}: <strong>{percentChange(hovered.values[baseYear] ?? 0, hovered.values[comparisonYear] ?? 0)?.toFixed(1)}%</strong></p>}</div>}</div></div>;
}

function ExecutiveSalesTrend({ sales, filters, plan }: { sales: SalesRow[]; filters: FilterState; plan: SalesData["plan"] }) {
  const [metric, setMetric] = useState<TrendMetric>("unit");
  const availableYears = useMemo(() => [...new Set(sales.map((row) => row.year))].sort((a, b) => b - a), [sales]);
  const scopedRows = sales.filter((row) => rowMatches(row, { ...filters, year: [], month: [] }));
  const targetAllowed = metric === "unit" && availableYears[0] === plan.year && filters.branch.length === 0 && filters.salesperson.length === 0 && selectedProductGroups(filters).length === 0;
  const chartYears = [2026, 2025, 2024, 2023, 2022, ...availableYears].filter((year, index, values) => values.indexOf(year) === index);
  const series: StandardLineSeries[] = chartYears.map((year, index) => ({ id: String(year), year, label: String(year), kind: index === 0 ? "current" : index === 1 ? "previous" : "older", values: MONTHS.map((_, month) => { const rows = scopedRows.filter((row) => row.year === year && row.month === month + 1); const measure = metric === "unit" ? filterByProductGroups(rows, PRODUCT_GROUPS.UNIT_PRODUCTS) : filterByProductGroups(rows, PRODUCT_GROUPS.VALUE_PRODUCTS); return measure.length ? metric === "unit" ? measure.length : sum(measure, (row) => row.finalReceived) : null; }) }));
  if (targetAllowed) series.push({ id: "target", year: plan.year, label: "Target", kind: "target", values: plan.units.map((value) => value || null) });
  return <PremiumTrendChart title="Sales Trend" subtitle="Compare sales performance by year, period and metric." labels={MONTHS} unit={metric === "unit" ? "Unit" : "MMK"} formatValue={metric === "unit" ? (value) => value.toLocaleString() : formatCompact} metricOptions={[{ id: "unit", label: "Sales Unit" }, { id: "value", label: "Sales Value" }]} defaultMetric="unit" onMetricChange={(value) => setMetric(value as TrendMetric)} defaultSeriesIds={["2026", "2025"]} series={series} />;
}

function TargetProgressCard({ target, actual }: { target: number | null; actual: number }) {
  const achievement = target && target > 0 ? (actual / target) * 100 : null;
  const remaining = target && target > 0 ? Math.max(target - actual, 0) : null;
  const progress = achievement === null ? 0 : Math.min(achievement, 100);

  return (
    <Card className="flex h-full min-h-[420px] flex-col justify-between rounded-2xl border-[#E8EAED] bg-white p-5 shadow-[0_8px_24px_rgba(31,41,55,0.035)] sm:p-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-semibold leading-tight tracking-[-0.015em] text-[#1F2937]">Target Progress</h2>
            <p className="mt-1 text-sm text-[#6B7280]">Monthly sales unit plan</p>
          </div>
          <span className="rounded-full border border-[#E5E7EB] px-3 py-1 text-xs font-semibold text-[#6B7280]">Sales Unit</span>
        </div>
        <div className="mt-9 space-y-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">Target</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#1F2937]">{target === null ? "N/A" : formatCompact(target)} <span className="text-sm font-semibold tracking-normal text-[#6B7280]">Unit</span></p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">Actual</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#1F2937]">{formatCompact(actual)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">Remaining</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#1F2937]">{remaining === null ? "N/A" : formatCompact(remaining)}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#4B5563]">Achievement</span>
          <span className={cn("text-base font-bold", achievement === null ? "text-[#6B7280]" : achievement >= 100 ? "text-[#16A34A]" : "text-[#DC2626]")}>{achievement === null ? "N/A" : `${achievement.toFixed(1)}%`}</span>
        </div>
        <div className="h-3 rounded-full bg-[#F3F4F6]">
          <div className="h-3 rounded-full bg-[#FF7A00]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </Card>
  );
}

function SalesPageTable({ rows, onExport }: { rows: SalesRow[]; onExport: () => void }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"date" | "branch" | "salesperson" | "model" | "value" | "gp">("date");
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const searched = rows.filter((row) => `${row.date} ${row.branch} ${row.salesperson} ${row.productType} ${row.model}`.toLowerCase().includes(query.toLowerCase()));
  const sorted = [...searched].sort((a, b) => {
    const left = sortKey === "value" ? a.finalReceived : sortKey === "gp" ? a.gp1 : sortKey === "model" ? a.model : a[sortKey];
    const right = sortKey === "value" ? b.finalReceived : sortKey === "gp" ? b.gp1 : sortKey === "model" ? b.model : b[sortKey];
    const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
    return ascending ? result : -result;
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);
  function changeSort(key: typeof sortKey) { setPage(1); if (sortKey === key) setAscending((value) => !value); else { setSortKey(key); setAscending(false); } }
  const header = (label: string, key: typeof sortKey) => <button type="button" onClick={() => changeSort(key)} className="whitespace-nowrap font-semibold hover:text-[#E86F00]">{label}{sortKey === key ? ascending ? " ↑" : " ↓" : ""}</button>;

  return (
    <TableCard title="Sales Transaction Table" search={<div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search transactions" className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] pl-9 pr-3 text-sm outline-none focus:border-[#FFB46E] focus:bg-white" /></div>} exportAction={<ExportButton onClick={onExport} />} pagination={<div className="flex items-center justify-between text-xs font-semibold text-[#6B7280]"><span>{sorted.length} transactions</span><div className="flex items-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-[#E5E7EB] p-1.5 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={15} /></button><span>{page} / {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-[#E5E7EB] p-1.5 disabled:opacity-40" aria-label="Next page"><ChevronRight size={15} /></button></div></div>} empty={!rows.length}>
      <div className="overflow-x-auto rounded-xl border border-[#EEF0F3]">
        <table className="min-w-[1150px] w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#FAFBFC] text-[#6B7280]"><tr><th className="px-3 py-3">{header("Date", "date")}</th><th className="px-3 py-3">Invoice</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">{header("Branch", "branch")}</th><th className="px-3 py-3">{header("Salesperson", "salesperson")}</th><th className="px-3 py-3">Product Group</th><th className="px-3 py-3">{header("Model", "model")}</th><th className="px-3 py-3">Quantity</th><th className="px-3 py-3">{header("Sales Value", "value")}</th><th className="px-3 py-3">{header("Gross Profit", "gp")}</th><th className="px-3 py-3">Status</th></tr></thead>
          <tbody className="divide-y divide-[#F1F2F4] text-[#4B5563]">{pageRows.map((row) => <tr key={`${row.date}-${row.branch}-${row.salesperson}-${row.model}-${row.finalReceived}`} className="hover:bg-[#FFFaf5]"><td className="whitespace-nowrap px-3 py-3">{row.date}</td><td className="px-3 py-3 text-[#9CA3AF]">N/A</td><td className="px-3 py-3 text-[#9CA3AF]">N/A</td><td className="px-3 py-3">{row.branch}</td><td className="px-3 py-3">{row.salesperson || "N/A"}</td><td className="px-3 py-3"><ProductBadge label={productCategory(row) === "Other" ? "OT" : productCategory(row)} /></td><td className="px-3 py-3">{row.model || "N/A"}</td><td className="px-3 py-3 text-[#9CA3AF]">N/A</td><td className="px-3 py-3 font-semibold text-[#1F2937]">{formatMoney(row.finalReceived)}</td><td className="px-3 py-3 font-semibold text-[#1F2937]">{formatMoney(row.gp1)}</td><td className="px-3 py-3 text-[#9CA3AF]">N/A</td></tr>)}</tbody>
        </table>
      </div>
    </TableCard>
  );
}

function exportRows(rows: SalesRow[]) {
  const csvRows = [["Date", "Invoice", "Customer", "Branch", "Salesperson", "Product Group", "Model", "Quantity", "Sales Value", "Gross Profit", "Status"], ...rows.map((row) => [row.date, "N/A", "N/A", row.branch, row.salesperson || "N/A", productCategory(row), row.model || "N/A", "N/A", String(row.finalReceived), String(row.gp1), "N/A"])];
  const csv = csvRows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "kmm-sales-transactions.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function filterOptions(rows: SalesRow[], filters: FilterState): FilterState {
  const availableRows = rows.filter((row) => rowMatches(row, { ...filters, salesperson: [] }));
  return {
    year: Array.from(new Set(rows.map((row) => String(row.year)))).sort((a, b) => Number(b) - Number(a)),
    month: MONTHS,
    branch: Array.from(new Set(rows.map((row) => row.branch))).filter(Boolean).sort(),
    salesperson: Array.from(new Set(availableRows.map((row) => row.salesperson))).filter(Boolean).sort(),
    productGroup: PRODUCT_FILTER_OPTIONS,
  };
}

export function SalesPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllModels, setShowAllModels] = useState(false);
  const [showAllPeople, setShowAllPeople] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load dashboard-data.json (${response.status})`);
      setData(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load sales data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load dashboard-data.json (${response.status})`);
        return response.json() as Promise<SalesData>;
      })
      .then((loadedData) => {
        if (!ignore) setData(loadedData);
      })
      .catch((loadError: unknown) => {
        if (!ignore) setError(loadError instanceof Error ? loadError.message : "Unable to load sales data");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const options = data ? filterOptions(data.sales, filters) : { year: ["2026"], month: MONTHS, branch: [], salesperson: [], productGroup: PRODUCT_FILTER_OPTIONS };
  const rows = useMemo(() => data?.sales.filter((row) => rowMatches(row, filters)) ?? [], [data, filters]);
  const unitRows = useMemo(() => filterByProductGroups(rows, PRODUCT_GROUPS.UNIT_PRODUCTS), [rows]);
  const valueRows = useMemo(() => filterByProductGroups(rows, PRODUCT_GROUPS.VALUE_PRODUCTS), [rows]);
  const previousRows = useMemo(() => data?.sales.filter((row) => rowMatches(row, previousYearFilters(filters))) ?? [], [data, filters]);
  const previousUnitRows = filterByProductGroups(previousRows, PRODUCT_GROUPS.UNIT_PRODUCTS);
  const previousValueRows = filterByProductGroups(previousRows, PRODUCT_GROUPS.VALUE_PRODUCTS);
  const salesValue = sum(valueRows, (row) => row.finalReceived);
  const grossProfit = sum(valueRows, (row) => row.gp1);
  const salesTarget = data ? targetValue(data, filters) : null;
  const achievement = salesTarget && salesTarget > 0 ? (unitRows.length / salesTarget) * 100 : null;
  const asp = unitRows.length ? salesValue / unitRows.length : null;
  const selectedMonthNumbers = selectedMonths(filters);
  const comparisonLabel = selectedYears(filters).length === 1 && selectedMonthNumbers.length === 1 ? `vs ${MONTHS[selectedMonthNumbers[0] - 1]} ${selectedYears(filters)[0] - 1}` : "vs same period last year";
  const byBranch = Array.from(new Set(unitRows.map((row) => row.branch))).map((label) => ({ label, value: unitRows.filter((row) => row.branch === label).length })).sort((a, b) => b.value - a.value);
  const byProduct = PRODUCT_GROUPS.UNIT_PRODUCTS.map((label) => ({ label, value: unitRows.filter((row) => productCategory(row) === label).length })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const modelGroups = Array.from(new Set(unitRows.map((row) => row.model || "N/A"))).map((label) => ({ label, value: unitRows.filter((row) => (row.model || "N/A") === label).length })).sort((a, b) => b.value - a.value);
  const peopleGroups = Array.from(new Set(unitRows.map((row) => row.salesperson || "N/A"))).map((label) => ({ label, value: unitRows.filter((row) => (row.salesperson || "N/A") === label).length })).sort((a, b) => b.value - a.value);

  function updateFilter(key: FilterKey, values: string[]) {
    setFilters((current) => ({ ...current, [key]: values, ...(key === "branch" ? { salesperson: [] } : {}) }));
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1F2937]">
      <AppSidebar collapsed={collapsed} mobileOpen={mobileOpen} onCollapsedChange={setCollapsed} onMobileOpenChange={setMobileOpen} />
      <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]")}>
        <header className="sticky top-0 z-30 flex h-[82px] items-center gap-3 border-b border-[#E5E7EB] bg-white/95 px-4 backdrop-blur-md sm:px-6 xl:px-8"><button className="rounded-xl border border-[#E5E7EB] p-2.5 text-[#55565A] hover:bg-[#F8FAFC] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="hidden max-w-md flex-1 md:block"><p className="text-lg font-bold tracking-[-0.02em] text-[#1F2937]">Sales Performance</p><p className="text-xs text-[#9CA3AF]">KMM Sales Intelligence</p></div><div className="ml-auto flex items-center gap-2 sm:gap-3"><HeaderPresentationTrigger /><div className="relative"><button className="relative grid size-10 place-items-center rounded-xl border border-[#E5E7EB] text-[#55565A] transition hover:border-[#D1D5DB] hover:bg-[#F8FAFC]" onClick={() => setNotificationsOpen((value) => !value)} aria-label="Open notifications" aria-expanded={notificationsOpen}><Bell size={18} /><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#EF4444]" /></button>{notificationsOpen && <Card className="absolute right-0 top-12 z-50 w-[310px] p-2 shadow-xl"><p className="px-3 py-2 text-sm font-semibold">Sales data is source-backed</p><p className="px-3 pb-2 text-xs text-[#6B7280]">Loaded from the current dashboard data extract.</p></Card>}</div><button className="flex items-center gap-2 rounded-xl p-1.5 pr-2 transition hover:bg-[#F8FAFC]" aria-label="Open profile menu"><span className="grid size-9 place-items-center rounded-xl bg-[#55565A] text-xs font-bold text-white">KM</span><span className="hidden text-left xl:block"><span className="block text-xs font-semibold">KMM Admin</span><span className="block text-[10px] text-[#9CA3AF]">Executive view</span></span><ChevronDown className="hidden text-[#9CA3AF] xl:block" size={15} /></button></div></header>
        <main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6 2xl:p-6">
          <div className="space-y-6">
            <section className="space-y-5">
              
              <SalesFilters filters={filters} options={options} onChange={updateFilter} onRefresh={loadData} onReset={() => setFilters(defaultFilters)} onExport={() => exportRows(rows)} />
            </section>
            {loading && <Card className="grid min-h-[320px] place-items-center p-8"><div className="w-full max-w-xl space-y-4"><LoadingSkeleton variant="chart" /><p className="text-center text-sm font-semibold text-[#6B7280]">Loading real sales data...</p></div></Card>}
            {error && !loading && <Card className="grid min-h-[320px] place-items-center p-8"><ErrorState message={error} onRetry={loadData} /></Card>}
            {data && !loading && !error && (
              <>
                <section aria-label="Sales KPIs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-3 2xl:gap-4">
                  <KpiCard title="Sales Unit" value={unitRows.length} unit="Unit" comparison={KpiComparison({ value: percentChange(unitRows.length, previousUnitRows.length), label: comparisonLabel })} />
                  <KpiCard title="Sales Value" value={formatCompact(salesValue)} unit="MMK" comparison={KpiComparison({ value: percentChange(salesValue, sum(previousValueRows, (row) => row.finalReceived)), label: comparisonLabel })} />
                  <KpiCard title="Gross Profit" value={formatCompact(grossProfit)} unit="MMK" comparison={KpiComparison({ value: percentChange(grossProfit, sum(previousValueRows, (row) => row.gp1)), label: comparisonLabel })} />
                  <KpiCard title="Achievement" value={achievement === null ? "N/A" : `${achievement.toFixed(1)}%`} unit="" supportingText={achievement === null ? "Target unavailable" : achievement >= 100 ? <span className="font-semibold text-[#16A34A]">Target met</span> : <span className="font-semibold text-[#DC2626]">Below target</span>} />
                  <KpiCard title="Average Selling Price (ASP)" value={asp === null ? "N/A" : formatCompact(asp)} unit="MMK" />
                </section>
                <section aria-label="Sales trend and target" className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
                  <ExecutiveSalesTrend sales={data.sales} filters={filters} plan={data.plan} />
                  <TargetProgressCard target={salesTarget} actual={unitRows.length} />
                </section>
                <section aria-label="Sales analysis" className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
                  <ChartCard title="Sales by Branch"><BarChart data={byBranch} /></ChartCard>
                  <ChartCard title="Salesperson Ranking"><BarChart data={peopleGroups} limit={showAllPeople ? undefined : 10} onViewAll={() => setShowAllPeople(true)} /></ChartCard>
                  <ChartCard title="Sales by Product Group"><BarChart data={byProduct} /></ChartCard>
                  <ChartCard title="Top Model"><BarChart data={modelGroups} limit={showAllModels ? undefined : 10} onViewAll={() => setShowAllModels(true)} /></ChartCard>
                </section>
                <SalesPageTable rows={rows} onExport={() => exportRows(rows)} />
                <p className="text-xs text-[#9CA3AF]">Source: {data.meta.sources.join(" · ")}</p>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
