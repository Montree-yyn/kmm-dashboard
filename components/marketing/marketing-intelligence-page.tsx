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
import { OPERATIONAL_SHOWROOMS, normalizeLocation, normalizeTownshipAlias, operationalShowroomForBranch, productGroup } from "../../lib/marketing/location-mapping";
import { cn } from "../../lib/utils";
import { MyanmarMarketingMap } from "./myanmar-marketing-map";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SHOWROOMS = [{ id: "KMM-MYAWADDY", name: "Myawaddy" }, { id: "KMM-HPAAN", name: "Hpa-an" }, { id: "KMM-MAWLAMYINE", name: "Mawlamyine (Moke Ta Ma)" }, { id: "KMM-THARYARWADDY", name: "Tharyarwaddy" }, { id: "KMM-NATTALIN", name: "Nattalin" }, { id: "KMM-NAWNGHKIO", name: "Naung Cho" }] as const;
const REGIONS = [{ label: "Kayin State", source: "Kayin" }, { label: "Mon State", source: "Mon" }, { label: "Bago West", source: "Bago (West)" }, { label: "Shan State", source: "Shan (North)" }];
const POPULATION_PRODUCTS = ["TT", "CH", "EX", "TP"];
const UNIT_PRODUCTS = ["TT", "CH", "EX", "TP", "MAX"];
const VALUE_PRODUCTS = [...UNIT_PRODUCTS, "IM", "IMO", "OT"];
const COLORS = ["#FFF7ED", "#FFEDD5", "#FDBA74", "#F97316", "#C2410C"];
type Product = "All" | "TT" | "CH" | "EX" | "TP";
type Mode = "population" | "activity";
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
};
type TownshipMetric = {
    township: string;
    stateRegion: string;
    population: number;
    activities: number;
    salesUnit: number;
    booking: number | null;
    density: number | null;
    fill: string;
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
function heatColor(value: number, values: number[]) { if (!value)
    return "#FFFFFF"; const sorted = values.filter((item) => item > 0).sort((a, b) => a - b); if (!sorted.length)
    return "#FFFFFF"; const levels = [quantile(sorted, 0.2), quantile(sorted, 0.4), quantile(sorted, 0.6), quantile(sorted, 0.8)]; return COLORS[value <= levels[0] ? 0 : value <= levels[1] ? 1 : value <= levels[2] ? 2 : value <= levels[3] ? 3 : 4]; }
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
    return <div className="inline-flex h-9 shrink-0 rounded-lg border border-[#E5E7EB] bg-white p-0.5"><button type="button" onClick={() => onChange("population")} className={cn("rounded-md px-2.5 text-[13px] font-semibold", mode === "population" ? "bg-[#FFF1E5] text-[#E86F00]" : "text-[#6B7280]")}>Population</button><button type="button" onClick={() => onChange("activity")} className={cn("rounded-md px-2.5 text-[13px] font-semibold", mode === "activity" ? "bg-[#FFF1E5] text-[#E86F00]" : "text-[#6B7280]")}>Activity</button></div>;
}
function HeatmapLegend({ mode }: { mode: Mode }) {
    return <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-[#E5E7EB] bg-white/95 px-3 py-2 text-xs text-[#4B5563] shadow-[0_8px_24px_rgba(31,41,55,0.08)]"><p className="font-semibold">{mode === "population" ? "Engine Population" : "Marketing Activities"}</p><div className="mt-2 flex h-2 w-32 overflow-hidden rounded-full">{COLORS.map((color) => <i key={color} className="flex-1" style={{ backgroundColor: color }}/>)}</div><div className="mt-1 flex justify-between text-[10px] text-[#9CA3AF]"><span>Very Low</span><span>Very High</span></div></div>;
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
function Trend({ rows }: { rows: MarketingRow[] }) { const latest = Math.max(...rows.map((row) => row.month ?? 0), 0); const values = MONTHS.map((_, index) => index + 1 > latest ? null : rows.filter((row) => row.month === index + 1).length); return <PremiumTrendChart title="Marketing Trend" subtitle="Monthly completed activities" labels={MONTHS} unit="Activities" series={[{ id: "activities", label: "Monthly Activities", values, kind: "current" }]} />; }
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
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [filters, setFilters] = useState<Filters>(defaults);
    const [product, setProduct] = useState<Product>("All");
    const [mode, setMode] = useState<Mode>("population");
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
    const geoIndex = useMemo(() => new Map(geoTownships.map((feature) => [normalizeLocation(feature.properties.TS), feature])), [geoTownships]);
    const resolveTownship = useCallback((raw: string): ResolvedTownship => { const trimmed = raw.trim(); if (!trimmed)
        return { raw, key: null, status: "missing" }; if (/[\\/;]/.test(trimmed))
        return { raw, key: null, status: "ambiguous" }; const direct = normalizeLocation(trimmed); if (geoIndex.has(direct))
        return { raw, key: direct, status: "direct" }; const alias = normalizeTownshipAlias(trimmed); const aliasKey = alias ? normalizeLocation(alias) : ""; return aliasKey && geoIndex.has(aliasKey) ? { raw, key: aliasKey, status: "alias" } : { raw, key: null, status: "unmatched" }; }, [geoIndex]);
    const marketing = useMemo(() => (data?.marketing ?? []).filter((row) => currentMatch(row, filters) && isComplete(row)), [data, filters]);
    const periodSales = useMemo(() => (data?.sales ?? []).filter((row) => currentMatch(row, filters)), [data, filters]);
    const populationSales = useMemo(() => { if (!data)
        return []; const end = cutoff(filters, data); return data.sales.filter((row) => { const category = productGroup(row.productType); const inProduct = product === "All" ? POPULATION_PRODUCTS.includes(category) : category === product; const beforeEnd = (row.year ?? 0) < end.year || ((row.year ?? 0) === end.year && (row.month ?? 0) <= end.month); return inProduct && beforeEnd && (!filters.branch.length || filters.branch.includes(row.branch)); }); }, [data, filters, product]);
    const mapped = useMemo(() => { const population = new Map<string, number>(); const activities = new Map<string, number>(); const salesUnits = new Map<string, number>(); const source = new Map<string, GeoTownship>(); populationSales.forEach((row) => { const resolved = resolveTownship(row.township); if (resolved.key) {
        population.set(resolved.key, (population.get(resolved.key) ?? 0) + 1);
        const feature = geoIndex.get(resolved.key);
        if (feature)
            source.set(resolved.key, feature);
    } }); periodSales.filter((row) => UNIT_PRODUCTS.includes(productGroup(row.productType)) && (product === "All" || productGroup(row.productType) === product)).forEach((row) => { const resolved = resolveTownship(row.township); if (resolved.key)
        salesUnits.set(resolved.key, (salesUnits.get(resolved.key) ?? 0) + 1); }); marketing.forEach((row) => { const resolved = resolveTownship(row.township); if (resolved.key)
        activities.set(resolved.key, (activities.get(resolved.key) ?? 0) + 1); }); const keys = new Set([...population.keys(), ...activities.keys(), ...salesUnits.keys()]); const raw = [...keys].map((key) => ({ key, feature: source.get(key) ?? geoIndex.get(key), population: population.get(key) ?? 0, activities: activities.get(key) ?? 0, salesUnit: salesUnits.get(key) ?? 0 })).filter((item): item is typeof item & {
        feature: GeoTownship;
    } => Boolean(item.feature)); const visible = raw.map((item) => mode === "population" ? item.population : item.activities); const metrics: Record<string, TownshipMetric> = {}; raw.forEach((item) => { const density = item.population ? item.activities / item.population : null; metrics[item.key] = { township: item.feature.properties.TS, stateRegion: item.feature.properties.ST, population: item.population, activities: item.activities, salesUnit: item.salesUnit, booking: null, density, fill: heatColor(mode === "population" ? item.population : item.activities, visible) }; }); return { metrics, rows: raw, population, activities, salesUnits }; }, [populationSales, periodSales, marketing, mode, product, geoIndex, resolveTownship]);
    const quality = useMemo(() => { const summarize = (rows: Array<{
        township: string;
    }>) => { const results = rows.map((row) => resolveTownship(row.township)); const names = (status: ResolvedTownship["status"]) => Array.from(new Set(results.filter((result) => result.status === status).map((result) => result.raw))).filter(Boolean).sort(); return { total: rows.length, mapped: results.filter((result) => result.key).length, normalized: results.filter((result) => result.status === "alias").length, missing: results.filter((result) => result.status === "missing").length, unmatched: names("unmatched"), ambiguous: names("ambiguous") }; }; return { cpi: summarize(data?.sales ?? []), marketing: summarize(data?.marketing ?? []) }; }, [data, resolveTownship]);
    void quality;
  const showroomMetrics = useMemo(() => OPERATIONAL_SHOWROOMS.map((showroom) => { const sales = periodSales.filter((row) => operationalShowroomForBranch(row.branch)?.code === showroom.code); const activity = marketing.filter((row) => operationalShowroomForBranch(row.branch)?.code === showroom.code); const bookings = (data?.booking ?? []).filter((row) => currentMatch(row, filters) && operationalShowroomForBranch(row.branch)?.code === showroom.code && row.status !== "Cancelled"); const unit = sales.filter((row) => UNIT_PRODUCTS.includes(productGroup(row.productType)) && (product === "All" || productGroup(row.productType) === product)); const value = sales.filter((row) => VALUE_PRODUCTS.includes(productGroup(row.productType)) && (product === "All" || productGroup(row.productType) === product)); const cost = sum(activity, (row) => row.expense); const revenue = sum(value, (row) => row.finalReceived); const months = MONTHS.map((label, index) => ({ label, cost: sum(activity.filter((row) => row.month === index + 1), (row) => row.expense), unit: unit.filter((row) => row.month === index + 1).length })); return { showroom, activities: activity.length, unit: unit.length, value: revenue, gp: sum(value, (row) => row.gp1), cost, booking: bookings.length, roi: cost ? revenue / cost : null, topProduct: <ShowroomChart months={months}/>, topSalesperson: "", months }; }), [periodSales, marketing, data, filters, product]);
    const regional = useMemo(() => REGIONS.map((region) => { const rows = mapped.rows.filter((item) => item.feature.properties.ST === region.source); const population = sum(rows, (item) => item.population); const activities = sum(rows, (item) => item.activities); const salesUnit = sum(rows, (item) => item.salesUnit); const density = population ? activities / population : null; const densities = mapped.rows.map((item) => item.population ? item.activities / item.population : null).filter((value): value is number => value !== null).sort((a, b) => a - b); const populationThreshold = quantile(mapped.rows.map((item) => item.population).filter(Boolean).sort((a, b) => a - b), 0.6); const lower = quantile(densities, 0.25); const upper = quantile(densities, 0.75); const status = !population ? "No data" : activities === 0 || (density !== null && density < lower && population >= populationThreshold) ? "Under-covered" : density !== null && density > upper && population < populationThreshold ? "Over-covered" : "Balanced"; return { ...region, population, activities, salesUnit, density, status }; }), [mapped]);
    const visibleShowroomIds = filters.showroom.length ? SHOWROOMS.filter((showroom) => filters.showroom.includes(showroom.name)).map((showroom) => showroom.id) : undefined;
    const activityBreakdown = useMemo(() => Array.from(new Set(marketing.map((row) => row.activity))).map((label) => ({ label, value: marketing.filter((row) => row.activity === label).length })), [marketing]);
    const ranking = Object.values(mapped.metrics).map((metric) => ({ label: metric.township, value: metric.population }));
    const change = (key: keyof Filters, value: string[]) => setFilters((current) => ({ ...current, [key]: value }));
    const exportRows = () => { const csv = [["Date", "Activity", "Branch", "Township", "Participants", "Leads", "Booking", "Cost"], ...marketing.map((row) => [row.date, row.activity, row.branch, row.township, String(row.participants), String(row.prospectCount), String(row.bookingCount), String(row.expense)])].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const link = document.createElement("a"); link.href = url; link.download = "kmm-marketing-activities.csv"; link.click(); URL.revokeObjectURL(url); };
    return <div className="min-h-screen bg-[#F8FAFC] text-[#1F2937]"><AppSidebar collapsed={collapsed} mobileOpen={mobileOpen} onCollapsedChange={setCollapsed} onMobileOpenChange={setMobileOpen}/><div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]")}><header className="sticky top-0 z-30 flex h-[82px] items-center gap-3 border-b border-[#E5E7EB] bg-white/95 px-4 backdrop-blur-md sm:px-6 xl:px-8"><button className="rounded-xl border border-[#E5E7EB] p-2.5 text-[#55565A] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19}/></button><div><h1 className="text-lg font-bold text-[#1F2937]">Marketing</h1><p className="text-xs text-[#9CA3AF]">KMM Sales Intelligence</p></div><div className="ml-auto flex items-center gap-2 sm:gap-3"><HeaderPresentationTrigger /><button className="relative grid size-10 place-items-center rounded-xl border border-[#E5E7EB] text-[#55565A]" aria-label="Open notifications"><Bell size={18}/><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#EF4444]"/></button><button className="flex items-center gap-2 rounded-xl p-1.5 pr-2" aria-label="Open profile menu"><span className="grid size-9 place-items-center rounded-xl bg-[#55565A] text-xs font-bold text-white">KM</span><span className="hidden text-left xl:block"><span className="block text-xs font-semibold">KMM Admin</span><span className="block text-[10px] text-[#9CA3AF]">Executive view</span></span><ChevronDown className="hidden text-[#9CA3AF] xl:block" size={15}/></button></div></header><main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-5 xl:p-6"><section className="space-y-5"><MarketingFilters filters={filters} options={options} onChange={change} onRefresh={load} onReset={() => { setFilters(defaults); setProduct("All"); }} onExport={exportRows}/></section>{loading && <Card className="grid min-h-[320px] place-items-center p-8"><LoadingSkeleton variant="chart"/></Card>}{error && !loading && <Card className="grid min-h-[320px] place-items-center p-8"><ErrorState message={error} onRetry={load}/></Card>}{data && !loading && !error && <><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-3"><KpiCard title="Marketing Activities" value={count(marketing.length)} unit="Activities"/><KpiCard title="Marketing Cost" value={compact(sum(marketing, (row) => row.expense))} unit="MMK"/><KpiCard title="Participants / Customers" value={count(sum(marketing, (row) => row.participants))} unit="People"/><KpiCard title="Sales from Marketing" value="N/A" unit="" supportingText="Attribution unavailable"/><KpiCard title="Marketing ROI" value="N/A" unit="" supportingText="Attribution unavailable"/></section><section className="grid gap-4 lg:grid-cols-3">{showroomMetrics.map((item) => <Card key={item.showroom.code} className="rounded-2xl border-[#E8EAED] bg-white p-5 shadow-[0_8px_24px_rgba(31,41,55,0.035)]"><div className="flex items-baseline justify-between"><h2 className="text-[18px] font-semibold text-[#1F2937]">{item.showroom.name}</h2><span className="text-xs text-[#9CA3AF]">{item.showroom.code}</span></div><div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-5"><Metric label="Activities" value={count(item.activities)}/><Metric label="Sales Unit" value={count(item.unit)}/><Metric label="Sales Value" value={`${compact(item.value)} MMK`}/><Metric label="Gross Profit" value={`${compact(item.gp)} MMK`}/><Metric label="Marketing Cost" value={`${compact(item.cost)} MMK`}/><Metric label="Booking" value={count(item.booking)}/><Metric label="Branch Sales / Cost" value={item.roi === null ? "N/A" : `${item.roi.toFixed(1)}x`} accent/></div><div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#EEF0F3] pt-4"><Metric label="Top Product" value={item.topProduct}/><Metric label="Top Salesperson" value={item.topSalesperson}/></div></Card>)}</section><section className="space-y-4"><div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center"><div><h2 className="text-[21px] font-semibold text-[#1F2937]">Engine Population & Marketing Activity</h2><p className="mt-1 text-sm text-[#6B7280]">Engine Population is cumulative delivered TT, CH, EX and TP units through the selected period.</p></div><ProductSelect product={product} onChange={setProduct}/></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><Card className="flex h-[420px] flex-col overflow-hidden rounded-2xl border-[#E8EAED] bg-white p-0 shadow-[0_8px_24px_rgba(31,41,55,0.035)] md:h-[560px] xl:h-[720px]"><div className="flex shrink-0 flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-start sm:px-6"><div><h2 className="text-[19px] font-semibold text-[#1F2937]">Myanmar Engine Population Heatmap</h2><p className="mt-1 text-sm text-[#6B7280]">{product} · {count(populationSales.length)} cumulative delivered units</p></div><div className="flex shrink-0 flex-wrap items-center gap-2"><HeatmapModeToggle mode={mode} onChange={setMode}/><Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => setMapFocused(true)}><Maximize2 size={15}/>Expand Map</Button></div></div><div className="relative min-h-0 flex-1 overflow-hidden"><MyanmarMarketingMap visibleShowroomIds={visibleShowroomIds} townshipMetrics={mapped.metrics} productLabel={product} mode={mode} resetSignal={mapResetSignal}/><HeatmapLegend mode={mode}/></div></Card><ChartCard title="Engine Population Summary" subtitle="Township-level aggregation" className="h-full"><div className="overflow-hidden rounded-xl border border-[#EEF0F3]"><table className="w-full text-left text-xs"><thead className="bg-[#FAFBFC] text-[#6B7280]"><tr><th className="px-3 py-3">Region</th><th className="px-3 py-3 text-right">Population</th><th className="px-3 py-3 text-right">Activities</th><th className="px-3 py-3 text-right">Density</th><th className="px-3 py-3 text-right">Sales Unit</th><th className="px-3 py-3">Coverage</th></tr></thead><tbody className="divide-y divide-[#EEF0F3]">{regional.map((region) => <tr key={region.label}><td className="px-3 py-3 font-semibold text-[#4B5563]">{region.label}</td><td className="px-3 py-3 text-right">{count(region.population)}</td><td className="px-3 py-3 text-right">{count(region.activities)}</td><td className="px-3 py-3 text-right">{region.density === null ? "N/A" : region.density.toFixed(2)}</td><td className="px-3 py-3 text-right">{count(region.salesUnit)}</td><td className="px-3 py-3 text-[#6B7280]">{region.status}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs leading-5 text-[#9CA3AF]">Coverage: Under-covered = high population with low density; Over-covered = lower population with high density; otherwise Balanced.</p></ChartCard></div><MapFullscreenDialog open={mapFocused} title="Myanmar Engine Population Heatmap" subtitle={<span>{product} · {count(populationSales.length)} cumulative delivered units</span>} onClose={() => { setMapFocused(false); setMapResetSignal((value) => value + 1); }} onReset={() => setMapResetSignal((value) => value + 1)} controls={<><ProductSelect product={product} onChange={setProduct} className="h-9 rounded-lg"/><HeatmapModeToggle mode={mode} onChange={setMode}/></>}><MyanmarMarketingMap visibleShowroomIds={visibleShowroomIds} townshipMetrics={mapped.metrics} productLabel={product} mode={mode} resetSignal={mapResetSignal}/><HeatmapLegend mode={mode}/></MapFullscreenDialog></section><section className="space-y-5"><ChartCard title="Activity Trend" subtitle="Monthly completed activities" minHeight={410}><Trend rows={marketing}/></ChartCard><div className="grid gap-5 lg:grid-cols-2"><ChartCard title="Activity Type Breakdown" subtitle="Completed activity records" minHeight={300}><Bars rows={activityBreakdown}/></ChartCard><ChartCard title="Top 10 Township" subtitle="Cumulative engine population" minHeight={300}><Bars rows={ranking} unit=" Unit"/></ChartCard></div></section><TableCard title="Latest Marketing Activities" search={<div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"/><span className="block h-9 w-48 rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] pl-9 pr-3 pt-2 text-sm text-[#9CA3AF]">Filtered activity data</span></div>} exportAction={<ExportButton onClick={exportRows}/>} empty={!marketing.length}><div className="overflow-x-auto rounded-xl border border-[#EEF0F3]"><table className="min-w-[960px] w-full text-left text-xs"><thead className="sticky top-0 bg-[#FAFBFC] text-[#6B7280]"><tr>{["Date", "Activity", "Branch", "Township", "Participants", "Leads", "Booking", "Cost"].map((heading) => <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[#F1F2F4] text-[#4B5563]">{marketing.map((row, index) => <tr key={`${row.date}-${index}`}><td className="px-3 py-3">{row.date}</td><td className="px-3 py-3 font-semibold text-[#1F2937]">{row.activity}</td><td className="px-3 py-3">{row.branch}</td><td className="px-3 py-3">{row.township || "N/A"}</td><td className="px-3 py-3">{count(row.participants)}</td><td className="px-3 py-3">{count(row.prospectCount)}</td><td className="px-3 py-3">{count(row.bookingCount)}</td><td className="px-3 py-3">{count(row.expense)}</td></tr>)}</tbody></table></div></TableCard><p className="pb-2 text-xs text-[#9CA3AF]">Source: {data.meta.sources.join(" · ")}</p></>}</main></div></div>;
}
