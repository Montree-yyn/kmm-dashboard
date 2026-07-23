"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, BarChart3, Bell, ChevronDown, CircleDollarSign, Maximize2, Menu, PackageCheck, RefreshCw, RotateCcw, Search, ShoppingCart } from "lucide-react";
import { AppSidebar } from "../navigation/app-sidebar";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ChartCard } from "../design-system/chart-card";
import { ErrorState } from "../design-system/error-state";
import { ExportButton } from "../design-system/export-button";
import { FilterBar } from "../design-system/filter-bar";
import { KpiCard } from "../design-system/kpi-card";
import { LoadingSkeleton } from "../design-system/loading-skeleton";
import { TableCard } from "../design-system/table-card";
import { PremiumTrendChart } from "../common/charts/PremiumTrendChart";
import { MapFullscreenDialog } from "../common/map/MapFullscreenDialog";
import { HeaderPresentationTrigger } from "../presentation/HeaderPresentationTrigger";
import { OPERATIONAL_SHOWROOMS, normalizeLocation, operationalShowroomForBranch, productGroup } from "../../lib/marketing/location-mapping";
import { PROJECT_TIMEZONE, changeSummary, defaultExecutiveGisFilters, formatPeriodLabel, resolveComparison, resolvePeriod, rowInDateRange, type ComparisonMode, type ExecutiveGisFilters, type PeriodMode } from "../../lib/marketing/time-filters";
import { canonicalBoundaryIds, resolveSalesGeography, type GeographyFailure } from "../../lib/marketing/township-geography";
import { cn } from "../../lib/utils";
import { useLocale } from "../../src/hooks/useLocale";
import { MyanmarMarketingMap } from "./myanmar-marketing-map";
import townshipMaster from "../../data/master-townships.json";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SHOWROOMS = [{ id: "KMM-MYAWADDY", name: "Myawaddy" }, { id: "KMM-HPAAN", name: "Hpa-an" }, { id: "KMM-MAWLAMYINE", name: "Mawlamyine (Moke Ta Ma)" }, { id: "KMM-THARYARWADDY", name: "Tharyarwaddy" }, { id: "KMM-NATTALIN", name: "Nattalin" }, { id: "KMM-NAWNGHKIO", name: "Naung Cho" }] as const;
const REGIONS = [{ label: "Kayin State", source: "Kayin" }, { label: "Mon State", source: "Mon" }, { label: "Bago West", source: "Bago (West)" }, { label: "Shan State", source: "Shan (North)" }];
const UNIT_PRODUCTS = ["TT", "CH", "EX", "TP", "MAX"];
const VALUE_PRODUCTS = [...UNIT_PRODUCTS, "IM", "IMO", "OT"];
const COLORS = ["#FFF7ED", "#FFEDD5", "#FDBA74", "#F97316", "#C2410C"];
const ZERO_SALES_COLOR = "#F3F4F6";
const NO_DATA_COLOR = "#F8FAFC";
type Product = "All" | "TT" | "CH" | "EX" | "TP";
type Mode = "sales" | "population" | "activity";
type Filters = {
    year: string[];
    month: string[];
    branch: string[];
    showroom: string[];
};
type SalesRow = {
    date: string;
    year: number | null;
    month: number | null;
    branch: string;
    salesperson: string;
    stateRegion: string;
    township: string;
    village: string;
    area: string;
    productType: string;
    model: string;
    finalReceived: number;
    gp1: number;
};
type MarketingRow = {
    date: string;
    year: number | null;
    month: number | null;
    branch: string;
    township: string;
    stateRegion: string;
    village: string;
    activity: string;
    participants: number;
    bookingCount: number;
    prospectCount: number;
    expense: number;
};
type BookingRow = {
    year: number | null;
    month: number | null;
    branch: string;
    productType: string;
    price?: number;
    status: string;
};
type Data = {
    meta: {
        sourceUpdatedAt: string;
        sources: string[];
    };
    sales: SalesRow[];
    marketing: MarketingRow[];
    booking: BookingRow[];
};
type GeoTownship = {
    properties: {
        TS: string;
        ST: string;
    };
};
type ResolvedTownship = {
    key: string | null;
    status: "direct" | "alias" | "missing" | "unmatched" | "ambiguous";
    raw: string;
    normalizedStateRegion: string;
    normalizedTownship: string;
    reason: GeographyFailure | null;
};
type TownshipMetric = {
    township: string;
    stateRegion: string;
    installedBase: number;
    population: number;
    installedBaseByProduct: {
        tractor: number;
        combineHarvester: number;
        excavator: number;
        transplanter: number;
        drone: number;
        other: number;
    };
    salesByProduct: {
        tractor: number;
        combineHarvester: number;
        excavator: number;
        transplanter: number;
        drone: number;
        other: number;
    };
    activities: number;
    salesUnit: number;
    salesValue: number;
    gpValue: number;
    gpPercent: number | null;
    bookingUnit: number | null;
    bookingValue: number | null;
    lastActivityDate: string | null;
    activityDensity: number | null;
    topActivityType: string | null;
    density: number | null;
    fill: string;
    periodLabel?: string;
    comparisonLabel?: string;
    comparison?: { salesUnit: number; salesValue: number; gpValue: number; gpPercent: number | null; activities: number };
    debugPeriod?: { resolvedPeriodMode: PeriodMode; resolvedDateFrom: string; resolvedDateTo: string; comparisonMode: ComparisonMode; comparisonDateFrom: string; comparisonDateTo: string; currentFilteredSalesRows: number; comparisonFilteredSalesRows: number; currentSalesUnit: number; comparisonSalesUnit: number; currentSalesValue: number; comparisonSalesValue: number; currentBookingUnit: number; comparisonBookingUnit: number; currentGPValue: number; comparisonGPValue: number; timezoneUsed: string };
};
const defaults: Filters = { year: ["2026"], month: MONTHS.slice(0, 6), branch: [], showroom: [] };
const sum = <T,>(rows: T[], getter: (row: T) => number) => rows.reduce((total, row) => total + getter(row), 0);
const count = (value: number) => Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
const compact = (value: number) => Math.abs(value) >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : count(value);
const isComplete = (row: MarketingRow) => Boolean(row.date && row.activity.trim());
const selectedMonths = (filters: Filters) => filters.month.map((month) => MONTHS.indexOf(month) + 1).filter((month) => month > 0);
function currentMatch(row: {
    year: number | null;
    month: number | null;
    branch: string;
}, filters: Filters) { const years = filters.year.map(Number).filter(Number.isFinite); const months = selectedMonths(filters); return (!years.length || (row.year !== null && years.includes(row.year))) && (!months.length || (row.month !== null && months.includes(row.month))) && (!filters.branch.length || filters.branch.includes(row.branch)); }
function cutoff(filters: Filters, data: Data) { const years = filters.year.map(Number).filter(Number.isFinite); const year = years.length ? Math.max(...years) : Math.max(...data.sales.map((row) => row.year ?? 0)); const months = selectedMonths(filters); return { year, month: months.length ? Math.max(...months) : 12 }; }
function quantile(sorted: number[], ratio: number) { return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))] ?? 0; }
function heatColor(value: number, values: number[], zeroColor = NO_DATA_COLOR) { if (!value)
    return zeroColor; const sorted = values.filter((item) => item > 0).sort((a, b) => a - b); if (!sorted.length)
    return zeroColor; const levels = [quantile(sorted, 0.2), quantile(sorted, 0.4), quantile(sorted, 0.6), quantile(sorted, 0.8)]; return COLORS[value <= levels[0] ? 0 : value <= levels[1] ? 1 : value <= levels[2] ? 2 : value <= levels[3] ? 3 : 4]; }
