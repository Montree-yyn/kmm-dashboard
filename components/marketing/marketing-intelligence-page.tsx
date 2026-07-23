"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, ChevronDown, Maximize2, Menu, RefreshCw, RotateCcw, Search } from "lucide-react";
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
import { PROJECT_TIMEZONE, defaultExecutiveGisFilters, formatPeriodLabel, resolveComparison, resolvePeriod, rowInDateRange, type ComparisonMode, type ExecutiveGisFilters, type PeriodMode } from "../../lib/marketing/time-filters";
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
type GeographyLevel = "state" | "township" | "showroom";
function DecisionToolbar({ filters, onFiltersChange, product, onProductChange, activeMetric, onMetricChange, geography, onGeographyChange }: { filters: ExecutiveGisFilters; onFiltersChange: (next: ExecutiveGisFilters) => void; product: Product; onProductChange: (product: Product) => void; activeMetric: ExecutiveGisFilters["activeMetric"]; onMetricChange: (metric: ExecutiveGisFilters["activeMetric"], mode: Mode) => void; geography: GeographyLevel; onGeographyChange: (level: GeographyLevel) => void }) {
    const { t } = useLocale();
    const applyPeriod = (periodMode: PeriodMode) => { const current = resolvePeriod(periodMode, filters.dateTo, filters); const comparison = resolveComparison(filters.comparisonMode, current, { dateFrom: filters.comparisonDateFrom, dateTo: filters.comparisonDateTo }); onFiltersChange({ ...filters, periodMode, dateFrom: current.dateFrom, dateTo: current.dateTo, comparisonDateFrom: comparison.dateFrom, comparisonDateTo: comparison.dateTo }); };
    const applyComparison = (comparisonMode: ComparisonMode) => { const comparison = resolveComparison(comparisonMode, filters, { dateFrom: filters.comparisonDateFrom, dateTo: filters.comparisonDateTo }); onFiltersChange({ ...filters, comparisonMode, comparisonDateFrom: comparison.dateFrom, comparisonDateTo: comparison.dateTo }); };
    const metricOptions: { label: string; value: ExecutiveGisFilters["activeMetric"]; mode: Mode }[] = [
        { label: t("metric.salesUnit"), value: "salesUnit", mode: "sales" },
        { label: t("metric.salesValue"), value: "salesValue", mode: "sales" },
        { label: t("metric.gp"), value: "gpValue", mode: "sales" },
        { label: t("metric.booking"), value: "bookingUnit", mode: "sales" },
        { label: t("metric.installedBase"), value: "installedBase", mode: "population" },
        { label: t("metric.marketingActivity"), value: "activities", mode: "activity" },
    ];
    const selectedMetric = metricOptions.find((option) => option.value === activeMetric) ?? metricOptions[0];
    return <section aria-label="Decision Toolbar" className="flex min-h-[52px] shrink-0 flex-wrap items-center gap-2 border-b border-[#E5E7EB] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(31,41,55,0.04)] xl:flex-nowrap xl:px-4"><label className="text-[11px] font-bold text-[#6B7280]">เวลา <select value={filters.periodMode} onChange={(event) => applyPeriod(event.target.value as PeriodMode)} className="ml-1.5 h-8 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-bold text-[#1F2937]"><option value="this-month">{t("period.thisMonth")}</option><option value="this-quarter">{t("period.thisQuarter")}</option><option value="ytd">{t("period.ytd")}</option><option value="rolling-12-months">{t("period.rolling12Months")}</option><option value="custom">{t("period.customDateRange")}</option></select></label><label className="text-[11px] font-bold text-[#6B7280]">สินค้า <select value={product} onChange={(event) => onProductChange(event.target.value as Product)} className="ml-1.5 h-8 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-bold text-[#1F2937]"><option value="All">ทั้งหมด</option><option value="TT">Tractor</option><option value="CH">Combine Harvester</option><option value="EX">Excavator</option><option value="TP">Rice Transplanter</option></select></label><label className="text-[11px] font-bold text-[#6B7280]">Metric <select value={selectedMetric.value} onChange={(event) => { const next = metricOptions.find((option) => option.value === event.target.value) ?? metricOptions[0]; onMetricChange(next.value, next.mode); }} className="ml-1.5 h-8 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-bold text-[#1F2937]">{metricOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="text-[11px] font-bold text-[#6B7280]">พื้นที่ <select value={geography} onChange={(event) => onGeographyChange(event.target.value as GeographyLevel)} className="ml-1.5 h-8 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-bold text-[#1F2937]"><option value="state">State / Region</option><option value="township">Township</option><option value="showroom">Showroom</option></select></label><label className="text-[11px] font-bold text-[#6B7280]">Compare <select value={filters.comparisonMode} onChange={(event) => applyComparison(event.target.value as ComparisonMode)} className="ml-1.5 h-8 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-bold text-[#1F2937]"><option value="none">{t("comparison.none")}</option><option value="previous-period">{t("comparison.previousPeriod")}</option><option value="same-period-last-year">{t("comparison.samePeriodLastYear")}</option><option value="custom">{t("comparison.custom")}</option></select></label><button type="button" className="h-8 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-bold text-[#6B7280]">Layer</button><span className="ml-auto hidden text-[11px] font-semibold text-[#9CA3AF] lg:block">{formatPeriodLabel(filters)}</span></section>;
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
    const [geography, setGeography] = useState<GeographyLevel>("township");
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
    return <div className="min-h-screen bg-[#F7F8FA] text-[#1F2937]"><AppSidebar collapsed={collapsed} mobileOpen={mobileOpen} onCollapsedChange={setCollapsed} onMobileOpenChange={setMobileOpen}/><div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]")}><header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[#E5E7EB] bg-white px-3 sm:px-4 xl:px-6"><button className="rounded-xl border border-[#E5E7EB] p-2 text-[#55565A] lg:hidden" onClick={() => setMobileOpen(true)} aria-label={t("common.openNavigation")}><Menu size={18}/></button><div className="min-w-0"><h1 className="truncate text-[17px] font-bold tracking-[-0.02em] text-[#1F2937]">วิเคราะห์การตลาด <span className="hidden text-[#6B7280] sm:inline">(Marketing Intelligence)</span></h1><p className="hidden truncate text-[11px] font-medium text-[#9CA3AF] sm:block">ข้อมูลเชิงพื้นที่เพื่อวางแผนการตลาดและการขาย</p></div><div className="ml-auto flex items-center gap-2"><span className="hidden text-[11px] font-semibold text-[#9CA3AF] xl:inline">Last update: {data?.meta.sourceUpdatedAt ?? "—"}</span><div className="inline-flex h-8 items-center rounded-lg border border-[#E5E7EB] bg-white p-0.5 text-xs font-bold"><button type="button" onClick={() => setLanguage("th")} className={cn("rounded-md px-2 py-1", language === "th" ? "bg-[#FFF1E5] text-[#E86F00]" : "text-[#6B7280]")}>{t("language.thai")}</button><span className="text-[#D1D5DB]">|</span><button type="button" onClick={() => setLanguage("en")} className={cn("rounded-md px-2 py-1", language === "en" ? "bg-[#FFF1E5] text-[#E86F00]" : "text-[#6B7280]")}>{t("language.english")}</button></div><HeaderPresentationTrigger /><button className="relative hidden size-9 place-items-center rounded-xl border border-[#E5E7EB] text-[#55565A] sm:grid" aria-label={t("common.openNotifications")}><Bell size={17}/><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#EF4444]"/></button></div></header><main className="flex h-[calc(100vh-56px)] min-h-[640px] flex-col"><DecisionToolbar filters={gisFilters} onFiltersChange={setGisFilters} product={product} onProductChange={setProduct} activeMetric={gisFilters.activeMetric} onMetricChange={(activeMetric, nextMode) => { setMode(nextMode); setGisFilters((current) => ({ ...current, activeMetric })); }} geography={geography} onGeographyChange={setGeography}/><div className="grid min-h-0 flex-1 gap-3 p-3 lg:p-4 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]"><section aria-label="Marketing territory map" className="min-h-0 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(31,41,55,0.04)]"><MyanmarMarketingMap visibleShowroomIds={visibleShowroomIds} townshipMetrics={mapped.metrics} productLabel={product} mode={mode} activeMetric={gisFilters.activeMetric} onActiveMetricChange={(activeMetric) => setGisFilters((current) => ({ ...current, activeMetric }))} resetSignal={mapResetSignal}/></section><aside aria-label="Right Intelligence Panel placeholder" className="hidden min-h-0 flex-col rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-4 text-sm text-[#6B7280] shadow-[0_1px_2px_rgba(31,41,55,0.04)] xl:flex"><div className="sticky top-0 bg-white pb-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">Area Intelligence</p><h2 className="mt-1 text-base font-bold text-[#1F2937]">เลือกพื้นที่บนแผนที่</h2></div><div className="mt-2 space-y-3"><p>Right Intelligence Panel area reserved for Sprint 2.</p><p className="rounded-xl bg-[#FAFBFC] p-3 text-xs leading-5">Context KPI, opportunity, risk, recommendation, and next action logic are intentionally not implemented in Sprint 1.</p></div></aside></div><section aria-label="Strategic Focus placeholder" className="mx-3 mb-3 flex min-h-12 shrink-0 items-center gap-3 overflow-x-auto rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-4 text-xs font-semibold text-[#6B7280] shadow-[0_-4px_16px_rgba(31,41,55,0.04)] lg:mx-4 lg:mb-4"><span className="font-bold text-[#1F2937]">Strategic Focus</span><span>🔥 High Opportunity</span><span>⚠ Need Attention</span><span>📈 High Growth</span><span>🎯 Recommended Campaign</span><span>📅 Next Action</span><span className="ml-auto hidden text-[#9CA3AF] md:inline">Placeholder only — no action logic in Sprint 1</span></section></main></div></div>;
}
