"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, ChevronLeft, ChevronRight, Menu, RefreshCw, RotateCcw, Search } from "lucide-react";
import { AppSidebar } from "../navigation/app-sidebar";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { ChartCard } from "../design-system/chart-card";
import { ErrorState } from "../design-system/error-state";
import { ExportButton } from "../design-system/export-button";
import { FilterBar } from "../design-system/filter-bar";
import { KpiCard } from "../design-system/kpi-card";
import { LoadingSkeleton } from "../design-system/loading-skeleton";
import { Progress } from "../ui/progress";
import { TableCard } from "../design-system/table-card";
import { PremiumTrendChart } from "../common/charts/PremiumTrendChart";
import { HeaderPresentationTrigger } from "../presentation/HeaderPresentationTrigger";
import { MyanmarMarketingMap } from "./myanmar-marketing-map";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SHOWROOMS = [
  { id: "KMM-MYAWADDY", name: "Myawaddy", region: "Kayin" },
  { id: "KMM-HPAAN", name: "Hpa-an", region: "Kayin" },
  { id: "KMM-MAWLAMYINE", name: "Mawlamyine (Moke Ta Ma)", region: "Mon" },
  { id: "KMM-THARYARWADDY", name: "Tharyarwaddy", region: "Bago West" },
  { id: "KMM-NATTALIN", name: "Nattalin", region: "Bago West" },
  { id: "KMM-NAWNGHKIO", name: "Naung Cho", region: "Shan" },
] as const;
const REGIONS = ["Kayin", "Mon", "Bago West", "Shan"] as const;

type FilterKey = "year" | "month" | "branch" | "showroom";
type FilterState = Record<FilterKey, string[]>;
type MarketingRow = { date: string; year: number | null; month: number | null; branch: string; activity: string; participants: number; bookingCount: number; prospectCount: number; expense: number };
type MarketingData = { meta: { sourceUpdatedAt: string; sources: string[] }; marketing: MarketingRow[] };
type TrendPoint = { label: string; activities: number | null; cost: number | null; sales: number | null };

const defaultFilters: FilterState = { year: ["2026"], month: MONTHS.slice(0, 6), branch: [], showroom: [] };

function formatNumber(value: number) { return Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value); }
function formatCompact(value: number) {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return formatNumber(value);
}
function sum<T>(rows: T[], selector: (row: T) => number) { return rows.reduce((total, row) => total + selector(row), 0); }
function monthNumbers(filters: FilterState) { return filters.month.map((month) => MONTHS.indexOf(month) + 1).filter((month) => month > 0); }
function isCompletedActivity(row: MarketingRow) { return Boolean(row.activity.trim() && row.date); }
function rowMatches(row: MarketingRow, filters: FilterState) {
  const years = filters.year.map(Number).filter(Number.isFinite);
  const months = monthNumbers(filters);
  return (!years.length || (row.year !== null && years.includes(row.year)))
    && (!months.length || (row.month !== null && months.includes(row.month)))
    && (!filters.branch.length || filters.branch.includes(row.branch));
}

