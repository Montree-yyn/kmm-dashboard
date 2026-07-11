"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, ChevronLeft, ChevronRight, Menu, RefreshCw, RotateCcw, Search } from "lucide-react";
import { AppSidebar } from "../navigation/app-sidebar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { PRODUCT_GROUPS, filterByProductGroups } from "../../lib/dashboard/product-groups";
import { ChartCard } from "../design-system/chart-card";
import { EmptyState } from "../design-system/empty-state";
import { ErrorState } from "../design-system/error-state";
import { ExportButton } from "../design-system/export-button";
import { FilterBar } from "../design-system/filter-bar";
import { KpiCard } from "../design-system/kpi-card";
import { LoadingSkeleton } from "../design-system/loading-skeleton";
import { SectionHeader } from "../design-system/section-header";
import { StatusBadge } from "../design-system/status-badge";
import { TableCard } from "../design-system/table-card";
import { HeaderPresentationTrigger } from "../presentation/HeaderPresentationTrigger";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BRANCHES = [
  { code: "KMM01", name: "Hpa-an" },
  { code: "KMM02", name: "Mawlamyine" },
  { code: "KMM03", name: "Tharyarwaddy" },
] as const;

type FilterKey = "year" | "month" | "branch" | "salesperson";
type FilterState = Record<FilterKey, string[]>;
type SourceRow = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  productType: string;
  model: string;
  finalReceived?: number;
};
type SalesRow = SourceRow & { finalReceived: number };
type DashboardData = {
  meta: { sourceUpdatedAt: string };
  plan: { year: number; months: string[]; units: number[] };
  sales: SalesRow[];
  booking: SourceRow[];
};
type Person = {
  name: string;
  branch: string;
  salesUnit: number;
  salesValue: number;
};
type SortKey = "name" | "branch" | "salesUnit" | "salesValue";

const defaultFilters: FilterState = {
  year: ["2026"],
  month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  branch: [],
  salesperson: [],
};

function sum<T>(rows: T[], getValue: (row: T) => number) {
  return rows.reduce((total, row) => total + getValue(row), 0);
}