function MultiSelect({ label, options, values, onChange }: {
    label: string;
    options: string[];
    values: string[];
    onChange: (values: string[]) => void;
}) { const [open, setOpen] = useState(false); const [query, setQuery] = useState(""); const visible = options.filter((item) => item.toLowerCase().includes(query.toLowerCase())); const summary = values.length === 0 ? "All" : values.length === 1 ? values[0] : `${values.length} selected`; return <div className="relative min-w-0"><label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A8E96]">{label}</label><button type="button" className="flex h-11 w-full items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-3 text-left text-sm font-semibold text-[#1F2937]" onClick={() => setOpen(!open)}><span className="truncate">{summary}</span><ChevronDown size={16} className="text-[#9CA3AF]"/></button>{open && <Card className="absolute left-0 right-0 top-[72px] z-50 p-2 shadow-xl"><div className="relative mb-2"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"/><input className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] pl-9 pr-3 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}`}/></div><div className="max-h-52 space-y-1 overflow-y-auto">{visible.map((item) => <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#4B5563] hover:bg-[#FFF7EF]"><input type="checkbox" className="accent-[#FF7A00]" checked={values.includes(item)} onChange={() => onChange(values.includes(item) ? values.filter((value) => value !== item) : [...values, item])}/>{item}</label>)}</div></Card>}</div>; }
function MarketingFilters({ filters, options, onChange, onReset, onRefresh, onExport }: {
    filters: Filters;
    options: Filters;
    onChange: (key: keyof Filters, values: string[]) => void;
    onReset: () => void;
    onRefresh: () => void;
    onExport: () => void;
}) { return <FilterBar actions={<><Button variant="outline" className="h-11" onClick={onReset}><RotateCcw size={16}/>Reset</Button><Button variant="outline" className="h-11" onClick={onRefresh}><RefreshCw size={16}/>Refresh</Button><ExportButton onClick={onExport}/></>}><MultiSelect label="Year" options={options.year} values={filters.year} onChange={(value) => onChange("year", value)}/><MultiSelect label="Month" options={options.month} values={filters.month} onChange={(value) => onChange("month", value)}/><MultiSelect label="Region / Branch" options={options.branch} values={filters.branch} onChange={(value) => onChange("branch", value)}/><MultiSelect label="Showroom" options={options.showroom} values={filters.showroom} onChange={(value) => onChange("showroom", value)}/></FilterBar>; }
function ProductSelect({ product, onChange, className }: { product: Product; onChange: (product: Product) => void; className?: string }) {
    return <select value={product} onChange={(event) => onChange(event.target.value as Product)} className={cn("h-10 min-w-48 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#1F2937] outline-none focus:border-[#FFB46E]", className)} aria-label="Product type"><option value="All">All Products</option><option value="TT">TT Tractor</option><option value="CH">CH Combine Harvester</option><option value="EX">EX Excavator</option><option value="TP">TP Transplanter</option></select>;
}
function HeatmapModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
    return <div className="inline-flex h-9 shrink-0 rounded-lg border border-[#E5E7EB] bg-white p-0.5"><button type="button" onClick={() => onChange("sales")} className={cn("rounded-md px-2.5 text-[13px] font-semibold", mode === "sales" ? "bg-[#FFF1E5] text-[#E86F00]" : "text-[#6B7280]")}>Sales</button><button type="button" onClick={() => onChange("population")} className={cn("rounded-md px-2.5 text-[13px] font-semibold", mode === "population" ? "bg-[#FFF1E5] text-[#E86F00]" : "text-[#6B7280]")}>Population</button><button type="button" onClick={() => onChange("activity")} className={cn("rounded-md px-2.5 text-[13px] font-semibold", mode === "activity" ? "bg-[#FFF1E5] text-[#E86F00]" : "text-[#6B7280]")}>Activity</button></div>;
}
function HeatmapLegend({ mode }: { mode: Mode }) {
    const label = mode === "sales" ? "Sales Unit" : mode === "population" ? "Engine Population" : "Marketing Activities";
    return <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-[#E5E7EB] bg-white/95 px-3 py-2 text-xs text-[#4B5563] shadow-[0_8px_24px_rgba(31,41,55,0.08)]"><p className="font-semibold">{label}</p><div className="mt-2 flex h-2 w-32 overflow-hidden rounded-full">{COLORS.map((color) => <i key={color} className="flex-1" style={{ backgroundColor: color }}/>)}</div><div className="mt-1 flex justify-between text-[10px] text-[#9CA3AF]"><span>Very Low</span><span>Very High</span></div></div>;
}
function ExecutiveGisControls({ filters, onChange }: { filters: ExecutiveGisFilters; onChange: (next: ExecutiveGisFilters) => void }) {
    const { t } = useLocale();
    const applyPeriod = (periodMode: PeriodMode) => { const current = resolvePeriod(periodMode, filters.dateTo, filters); const comparison = resolveComparison(filters.comparisonMode, current, { dateFrom: filters.comparisonDateFrom, dateTo: filters.comparisonDateTo }); onChange({ ...filters, periodMode, dateFrom: current.dateFrom, dateTo: current.dateTo, comparisonDateFrom: comparison.dateFrom, comparisonDateTo: comparison.dateTo }); };
    const applyComparison = (comparisonMode: ComparisonMode) => { const comparison = resolveComparison(comparisonMode, filters, { dateFrom: filters.comparisonDateFrom, dateTo: filters.comparisonDateTo }); onChange({ ...filters, comparisonMode, comparisonDateFrom: comparison.dateFrom, comparisonDateTo: comparison.dateTo }); };
    return <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-xl border border-[#E8EAED] bg-white/95 px-2.5 py-1.5 shadow-[0_6px_18px_rgba(31,41,55,0.035)]"><label className="text-[11px] font-semibold text-[#6B7280]">{t("period.time")} <select value={filters.periodMode} onChange={(event) => applyPeriod(event.target.value as PeriodMode)} className="ml-1.5 h-7 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-bold text-[#1F2937]"><option value="this-month">{t("period.thisMonth")}</option><option value="previous-month">{t("period.previousMonth")}</option><option value="this-quarter">{t("period.thisQuarter")}</option><option value="previous-quarter">{t("period.previousQuarter")}</option><option value="this-year">{t("period.thisYear")}</option><option value="ytd">{t("period.ytd")}</option><option value="rolling-12-months">{t("period.rolling12Months")}</option><option value="custom">{t("period.customDateRange")}</option></select></label><label className="text-[11px] font-semibold text-[#6B7280]">{t("period.compare")} <select value={filters.comparisonMode} onChange={(event) => applyComparison(event.target.value as ComparisonMode)} className="ml-1.5 h-7 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-bold text-[#1F2937]"><option value="none">{t("comparison.none")}</option><option value="previous-period">{t("comparison.previousPeriod")}</option><option value="same-period-last-year">{t("comparison.samePeriodLastYear")}</option><option value="previous-year">{t("comparison.previousYear")}</option><option value="custom">{t("comparison.custom")}</option></select></label><label className="text-[11px] font-semibold text-[#6B7280]">{t("period.from")} <input type="date" value={filters.dateFrom} onChange={(event) => onChange({ ...filters, periodMode: "custom", dateFrom: event.target.value })} className="ml-1.5 h-7 rounded-lg border border-[#E5E7EB] px-2 text-xs"/></label><label className="text-[11px] font-semibold text-[#6B7280]">{t("period.to")} <input type="date" value={filters.dateTo} onChange={(event) => { const current = { dateFrom: filters.dateFrom, dateTo: event.target.value }; const comparison = resolveComparison(filters.comparisonMode, current, { dateFrom: filters.comparisonDateFrom, dateTo: filters.comparisonDateTo }); onChange({ ...filters, periodMode: "custom", dateTo: event.target.value, comparisonDateFrom: comparison.dateFrom, comparisonDateTo: comparison.dateTo }); }} className="ml-1.5 h-7 rounded-lg border border-[#E5E7EB] px-2 text-xs"/></label><p className="ml-auto text-[11px] font-semibold text-[#9CA3AF]">{formatPeriodLabel(filters)}{filters.comparisonMode !== "none" ? ` vs ${formatPeriodLabel({ dateFrom: filters.comparisonDateFrom, dateTo: filters.comparisonDateTo })}` : ""}</p></div>;
}
function ExecutiveKpiStrip({ items }: { items: { label: string; value: string; comparison?: string; delta?: string; percent?: string; direction?: "up" | "down" | "flat"; note?: string }[] }) {
    const { t } = useLocale();
    const visibleLabels = ["Sales Unit", "Sales Value", "GP Value", "Booking Unit", "Installed Base"];
    const iconMap = { "Sales Unit": BarChart3, "Sales Value": CircleDollarSign, "GP Value": Activity, "Booking Unit": ShoppingCart, "Installed Base": PackageCheck };
    const labelMap = { "Sales Unit": t("metric.salesUnit"), "Sales Value": t("metric.salesValue"), "GP Value": t("metric.gp"), "Booking Unit": t("metric.booking"), "Installed Base": t("metric.installedBase"), "Marketing Activities": t("metric.marketingActivity"), Showrooms: t("metric.showroom") };
    const displayLabel = (label: string) => labelMap[label as keyof typeof labelMap] ?? label;
    const visible = visibleLabels.map((label) => items.find((item) => item.label === label)).filter((item): item is NonNullable<typeof item> => Boolean(item));
    const hidden = items.filter((item) => !visibleLabels.includes(item.label));
    const compactComparison = (item: typeof visible[number]) => item.note ? item.note : item.comparison ? `${item.direction === "up" ? "▲" : item.direction === "down" ? "▼" : "■"} ${item.percent}` : "";
    const fullComparison = (item: typeof visible[number]) => item.note ?? (item.comparison ? `${item.delta} · ${item.percent} vs ${item.comparison}` : "");
    return <section className="flex max-h-20 items-stretch gap-2 overflow-x-auto rounded-xl border border-[#E8EAED] bg-white/95 p-2 shadow-[0_6px_18px_rgba(31,41,55,0.04)]">{visible.map((item) => { const Icon = iconMap[item.label as keyof typeof iconMap]; return <div key={item.label} title={fullComparison(item)} className="flex min-w-[150px] flex-1 items-center gap-2 rounded-xl border border-[#EEF0F3] bg-white px-3 py-2 shadow-[0_4px_12px_rgba(31,41,55,0.025)]"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#FFF7ED] text-[#E86F00]"><Icon size={15}/></span><span className="min-w-0"><span className="block truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">{displayLabel(item.label)}</span><strong className="block truncate text-base leading-5 text-[#1F2937]">{item.value}</strong><small className="block truncate text-[11px] font-semibold text-[#6B7280]">{compactComparison(item)}</small></span></div>; })}<details className="relative min-w-[120px] rounded-xl border border-[#EEF0F3] bg-white px-3 py-2 text-xs text-[#4B5563]"><summary className="cursor-pointer font-bold text-[#6B7280]">{t("common.more")}</summary><div className="absolute right-0 top-10 z-20 w-64 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-xl">{hidden.map((item) => <p key={item.label} className="flex justify-between gap-3 py-1"><span>{displayLabel(item.label)}</span><strong>{item.value}</strong></p>)}{visible.filter((item) => item.comparison).map((item) => <p key={`${item.label}-detail`} className="border-t border-[#EEF0F3] py-1 text-[11px]"><strong>{displayLabel(item.label)}</strong>: {fullComparison(item)}</p>)}</div></details></section>;
}
function Metric({ label, value, accent = false }: {
    label: string;
    value: ReactNode;
    accent?: boolean;
}) { if (["Sales Value", "Gross Profit", "Branch Sales / Cost", "Top Salesperson"].includes(label))
    return null; if (label === "Top Product")
    return <div className="col-span-2 border-t border-[#EEF0F3] pt-3"><p className="text-[11px] font-medium text-[#9CA3AF]">Marketing Cost vs Sales Unit</p>{value}</div>; return <div><p className="text-[11px] font-medium text-[#9CA3AF]">{label}</p><p className={cn("mt-1 text-sm font-semibold", accent ? "text-[#E86F00]" : "text-[#1F2937]")}>{value}</p></div>; }
function Bars({ rows, unit = "" }: {
    rows: {
        label: string;
        value: number;
    }[];
    unit?: string;
}) { if (unit === " Unit")
    return <TopTownshipTable rows={rows}/>; const ranked = [...rows].sort((a, b) => b.value - a.value).slice(0, 10); const maxValue = Math.max(...ranked.map((row) => Number(row.value) || 0), 0); const totalValue = ranked.reduce((total, row) => total + (Number(row.value) || 0), 0); return ranked.length ? <div className="space-y-3">{ranked.map((row) => { const value = Number(row.value) || 0; const width = maxValue > 0 ? (value / maxValue) * 100 : 0; const percentage = totalValue > 0 ? (value / totalValue) * 100 : 0; return <div key={row.label} className="grid grid-cols-[minmax(72px,1fr)_minmax(0,2fr)_auto] items-center gap-3"><span className="truncate text-xs font-semibold text-[#4B5563]">{row.label}</span><div className="h-2 rounded-full bg-[#F3F4F6]"><div className="h-full rounded-full bg-[#FF7A00]" style={{ width: `${width}%` }}/></div><span className="text-xs font-bold text-[#4B5563]">{count(value)}{unit}{unit ? "" : ` (${percentage.toFixed(0)}%)`}</span></div>; })}</div> : <p className="py-10 text-center text-sm text-[#9CA3AF]">No mapped township data</p>; }
function Trend({ rows }: { rows: MarketingRow[] }) {
  const [metric, setMetric] = useState<"unit" | "value">("unit");
  const series = [2026, 2025, 2024, 2023, 2022].map((year, index) => ({ id: String(year), year, label: String(year), kind: index === 0 ? "current" as const : index === 1 ? "previous" as const : "older" as const, values: MONTHS.map((_, month) => {
    const monthRows = rows.filter((row) => row.year === year && row.month === month + 1);
    if (!monthRows.length) return null;
    return metric === "unit" ? monthRows.length : monthRows.reduce((total, row) => total + row.expense, 0);
  }) }));
  return <PremiumTrendChart title="Marketing Trend" subtitle="Compare marketing performance by year, period and metric." labels={MONTHS} unit={metric === "unit" ? "Activities" : "MMK"} formatValue={metric === "unit" ? count : compact} defaultSeriesIds={["2026", "2025"]} onMetricChange={(value) => setMetric(value as "unit" | "value")} series={series} />;
}
function ShowroomChart({ months }: {
    months: {
        label: string;
        cost: number;
        unit: number;
    }[];
}) { const maxCost = Math.max(...months.map((month) => month.cost), 1); const maxUnit = Math.max(...months.map((month) => month.unit), 1); const points = months.map((month, index) => `${28 + index * 46},${84 - (month.unit / maxUnit) * 60}`).join(" "); return <svg className="mt-2 h-24 w-full" viewBox="0 0 300 108" preserveAspectRatio="none" role="img"><title>Monthly marketing cost and sales unit comparison</title>{months.map((month, index) => <g key={month.label}><title>{`${month.label}: Marketing Cost ${count(month.cost)} MMK, Sales Unit ${count(month.unit)}`}</title><rect x={18 + index * 46} y={84 - (month.cost / maxCost) * 60} width="20" height={(month.cost / maxCost) * 60} rx="3" fill="#FF7A00" opacity="0.9"/><text x={28 + index * 46} y="102" textAnchor="middle" fontSize="9" fill="#9CA3AF">{month.label}</text></g>)}<polyline points={points} fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/>{months.map((month, index) => <circle key={month.label} cx={28 + index * 46} cy={84 - (month.unit / maxUnit) * 60} r="2.5" fill="white" stroke="#6B7280" strokeWidth="1.5"/>)}</svg>; }
function TopTownshipTable({ rows }: {
    rows: {
        label: string;
        value: number;
    }[];
}) { const ranked = [...rows].filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 10); const max = Math.max(...ranked.map((row) => row.value), 1); return ranked.length ? <div className="space-y-3">{ranked.map((row, index) => <div key={row.label} className="grid grid-cols-[18px_minmax(110px,1.6fr)_minmax(0,1fr)_auto] items-center gap-2 text-xs"><span className="font-semibold text-[#9CA3AF]">{index + 1}</span><span className="min-w-0 whitespace-normal break-words font-semibold leading-4 text-[#4B5563]">{row.label}</span><div className="h-2 rounded-full bg-[#F3F4F6]"><div className="h-full rounded-full bg-[#FF7A00]" style={{ width: `${(row.value / max) * 100}%` }}/></div><span className="font-bold text-[#1F2937]">{count(row.value)}</span></div>)}</div> : <p className="py-10 text-center text-sm text-[#9CA3AF]">No mapped township data</p>; }
export function MarketingIntelligencePage() {
    const { language, setLanguage, t } = useLocale();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [filters, setFilters] = useState<Filters>(defaults);
    const [product, setProduct] = useState<Product>("All");
    const [mode, setMode] = useState<Mode>("sales");
    const [gisFilters, setGisFilters] = useState<ExecutiveGisFilters>(() => defaultExecutiveGisFilters());
    const [mapFocused, setMapFocused] = useState(false);
    const [mapResetSignal, setMapResetSignal] = useState(0);
    const [data, setData] = useState<Data | null>(null);
    const [geoTownships, setGeoTownships] = useState<GeoTownship[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const load = async () => { setLoading(true); setError(""); try {
        const response = await fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" });
        if (!response.ok)
            throw new Error(`Unable to load dashboard-data.json (${response.status})`);
        setData(await response.json() as Data);
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load marketing data");
    }
    finally {
        setLoading(false);
    } };
    useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
    useEffect(() => { let active = true; fetch("/maps/myanmar-townships.geojson").then((response) => response.json()).then((geo: {
        features: GeoTownship[];
    }) => { if (active)
        setGeoTownships(geo.features); }).catch(() => { if (active)
        setGeoTownships([]); }); return () => { active = false; }; }, []);
    const options = useMemo<Filters>(() => ({ year: data ? Array.from(new Set(data.marketing.map((row) => String(row.year ?? "")))).filter(Boolean).sort().reverse() : ["2026"], month: MONTHS, branch: data ? Array.from(new Set(data.marketing.map((row) => row.branch))).filter(Boolean).sort() : [], showroom: SHOWROOMS.map((showroom) => showroom.name) }), [data]);
    const boundary = useMemo(() => canonicalBoundaryIds(geoTownships.map((feature) => ({ stateRegion: feature.properties.ST, township: feature.properties.TS }))), [geoTownships]);
    const geoIndex = useMemo(() => new Map(geoTownships.map((feature) => {
        const resolved = resolveSalesGeography(feature.properties.ST, feature.properties.TS, boundary.ids);
        return resolved.canonicalLocationId ? [resolved.canonicalLocationId, feature] : null;
    }).filter((entry): entry is [string, GeoTownship] => Boolean(entry))), [geoTownships, boundary]);
    const resolveTownship = useCallback((rawTownship: string, rawStateRegion: string): ResolvedTownship => {
        const resolved = resolveSalesGeography(rawStateRegion, rawTownship, boundary.ids);
        return { raw: rawTownship, key: resolved.canonicalLocationId, status: resolved.reason === "MISSING_STATE" || resolved.reason === "MISSING_TOWNSHIP" ? "missing" : resolved.reason === "AMBIGUOUS_TOWNSHIP" ? "ambiguous" : resolved.canonicalLocationId ? resolved.aliasStatus === "APPROVED_ALIAS" ? "alias" : "direct" : "unmatched", normalizedStateRegion: resolved.normalizedStateRegion, normalizedTownship: resolved.normalizedTownship, reason: resolved.reason };
    }, [boundary]);
    const matchesSelectedShowroom = useCallback((branch: string) => !filters.showroom.length || filters.showroom.includes(operationalShowroomForBranch(branch)?.name ?? ""), [filters.showroom]);
    const comparisonRange = useMemo(() => ({ dateFrom: gisFilters.comparisonDateFrom, dateTo: gisFilters.comparisonDateTo }), [gisFilters.comparisonDateFrom, gisFilters.comparisonDateTo]);
    const marketing = useMemo(() => (data?.marketing ?? []).filter((row) => rowInDateRange(row, gisFilters) && matchesSelectedShowroom(row.branch) && isComplete(row)), [data, gisFilters, matchesSelectedShowroom]);
    const comparisonMarketing = useMemo(() => gisFilters.comparisonMode === "none" ? [] : (data?.marketing ?? []).filter((row) => rowInDateRange(row, comparisonRange) && matchesSelectedShowroom(row.branch) && isComplete(row)), [data, gisFilters.comparisonMode, comparisonRange, matchesSelectedShowroom]);
    const periodSales = useMemo(() => (data?.sales ?? []).filter((row) => rowInDateRange(row, gisFilters) && matchesSelectedShowroom(row.branch)), [data, gisFilters, matchesSelectedShowroom]);
    const comparisonSales = useMemo(() => gisFilters.comparisonMode === "none" ? [] : (data?.sales ?? []).filter((row) => rowInDateRange(row, comparisonRange) && matchesSelectedShowroom(row.branch)), [data, gisFilters.comparisonMode, comparisonRange, matchesSelectedShowroom]);
    const populationSales = useMemo(() => { if (!data)
        return []; return data.sales.filter((row) => { const category = productGroup(row.productType); const inProduct = product === "All" ? UNIT_PRODUCTS.includes(category) : category === product; const dateKey = row.date ? rowInDateRange(row, { dateFrom: "1900-01-01", dateTo: gisFilters.dateTo }) : (row.year ?? 0) < Number(gisFilters.dateTo.slice(0, 4)) || ((row.year ?? 0) === Number(gisFilters.dateTo.slice(0, 4)) && (row.month ?? 0) <= Number(gisFilters.dateTo.slice(5, 7))); return inProduct && dateKey && (!filters.branch.length || filters.branch.includes(row.branch)); }); }, [data, filters.branch, gisFilters.dateTo, product]);
    const mapped = useMemo(() => { const population = new Map<string, number>(); const activities = new Map<string, number>(); const salesUnits = new Map<string, number>(); const salesValues = new Map<string, number>(); const gpValues = new Map<string, number>(); const installedBaseByProduct = new Map<string, TownshipMetric["installedBaseByProduct"]>(); const salesByProduct = new Map<string, TownshipMetric["salesByProduct"]>(); const lastActivityDates = new Map<string, string>(); const activityTypes = new Map<string, Map<string, number>>(); const source = new Map<string, GeoTownship>(); const productKey = (category: string): keyof TownshipMetric["salesByProduct"] => category === "TT" ? "tractor" : category === "CH" ? "combineHarvester" : category === "EX" ? "excavator" : category === "TP" ? "transplanter" : category === "MAX" ? "drone" : "other"; const blankProducts = (): TownshipMetric["salesByProduct"] => ({ tractor: 0, combineHarvester: 0, excavator: 0, transplanter: 0, drone: 0, other: 0 }); populationSales.forEach((row) => { const resolved = resolveTownship(row.township, row.stateRegion); if (resolved.key) {
        population.set(resolved.key, (population.get(resolved.key) ?? 0) + 1);
        const category = productGroup(row.productType);
        const detail = installedBaseByProduct.get(resolved.key) ?? blankProducts();
        detail[productKey(category)] += 1;
        installedBaseByProduct.set(resolved.key, detail);
        const feature = geoIndex.get(resolved.key);
        if (feature)
            source.set(resolved.key, feature);
    } }); periodSales.filter((row) => product === "All" || productGroup(row.productType) === product).forEach((row) => { const resolved = resolveTownship(row.township, row.stateRegion); if (!resolved.key)
        return; const category = productGroup(row.productType); {
        salesUnits.set(resolved.key, (salesUnits.get(resolved.key) ?? 0) + 1);
        const detail = salesByProduct.get(resolved.key) ?? blankProducts();
        detail[productKey(category)] += 1;
        salesByProduct.set(resolved.key, detail);
    } {
        salesValues.set(resolved.key, (salesValues.get(resolved.key) ?? 0) + row.finalReceived);
        gpValues.set(resolved.key, (gpValues.get(resolved.key) ?? 0) + row.gp1);
    } }); marketing.forEach((row) => { const resolved = resolveTownship(row.township, row.stateRegion); if (!resolved.key)
        return; activities.set(resolved.key, (activities.get(resolved.key) ?? 0) + 1); if (row.date && (!lastActivityDates.get(resolved.key) || row.date > (lastActivityDates.get(resolved.key) ?? "")))
        lastActivityDates.set(resolved.key, row.date); if (row.activity.trim()) {
        const counts = activityTypes.get(resolved.key) ?? new Map<string, number>();
        counts.set(row.activity, (counts.get(row.activity) ?? 0) + 1);
        activityTypes.set(resolved.key, counts);
    } }); const keys = new Set([...population.keys(), ...activities.keys(), ...salesUnits.keys(), ...salesValues.keys()]); const raw = [...keys].map((key) => ({ key, feature: source.get(key) ?? geoIndex.get(key), population: population.get(key) ?? 0, activities: activities.get(key) ?? 0, salesUnit: salesUnits.get(key) ?? 0 })).filter((item): item is typeof item & {
        feature: GeoTownship;
    } => Boolean(item.feature)); const metricValue = (item: { population: number; activities: number; salesUnit: number }) => mode === "sales" ? item.salesUnit : mode === "population" ? item.population : item.activities; const visible = raw.map(metricValue); const metrics: Record<string, TownshipMetric> = {}; raw.forEach((item) => { const density = item.population ? item.activities / item.population : null; const value = salesValues.get(item.key) ?? 0; const gp = gpValues.get(item.key) ?? 0; const topType = Array.from(activityTypes.get(item.key)?.entries() ?? []).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; metrics[item.key] = { township: item.feature.properties.TS, stateRegion: item.feature.properties.ST, installedBase: item.population, population: item.population, installedBaseByProduct: installedBaseByProduct.get(item.key) ?? blankProducts(), salesByProduct: salesByProduct.get(item.key) ?? blankProducts(), activities: item.activities, salesUnit: item.salesUnit, salesValue: value, gpValue: gp, gpPercent: value ? (gp / value) * 100 : null, bookingUnit: null, bookingValue: null, lastActivityDate: lastActivityDates.get(item.key) ?? null, activityDensity: density, topActivityType: topType, density, fill: heatColor(metricValue(item), visible, mode === "sales" ? ZERO_SALES_COLOR : NO_DATA_COLOR) }; }); return { metrics, rows: raw, population, activities, salesUnits }; }, [populationSales, periodSales, marketing, mode, product, geoIndex, resolveTownship]);
    const quality = useMemo(() => { const summarize = (rows: Array<{ township: string; stateRegion: string }>) => { const results = rows.map((row) => resolveTownship(row.township, row.stateRegion)); const names = (status: ResolvedTownship["status"]) => Array.from(new Set(results.filter((result) => result.status === status).map((result) => result.raw))).filter(Boolean).sort(); return { total: rows.length, mapped: results.filter((result) => result.key).length, normalized: results.filter((result) => result.status === "alias").length, missing: results.filter((result) => result.status === "missing").length, unmatched: names("unmatched"), ambiguous: names("ambiguous") }; }; return { cpi: summarize(data?.sales ?? []), marketing: summarize(data?.marketing ?? []) }; }, [data, resolveTownship]);
    void quality;
  const showroomMetrics = useMemo(() => OPERATIONAL_SHOWROOMS.map((showroom) => { const sales = periodSales.filter((row) => operationalShowroomForBranch(row.branch)?.code === showroom.code); const activity = marketing.filter((row) => operationalShowroomForBranch(row.branch)?.code === showroom.code); const bookings = (data?.booking ?? []).filter((row) => currentMatch(row, filters) && operationalShowroomForBranch(row.branch)?.code === showroom.code && row.status !== "Cancelled"); const unit = sales.filter((row) => UNIT_PRODUCTS.includes(productGroup(row.productType)) && (product === "All" || productGroup(row.productType) === product)); const value = sales.filter((row) => VALUE_PRODUCTS.includes(productGroup(row.productType)) && (product === "All" || productGroup(row.productType) === product)); const cost = sum(activity, (row) => row.expense); const revenue = sum(value, (row) => row.finalReceived); const months = MONTHS.map((label, index) => ({ label, cost: sum(activity.filter((row) => row.month === index + 1), (row) => row.expense), unit: unit.filter((row) => row.month === index + 1).length })); return { showroom, activities: activity.length, unit: unit.length, value: revenue, gp: sum(value, (row) => row.gp1), cost, booking: bookings.length, roi: cost ? revenue / cost : null, topProduct: <ShowroomChart months={months}/>, topSalesperson: "", months }; }), [periodSales, marketing, data, filters, product]);
    const regional = useMemo(() => REGIONS.map((region) => { const rows = mapped.rows.filter((item) => item.feature.properties.ST === region.source); const population = sum(rows, (item) => item.population); const activities = sum(rows, (item) => item.activities); const salesUnit = sum(rows, (item) => item.salesUnit); const density = population ? activities / population : null; const densities = mapped.rows.map((item) => item.population ? item.activities / item.population : null).filter((value): value is number => value !== null).sort((a, b) => a - b); const populationThreshold = quantile(mapped.rows.map((item) => item.population).filter(Boolean).sort((a, b) => a - b), 0.6); const lower = quantile(densities, 0.25); const upper = quantile(densities, 0.75); const status = !population ? "No data" : activities === 0 || (density !== null && density < lower && population >= populationThreshold) ? "Under-covered" : density !== null && density > upper && population < populationThreshold ? "Over-covered" : "Balanced"; return { ...region, population, activities, salesUnit, density, status }; }), [mapped]);
    const visibleShowroomIds = filters.showroom.length ? SHOWROOMS.filter((showroom) => filters.showroom.includes(showroom.name)).map((showroom) => showroom.id) : undefined;
    const currentBooking = useMemo(() => (data?.booking ?? []).filter((row) => rowInDateRange(row, gisFilters) && row.status !== "Cancelled"), [data, gisFilters]);
    const comparisonBooking = useMemo(() => gisFilters.comparisonMode === "none" ? [] : (data?.booking ?? []).filter((row) => rowInDateRange(row, comparisonRange) && row.status !== "Cancelled"), [data, gisFilters.comparisonMode, comparisonRange]);
    const kpiItems = useMemo(() => {
        const item = (label: string, current: number, comparison: number, formatter = count) => { const change = changeSummary(current, comparison); return { label, value: formatter(current), comparison: formatter(comparison), delta: formatter(change.delta), percent: change.percent === null ? "N/A" : `${change.percent.toFixed(1)}%`, direction: change.direction }; };
        const salesValue = sum(periodSales, (row) => row.finalReceived); const comparisonSalesValue = sum(comparisonSales, (row) => row.finalReceived);
        const gpValue = sum(periodSales, (row) => row.gp1); const comparisonGPValue = sum(comparisonSales, (row) => row.gp1);
        const gpPercent = salesValue ? (gpValue / salesValue) * 100 : 0; const comparisonGpPercent = comparisonSalesValue ? (comparisonGPValue / comparisonSalesValue) * 100 : 0;
        return [item("Sales Unit", periodSales.length, comparisonSales.length), item("Sales Value", salesValue, comparisonSalesValue, compact), item("GP Value", gpValue, comparisonGPValue, compact), item("GP %", gpPercent, comparisonGpPercent, (value) => `${value.toFixed(1)}%`), item("Booking Unit", currentBooking.length, comparisonBooking.length), { label: "Installed Base", value: count(populationSales.length), note: t("common.cumulative") }, { label: "Marketing Activity", value: count(marketing.length), comparison: count(comparisonMarketing.length), delta: count(marketing.length - comparisonMarketing.length), percent: comparisonMarketing.length === 0 ? t("common.notAvailable") : `${(((marketing.length - comparisonMarketing.length) / comparisonMarketing.length) * 100).toFixed(1)}%`, direction: marketing.length > comparisonMarketing.length ? "up" as const : marketing.length < comparisonMarketing.length ? "down" as const : "flat" as const }, { label: "Showrooms", value: count(OPERATIONAL_SHOWROOMS.length), note: t("common.currentSnapshot") }];
    }, [periodSales, comparisonSales, currentBooking, comparisonBooking, populationSales.length, marketing.length, comparisonMarketing.length, t]);
    const activityBreakdown = useMemo(() => Array.from(new Set(marketing.map((row) => row.activity))).map((label) => ({ label, value: marketing.filter((row) => row.activity === label).length })), [marketing]);
    const ranking = Object.values(mapped.metrics).map((metric) => ({ label: metric.township, value: metric.population }));
    const change = (key: keyof Filters, value: string[]) => setFilters((current) => ({ ...current, [key]: value }));
    const exportRows = () => { const csv = [["Date", "Activity", "Branch", "Township", "Participants", "Leads", "Booking", "Cost"], ...marketing.map((row) => [row.date, row.activity, row.branch, row.township, String(row.participants), String(row.prospectCount), String(row.bookingCount), String(row.expense)])].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const link = document.createElement("a"); link.href = url; link.download = "kmm-marketing-activities.csv"; link.click(); URL.revokeObjectURL(url); };
    const townshipIntelligenceMetrics = useMemo(() => {
        const productKey = (value: string): keyof TownshipMetric["salesByProduct"] => value === "TT" ? "tractor" : value === "CH" ? "combineHarvester" : value === "EX" ? "excavator" : value === "TP" ? "transplanter" : value === "MAX" ? "drone" : "other";
        const emptyProducts = () => ({ tractor: 0, combineHarvester: 0, excavator: 0, transplanter: 0, drone: 0, other: 0 });
        const countBy = (rows: { model?: string; salesperson?: string; branch?: string; area?: string }[], field: "model" | "salesperson" | "branch" | "area") => Array.from(rows.reduce((counts, row) => { const value = row[field]?.trim(); if (value) counts.set(value, (counts.get(value) ?? 0) + 1); return counts; }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        const records = townshipMaster as { township_id: string; township: string; state_region: string }[];
        const result: Record<string, TownshipMetric> = {};
        const companySales = { unit: periodSales.length, value: sum(periodSales, (row) => row.finalReceived) };
        const companyInstalledBase = populationSales.length;
        const resolutionRows = periodSales.map((row) => ({ row, resolution: resolveTownship(row.township, row.stateRegion) }));
        const unresolvedGroups = new Map<string, { rawStateRegion: string; rawTownship: string; normalizedStateRegion: string; normalizedTownship: string; aliasStatus: string; reason: string; rowCount: number; salesUnit: number; salesValue: number }>();
        resolutionRows.filter(({ resolution }) => !resolution.key).forEach(({ row, resolution }) => {
            const key = [row.stateRegion, row.township, resolution.reason].join("|");
            const group = unresolvedGroups.get(key) ?? { rawStateRegion: row.stateRegion, rawTownship: row.township, normalizedStateRegion: resolution.normalizedStateRegion, normalizedTownship: resolution.normalizedTownship, aliasStatus: "NONE", reason: resolution.reason ?? "OTHER", rowCount: 0, salesUnit: 0, salesValue: 0 };
            group.rowCount += 1; group.salesUnit += 1; group.salesValue += row.finalReceived; unresolvedGroups.set(key, group);
        });
        const resolvedRows = resolutionRows.filter(({ resolution }) => Boolean(resolution.key));
        const mappedRows = resolvedRows.filter(({ resolution }) => resolution.key && geoIndex.has(resolution.key));
        const reconciliation = {
            sourceSalesRows: periodSales.length,
            resolvedSalesRows: resolvedRows.length,
            unresolvedSalesRows: periodSales.length - resolvedRows.length,
            mappedSalesRows: mappedRows.length,
            unmappedCanonicalRows: resolvedRows.length - mappedRows.length,
            sourceSalesUnit: periodSales.length,
            mappedTownshipSalesUnit: mappedRows.length,
            unresolvedSalesUnit: periodSales.length - resolvedRows.length,
            salesUnitDifference: periodSales.length - mappedRows.length - (periodSales.length - resolvedRows.length),
            sourceSalesValue: companySales.value,
            mappedTownshipSalesValue: sum(mappedRows, ({ row }) => row.finalReceived),
            unresolvedSalesValue: sum(resolutionRows.filter(({ resolution }) => !resolution.key), ({ row }) => row.finalReceived),
            salesValueDifference: companySales.value - sum(mappedRows, ({ row }) => row.finalReceived) - sum(resolutionRows.filter(({ resolution }) => !resolution.key), ({ row }) => row.finalReceived),
            unmatchedRecords: Array.from(unresolvedGroups.values()).sort((a, b) => b.rowCount - a.rowCount || a.rawStateRegion.localeCompare(b.rawStateRegion) || a.rawTownship.localeCompare(b.rawTownship)),
        };
        records.forEach((record) => {
            const matches = <T extends { township: string; stateRegion: string }>(row: T) => resolveTownship(row.township, row.stateRegion).key === record.township_id;
            const installedRows = populationSales.filter(matches);
            const salesRows = periodSales.filter(matches);
            const comparisonSalesRows = comparisonSales.filter(matches);
            const activityRows = marketing.filter(matches);
            if (!installedRows.length && !salesRows.length && !activityRows.length) return;
            const installed = emptyProducts(); installedRows.forEach((row) => { installed[productKey(productGroup(row.productType))] += 1; });
            const sales = emptyProducts(); salesRows.forEach((row) => { sales[productKey(productGroup(row.productType))] += 1; });
            const salesValue = sum(salesRows, (row) => row.finalReceived); const gpValue = sum(salesRows, (row) => row.gp1); const comparisonSalesValue = sum(comparisonSalesRows, (row) => row.finalReceived); const comparisonGPValue = sum(comparisonSalesRows, (row) => row.gp1);
            const topSalesModels = countBy(salesRows, "model").slice(0, 3).map(([model, unit]) => ({ model, unit, metric: "Sales Unit" as const }));
            const topInstalledModels = countBy(installedRows, "model").slice(0, 3).map(([model, unit]) => ({ model, unit, metric: "Installed Base" as const }));
            const lastActivity = [...activityRows].sort((a, b) => b.date.localeCompare(a.date))[0];
            const activityTypes = countBy(activityRows.map((row) => ({ model: row.activity })), "model");
            const branch = countBy(salesRows, "branch")[0]?.[0];
            const showroom = branch ? operationalShowroomForBranch(branch)?.name ?? null : null;
            const territory = countBy(salesRows, "area")[0]?.[0] ?? null;
            const sameTownDifferentState = [...populationSales, ...periodSales, ...marketing].filter((row) => normalizeLocation(row.township) === normalizeLocation(record.township) && normalizeLocation(row.stateRegion) !== normalizeLocation(record.state_region)).length;
            result[record.township_id] = { township: record.township, stateRegion: record.state_region, canonicalLocationId: record.township_id, installedBase: installedRows.length, population: installedRows.length, installedBaseByProduct: installed, salesByProduct: sales, salesUnit: salesRows.length, salesValue, gpValue, gpPercent: salesValue ? (gpValue / salesValue) * 100 : null, bookingUnit: null, bookingValue: null, activities: activityRows.length, lastActivityDate: lastActivity?.date ?? null, lastActivityType: lastActivity?.activity ?? null, activityDensity: installedRows.length ? activityRows.length / installedRows.length : null, topActivityType: activityTypes[0]?.[0] ?? null, density: installedRows.length ? activityRows.length / installedRows.length : null, fill: mapped.metrics[record.township_id]?.fill ?? (mode === "sales" ? ZERO_SALES_COLOR : NO_DATA_COLOR), periodLabel: formatPeriodLabel(gisFilters), comparisonLabel: formatPeriodLabel({ dateFrom: gisFilters.comparisonDateFrom, dateTo: gisFilters.comparisonDateTo }), comparison: { salesUnit: comparisonSalesRows.length, salesValue: comparisonSalesValue, gpValue: comparisonGPValue, gpPercent: comparisonSalesValue ? (comparisonGPValue / comparisonSalesValue) * 100 : null, activities: comparisonMarketing.filter(matches).length }, responsibleShowroom: showroom, salesTerritory: territory, topModels: topSalesModels.length ? topSalesModels : topInstalledModels, topSalesperson: countBy(salesRows, "salesperson")[0]?.[0] ?? null, unresolvedGeographyCount: sameTownDifferentState || undefined, debugCompanySales: companySales, debugCompanyInstalledBase: companyInstalledBase, debugSalesReconciliation: reconciliation, debugPeriod: { resolvedPeriodMode: gisFilters.periodMode, resolvedDateFrom: gisFilters.dateFrom, resolvedDateTo: gisFilters.dateTo, comparisonMode: gisFilters.comparisonMode, comparisonDateFrom: gisFilters.comparisonDateFrom, comparisonDateTo: gisFilters.comparisonDateTo, currentFilteredSalesRows: periodSales.length, comparisonFilteredSalesRows: comparisonSales.length, currentSalesUnit: periodSales.length, comparisonSalesUnit: comparisonSales.length, currentSalesValue: companySales.value, comparisonSalesValue: sum(comparisonSales, (row) => row.finalReceived), currentBookingUnit: currentBooking.length, comparisonBookingUnit: comparisonBooking.length, currentGPValue: sum(periodSales, (row) => row.gp1), comparisonGPValue: sum(comparisonSales, (row) => row.gp1), timezoneUsed: PROJECT_TIMEZONE } };
        });
        return result;
    }, [populationSales, periodSales, comparisonSales, marketing, comparisonMarketing, mapped.metrics, mode, resolveTownship, gisFilters, currentBooking.length, comparisonBooking.length]);
    mapped.metrics = townshipIntelligenceMetrics;
    return <div className="min-h-screen bg-[#F8FAFC] text-[#1F2937]"><AppSidebar collapsed={collapsed} mobileOpen={mobileOpen} onCollapsedChange={setCollapsed} onMobileOpenChange={setMobileOpen}/><div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]")}><header className="sticky top-0 z-30 flex h-[82px] items-center gap-3 border-b border-[#E5E7EB] bg-white/95 px-4 backdrop-blur-md sm:px-6 xl:px-8"><button className="rounded-xl border border-[#E5E7EB] p-2.5 text-[#55565A] lg:hidden" onClick={() => setMobileOpen(true)} aria-label={t("common.openNavigation")}><Menu size={19}/></button><div><h1 className="text-lg font-bold text-[#1F2937]">{t("nav.marketing")}</h1><p className="text-xs text-[#9CA3AF]">{t("app.subtitle")}</p></div><div className="ml-auto flex items-center gap-2 sm:gap-3"><div className="inline-flex h-8 items-center rounded-lg border border-[#E5E7EB] bg-white p-0.5 text-xs font-bold"><button type="button" onClick={() => setLanguage("th")} className={cn("rounded-md px-2 py-1", language === "th" ? "bg-[#FFF1E5] text-[#E86F00]" : "text-[#6B7280]")}>{t("language.thai")}</button><span className="text-[#D1D5DB]">|</span><button type="button" onClick={() => setLanguage("en")} className={cn("rounded-md px-2 py-1", language === "en" ? "bg-[#FFF1E5] text-[#E86F00]" : "text-[#6B7280]")}>{t("language.english")}</button></div><HeaderPresentationTrigger /><button className="relative grid size-10 place-items-center rounded-xl border border-[#E5E7EB] text-[#55565A]" aria-label={t("common.openNotifications")}><Bell size={18}/><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#EF4444]" /></button><button className="flex items-center gap-2 rounded-xl p-1.5 pr-2" aria-label={t("common.openProfileMenu")}><span className="grid size-9 place-items-center rounded-xl bg-[#55565A] text-xs font-bold text-white">KM</span><span className="hidden text-left xl:block"><span className="block text-xs font-semibold">KMM Admin</span><span className="block text-[10px] text-[#9CA3AF]">Executive view</span></span><ChevronDown className="hidden text-[#9CA3AF] xl:block" size={15}/></button></div></header><main className="flex h-[calc(100vh-82px)] min-h-[560px] flex-col gap-2 p-3 sm:p-4 xl:p-4"><ExecutiveGisControls filters={gisFilters} onChange={setGisFilters}/><ExecutiveKpiStrip items={kpiItems}/><section aria-label="Marketing territory map" className="min-h-0 flex-1 w-full overflow-hidden rounded-2xl border border-[#E8EAED] bg-white shadow-[0_8px_24px_rgba(31,41,55,0.035)]"><MyanmarMarketingMap visibleShowroomIds={visibleShowroomIds} townshipMetrics={mapped.metrics} productLabel={product} mode={mode} activeMetric={gisFilters.activeMetric} onActiveMetricChange={(activeMetric) => setGisFilters((current) => ({ ...current, activeMetric }))} resetSignal={mapResetSignal}/></section></main></div></div>;
    return <div className="min-h-screen bg-[#F8FAFC] text-[#1F2937]"><AppSidebar collapsed={collapsed} mobileOpen={mobileOpen} onCollapsedChange={setCollapsed} onMobileOpenChange={setMobileOpen}/><div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]")}><header className="sticky top-0 z-30 flex h-[82px] items-center gap-3 border-b border-[#E5E7EB] bg-white/95 px-4 backdrop-blur-md sm:px-6 xl:px-8"><button className="rounded-xl border border-[#E5E7EB] p-2.5 text-[#55565A] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19}/></button><div><h1 className="text-lg font-bold text-[#1F2937]">Marketing</h1><p className="text-xs text-[#9CA3AF]">KMM Sales Intelligence</p></div><div className="ml-auto flex items-center gap-2 sm:gap-3"><HeaderPresentationTrigger /><button className="relative grid size-10 place-items-center rounded-xl border border-[#E5E7EB] text-[#55565A]" aria-label="Open notifications"><Bell size={18}/><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#EF4444]"/></button><button className="flex items-center gap-2 rounded-xl p-1.5 pr-2" aria-label="Open profile menu"><span className="grid size-9 place-items-center rounded-xl bg-[#55565A] text-xs font-bold text-white">KM</span><span className="hidden text-left xl:block"><span className="block text-xs font-semibold">KMM Admin</span><span className="block text-[10px] text-[#9CA3AF]">Executive view</span></span><ChevronDown className="hidden text-[#9CA3AF] xl:block" size={15}/></button></div></header><main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-5 xl:p-6"><section className="space-y-5"><MarketingFilters filters={filters} options={options} onChange={change} onRefresh={load} onReset={() => { setFilters(defaults); setProduct("All"); }} onExport={exportRows}/></section>{loading && <Card className="grid min-h-[320px] place-items-center p-8"><LoadingSkeleton variant="chart"/></Card>}{error && !loading && <Card className="grid min-h-[320px] place-items-center p-8"><ErrorState message={error} onRetry={load}/></Card>}{data && !loading && !error && <><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-3"><KpiCard title="Marketing Activities" value={count(marketing.length)} unit="Activities"/><KpiCard title="Marketing Cost" value={compact(sum(marketing, (row) => row.expense))} unit="MMK"/><KpiCard title="Participants / Customers" value={count(sum(marketing, (row) => row.participants))} unit="People"/><KpiCard title="Sales from Marketing" value="N/A" unit="" supportingText="Attribution unavailable"/><KpiCard title="Marketing ROI" value="N/A" unit="" supportingText="Attribution unavailable"/></section><section className="grid gap-4 lg:grid-cols-3">{showroomMetrics.map((item) => <Card key={item.showroom.code} className="rounded-2xl border-[#E8EAED] bg-white p-5 shadow-[0_8px_24px_rgba(31,41,55,0.035)]"><div className="flex items-baseline justify-between"><h2 className="text-[18px] font-semibold text-[#1F2937]">{item.showroom.name}</h2><span className="text-xs text-[#9CA3AF]">{item.showroom.code}</span></div><div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-5"><Metric label="Activities" value={count(item.activities)}/><Metric label="Sales Unit" value={count(item.unit)}/><Metric label="Sales Value" value={`${compact(item.value)} MMK`}/><Metric label="Gross Profit" value={`${compact(item.gp)} MMK`}/><Metric label="Marketing Cost" value={`${compact(item.cost)} MMK`}/><Metric label="Booking" value={count(item.booking)}/><Metric label="Branch Sales / Cost" value={item.roi === null ? "N/A" : `${item.roi.toFixed(1)}x`} accent/></div><div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#EEF0F3] pt-4"><Metric label="Top Product" value={item.topProduct}/><Metric label="Top Salesperson" value={item.topSalesperson}/></div></Card>)}</section><section className="space-y-4"><div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center"><div><h2 className="text-[21px] font-semibold text-[#1F2937]">Engine Population & Marketing Activity</h2><p className="mt-1 text-sm text-[#6B7280]">Engine Population is cumulative delivered TT, CH, EX and TP units through the selected period.</p></div><ProductSelect product={product} onChange={setProduct}/></div><Card className="flex h-auto flex-col overflow-hidden rounded-2xl border-[#E8EAED] bg-white p-0 shadow-[0_8px_24px_rgba(31,41,55,0.035)] md:h-[620px] xl:max-h-[680px]"><div className="flex shrink-0 flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-start sm:px-6"><div><h2 className="text-[19px] font-semibold text-[#1F2937]">Myanmar Engine Population Heatmap</h2><p className="mt-1 text-sm text-[#6B7280]">{product} · {count(populationSales.length)} cumulative delivered units</p></div><div className="flex shrink-0 flex-wrap items-center gap-2"><HeatmapModeToggle mode={mode} onChange={setMode}/><Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => setMapFocused(true)}><Maximize2 size={15}/>Expand Map</Button></div></div><div className="relative h-full w-full flex-1 overflow-hidden"><MyanmarMarketingMap visibleShowroomIds={visibleShowroomIds} townshipMetrics={mapped.metrics} productLabel={product} mode={mode} resetSignal={mapResetSignal}/><HeatmapLegend mode={mode}/></div></Card><MapFullscreenDialog open={mapFocused} title="Myanmar Engine Population Heatmap" subtitle={<span>{product} · {count(populationSales.length)} cumulative delivered units</span>} onClose={() => { setMapFocused(false); setMapResetSignal((value) => value + 1); }} onReset={() => setMapResetSignal((value) => value + 1)} controls={<><ProductSelect product={product} onChange={setProduct} className="h-9 rounded-lg"/><HeatmapModeToggle mode={mode} onChange={setMode}/></>}><MyanmarMarketingMap visibleShowroomIds={visibleShowroomIds} townshipMetrics={mapped.metrics} productLabel={product} mode={mode} resetSignal={mapResetSignal}/><HeatmapLegend mode={mode}/></MapFullscreenDialog></section><section className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2"><ChartCard title="Engine Population Summary" subtitle="Township-level aggregation" className="h-full" minHeight={420}><div className="overflow-hidden rounded-xl border border-[#EEF0F3]"><table className="w-full text-left text-xs"><thead className="bg-[#FAFBFC] text-[#6B7280]"><tr><th className="px-3 py-3">Region</th><th className="px-3 py-3 text-right">Population</th><th className="px-3 py-3 text-right">Activities</th><th className="px-3 py-3 text-right">Density</th><th className="px-3 py-3 text-right">Sales Unit</th><th className="px-3 py-3">Coverage</th></tr></thead><tbody className="divide-y divide-[#EEF0F3]">{regional.map((region) => <tr key={region.label}><td className="px-3 py-3 font-semibold text-[#4B5563]">{region.label}</td><td className="px-3 py-3 text-right">{count(region.population)}</td><td className="px-3 py-3 text-right">{count(region.activities)}</td><td className="px-3 py-3 text-right">{region.density === null ? "N/A" : region.density.toFixed(2)}</td><td className="px-3 py-3 text-right">{count(region.salesUnit)}</td><td className="px-3 py-3 text-[#6B7280]">{region.status}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs leading-5 text-[#9CA3AF]">Coverage: Under-covered = high population with low density; Over-covered = lower population with high density; otherwise Balanced.</p></ChartCard><ChartCard title="Marketing Trend" subtitle="Monthly completed activities" className="h-full" minHeight={420}><Trend rows={marketing}/></ChartCard></section><section className="grid gap-5 lg:grid-cols-2"><ChartCard title="Activity Type Breakdown" subtitle="Completed activity records" minHeight={300}><Bars rows={activityBreakdown}/></ChartCard><ChartCard title="Top 10 Township" subtitle="Cumulative engine population" minHeight={300}><Bars rows={ranking} unit=" Unit"/></ChartCard></section><TableCard title="Latest Marketing Activities" search={<div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"/><span className="block h-9 w-48 rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] pl-9 pr-3 pt-2 text-sm text-[#9CA3AF]">Filtered activity data</span></div>} exportAction={<ExportButton onClick={exportRows}/>} empty={!marketing.length}><div className="overflow-x-auto rounded-xl border border-[#EEF0F3]"><table className="min-w-[960px] w-full text-left text-xs"><thead className="sticky top-0 bg-[#FAFBFC] text-[#6B7280]"><tr>{["Date", "Activity", "Branch", "Township", "Participants", "Leads", "Booking", "Cost"].map((heading) => <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[#F1F2F4] text-[#4B5563]">{marketing.map((row, index) => <tr key={`${row.date}-${index}`}><td className="px-3 py-3">{row.date}</td><td className="px-3 py-3 font-semibold text-[#1F2937]">{row.activity}</td><td className="px-3 py-3">{row.branch}</td><td className="px-3 py-3">{row.township || "N/A"}</td><td className="px-3 py-3">{count(row.participants)}</td><td className="px-3 py-3">{count(row.prospectCount)}</td><td className="px-3 py-3">{count(row.bookingCount)}</td><td className="px-3 py-3">{count(row.expense)}</td></tr>)}</tbody></table></div></TableCard><p className="pb-2 text-xs text-[#9CA3AF]">Source: {data.meta.sources.join(" · ")}</p></>}</main></div></div>;
}