function MultiSelectFilter({ label, options, values, onChange }: { label: string; options: string[]; values: string[]; onChange: (values: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visibleOptions = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));
  const text = values.length === 0 ? "All" : values.length === 1 ? values[0] : `${values.length} selected`;
  return <div className="relative min-w-0"><label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A8E96]">{label}</label><button type="button" onClick={() => setOpen((value) => !value)} className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white px-3 text-left text-sm font-semibold text-[#1F2937] shadow-[0_1px_2px_rgba(31,41,55,0.04)] transition hover:border-[#D1D5DB]" aria-expanded={open}><span className="truncate">{text}</span><ChevronDown size={16} className={cn("shrink-0 text-[#9CA3AF] transition-transform", open && "rotate-180")} /></button>{open && <Card className="absolute left-0 right-0 top-[72px] z-50 p-2 shadow-xl"><div className="relative mb-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] pl-9 pr-3 text-sm outline-none focus:border-[#FFB46E]" placeholder={`Search ${label.toLowerCase()}`} /></div><div className="max-h-52 space-y-1 overflow-y-auto">{visibleOptions.map((option) => <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-[#55565A] hover:bg-[#FFF7EF]"><input type="checkbox" checked={values.includes(option)} onChange={() => onChange(values.includes(option) ? values.filter((value) => value !== option) : [...values, option])} className="size-4 rounded border-[#D1D5DB] accent-[#FF8615]" /><span className="truncate">{option}</span></label>)}{visibleOptions.length === 0 && <p className="px-2 py-4 text-center text-sm text-[#9CA3AF]">No options found</p>}</div></Card>}</div>;
}

function MarketingFilters({ filters, options, onChange, onRefresh, onReset, onExport }: { filters: FilterState; options: FilterState; onChange: (key: FilterKey, values: string[]) => void; onRefresh: () => void; onReset: () => void; onExport: () => void }) {
  return <FilterBar actions={<><Button className="h-11" variant="outline" onClick={onReset}><RotateCcw size={16} />Reset</Button><Button className="h-11" variant="outline" onClick={onRefresh}><RefreshCw size={16} />Refresh</Button><ExportButton onClick={onExport} /></>}><MultiSelectFilter label="Year" options={options.year} values={filters.year} onChange={(values) => onChange("year", values)} /><MultiSelectFilter label="Month" options={options.month} values={filters.month} onChange={(values) => onChange("month", values)} /><MultiSelectFilter label="Region / Branch" options={options.branch} values={filters.branch} onChange={(values) => onChange("branch", values)} /><MultiSelectFilter label="Showroom" options={options.showroom} values={filters.showroom} onChange={(values) => onChange("showroom", values)} /></FilterBar>;
}

function HorizontalBars({ data, emptyText = "No source data available" }: { data: { label: string; value: number | null }[]; emptyText?: string }) {
  const visible = [...data].filter((item) => item.value !== null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const max = Math.max(...visible.map((item) => item.value ?? 0), 1);
  if (!visible.length) return <div className="grid min-h-44 place-items-center text-center text-sm text-[#9CA3AF]">{emptyText}</div>;
  return <div className="space-y-4">{visible.map((item) => <div key={item.label} className="grid grid-cols-[minmax(78px,120px)_minmax(0,1fr)_auto] items-center gap-3 text-sm"><span className="truncate font-semibold text-[#4B5563]" title={item.label}>{item.label}</span><Progress value={((item.value ?? 0) / max) * 100} className="h-2.5" /><span className="min-w-10 text-right text-xs font-bold text-[#4B5563]">{formatCompact(item.value ?? 0)}</span></div>)}</div>;
}

function TrendChart({ data, mode }: { data: TrendPoint[]; mode: "activities" | "cost-sales" }) { return <PremiumTrendChart labels={data.map((point) => point.label)} unit={mode === "activities" ? "Activities" : "MMK"} formatValue={formatCompact} series={mode === "activities" ? [{ id: "activities", label: "Monthly Activities", values: data.map((point) => point.activities), kind: "current" }] : [{ id: "cost", label: "Marketing Cost", values: data.map((point) => point.cost), kind: "current" }, { id: "sales", label: "Sales", values: data.map((point) => point.sales), kind: "previous" }]} />; }

function exportRows(rows: MarketingRow[]) {
  const headers = ["Date", "Activity", "Activity Type", "Region", "Showroom", "Cost", "Leads", "Booking", "Sales", "ROI", "Status"];
  const csv = [headers, ...rows.map((row) => [row.date, row.activity || "N/A", row.activity || "N/A", row.branch || "N/A", "N/A", String(row.expense), String(row.prospectCount), String(row.bookingCount), "N/A", "N/A", "N/A"])].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "kmm-marketing-activities.csv"; anchor.click(); URL.revokeObjectURL(url);
}

function MarketingActivityTable({ rows }: { rows: MarketingRow[] }) {
  const [query, setQuery] = useState(""); const [sortKey, setSortKey] = useState<"date" | "activity" | "branch" | "expense" | "prospectCount">("date"); const [ascending, setAscending] = useState(false); const [page, setPage] = useState(1); const pageSize = 10;
  const visible = rows.filter((row) => `${row.date} ${row.activity} ${row.branch}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => { const left = a[sortKey]; const right = b[sortKey]; const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right)); return ascending ? result : -result; });
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize)); const pageRows = visible.slice((page - 1) * pageSize, page * pageSize);
  const toggle = (key: typeof sortKey) => { setPage(1); if (sortKey === key) setAscending((value) => !value); else { setSortKey(key); setAscending(false); } };
  const column = (label: string, key: typeof sortKey) => <button type="button" className="whitespace-nowrap font-semibold hover:text-[#E86F00]" onClick={() => toggle(key)}>{label}{sortKey === key ? ascending ? " ↑" : " ↓" : ""}</button>;
  return <TableCard title="Latest Marketing Activities" search={<div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] pl-9 pr-3 text-sm outline-none focus:border-[#FFB46E]" placeholder="Search activities" /></div>} exportAction={<ExportButton onClick={() => exportRows(visible)} />} pagination={<div className="flex items-center justify-between text-xs font-semibold text-[#6B7280]"><span>{visible.length} activities</span><div className="flex items-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-[#E5E7EB] p-1.5 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={15} /></button><span>{page} / {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-[#E5E7EB] p-1.5 disabled:opacity-40" aria-label="Next page"><ChevronRight size={15} /></button></div></div>} empty={!rows.length}><div className="overflow-x-auto rounded-xl border border-[#EEF0F3]"><table className="min-w-[1120px] w-full text-left text-xs"><thead className="sticky top-0 z-10 bg-[#FAFBFC] text-[#6B7280]"><tr><th className="px-3 py-3">{column("Date", "date")}</th><th className="px-3 py-3">{column("Activity", "activity")}</th><th className="px-3 py-3">Activity Type</th><th className="px-3 py-3">{column("Region", "branch")}</th><th className="px-3 py-3">Showroom</th><th className="px-3 py-3">{column("Cost", "expense")}</th><th className="px-3 py-3">{column("Leads", "prospectCount")}</th><th className="px-3 py-3">Booking</th><th className="px-3 py-3">Sales</th><th className="px-3 py-3">ROI</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-[#F1F2F4] text-[#4B5563]">{pageRows.map((row, index) => <tr key={`${row.date}-${row.branch}-${row.activity}-${index}`} className="hover:bg-[#FFFaf5]"><td className="whitespace-nowrap px-3 py-3">{row.date || "N/A"}</td><td className="px-3 py-3 font-semibold text-[#1F2937]">{row.activity || "N/A"}</td><td className="px-3 py-3">{row.activity || "N/A"}</td><td className="px-3 py-3">{row.branch || "N/A"}</td><td className="px-3 py-3 text-[#9CA3AF]">N/A</td><td className="px-3 py-3 font-semibold text-[#1F2937]">{formatNumber(row.expense)}</td><td className="px-3 py-3">{formatNumber(row.prospectCount)}</td><td className="px-3 py-3">{formatNumber(row.bookingCount)}</td><td className="px-3 py-3 text-[#9CA3AF]">N/A</td><td className="px-3 py-3 text-[#9CA3AF]">N/A</td><td className="px-3 py-3 text-[#9CA3AF]">N/A</td></tr>)}</tbody></table></div></TableCard>;
}

export function MarketingMapPage() {
  const [mobileOpen, setMobileOpen] = useState(false); const [collapsed, setCollapsed] = useState(false); const [filters, setFilters] = useState<FilterState>(defaultFilters); const [data, setData] = useState<MarketingData | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function loadData() { setLoading(true); setError(""); try { const response = await fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" }); if (!response.ok) throw new Error(`Unable to load dashboard-data.json (${response.status})`); setData(await response.json()); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load marketing data"); } finally { setLoading(false); } }
  useEffect(() => {
    let ignore = false;
    fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load dashboard-data.json (${response.status})`);
        return response.json() as Promise<MarketingData>;
      })
      .then((loadedData) => { if (!ignore) setData(loadedData); })
      .catch((loadError: unknown) => { if (!ignore) setError(loadError instanceof Error ? loadError.message : "Unable to load marketing data"); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);
  const options = useMemo<FilterState>(() => ({ year: data ? Array.from(new Set(data.marketing.map((row) => String(row.year ?? "")))).filter(Boolean).sort((a, b) => Number(b) - Number(a)) : ["2026"], month: MONTHS, branch: data ? Array.from(new Set(data.marketing.map((row) => row.branch))).filter(Boolean).sort() : [], showroom: SHOWROOMS.map((showroom) => showroom.name) }), [data]);
  const rows = useMemo(() => data?.marketing.filter((row) => rowMatches(row, filters)) ?? [], [data, filters]); const completedRows = useMemo(() => rows.filter(isCompletedActivity), [rows]);
  const activityCount = completedRows.length; const cost = sum(completedRows, (row) => row.expense); const leads = sum(completedRows, (row) => row.prospectCount);
  const activityBreakdown = useMemo(() => Array.from(new Set(completedRows.map((row) => row.activity))).map((label) => ({ label, value: completedRows.filter((row) => row.activity === label).length })), [completedRows]);
  const trendData = useMemo<TrendPoint[]>(() => MONTHS.map((label, index) => { const monthRows = completedRows.filter((row) => row.month === index + 1); return { label, activities: monthRows.length ? monthRows.length : null, cost: monthRows.length ? sum(monthRows, (row) => row.expense) : null, sales: null }; }), [completedRows]);
  const visibleShowroomIds = filters.showroom.length ? SHOWROOMS.filter((showroom) => filters.showroom.includes(showroom.name)).map((showroom) => showroom.id) : undefined;
  function updateFilter(key: FilterKey, values: string[]) { setFilters((current) => ({ ...current, [key]: values })); }
  return <div className="min-h-screen bg-[#F8FAFC] text-[#1F2937]"><AppSidebar collapsed={collapsed} mobileOpen={mobileOpen} onCollapsedChange={setCollapsed} onMobileOpenChange={setMobileOpen} /><div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]")}><header className="sticky top-0 z-30 flex h-[82px] items-center gap-3 border-b border-[#E5E7EB] bg-white/95 px-4 backdrop-blur-md sm:px-6 xl:px-8"><button className="rounded-xl border border-[#E5E7EB] p-2.5 text-[#55565A] hover:bg-[#F8FAFC] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><div><h1 className="text-lg font-bold tracking-[-0.02em] text-[#1F2937]">Marketing</h1><p className="text-xs text-[#9CA3AF]">KMM Sales Intelligence</p></div><div className="ml-auto flex items-center gap-2 sm:gap-3"><HeaderPresentationTrigger /><button className="relative grid size-10 place-items-center rounded-xl border border-[#E5E7EB] text-[#55565A] transition hover:border-[#D1D5DB] hover:bg-[#F8FAFC]" aria-label="Open notifications"><Bell size={18} /><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#EF4444]" /></button><button className="flex items-center gap-2 rounded-xl p-1.5 pr-2 transition hover:bg-[#F8FAFC]" aria-label="Open profile menu"><span className="grid size-9 place-items-center rounded-xl bg-[#55565A] text-xs font-bold text-white">KM</span><span className="hidden text-left xl:block"><span className="block text-xs font-semibold">KMM Admin</span><span className="block text-[10px] text-[#9CA3AF]">Executive view</span></span><ChevronDown className="hidden text-[#9CA3AF] xl:block" size={15} /></button></div></header><main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-5 xl:p-6"><section className="space-y-5"><MarketingFilters filters={filters} options={options} onChange={updateFilter} onRefresh={loadData} onReset={() => setFilters(defaultFilters)} onExport={() => exportRows(rows)} /></section>{loading && <Card className="grid min-h-[320px] place-items-center p-8"><div className="w-full max-w-xl space-y-4"><LoadingSkeleton variant="chart" /><p className="text-center text-sm font-semibold text-[#6B7280]">Loading marketing data...</p></div></Card>}{error && !loading && <Card className="grid min-h-[320px] place-items-center p-8"><ErrorState message={error} onRetry={loadData} /></Card>}{data && !loading && !error && <><section aria-label="Marketing KPIs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-3 2xl:gap-4"><KpiCard title="Marketing Activities" value={activityCount} unit="Activities" /><KpiCard title="Marketing Cost" value={formatCompact(cost)} unit="MMK" /><KpiCard title="Leads Generated" value={leads} unit="Leads" /><KpiCard title="Sales from Marketing" value="N/A" unit="" /><KpiCard title="Marketing ROI" value="N/A" unit="" /></section><section aria-label="Showroom marketing overview" className="grid gap-5 xl:grid-cols-[minmax(250px,1fr)_minmax(460px,2fr)_minmax(250px,1fr)] xl:items-stretch"><ChartCard title="Showroom Performance Ranking" subtitle="No branch-to-showroom mapping in current source" className="h-full"><div className="space-y-3">{SHOWROOMS.map((showroom, index) => <div key={showroom.id} className="grid grid-cols-[22px_minmax(0,1fr)] gap-3"><span className="pt-0.5 text-xs font-bold text-[#9CA3AF]">{index + 1}</span><div><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold text-[#4B5563]">{showroom.name}</span><span className="text-xs font-semibold text-[#9CA3AF]">N/A</span></div><Progress value={0} className="mt-2 h-1.5" /></div></div>)}</div></ChartCard><Card className="flex h-[520px] flex-col overflow-hidden rounded-2xl border-[#E8EAED] bg-white p-0 shadow-[0_8px_24px_rgba(31,41,55,0.035)] md:h-[620px] xl:h-[680px]"><div className="shrink-0 px-5 pt-5 sm:px-6 sm:pt-6"><h2 className="text-[19px] font-semibold leading-tight tracking-[-0.015em] text-[#1F2937]">Myanmar Showroom Coverage</h2><p className="mt-1 text-sm text-[#6B7280]">Hover a marker to view available showroom KPIs</p></div><div className="relative mt-7 min-h-0 flex-1 overflow-hidden"><MyanmarMarketingMap visibleShowroomIds={visibleShowroomIds} /></div></Card><ChartCard title="Marketing Activity Breakdown" subtitle="Actual activity labels from the marketing extract" className="h-full"><HorizontalBars data={activityBreakdown} /></ChartCard></section><section aria-label="Marketing trends" className="grid gap-5 xl:grid-cols-2"><ChartCard title="Marketing Activities Trend" minHeight={360}><TrendChart data={trendData} mode="activities" /></ChartCard><ChartCard title="Marketing Cost vs Sales" subtitle="Sales attribution is unavailable in the current marketing extract" minHeight={360}><TrendChart data={trendData} mode="cost-sales" /></ChartCard></section><section aria-label="Regional performance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{REGIONS.map((region) => <Card key={region} className="min-h-[230px] p-5 shadow-[0_8px_24px_rgba(31,41,55,0.035)]"><h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[#1F2937]">{region}</h2><div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">{["Activities", "Marketing Cost", "Leads", "Sales", "Booking", "ROI"].map((label) => <div key={label}><p className="text-xs font-medium text-[#9CA3AF]">{label}</p><p className="mt-1 font-semibold text-[#1F2937]">N/A</p></div>)}</div><div className="mt-5 border-t border-[#EEF0F3] pt-4"><p className="text-xs font-medium text-[#9CA3AF]">Top Showroom</p><p className="mt-1 text-sm font-semibold text-[#1F2937]">N/A</p></div></Card>)}</section><MarketingActivityTable rows={completedRows} /><p className="pb-2 text-xs text-[#9CA3AF]">Source: {data.meta.sources.join(" · ")}</p></>}</main></div></div>;
}
