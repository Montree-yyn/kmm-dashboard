"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { BarChart3, BadgeDollarSign, Building2, CalendarDays, ChevronDown, CircleDollarSign, Percent, RefreshCw, RotateCcw, Search, UserRound, UsersRound, X } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { getSalesKpis } from "../../lib/sales/business-service";
import { loadLiveSalesData } from "../../lib/sales/client";
import { resolveCommissionIdentity } from "../../lib/sales/commission-identity";
import type { CommissionIdentityAlias } from "../../lib/sales/commission-identity";
import { loadLiveOperationalData } from "../../lib/operations/client";
import { operationalShowroomForBranch } from "../../lib/marketing/location-mapping";
import { ErrorState } from "../design-system/error-state";
import { ExportButton } from "../design-system/export-button";
import { FilterBar } from "../design-system/filter-bar";
import { KpiCard } from "../design-system/kpi-card";
import { LoadingSkeleton } from "../design-system/loading-skeleton";
import { PageHeader } from "../design-system/page-header";
import { SectionHeader } from "../design-system/section-header";
import { TableCard } from "../design-system/table-card";
import { useLocale } from "../../src/hooks/useLocale";
import { useCompany } from "../../src/hooks/useCompany";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type FilterKey = "year" | "month" | "branch" | "salesperson";
type FilterState = Record<FilterKey, string[]>;
type SourceRow = { date: string; year: number | null; month: number | null; branch: string; salesperson: string; productType: string; model: string };
type SalesRow = SourceRow & { employeeCode?: string; salespersonCode?: string | null; salespersonName?: string | null; quantity?: number; finalReceived: number | null; gp1: number | null; expense: number | null; commission: number | null };
type BookingRow = SourceRow & { salespersonCode?: string | null; salespersonName?: string | null; price: number | null; deposit: number | null; status: string };
type Employee = {
  employeeCode: string;
  salespersonCode: string;
  salespersonName: string;
  status?: string;
  position?: string | null;
  branch?: string | null;
  territory?: string | null;
  phone?: string | null;
  email?: string | null;
  joinedDate?: string | null;
};
type DashboardData = { meta: { sourceUpdatedAt: string }; plan: { year: number | null; months: string[]; units: Array<number | null> }; sales: SalesRow[]; booking: BookingRow[]; employees: Employee[]; salespersonIdentityAliases: CommissionIdentityAlias[]; employeeMasterAvailable: boolean };
type Person = { id: string; name: string; branch: string; salesUnit: number; salesValue: number; gp: number; commission: number | null; booking: number; target: number | null; achievement: number | null; conversion: number; rank: number; employeeCode: string | null; salespersonCode: string | null; status: "active" | "inactive" | "historical"; position: string | null; territory: string | null; phone: string | null; email: string | null; joinedDate: string | null };
type RankingMetric = "salesUnit" | "salesValue" | "gp" | "gpPercent" | "commission" | "commissionOfGp";
type RankingView = "table" | "cards";
type BranchTrendPoint = { key: string; label: string; sales: number | null; gp: number | null };
type BranchManager = { name: string; position: string | null } | null;
type BranchMetric = { code: string; name: string; people: Person[]; salesUnit: number; salesValue: number | null; gp: number | null; gpPercent: number | null; booking: number; bookingPerPerson: number | null; trend: BranchTrendPoint[]; manager: BranchManager };

const defaultFilters: FilterState = { year: ["2026"], month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], branch: [], salesperson: [] };