function formatNumber(value: number) {
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatCompact(value: number) {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return formatNumber(value);
}

function initials(name: string) {
  return name.split(/[\s-]+/).filter(Boolean).slice(-2).map((word) => word[0]).join("").toUpperCase() || "NA";
}

function selectedYears(filters: FilterState) {
  return filters.year.map(Number).filter(Number.isFinite);
}

function selectedMonths(filters: FilterState) {
  return filters.month.map((month) => MONTHS.indexOf(month) + 1).filter((month) => month > 0);
}

function matchesFilters(row: Pick<SourceRow, "year" | "month" | "branch" | "salesperson">, filters: FilterState) {
  const years = selectedYears(filters);
  const months = selectedMonths(filters);
  if (years.length && (!row.year || !years.includes(row.year))) return false;
  if (months.length && (!row.month || !months.includes(row.month))) return false;
  if (filters.branch.length && !filters.branch.includes(row.branch)) return false;
  if (filters.salesperson.length && !filters.salesperson.includes(row.salesperson)) return false;
  return true;
}

function targetForScope(data: DashboardData, filters: FilterState) {
  const years = selectedYears(filters);
  if (years.length !== 1 || years[0] !== data.plan.year || filters.branch.length || filters.salesperson.length) return null;
  const months = selectedMonths(filters);
  const indexes = months.length ? months.map((month) => month - 1) : data.plan.months.map((_, index) => index);
  const target = indexes.reduce((total, index) => total + (data.plan.units[index] ?? 0), 0);
  return target > 0 ? target : null;
}

function personBranch(name: string, sourceRows: SourceRow[]) {
  const counts = new Map<string, number>();
  sourceRows.filter((row) => row.salesperson === name && row.branch).forEach((row) => counts.set(row.branch, (counts.get(row.branch) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "N/A";
}

function MultiSelectFilter({ label, options, values, onChange }: { label: string; options: string[]; values: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));
  const displayValue = values.length === 0 ? "All" : values.length === 1 ? values[0] : `${values.length} selected`;

  function toggle(option: string) {
    onChange(values.includes(option) ? values.filter((item) => item !== option) : [...values, option]);
  }

  return (
    <div className="relative min-w-0">
      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A8E96]">{label}</label>
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white px-3 text-left text-sm font-semibold text-[#1F2937] shadow-[0_1px_2px_rgba(31,41,55,0.04)] transition hover:border-[#D1D5DB] focus:border-[#FFB46E] focus:ring-4 focus:ring-[#FF8615]/10" aria-expanded={open}>
        <span className="truncate">{displayValue}</span><ChevronDown size={16} className={cn("shrink-0 text-[#9CA3AF] transition-transform", open && "rotate-180")} />
      </button>
      {open && <Card className="absolute left-0 right-0 top-[72px] z-50 p-2 shadow-xl">
        <div className="relative mb-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] pl-9 pr-3 text-sm outline-none focus:border-[#FFB46E] focus:bg-white" placeholder={`Search ${label.toLowerCase()}`} /></div>
        <div className="max-h-52 space-y-1 overflow-y-auto">
          {filteredOptions.map((option) => <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-[#55565A] hover:bg-[#FFF7EF]"><input type="checkbox" checked={values.includes(option)} onChange={() => toggle(option)} className="size-4 rounded border-[#D1D5DB] accent-[#FF8615]" /><span className="truncate">{option}</span></label>)}
          {!filteredOptions.length && <p className="px-2 py-4 text-center text-sm text-[#9CA3AF]">No options found</p>}
        </div>
      </Card>}
    </div>
  );
}

function OrganizationFilters({ filters, options, onChange, onRefresh, onReset, onExport }: { filters: FilterState; options: FilterState; onChange: (key: FilterKey, values: string[]) => void; onRefresh: () => void; onReset: () => void; onExport: () => void }) {
  return <FilterBar actions={<><Button className="h-11" variant="outline" onClick={onReset}><RotateCcw size={16} />Reset</Button><Button className="h-11" variant="outline" onClick={onRefresh}><RefreshCw size={16} />Refresh</Button><ExportButton onClick={onExport} /></>}>
    <MultiSelectFilter label="Year" options={options.year} values={filters.year} onChange={(values) => onChange("year", values)} />
    <MultiSelectFilter label="Month" options={options.month} values={filters.month} onChange={(values) => onChange("month", values)} />
    <MultiSelectFilter label="Branch" options={options.branch} values={filters.branch} onChange={(values) => onChange("branch", values)} />
    <MultiSelectFilter label="Salesperson" options={options.salesperson} values={filters.salesperson} onChange={(values) => onChange("salesperson", values)} />
  </FilterBar>;
}

function Avatar({ name }: { name: string }) {
  return <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#F3F4F6] text-[11px] font-bold text-[#4B5563]" aria-label={`${name} initials`}>{initials(name)}</span>;
}

function MetricBar({ value }: { value: number | null }) {
  const width = value === null ? 0 : Math.min(value, 100);
  return <div className="h-2 rounded-full bg-[#F3F4F6]"><div className="h-2 rounded-full bg-[#FF7A00]" style={{ width: `${width}%` }} /></div>;
}

function OrganizationStructure({ people, expanded, onToggle }: { people: Person[]; expanded: string | null; onToggle: (branch: string) => void }) {
  return <section className="space-y-5" aria-label="Sales organization structure">
    <SectionHeader title="Sales Organization Structure" description="Transaction-derived roster. Employee master data is not connected." />
    <Card className="overflow-hidden rounded-2xl border-[#E8EAED] p-5 shadow-[0_8px_24px_rgba(31,41,55,0.035)] sm:p-6">
      <div className="mx-auto w-full max-w-xs rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-4 text-center"><Avatar name="N/A" /><p className="mt-3 text-sm font-semibold text-[#1F2937]">N/A</p><p className="mt-1 text-xs text-[#6B7280]">Sales Division Manager</p><p className="mt-3 text-xs font-semibold text-[#4B5563]">{people.length} data-derived team members</p></div>
      <div className="mx-auto h-7 w-px bg-[#D1D5DB]" />
      <div className="hidden h-px bg-[#D1D5DB] md:block" />
      <div className="grid gap-4 pt-0 md:grid-cols-3 md:pt-7">
        {BRANCHES.map((branch) => {
          const team = people.filter((person) => person.branch === branch.code);
          const isExpanded = expanded === branch.code;
          return <div key={branch.code} className="relative rounded-xl border border-[#E5E7EB] bg-white p-4 md:before:absolute md:before:-top-7 md:before:left-1/2 md:before:h-7 md:before:w-px md:before:bg-[#D1D5DB]">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#1F2937]">{branch.code} <span className="font-medium text-[#6B7280]">{branch.name}</span></p><p className="mt-1 text-xs text-[#9CA3AF]">Branch Manager: N/A</p></div><Badge variant="outline">{team.length} team</Badge></div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs"><div><dt className="text-[#9CA3AF]">Managers</dt><dd className="mt-0.5 font-semibold text-[#4B5563]">N/A</dd></div><div><dt className="text-[#9CA3AF]">Senior Sales</dt><dd className="mt-0.5 font-semibold text-[#4B5563]">N/A</dd></div><div><dt className="text-[#9CA3AF]">Sales Staff</dt><dd className="mt-0.5 font-semibold text-[#4B5563]">N/A</dd></div><div><dt className="text-[#9CA3AF]">Support Staff</dt><dd className="mt-0.5 font-semibold text-[#4B5563]">N/A</dd></div></dl>
            <Button className="mt-4 h-9 w-full" variant="outline" onClick={() => onToggle(branch.code)} aria-expanded={isExpanded}>{isExpanded ? "Collapse Team" : "Expand Team"}</Button>
            {isExpanded && <div className="mt-4 space-y-2 border-t border-[#EEF0F3] pt-4">{team.length ? team.map((person) => <div key={person.name} className="flex items-center gap-3 rounded-lg bg-[#FAFBFC] p-2.5"><Avatar name={person.name} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#1F2937]">{person.name}</p><p className="mt-0.5 text-[11px] text-[#9CA3AF]">Position N/A</p></div><span className="text-xs font-bold text-[#4B5563]">{person.salesUnit} Unit</span></div>) : <EmptyState message="No team members in the selected scope." />}</div>}
          </div>;
        })}
      </div>
    </Card>
  </section>;
}

function BranchPerformance({ people }: { people: Person[] }) {
  return <section className="space-y-5" aria-label="Branch performance"><SectionHeader title="Branch Performance" description="Sales Unit counts TT, CH, EX, TP and MAX. Sales Value includes approved value product groups." />
    <div className="grid gap-4 lg:grid-cols-3">{BRANCHES.map((branch) => {
      const team = people.filter((person) => person.branch === branch.code);
      const salesUnit = sum(team, (person) => person.salesUnit);
      const salesValue = sum(team, (person) => person.salesValue);
      return <Card key={branch.code} className="min-h-[260px] rounded-2xl border-[#E8EAED] p-5 shadow-[0_8px_24px_rgba(31,41,55,0.035)]"><div className="flex items-start justify-between"><div><h3 className="text-base font-semibold text-[#1F2937]">{branch.code}</h3><p className="mt-1 text-sm text-[#6B7280]">{branch.name}</p></div><Badge variant="outline">{team.length} team</Badge></div><dl className="mt-6 grid grid-cols-2 gap-y-4 text-sm"><div><dt className="text-xs text-[#9CA3AF]">Manager</dt><dd className="mt-1 font-semibold text-[#4B5563]">N/A</dd></div><div><dt className="text-xs text-[#9CA3AF]">Average Skill Score</dt><dd className="mt-1 font-semibold text-[#4B5563]">N/A</dd></div><div><dt className="text-xs text-[#9CA3AF]">Sales Unit</dt><dd className="mt-1 text-lg font-semibold text-[#1F2937]">{formatNumber(salesUnit)}</dd></div><div><dt className="text-xs text-[#9CA3AF]">Sales Value</dt><dd className="mt-1 text-lg font-semibold text-[#1F2937]">{formatCompact(salesValue)} <span className="text-xs text-[#6B7280]">MMK</span></dd></div></dl><div className="mt-6"><div className="mb-2 flex justify-between text-xs font-semibold text-[#4B5563]"><span>Achievement</span><span>N/A</span></div><MetricBar value={null} /></div><button type="button" className="mt-4 text-xs font-semibold text-[#E86F00] hover:underline">View Team Detail</button></Card>;
    })}</div>
  </section>;
}

function TopPerformers({ people }: { people: Person[] }) {
  const topPeople = [...people].sort((a, b) => b.salesUnit - a.salesUnit || b.salesValue - a.salesValue).slice(0, 5);
  return <ChartCard title="Top Performers" subtitle="Ranked by Sales Unit" minHeight={360}>
    <div className="space-y-3">{topPeople.length ? topPeople.map((person, index) => <div key={person.name} className="grid grid-cols-[24px_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#EEF0F3] p-3"><span className="text-sm font-bold text-[#9CA3AF]">{index + 1}</span><Avatar name={person.name} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#1F2937]">{person.name}</p><p className="mt-1 text-xs text-[#6B7280]">{person.branch}</p></div><div className="text-right"><p className="text-sm font-bold text-[#1F2937]">{person.salesUnit} Unit</p><p className="mt-1 text-xs text-[#6B7280]">{formatCompact(person.salesValue)} MMK</p></div></div>) : <EmptyState />}</div>
  </ChartCard>;
}

function SkillMatrix() {
  return <ChartCard title="Skill Matrix" subtitle="Team-average assessment" minHeight={360} empty><EmptyState message="No skill assessment data available." /></ChartCard>;
}

function DirectoryTable({ people, onExport }: { people: Person[]; onExport: () => void }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("salesUnit");
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const searched = people.filter((person) => `${person.name} ${person.branch}`.toLowerCase().includes(query.toLowerCase()));
  const sorted = [...searched].sort((left, right) => {
    const a = left[sortKey]; const b = right[sortKey];
    const result = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
    return ascending ? result : -result;
  });
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages);
  const shown = sorted.slice((current - 1) * pageSize, current * pageSize);
  const sort = (key: SortKey) => { setPage(1); if (key === sortKey) setAscending((value) => !value); else { setSortKey(key); setAscending(false); } };
  const heading = (label: string, key: SortKey) => <button type="button" onClick={() => sort(key)} className="whitespace-nowrap font-semibold hover:text-[#E86F00]">{label}{sortKey === key && (ascending ? " ↑" : " ↓")}</button>;
  return <TableCard title="Sales Organization Directory" search={<div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search people or branch" className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] pl-9 pr-3 text-sm outline-none focus:border-[#FFB46E] focus:bg-white" /></div>} exportAction={<ExportButton onClick={onExport} />} empty={!people.length} pagination={<div className="flex items-center justify-between text-xs font-semibold text-[#6B7280]"><span>{sorted.length} people</span><div className="flex items-center gap-2"><button type="button" disabled={current === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-[#E5E7EB] p-1.5 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={15} /></button><span>{current} / {pages}</span><button type="button" disabled={current === pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-[#E5E7EB] p-1.5 disabled:opacity-40" aria-label="Next page"><ChevronRight size={15} /></button></div></div>}>
    <div className="overflow-x-auto rounded-xl border border-[#EEF0F3]"><table className="min-w-[1180px] w-full text-left text-xs"><thead className="sticky top-0 z-10 bg-[#FAFBFC] text-[#6B7280]"><tr><th className="px-3 py-3">Photo</th><th className="px-3 py-3">{heading("Name", "name")}</th><th className="px-3 py-3">Position</th><th className="px-3 py-3">{heading("Branch", "branch")}</th><th className="px-3 py-3">Join Date</th><th className="px-3 py-3">Years of Service</th><th className="px-3 py-3">{heading("Sales Unit", "salesUnit")}</th><th className="px-3 py-3">{heading("Sales Value", "salesValue")}</th><th className="px-3 py-3">Achievement</th><th className="px-3 py-3">Skill Score</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-[#F1F2F4] text-[#4B5563]">{shown.map((person) => <tr key={person.name} className="hover:bg-[#FFFAF5]"><td className="px-3 py-3"><Avatar name={person.name} /></td><td className="px-3 py-3 font-semibold text-[#1F2937]">{person.name}</td><td className="px-3 py-3 text-[#9CA3AF]">N/A</td><td className="px-3 py-3">{person.branch}</td><td className="px-3 py-3 text-[#9CA3AF]">N/A</td><td className="px-3 py-3 text-[#9CA3AF]">N/A</td><td className="px-3 py-3 font-semibold text-[#1F2937]">{formatNumber(person.salesUnit)}</td><td className="px-3 py-3 font-semibold text-[#1F2937]">{formatNumber(person.salesValue)}</td><td className="px-3 py-3 text-[#9CA3AF]">N/A</td><td className="px-3 py-3 text-[#9CA3AF]">N/A</td><td className="px-3 py-3"><StatusBadge status="neutral">N/A</StatusBadge></td><td className="px-3 py-3"><button type="button" className="font-semibold text-[#E86F00] hover:underline">View</button></td></tr>)}</tbody></table></div>
  </TableCard>;
}

function exportDirectory(people: Person[]) {
  const headings = ["Name", "Position", "Branch", "Join Date", "Years of Service", "Sales Unit", "Sales Value", "Achievement", "Skill Score", "Status"];
  const records = people.map((person) => [person.name, "N/A", person.branch, "N/A", "N/A", String(person.salesUnit), String(person.salesValue), "N/A", "N/A", "N/A"]);
  const csv = [headings, ...records].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "kmm-sales-organization-directory.csv"; anchor.click(); URL.revokeObjectURL(url);
}

export function SalesOrganizationPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);

  async function loadData() {
    setLoading(true); setError("");
    try { const response = await fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" }); if (!response.ok) throw new Error(`Unable to load dashboard-data.json (${response.status})`); setData(await response.json()); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load sales organization data"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let ignore = false;
    fetch(`/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load dashboard-data.json (${response.status})`);
        return response.json() as Promise<DashboardData>;
      })
      .then((loadedData) => { if (!ignore) setData(loadedData); })
      .catch((loadError: unknown) => { if (!ignore) setError(loadError instanceof Error ? loadError.message : "Unable to load sales organization data"); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const filteredSales = useMemo(() => data?.sales.filter((row) => matchesFilters(row, filters)) ?? [], [data, filters]);
  const filteredBooking = useMemo(() => data?.booking.filter((row) => matchesFilters(row, filters)) ?? [], [data, filters]);
  const filteredSourceRows = useMemo(() => [...filteredSales, ...filteredBooking], [filteredSales, filteredBooking]);
  const people = useMemo(() => {
    const names = [...new Set(filteredSourceRows.map((row) => row.salesperson).filter(Boolean))];
    const unitRows = filterByProductGroups(filteredSales, PRODUCT_GROUPS.UNIT_PRODUCTS);
    const valueRows = filterByProductGroups(filteredSales, PRODUCT_GROUPS.VALUE_PRODUCTS);
    return names.map((name) => ({ name, branch: personBranch(name, filteredSourceRows), salesUnit: unitRows.filter((row) => row.salesperson === name).length, salesValue: sum(valueRows.filter((row) => row.salesperson === name), (row) => row.finalReceived) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredSales, filteredSourceRows]);
  const totalUnit = useMemo(() => sum(filterByProductGroups(filteredSales, PRODUCT_GROUPS.UNIT_PRODUCTS), () => 1), [filteredSales]);
  const totalTarget = data ? targetForScope(data, filters) : null;
  const averageAchievement = totalTarget === null ? null : (totalUnit / totalTarget) * 100;
  const filterOptions = useMemo(() => {
    const source = data ? [...data.sales, ...data.booking] : [];
    const matchingPeople = source.filter((row) => matchesFilters(row, { ...filters, salesperson: [] }));
    return { year: [...new Set(source.map((row) => String(row.year)).filter((year) => year !== "null"))].sort((a, b) => Number(b) - Number(a)), month: MONTHS, branch: [...new Set(source.map((row) => row.branch).filter(Boolean))].sort(), salesperson: [...new Set(matchingPeople.map((row) => row.salesperson).filter(Boolean))].sort() };
  }, [data, filters]);

  function updateFilter(key: FilterKey, values: string[]) { setFilters((current) => ({ ...current, [key]: values, ...(key === "branch" ? { salesperson: [] } : {}) })); }

  return <div className="min-h-screen bg-[#F8FAFC] text-[#1F2937]">
    <AppSidebar collapsed={collapsed} mobileOpen={mobileOpen} onCollapsedChange={setCollapsed} onMobileOpenChange={setMobileOpen} />
    <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]")}>
      <header className="sticky top-0 z-30 flex h-[82px] items-center gap-3 border-b border-[#E5E7EB] bg-white/95 px-4 backdrop-blur-md sm:px-6 xl:px-8"><button className="rounded-xl border border-[#E5E7EB] p-2.5 text-[#55565A] hover:bg-[#F8FAFC] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="hidden max-w-md flex-1 md:block"><p className="text-lg font-bold tracking-[-0.02em] text-[#1F2937]">Sales Organization</p><p className="text-xs text-[#9CA3AF]">KMM Sales Intelligence</p></div><div className="ml-auto flex items-center gap-2 sm:gap-3"><HeaderPresentationTrigger /><div className="relative"><button className="relative grid size-10 place-items-center rounded-xl border border-[#E5E7EB] text-[#55565A] transition hover:border-[#D1D5DB] hover:bg-[#F8FAFC]" onClick={() => setNotificationsOpen((value) => !value)} aria-label="Open notifications" aria-expanded={notificationsOpen}><Bell size={18} /><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#EF4444]" /></button>{notificationsOpen && <Card className="absolute right-0 top-12 z-50 w-[310px] p-2 shadow-xl"><p className="px-3 py-2 text-sm font-semibold">Data source status</p><p className="px-3 pb-2 text-xs text-[#6B7280]">Salesperson roster is derived from the current sales and booking extracts.</p></Card>}</div><button className="flex items-center gap-2 rounded-xl p-1.5 pr-2 transition hover:bg-[#F8FAFC]" aria-label="Open profile menu"><span className="grid size-9 place-items-center rounded-xl bg-[#55565A] text-xs font-bold text-white">KM</span><span className="hidden text-left xl:block"><span className="block text-xs font-semibold">KMM Admin</span><span className="block text-[10px] text-[#9CA3AF]">Executive view</span></span><ChevronDown className="hidden text-[#9CA3AF] xl:block" size={15} /></button></div></header>
      <main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6 2xl:p-6"><div className="space-y-6"><section className="space-y-5"><OrganizationFilters filters={filters} options={filterOptions} onChange={updateFilter} onRefresh={loadData} onReset={() => setFilters(defaultFilters)} onExport={() => exportDirectory(people)} /></section>
        {loading && <Card className="grid min-h-[320px] place-items-center p-8"><div className="w-full max-w-xl space-y-4"><LoadingSkeleton variant="chart" /><p className="text-center text-sm font-semibold text-[#6B7280]">Loading real sales organization data...</p></div></Card>}
        {error && !loading && <Card className="grid min-h-[320px] place-items-center p-8"><ErrorState message={error} onRetry={loadData} /></Card>}
        {data && !loading && !error && <><section aria-label="Organization KPIs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-3 2xl:gap-4"><KpiCard title="Total Salespeople" value={people.length} unit="People" /><KpiCard title="Branch Managers" value="N/A" unit="" supportingText="Employee master data unavailable" /><KpiCard title="Active Salespeople" value="N/A" unit="" supportingText="Employee status unavailable" /><KpiCard title="Average Achievement" value={averageAchievement === null ? "N/A" : `${averageAchievement.toFixed(1)}%`} unit="" supportingText={averageAchievement === null ? "Target not available at selected scope" : undefined} /><KpiCard title="Average Skill Score" value="N/A" unit="" supportingText="Skill assessment data unavailable" /></section>
          <OrganizationStructure people={people} expanded={expandedBranch} onToggle={(branch) => setExpandedBranch((current) => current === branch ? null : branch)} />
          <BranchPerformance people={people} />
          <section className="grid gap-5 xl:grid-cols-2"><TopPerformers people={people} /><SkillMatrix /></section>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"><ChartCard title="Tenure Distribution" subtitle="Employee tenure" minHeight={300} empty><EmptyState message="Join Date data is unavailable." /></ChartCard><ChartCard title="Position Distribution" subtitle="Organization roles" minHeight={300} empty><EmptyState message="Position data is unavailable." /></ChartCard><ChartCard title="Achievement Distribution" subtitle="Salespeople by achievement band" minHeight={300} empty><EmptyState message="Individual sales targets are unavailable." /></ChartCard></section>
          <DirectoryTable people={people} onExport={() => exportDirectory(people)} />
        </>}</div></main>
    </div>
  </div>;
}