function sum<T>(rows: T[], getValue: (row: T) => number) { return rows.reduce((total, row) => total + getValue(row), 0); }
function formatNumber(value: number) { return Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value); }
function formatCompact(value: number) { if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`; if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`; return formatNumber(value); }
function formatCurrency(value: number | null, currency: string) { return value === null ? "N/A" : `${formatCompact(value)} ${currency}`; }
function formatDate(value: string | null) { if (!value) return "N/A"; const date = new Date(`${value.slice(0, 10)}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date); }
function ratio(numerator: number | null, denominator: number) { return numerator === null || denominator === 0 ? null : (numerator / denominator) * 100; }
function initials(name: string) { return name.split(/[\s-]+/).filter(Boolean).slice(-2).map((word) => word[0]).join("").toUpperCase() || "NA"; }
function normalizeEmployeeBaseName(name: string) { return name.trim().replace(/\s+/g, " ").replace(/\s*\(\s*out\s*\)\s*$/i, "").trim().toLowerCase(); }
function isInactiveEmployeeName(name: string) { return /\(\s*out\s*\)\s*$/i.test(name.trim()); }
function isCurrentEmployee(name: string, inactiveNames: Set<string>) { const base = normalizeEmployeeBaseName(name); return Boolean(base) && !inactiveNames.has(base); }
type EmployeeDirectory = { available: boolean; byKey: Map<string, Employee>; byName: Map<string, Employee> };
function employeeKey(value: unknown) { return String(value ?? "").trim().toUpperCase(); }
function makeEmployeeDirectory(employees: Employee[], available: boolean): EmployeeDirectory {
  const byKey = new Map<string, Employee>();
  const byName = new Map<string, Employee>();
  employees.forEach((employee) => {
    [employee.employeeCode, employee.salespersonCode, employee.salespersonName].forEach((value) => {
      const key = employeeKey(value);
      if (key) byKey.set(key, employee);
    });
    const name = normalizeEmployeeBaseName(employee.salespersonName);
    if (name) byName.set(name, employee);
  });
  return { available, byKey, byName };
}
function employeeForRow(row: Pick<SalesRow | BookingRow, "salesperson" | "salespersonCode" | "salespersonName"> & { employeeCode?: string }, directory: EmployeeDirectory) {
  const candidates = [row.employeeCode, row.salespersonCode, row.salespersonName, row.salesperson];
  for (const candidate of candidates) {
    const match = directory.byKey.get(employeeKey(candidate)) ?? directory.byName.get(normalizeEmployeeBaseName(String(candidate ?? "")));
    if (match) return match;
  }
  return undefined;
}
function canonicalSalesperson(
  row: Pick<SalesRow | BookingRow, "salesperson" | "salespersonCode" | "salespersonName" | "branch"> & { employeeCode?: string },
  directory: EmployeeDirectory,
  employees: Employee[] = [],
  aliases: CommissionIdentityAlias[] = [],
) {
  const identity = resolveCommissionIdentity(row, employees, aliases);
  if (identity) return identity.name.trim();
  const match = employeeForRow(row, directory);
  return match?.salespersonName.trim() || row.salespersonName?.trim() || row.salesperson?.trim() || row.salespersonCode?.trim() || row.employeeCode?.trim() || "";
}
function isCurrentLiveEmployee(row: Pick<SalesRow | BookingRow, "salesperson" | "salespersonCode" | "salespersonName" | "branch"> & { employeeCode?: string }, directory: EmployeeDirectory, inactiveNames: Set<string>, employees: Employee[], aliases: CommissionIdentityAlias[] = []) {
  if (directory.available) return Boolean(employeeForRow(row, directory)) || Boolean(resolveCommissionIdentity(row, employees, aliases));
  // When no Master Data rows exist, retain the approved legacy explicit
  // "(out)" marker rule; a transaction alone is not treated as a new identity.
  return isCurrentEmployee(row.salesperson, inactiveNames);
}
function canonicalBranch(value: string) { return operationalShowroomForBranch(value)?.code ?? value.trim(); }
function years(filters: FilterState) { return filters.year.map(Number).filter(Number.isFinite); }
function months(filters: FilterState) { return filters.month.map((month) => MONTHS.indexOf(month) + 1).filter((month) => month > 0); }
function matchesFilters(row: Pick<SourceRow, "year" | "month" | "branch" | "salesperson">, filters: FilterState) { const selectedYears = years(filters); const selectedMonths = months(filters); return (!selectedYears.length || (row.year !== null && selectedYears.includes(row.year))) && (!selectedMonths.length || (row.month !== null && selectedMonths.includes(row.month))) && (!filters.branch.length || filters.branch.includes(row.branch)) && (!filters.salesperson.length || filters.salesperson.includes(row.salesperson)); }
function selectedPeriodTitle(filters: FilterState) {
  if (filters.month.length === 1) return `${filters.month[0]}${filters.year.length === 1 ? ` ${filters.year[0]}` : ""}`;
  if (filters.month.length > 1) return `${filters.month.length} Months${filters.year.length === 1 ? ` · ${filters.year[0]}` : ""}`;
  if (filters.year.length === 1) return filters.year[0];
  return "Selected Period";
}
function selectedPeriodLabel(filters: FilterState) { const year = filters.year.length === 1 ? filters.year[0] : filters.year.length ? `${filters.year.length} years` : "All years"; const month = filters.month.length === 1 ? filters.month[0] : filters.month.length ? `${filters.month.length} months` : "All months"; return `${month} · ${year}`; }
function selectedPeriodRange(filters: FilterState, rows: SourceRow[]) {
  const selectedYears = years(filters);
  const selectedMonths = months(filters);
  if (selectedYears.length === 1) {
    const firstMonth = selectedMonths.length ? Math.min(...selectedMonths) : 1;
    const lastMonth = selectedMonths.length ? Math.max(...selectedMonths) : 12;
    const first = new Date(Date.UTC(selectedYears[0], firstMonth - 1, 1)).toISOString();
    const last = new Date(Date.UTC(selectedYears[0], lastMonth, 0)).toISOString();
    return `${formatDate(first)} – ${formatDate(last)}`;
  }
  const dates = rows.map((row) => row.date).filter(Boolean).sort();
  if (dates.length) return `${formatDate(dates[0])} – ${formatDate(dates.at(-1) ?? dates[0])}`;
  return selectedPeriodLabel(filters);
}
function getBranchTrend(rows: SalesRow[]): BranchTrendPoint[] {
  const periods = new Map<string, { year: number; month: number; sales: number; salesAvailable: boolean; gp: number; gpAvailable: boolean }>();
  rows.forEach((row) => {
    if (row.year === null || row.month === null || row.month < 1 || row.month > 12) return;
    const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
    const period = periods.get(key) ?? { year: row.year, month: row.month, sales: 0, salesAvailable: true, gp: 0, gpAvailable: true };
    period.sales += row.finalReceived ?? 0;
    period.salesAvailable = period.salesAvailable && row.finalReceived !== null;
    period.gp += row.gp1 ?? 0;
    period.gpAvailable = period.gpAvailable && row.gp1 !== null;
    periods.set(key, period);
  });
  const sorted = [...periods.values()].sort((left, right) => left.year - right.year || left.month - right.month);
  const includeYear = new Set(sorted.map((period) => period.year)).size > 1;
  return sorted.map((period) => ({
    key: `${period.year}-${period.month}`,
    label: includeYear ? `${MONTHS[period.month - 1]} ${period.year}` : MONTHS[period.month - 1],
    sales: period.salesAvailable ? period.sales : null,
    gp: period.gpAvailable ? period.gp : null,
  }));
}
function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-[var(--text-secondary)] ring-inset",
        large
          ? "size-24 bg-[var(--brand-50)] text-xl shadow-[0_8px_20px_rgba(28,25,23,0.08)] ring-2 ring-[var(--surface-default)] ring-offset-2 ring-offset-[var(--surface-default)]"
          : "size-11 bg-[var(--surface-muted)] text-[11px] ring-1 ring-[var(--border-default)]",
      )}
      aria-label={`${name} photo placeholder`}
    >
      {initials(name)}
    </span>
  );
}

function MultiSelectFilter({ label, options, values, onChange }: { label: string; options: string[]; values: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visible = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));
  const labelValue = values.length === 0 ? "All" : values.length === 1 ? values[0] : `${values.length} selected`;
  const controlId = `team-${label.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <div className="relative min-w-0">
      <label
        htmlFor={controlId}
        className="mb-1.5 block text-xs font-medium leading-4 text-[var(--text-secondary)]"
      >
        {label}
      </label>
      <button
        id={controlId}
        type="button"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-left text-sm font-medium text-[var(--text-primary)] shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--text-disabled)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        aria-label={`${label} filter`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{labelValue}</span>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <Card
          className="absolute left-0 right-0 top-[68px] z-50 rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-elevated)] p-2 shadow-[var(--shadow-floating)]"
          role="listbox"
          aria-label={`${label} options`}
          aria-multiselectable="true"
        >
          <div className="relative mb-2">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
              className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-subtle)] pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--brand-500)] focus:bg-[var(--surface-default)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              placeholder={`Search ${label.toLowerCase()}`}
              aria-label={`Search ${label.toLowerCase()}`}
            />
          </div>
          <div className="max-h-52 space-y-1 overflow-y-auto">
            {visible.map((option) => (
              <label
                key={option}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--brand-50)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)]"
              >
                <input
                  type="checkbox"
                  checked={values.includes(option)}
                  onChange={() =>
                    onChange(
                      values.includes(option)
                        ? values.filter((item) => item !== option)
                        : [...values, option],
                    )
                  }
                  className="size-4 accent-[var(--brand-500)]"
                />
                <span className="truncate">{option}</span>
              </label>
            ))}
            {!visible.length && (
              <p className="px-2 py-4 text-center text-sm text-[var(--text-tertiary)]">
                No options found
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function TeamFilters({ filters, options, onChange, onRefresh, onReset, onExport }: { filters: FilterState; options: FilterState; onChange: (key: FilterKey, values: string[]) => void; onRefresh: () => void; onReset: () => void; onExport: () => void }) {
  const actionClass =
    "h-11 min-w-11 rounded-[var(--radius-control-lg)] border-[var(--border-default)] px-4 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

  return (
    <FilterBar
      actions={
        <>
          <Button className={actionClass} variant="outline" onClick={onReset}>
            <RotateCcw size={16} aria-hidden="true" />
            Reset
          </Button>
          <Button className={actionClass} variant="outline" onClick={onRefresh}>
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
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
        label="Showroom"
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

function trendPath(values: number[], max: number) {
  const left = 16;
  const right = 304;
  const top = 10;
  const bottom = 98;
  return values.map((value, index) => {
    const x = left + ((right - left) * index) / Math.max(values.length - 1, 1);
    const y = bottom - ((value / max) * (bottom - top));
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function BranchTrendChart({ showroomName, currency, points }: { showroomName: string; currency: string; points: BranchTrendPoint[] }) {
  if (!points.length) {
    return <div className="grid min-h-[146px] place-items-center rounded-[var(--radius-control-lg)] bg-[var(--surface-subtle)] px-4 text-center text-xs text-[var(--text-tertiary)]">Trend data is not available for this view.</div>;
  }
  const salesAvailable = points.every((point): point is BranchTrendPoint & { sales: number } => point.sales !== null);
  const gpAvailable = points.every((point): point is BranchTrendPoint & { gp: number } => point.gp !== null);
  const salesMax = Math.max(...points.map((point) => point.sales ?? 0), 1);
  const gpMax = Math.max(...points.map((point) => point.gp ?? 0), 1);
  const salesPath = salesAvailable ? trendPath(points.map((point) => point.sales ?? 0), salesMax) : "";
  const gpPath = gpAvailable ? trendPath(points.map((point) => point.gp ?? 0), gpMax) : "";
  const x = (index: number) => 16 + (288 * index) / Math.max(points.length - 1, 1);
  const ySales = (value: number) => 98 - ((value / salesMax) * 88);
  const yGp = (value: number) => 98 - ((value / gpMax) * 88);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] text-[var(--text-tertiary)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-[var(--chart-current)]" aria-hidden="true" />Sales ({currency})</span>
        {gpAvailable ? <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-[var(--text-tertiary)]" aria-hidden="true" />GP</span> : <span>GP unavailable</span>}
      </div>
      <svg viewBox="0 0 320 124" className="h-[132px] w-full" role="img" aria-label={`${showroomName} sales and gross profit trend`}>
        <line x1="16" x2="304" y1="98" y2="98" stroke="var(--divider)" strokeWidth="1" />
        <line x1="16" x2="304" y1="54" y2="54" stroke="var(--divider)" strokeWidth="1" strokeDasharray="2 4" />
        {salesAvailable && <path d={salesPath} fill="none" stroke="var(--chart-current)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {gpAvailable && <path d={gpPath} fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" />}
        {points.map((point, index) => <g key={point.key}>{salesAvailable && <circle cx={x(index)} cy={ySales(point.sales ?? 0)} r="3.5" fill="var(--surface-default)" stroke="var(--chart-current)" strokeWidth="2" />}{gpAvailable && <circle cx={x(index)} cy={yGp(point.gp ?? 0)} r="3" fill="var(--surface-default)" stroke="var(--text-tertiary)" strokeWidth="1.7" />}</g>)}
      </svg>
      <div className="grid grid-flow-col auto-cols-fr gap-1 text-center text-[10px] text-[var(--text-tertiary)]">{points.map((point) => <span key={point.key} className="truncate">{point.label}</span>)}</div>
    </div>
  );
}

function ShowroomManager({ manager }: { manager: BranchManager }) {
  return (
    <div className="flex items-center gap-3 border-t border-[var(--divider)] pt-3">
      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] text-[var(--text-tertiary)]" aria-hidden="true">
        {manager ? <Avatar name={manager.name} /> : <UserRound size={17} strokeWidth={1.8} />}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Showroom Manager</p>
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{manager?.name ?? "N/A"}</p>
        {manager?.position && <p className="truncate text-xs text-[var(--text-secondary)]">{manager.position}</p>}
      </div>
    </div>
  );
}

function ShowroomMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="truncate text-[11px] font-medium text-[var(--text-tertiary)]">{label}</p><p className="kmm-tabular mt-1 truncate text-base font-bold leading-5 text-[var(--text-primary)]">{value}</p></div>;
}

function TeamSummary({ items, currency }: { items: BranchMetric[]; currency: string }) {
  const legend = <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]"><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-[var(--chart-current)]" aria-hidden="true" />Sales ({currency})</span><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-[var(--text-tertiary)]" aria-hidden="true" />GP ({currency})</span></div>;
  return <section className="space-y-4" aria-label="Team Summary"><SectionHeader title="Team Summary" description="Showroom performance overview for the selected period." action={legend} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => { const salesPerPerson = item.people.length && item.salesValue !== null ? formatCurrency(item.salesValue / item.people.length, currency) : "N/A"; const bookingPerPerson = item.bookingPerPerson === null ? null : formatNumber(item.bookingPerPerson); return <Card key={item.code} className="flex h-full min-h-[420px] flex-col rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-4 shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--text-disabled)] hover:shadow-[var(--shadow-hover)] sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control-lg)] bg-[var(--brand-50)] text-[var(--brand-600)]" aria-hidden="true"><Building2 size={19} strokeWidth={1.8} /></span><div className="min-w-0"><h3 className="truncate text-base font-bold text-[var(--text-primary)]">{item.code}</h3><p className="truncate text-sm text-[var(--text-secondary)]">{item.name}</p></div></div><Badge variant="success" className="shrink-0">{item.people.length} active</Badge></div><div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4"><ShowroomMetric label="Sales" value={formatCurrency(item.salesValue, currency)} /><ShowroomMetric label="GP" value={formatCurrency(item.gp, currency)} /><ShowroomMetric label="GP%" value={item.gpPercent === null ? "N/A" : `${item.gpPercent.toFixed(1)}%`} /><ShowroomMetric label="Sales / Person" value={salesPerPerson} />{bookingPerPerson !== null && <div className="col-span-2 sm:col-span-4"><ShowroomMetric label="Booking / Person" value={bookingPerPerson} /></div>}</div><div className="mt-5"><BranchTrendChart showroomName={item.name} currency={currency} points={item.trend} /></div><div className="mt-auto pt-4"><ShowroomManager manager={item.manager} /></div></Card>; })}</div></section>;
}
function Metric({ label, value }: { label: string; value: ReactNode }) { return <div className="min-w-0"><p className="text-xs text-[var(--text-tertiary)]">{label}</p><p className="kmm-tabular mt-1 break-words font-semibold leading-5 text-[var(--text-primary)]" title={typeof value === "string" ? value : undefined}>{value}</p></div>; }
function CardMetric({ label, value, icon, full = false }: { label: string; value: ReactNode; icon?: ReactNode; full?: boolean }) { const displayValue = value === "N/A" ? "—" : value; return <div className={cn("min-w-0", full && "col-span-2")}><div className="flex items-center gap-1.5 text-[11px] font-medium leading-4 text-[var(--text-tertiary)]">{icon && <span className="text-[var(--brand-600)]" aria-hidden="true">{icon}</span>}<span>{label}</span></div><p className="kmm-tabular mt-0.5 truncate text-[17px] font-bold leading-5 text-[var(--text-primary)]" title={typeof displayValue === "string" ? displayValue : undefined}>{displayValue}</p></div>; }
function DrawerMetric({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) { return <div className="min-w-0 rounded-[var(--radius-control-lg)] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3"><div className="flex items-center gap-1.5 text-[11px] font-medium leading-4 text-[var(--text-tertiary)]">{icon && <span className="text-[var(--brand-600)]" aria-hidden="true">{icon}</span>}<span>{label}</span></div><p className="kmm-tabular mt-1 break-words text-base font-bold leading-5 text-[var(--text-primary)]">{value}</p></div>; }
function metricValue(person: Person, rankBy: RankingMetric) { return rankBy === "salesUnit" ? person.salesUnit : rankBy === "salesValue" ? person.salesValue : rankBy === "gp" ? person.gp : rankBy === "gpPercent" ? ratio(person.gp, person.salesValue) : rankBy === "commission" ? person.commission : ratio(person.commission, person.gp); }
function rankPeople(people: Person[], rankBy: RankingMetric) { return [...people].sort((left, right) => { const difference = (metricValue(right, rankBy) ?? Number.NEGATIVE_INFINITY) - (metricValue(left, rankBy) ?? Number.NEGATIVE_INFINITY); return difference || left.name.localeCompare(right.name); }).map((person, index) => ({ ...person, rank: index + 1 })); }
function RankingControls({ rankBy, onRankByChange, view, onViewChange }: { rankBy: RankingMetric; onRankByChange: (value: RankingMetric) => void; view: RankingView; onViewChange: (value: RankingView) => void }) {
  return <div className="flex flex-wrap items-center gap-2"><label className="flex min-h-11 items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">Rank by<select aria-label="Rank by" value={rankBy} onChange={(event) => onRankByChange(event.target.value as RankingMetric)} className="h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--brand-500)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><option value="salesUnit">Sales Unit</option><option value="salesValue">Sales Value</option><option value="gp">GP Value</option><option value="gpPercent">GP %</option><option value="commission">Commission</option><option value="commissionOfGp">Commission / GP %</option></select></label><div className="inline-flex min-h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-1" role="group" aria-label="Ranking view"><button type="button" aria-pressed={view === "table"} onClick={() => onViewChange("table")} className={cn("min-h-9 rounded-[calc(var(--radius-control)-2px)] px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", view === "table" ? "bg-[var(--surface-default)] text-[var(--text-primary)] shadow-[var(--shadow-card)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>Table</button><button type="button" aria-pressed={view === "cards"} onClick={() => onViewChange("cards")} className={cn("min-h-9 rounded-[calc(var(--radius-control)-2px)] px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", view === "cards" ? "bg-[var(--brand-500)] text-[var(--text-primary)] shadow-[var(--shadow-card)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>Cards</button></div></div>;
}
function RankingMetricCell({ person, metric }: { person: Person; metric: "gpPercent" | "commissionOfSales" | "commissionOfGp" }) { const value = metric === "gpPercent" ? ratio(person.gp, person.salesValue) : metric === "commissionOfSales" ? ratio(person.commission, person.salesValue) : ratio(person.commission, person.gp); return value === null ? "N/A" : `${value.toFixed(1)}%`; }
function BulkPhotoImportButton() {
  return <button type="button" disabled aria-describedby="photo-schema-missing" title="Photo import is unavailable until photo_url schema and storage/API approval" className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--text-disabled)] opacity-70">Bulk Import Photos</button>;
}
function SalespersonCard({ person, currency, onSelect }: { person: Person; currency: string; onSelect: (person: Person) => void }) {
  return <article role="button" tabIndex={0} aria-label={`Open ${person.name} employee detail`} onClick={() => onSelect(person)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(person); } }} className="group flex h-full min-h-[300px] cursor-pointer flex-col rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-4 shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--text-disabled)] hover:shadow-[var(--shadow-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:p-5"><div className="flex items-start justify-between gap-3"><span aria-label={`Rank ${person.rank}`} className="grid size-8 place-items-center rounded-full bg-[var(--brand-500)] text-sm font-bold text-[var(--text-primary)]">{person.rank}</span><Badge variant={person.status === "active" ? "success" : "outline"} className="shrink-0">{person.status === "active" ? "Active" : "Inactive / Historical"}</Badge></div><div className="mt-2 flex flex-col items-center text-center"><Avatar name={person.name} large /><p className="mt-2 w-full truncate text-lg font-bold leading-6 text-[var(--text-primary)]" title={person.name}>{person.name}</p>{person.position && <p className="mt-0.5 w-full truncate text-xs font-medium text-[var(--text-secondary)]">{person.position}</p>}<p className="mt-1 w-full truncate text-xs text-[var(--text-secondary)]">Showroom · {person.branch || "—"}</p></div><div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--divider)] pt-3"><CardMetric label="Sales Unit" value={formatNumber(person.salesUnit)} icon={<BarChart3 size={15} strokeWidth={1.8} />} /><CardMetric label="Sales Value" value={formatCurrency(person.salesValue, currency)} icon={<CircleDollarSign size={15} strokeWidth={1.8} />} /><CardMetric label="GP Value" value={formatCurrency(person.gp, currency)} icon={<BadgeDollarSign size={15} strokeWidth={1.8} />} /><CardMetric label="GP %" value={<RankingMetricCell person={person} metric="gpPercent" />} icon={<Percent size={14} strokeWidth={1.8} />} /><CardMetric label="Commission" value={formatCurrency(person.commission, currency)} icon={<CircleDollarSign size={15} strokeWidth={1.8} />} full /></div></article>;
}
function TopSalespeople({ ranked, onSelect, currency, periodLabel, rankBy, onRankByChange, view, onViewChange }: { ranked: Person[]; onSelect: (person: Person) => void; currency: string; periodLabel: string; rankBy: RankingMetric; onRankByChange: (value: RankingMetric) => void; view: RankingView; onViewChange: (value: RankingView) => void }) {
  const controls = <RankingControls rankBy={rankBy} onRankByChange={onRankByChange} view={view} onViewChange={onViewChange} />;
  const description = <div className="flex flex-wrap items-center gap-2"><span>Current employees only · Select a row or card for detail.</span><Badge variant="outline" className="gap-1.5"><UsersRound size={14} aria-hidden="true" />{ranked.length} employees</Badge></div>;
  return <section className="space-y-4"><SectionHeader title="Top Salespeople" description={description} action={<div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto"><span aria-label="Selected period" className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-2.5 text-xs font-medium text-[var(--text-secondary)]"><CalendarDays size={14} aria-hidden="true" />{periodLabel}</span>{controls}<BulkPhotoImportButton /></div>} /><p id="photo-schema-missing" className="sr-only">PHOTO_SCHEMA_MISSING: photo upload and bulk import are unavailable until a canonical photo_url schema and storage/API boundary are approved.</p>{view === "cards" ? <div aria-label="Salespeople cards" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{ranked.map((person) => <SalespersonCard key={person.id} person={person} currency={currency} onSelect={onSelect} />)}</div> : <TableCard title="Salespeople Ranking" empty={!ranked.length}><div className="overflow-x-auto rounded-[var(--radius-control-lg)] border border-[var(--border-subtle)]"><table className="kmm-tabular min-w-[1280px] w-full text-left text-xs"><thead className="bg-[var(--surface-subtle)] text-[var(--text-secondary)]"><tr><th rowSpan={2} className="px-3 py-3 font-semibold">Rank</th><th rowSpan={2} className="px-3 py-3 font-semibold">Photo</th><th rowSpan={2} className="px-3 py-3 font-semibold">Name</th><th rowSpan={2} className="px-3 py-3 font-semibold">Showroom</th><th colSpan={2} className="border-l border-[var(--divider)] px-3 py-2 text-center font-semibold">Sales</th><th colSpan={2} className="border-l border-[var(--divider)] px-3 py-2 text-center font-semibold">GP</th><th colSpan={3} className="border-l border-[var(--divider)] px-3 py-2 text-center font-semibold">Commission</th></tr><tr><th className="border-l border-[var(--divider)] px-3 py-2 font-semibold">Unit</th><th className="px-3 py-2 font-semibold">Value</th><th className="border-l border-[var(--divider)] px-3 py-2 font-semibold">Value</th><th className="px-3 py-2 font-semibold">GP %</th><th className="border-l border-[var(--divider)] px-3 py-2 font-semibold">Value</th><th className="px-3 py-2 font-semibold">% of Sales</th><th className="px-3 py-2 font-semibold">% of GP</th></tr></thead><tbody className="divide-y divide-[var(--divider)] text-[var(--text-secondary)]">{ranked.map((person) => { const commissionOfGp = ratio(person.commission, person.gp); const commissionTone = commissionOfGp === null ? "text-[var(--text-secondary)]" : commissionOfGp <= 20 ? "text-[var(--status-success)]" : commissionOfGp <= 30 ? "text-[var(--brand-600)]" : "text-[var(--status-danger)]"; return <tr key={person.id} className="h-12 cursor-pointer transition-colors hover:bg-[var(--brand-50)] focus-visible:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]" onClick={() => onSelect(person)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(person); } }} tabIndex={0} aria-label={`View ${person.name} details`}><td className="px-3 py-2 font-semibold text-[var(--text-tertiary)]">{person.rank}</td><td className="px-3 py-2"><Avatar name={person.name} /></td><td className="px-3 py-2 font-semibold text-[var(--text-primary)]">{person.name}</td><td className="px-3 py-2">{person.branch}</td><td className="border-l border-[var(--divider)] px-3 py-2 text-right font-semibold">{formatNumber(person.salesUnit)}</td><td className="px-3 py-2 text-right font-semibold">{formatCurrency(person.salesValue, currency)}</td><td className="border-l border-[var(--divider)] px-3 py-2 text-right font-semibold">{formatCurrency(person.gp, currency)}</td><td className="px-3 py-2 text-right font-semibold"><RankingMetricCell person={person} metric="gpPercent" /></td><td className="border-l border-[var(--divider)] px-3 py-2 text-right font-semibold">{formatCurrency(person.commission, currency)}</td><td className="px-3 py-2 text-right"><RankingMetricCell person={person} metric="commissionOfSales" /></td><td className={cn("px-3 py-2 text-right font-semibold", commissionTone)}><RankingMetricCell person={person} metric="commissionOfGp" /></td></tr>; })}</tbody></table></div></TableCard>}</section>;
}

function EmployeeDetailDrawer({ person, rows, currency, onClose }: { person: Person | null; rows: SalesRow[]; currency: string; onClose: () => void }) {
  const [trendMode, setTrendMode] = useState<"unit" | "value">("unit");

  useEffect(() => {
    if (!person) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [person, onClose]);

  if (!person) return null;

  const months = MONTHS.map((label, index) => {
    const monthRows = rows.filter((row) => row.month === index + 1);
    const kpis = getSalesKpis(monthRows);
    return { label, unit: kpis.salesUnit, value: kpis.salesValue ?? 0 };
  });
  const trendValues = months.map((item) => trendMode === "unit" ? item.unit : item.value);
  const peak = Math.max(...trendValues, 1);
  const recentSales = [...rows].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 5);
  const profile = [
    ["Employee ID", "N/A"],
    ["Employee Code", person.employeeCode ?? "N/A"],
    ["Salesperson Code", person.salespersonCode ?? "N/A"],
    ["Position", person.position ?? "N/A"],
    ["Showroom", person.branch],
    ["Branch", "N/A"],
    ["Territory", person.territory ?? "N/A"],
    ["Phone", person.phone ?? "N/A"],
    ["Email", person.email ?? "N/A"],
    ["Joined Date", formatDate(person.joinedDate)],
  ].filter(([, value]) => value !== "");

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/25"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-detail-title"
        className="ml-auto flex h-full w-full max-w-[28rem] flex-col overflow-y-auto border-l border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-floating)]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--divider)] bg-[var(--surface-default)] p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={person.name} large />
            <div className="min-w-0">
              <p className="truncate text-xl font-bold leading-6 text-[var(--text-primary)]" id="employee-detail-title">
                {person.name}
              </p>
              <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">{person.branch}</p>
              <Badge variant={person.status === "active" ? "success" : "outline"} className="mt-2">
                {person.status === "active" ? "Active" : "Inactive / Historical"}
              </Badge>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Employee Detail"
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <section aria-labelledby="employee-profile-heading">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="employee-profile-heading" className="text-sm font-semibold text-[var(--text-primary)]">
                  Profile
                </h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Verified identity fields only.</p>
              </div>
              <div className="text-right">
                <Avatar name={person.name} />
                <button
                  type="button"
                  disabled
                  aria-describedby="photo-schema-missing"
                  title="Photo upload is unavailable until photo_url schema and storage/API approval"
                  className="mt-2 min-h-10 rounded-[var(--radius-control)] border border-[var(--border-default)] px-3 text-xs font-semibold text-[var(--text-disabled)] opacity-70"
                >
                  Upload Photo
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              {profile.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
              <Metric label="Status" value={person.status === "active" ? "Active" : "Inactive / Historical"} />
            </div>
          </section>

          <section aria-labelledby="employee-performance-heading">
            <h3 id="employee-performance-heading" className="text-sm font-semibold text-[var(--text-primary)]">
              Performance Summary
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <DrawerMetric label="Rank" value={"#" + person.rank} />
              <DrawerMetric label="Sales Unit" value={formatNumber(person.salesUnit)} icon={<BarChart3 size={15} strokeWidth={1.8} />} />
              <DrawerMetric label="Sales Value" value={formatCurrency(person.salesValue, currency)} icon={<CircleDollarSign size={15} strokeWidth={1.8} />} />
              <DrawerMetric label="GP Value" value={formatCurrency(person.gp, currency)} icon={<BadgeDollarSign size={15} strokeWidth={1.8} />} />
              <DrawerMetric label="GP %" value={ratio(person.gp, person.salesValue) === null ? "N/A" : String(ratio(person.gp, person.salesValue)?.toFixed(1)) + "%"} icon={<Percent size={14} strokeWidth={1.8} />} />
              <DrawerMetric label="Commission" value={formatCurrency(person.commission, currency)} icon={<CircleDollarSign size={15} strokeWidth={1.8} />} />
              <DrawerMetric label="Commission % of Sales" value={ratio(person.commission, person.salesValue) === null ? "N/A" : String(ratio(person.commission, person.salesValue)?.toFixed(1)) + "%"} icon={<Percent size={14} strokeWidth={1.8} />} />
              <DrawerMetric label="Commission / GP" value={ratio(person.commission, person.gp) === null ? "N/A" : String(ratio(person.commission, person.gp)?.toFixed(1)) + "%"} icon={<Percent size={14} strokeWidth={1.8} />} />
              <DrawerMetric label="Target Unit" value={person.target === null ? "N/A" : formatNumber(person.target)} />
              <DrawerMetric label="Achievement" value={person.achievement === null ? "N/A" : String(person.achievement.toFixed(1)) + "%"} />
            </div>
          </section>

          <section aria-labelledby="employee-trend-heading">
            <div className="flex items-center justify-between gap-3">
              <h3 id="employee-trend-heading" className="text-sm font-semibold text-[var(--text-primary)]">
                Monthly Sales Trend
              </h3>
              <div className="inline-flex rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-1" role="group" aria-label="Sales trend metric">
                <button type="button" aria-pressed={trendMode === "unit"} onClick={() => setTrendMode("unit")} className={cn("min-h-9 rounded px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", trendMode === "unit" ? "bg-[var(--surface-default)] text-[var(--text-primary)] shadow-[var(--shadow-card)]" : "text-[var(--text-secondary)]")}>
                  Unit
                </button>
                <button type="button" aria-pressed={trendMode === "value"} onClick={() => setTrendMode("value")} className={cn("min-h-9 rounded px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", trendMode === "value" ? "bg-[var(--surface-default)] text-[var(--text-primary)] shadow-[var(--shadow-card)]" : "text-[var(--text-secondary)]")}>
                  Value
                </button>
              </div>
            </div>
            {rows.length ? (
              <div className="mt-3 flex h-32 items-end gap-0.5 border-b border-[var(--divider)] pb-1">
                {months.map((item, index) => (
                  <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="kmm-tabular text-[9px] text-[var(--text-secondary)]">{trendValues[index] ? formatCompact(trendValues[index]) : ""}</span>
                    <span className="w-full rounded-t bg-[var(--brand-500)]" style={{ height: String(trendValues[index] ? Math.max(8, (trendValues[index] / peak) * 84) : 2) + "px" }} />
                    <span className="text-[9px] text-[var(--text-tertiary)]">{item.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-[var(--radius-control)] bg-[var(--surface-subtle)] p-4 text-sm text-[var(--text-secondary)]">
                Sales trend data is not available for this view.
              </p>
            )}
          </section>

          <section aria-labelledby="employee-recent-sales-heading">
            <h3 id="employee-recent-sales-heading" className="text-sm font-semibold text-[var(--text-primary)]">
              Recent Sales (Top 5)
            </h3>
            {recentSales.length ? (
              <div className="mt-3 overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border-subtle)]">
                <table className="kmm-tabular min-w-[380px] w-full text-left text-xs">
                  <thead className="bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-2.5 py-2.5 font-semibold">Date</th>
                      <th className="px-2.5 py-2.5 font-semibold">Product</th>
                      <th className="px-2.5 py-2.5 font-semibold">Model</th>
                      <th className="px-2.5 py-2.5 text-right font-semibold">Unit</th>
                      <th className="px-2.5 py-2.5 text-right font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--divider)]">
                    {recentSales.map((row, index) => (
                      <tr key={row.date + "-" + row.model + "-" + index}>
                        <td className="px-2.5 py-2.5 text-[var(--text-secondary)]">{formatDate(row.date)}</td>
                        <td className="px-2.5 py-2.5 text-[var(--text-secondary)]">{row.productType || "N/A"}</td>
                        <td className="max-w-[140px] truncate px-2.5 py-2.5 font-medium text-[var(--text-primary)]" title={row.model}>{row.model || "N/A"}</td>
                        <td className="px-2.5 py-2.5 text-right text-[var(--text-secondary)]">{formatNumber(row.quantity ?? 0)}</td>
                        <td className="px-2.5 py-2.5 text-right font-semibold text-[var(--text-primary)]">{formatCurrency(row.finalReceived, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 rounded-[var(--radius-control)] bg-[var(--surface-subtle)] p-4 text-sm text-[var(--text-secondary)]">
                Recent sales data is not available for this view.
              </p>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function exportPeople(people: Person[], companyCode: string) { const headings = ["Rank", "Name", "Showroom", "Sales", "GP", "Booking", "Achievement %"]; const rows = people.map((person) => [String(person.rank), person.name, person.branch, String(person.salesUnit), String(person.gp), String(person.booking), person.achievement === null ? "N/A" : person.achievement.toFixed(1)]); const csv = [headings, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${companyCode.toLowerCase()}-team.csv`; anchor.click(); URL.revokeObjectURL(url); }

export function SalesOrganizationPage() {
  const { t } = useLocale();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? "";
  const companyCode = selectedCompany?.code ?? "KMM";
  const currency = selectedCompany?.currency ?? "MMK";
  const [filters, setFilters] = useState<FilterState>(defaultFilters); const [data, setData] = useState<DashboardData | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null); const [rankBy, setRankBy] = useState<RankingMetric>("salesValue"); const [rankingView, setRankingView] = useState<RankingView>("table");
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [salesPayload, operationalPayload] = await Promise.all([
        loadLiveSalesData({ allowFallback: false, companyId }),
        loadLiveOperationalData({ allowFallback: false, companyId }),
      ]);
      const employees = salesPayload.employees ?? [];
      const aliases = salesPayload.salespersonIdentityAliases ?? [];
      const directory = makeEmployeeDirectory(
        employees,
        salesPayload.employeeMasterAvailable === true,
      );
      const sales = salesPayload.sales.map((row) => ({
        ...row,
        branch: canonicalBranch(row.branch),
        salesperson: canonicalSalesperson(row, directory, employees, aliases),
      }));
      const booking = operationalPayload.booking.map((row) => ({
        ...row,
        branch: canonicalBranch(row.branch),
        salesperson: canonicalSalesperson(row, directory, employees, aliases),
      }));
      setData({
        meta: { sourceUpdatedAt: salesPayload.meta.sourceUpdatedAt },
        plan: salesPayload.plan,
        sales,
        booking,
        employees,
        salespersonIdentityAliases: aliases,
        employeeMasterAvailable: directory.available,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load live team data");
    } finally {
      setLoading(false);
    }
  }, [companyId]);
  useEffect(() => {
    queueMicrotask(() => { void loadData(); });
    const refresh = () => { void loadData(); };
    window.addEventListener("kmm:sales-imported", refresh);
    return () => window.removeEventListener("kmm:sales-imported", refresh);
  }, [loadData]);
  const employeeDirectory = useMemo(() => makeEmployeeDirectory(data?.employees ?? [], data?.employeeMasterAvailable === true), [data]);
  const inactiveNames = useMemo(() => new Set((data?.sales ?? []).filter((row) => isInactiveEmployeeName(row.salesperson)).map((row) => normalizeEmployeeBaseName(row.salesperson))), [data]);
  const filteredSales = useMemo(() => (data?.sales ?? []).filter((row) => matchesFilters(row, filters)), [data, filters]);
  const activeSales = useMemo(() => filteredSales.filter((row) => isCurrentLiveEmployee(row, employeeDirectory, inactiveNames, data?.employees ?? [], data?.salespersonIdentityAliases ?? [])), [filteredSales, employeeDirectory, inactiveNames, data?.employees, data?.salespersonIdentityAliases]);
  const filteredBooking = useMemo(() => (data?.booking ?? []).filter((row) => matchesFilters(row, filters)).filter((row) => isCurrentLiveEmployee(row, employeeDirectory, inactiveNames, data?.employees ?? [], data?.salespersonIdentityAliases ?? [])), [data, filters, employeeDirectory, inactiveNames]);
  const bookingSourceAvailable = Boolean(data?.booking.length);
  const people = useMemo<Person[]>(() => {
    const employees = data?.employees ?? [];
    const aliases = data?.salespersonIdentityAliases ?? [];
    const groups = new Map<string, { name: string; rows: SalesRow[]; employeeCode: string | null; salespersonCode: string | null }>();
    activeSales.forEach((row) => {
      const identity = resolveCommissionIdentity(row, employees, aliases);
      if (!identity) return;
      const group = groups.get(identity.key) ?? { name: identity.name, rows: [], employeeCode: identity.employeeCode, salespersonCode: identity.salespersonCode };
      group.rows.push(row);
      groups.set(identity.key, group);
    });
    return [...groups.entries()].map(([id, group]) => {
      const { rows, name } = group;
      const branch = [...new Set(rows.map((row) => row.branch).filter(Boolean))].sort((left, right) => rows.filter((row) => row.branch === right).length - rows.filter((row) => row.branch === left).length)[0] ?? "N/A";
      const kpis = getSalesKpis(rows);
      const commission = rows.length && rows.every((row) => row.commission !== null) ? sum(rows, (row) => row.commission ?? 0) : null;
      const booking = filteredBooking.filter((row) => resolveCommissionIdentity(row, employees, aliases)?.key === id).length;
      return {
        id,
        name,
        branch,
        salesUnit: kpis.salesUnit,
        salesValue: kpis.salesValue ?? 0,
        gp: kpis.grossProfit ?? 0,
        commission,
        booking,
        target: null,
        achievement: null,
        conversion: booking ? (kpis.salesUnit / booking) * 100 : 0,
        rank: 0,
        employeeCode: group.employeeCode,
        salespersonCode: group.salespersonCode,
        status: "active" as const,
        position: null,
        territory: null,
        phone: null,
        email: null,
        joinedDate: null,
      };
    }).sort((left, right) => right.salesUnit - left.salesUnit || left.name.localeCompare(right.name));
  }, [activeSales, data?.employees, data?.salespersonIdentityAliases, filteredBooking]);
  const rankedPeople = useMemo(() => rankPeople(people, rankBy), [people, rankBy]);
  const branchDefinitions = useMemo(() => {
    const byCode = new Map(
      (selectedCompany?.branches ?? []).map((branch) => [branch.code, { code: branch.code, name: branch.name }]),
    );
    for (const code of [...activeSales, ...filteredBooking].map((row) => row.branch).filter(Boolean)) {
      if (!byCode.has(code)) {
        byCode.set(code, { code, name: operationalShowroomForBranch(code)?.name ?? code });
      }
    }
    return [...byCode.values()]
      .filter((branch) => !filters.branch.length || filters.branch.includes(branch.code))
      .sort((left, right) => left.code.localeCompare(right.code));
  }, [activeSales, filteredBooking, filters.branch, selectedCompany?.branches]);
  const branchMetrics = useMemo(() => branchDefinitions.map((branch) => { const team = people.filter((person) => person.branch === branch.code); const salesRows = activeSales.filter((row) => row.branch === branch.code); const kpis = getSalesKpis(salesRows); const salesValue = kpis.salesValue; const gp = kpis.grossProfitAvailable ? kpis.grossProfit : null; const booking = filteredBooking.filter((row) => row.branch === branch.code).length; const gpPercent = salesValue !== null && gp !== null && salesValue !== 0 ? (gp / salesValue) * 100 : null; const bookingPerPerson = bookingSourceAvailable && team.length ? booking / team.length : null; return { code: branch.code, name: branch.name, people: team, salesUnit: kpis.salesUnit, salesValue, gp, gpPercent, booking, bookingPerPerson, trend: getBranchTrend(salesRows), manager: null }; }), [people, activeSales, branchDefinitions, filteredBooking, bookingSourceAvailable]);
  const selectedPerson = people.find((person) => person.id === selectedPersonId) ?? null;
  const selectedRankedPerson = selectedPerson ? rankedPeople.find((person) => person.id === selectedPerson.id) ?? selectedPerson : null;
  const selectedRows = selectedRankedPerson ? activeSales.filter((row) => resolveCommissionIdentity(row, data?.employees ?? [], data?.salespersonIdentityAliases ?? [])?.key === selectedRankedPerson.id) : [];
  const previousSalesValue = useMemo(() => { const selectedYears = years(filters); if (selectedYears.length !== 1) return null; const previous = { ...filters, year: [String(selectedYears[0] - 1)] }; const rows = (data?.sales ?? []).filter((row) => matchesFilters(row, previous)).filter((row) => isCurrentLiveEmployee(row, employeeDirectory, inactiveNames, data?.employees ?? [], data?.salespersonIdentityAliases ?? [])); return getSalesKpis(rows).salesValue; }, [data, filters, employeeDirectory, inactiveNames]);
  const activeKpis = getSalesKpis(activeSales); const totalSalesValue = activeKpis.salesValue ?? 0; const totalGp = activeKpis.grossProfitAvailable ? activeKpis.grossProfit : null; const totalGpPercent = totalGp !== null && totalSalesValue !== 0 ? (totalGp / totalSalesValue) * 100 : null; const avgSalesPerPerson = people.length ? totalSalesValue / people.length : null; const salesComparison = previousSalesValue && previousSalesValue !== 0 ? ((totalSalesValue - previousSalesValue) / previousSalesValue) * 100 : null; const periodTitle = selectedPeriodTitle(filters); const periodRange = selectedPeriodRange(filters, activeSales);
  const filterOptions = useMemo(() => { const source = data?.sales ?? []; const matching = source.filter((row) => matchesFilters(row, { ...filters, salesperson: [] })); return { year: [...new Set(source.map((row) => String(row.year)).filter((value) => value !== "null"))].sort((a, b) => Number(b) - Number(a)), month: MONTHS, branch: [...new Set(source.map((row) => row.branch).filter(Boolean))].sort(), salesperson: [...new Set(matching.filter((row) => isCurrentLiveEmployee(row, employeeDirectory, inactiveNames, data?.employees ?? [], data?.salespersonIdentityAliases ?? [])).map((row) => row.salesperson).filter(Boolean))].sort() }; }, [data, filters, employeeDirectory, inactiveNames]);
  function updateFilter(key: FilterKey, values: string[]) { setSelectedPersonId(null); setFilters((current) => ({ ...current, [key]: values, ...(key === "branch" ? { salesperson: [] } : {}) })); }
  return (
    <div className="kmm-sales-organization-page min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6">
          <div className="space-y-5 xl:space-y-6">
            <PageHeader
              title={t("route.team.title")}
              description={t("route.team.subtitle").replaceAll("KMM", companyCode)}
              action={
                data ? (
                  <div className="rounded-[var(--radius-pill)] border border-[var(--border-subtle)] bg-[var(--surface-default)] px-3 py-2 text-right shadow-[var(--shadow-card)]">
                    <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Selected period</p>
                    <p className="kmm-tabular text-sm font-semibold text-[var(--text-primary)]">{periodTitle}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">{periodRange}</p>
                  </div>
                ) : undefined
              }
              data-enterprise-page-header="team"
            />

            <section aria-label="Sales organization filters">
              <TeamFilters
                filters={filters}
                options={filterOptions}
                onChange={updateFilter}
                onRefresh={loadData}
                onReset={() => {
                  setFilters(defaultFilters);
                  setSelectedPersonId(null);
                }}
                onExport={() => exportPeople(people, companyCode)}
              />
            </section>

            {loading && (
              <Card
                className="grid min-h-[320px] place-items-center rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-8 shadow-[var(--shadow-card)]"
                aria-busy="true"
                aria-label="Loading sales organization data"
              >
                <div className="w-full max-w-xl space-y-4">
                  <LoadingSkeleton variant="chart" />
                  <p className="text-center text-sm font-medium text-[var(--text-secondary)]">
                    Loading team data...
                  </p>
                </div>
              </Card>
            )}

            {error && !loading && (
              <Card
                className="grid min-h-[320px] place-items-center rounded-[var(--radius-card)] border-[var(--status-danger)] bg-[var(--surface-default)] p-8 shadow-[var(--shadow-card)]"
                aria-live="assertive"
              >
                <ErrorState message={error} onRetry={loadData} />
              </Card>
            )}

            {data && !loading && !error && (
              <>
                <section
                  aria-label="Organization KPI Overview"
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-3 2xl:gap-4"
                >
                  <KpiCard
                    variant="executive"
                    title="Active Salespeople"
                    value={people.length}
                    unit="People"
                    icon={<UsersRound size={18} strokeWidth={1.8} />}
                    subtitle="Current employees only"
                  />
                  <KpiCard
                    variant="executive"
                    title="Total Sales"
                    value={formatCompact(totalSalesValue)}
                    unit={currency}
                    icon={<CircleDollarSign size={18} strokeWidth={1.8} />}
                    trendValue={
                      salesComparison === null
                        ? undefined
                        : `${salesComparison >= 0 ? "+" : ""}${salesComparison.toFixed(1)}%`
                    }
                    trendDirection={
                      salesComparison === null
                        ? "neutral"
                        : salesComparison >= 0
                          ? "up"
                          : "down"
                    }
                    comparisonLabel={
                      salesComparison === null ? undefined : "vs last year"
                    }
                    status={
                      salesComparison === null
                        ? "neutral"
                        : salesComparison >= 0
                          ? "positive"
                          : "negative"
                    }
                  />
                  <KpiCard
                    variant="executive"
                    title="Total GP"
                    value={totalGp === null ? "N/A" : formatCompact(totalGp)}
                    unit={currency}
                    icon={<BadgeDollarSign size={18} strokeWidth={1.8} />}
                    subtitle={totalGpPercent === null ? "GP% N/A" : `GP% ${totalGpPercent.toFixed(1)}%`}
                  />
                  <KpiCard
                    variant="executive"
                    title="Avg GP %"
                    value={totalGpPercent === null ? "N/A" : `${totalGpPercent.toFixed(1)}%`}
                    icon={<Percent size={18} strokeWidth={1.8} />}
                    subtitle="Total GP / Total Sales"
                  />
                  <KpiCard
                    variant="executive"
                    title="Avg Sales / Person"
                    value={avgSalesPerPerson === null ? "N/A" : formatCompact(avgSalesPerPerson)}
                    unit={currency}
                    icon={<BarChart3 size={18} strokeWidth={1.8} />}
                    subtitle="Total Sales / Active Salespeople"
                  />
                </section>

                <TeamSummary
                  items={branchMetrics}
                  currency={currency}
                />
                <TopSalespeople
                  ranked={rankedPeople}
                  currency={currency}
                  periodLabel={selectedPeriodLabel(filters)}
                  onSelect={(person) => setSelectedPersonId(person.id)}
                  rankBy={rankBy}
                  onRankByChange={setRankBy}
                  view={rankingView}
                  onViewChange={setRankingView}
                />
                <EmployeeDetailDrawer
                  person={selectedRankedPerson}
                  rows={selectedRows}
                  currency={currency}
                  onClose={() => setSelectedPersonId(null)}
                />
              </>
            )}
          </div>
      </main>
    </div>
  );
}
