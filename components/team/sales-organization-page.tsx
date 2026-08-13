"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, RefreshCw, RotateCcw, Search } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { getEngineUnitSalesRows, getSalesKpis, getSalesUnit } from "../../lib/sales/business-service";
import { loadLiveSalesData } from "../../lib/sales/client";
import { resolveCommissionIdentity } from "../../lib/sales/commission-identity";
import { loadLiveOperationalData } from "../../lib/operations/client";
import { operationalShowroomForBranch } from "../../lib/marketing/location-mapping";
import { ChartCard } from "../design-system/chart-card";
import { EmptyState } from "../design-system/empty-state";
import { ErrorState } from "../design-system/error-state";
import { ExportButton } from "../design-system/export-button";
import { FilterBar } from "../design-system/filter-bar";
import { KpiCard } from "../design-system/kpi-card";
import { LoadingSkeleton } from "../design-system/loading-skeleton";
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
type Employee = { employeeCode: string; salespersonCode: string; salespersonName: string };
type DashboardData = { meta: { sourceUpdatedAt: string }; plan: { year: number | null; months: string[]; units: number[] }; sales: SalesRow[]; booking: BookingRow[]; employees: Employee[]; employeeMasterAvailable: boolean };
type Person = { id: string; name: string; branch: string; salesUnit: number; salesValue: number; gp: number; commission: number | null; booking: number; target: number; achievement: number; conversion: number; rank: number };
type RankingMetric = "salesUnit" | "salesValue" | "gp" | "gpPercent" | "commission" | "commissionOfGp";
type BranchMetric = { code: string; name: string; people: Person[]; target: number; salesUnit: number; salesValue: number; gp: number; gpPercent: number | null; booking: number; achievement: number | null; conversion: number | null; health: number | null };
type ShowroomTargetRow = { showroomCode: string; targetUnit: number; year: number; month: number };
type ShowroomAchievementRankingEntry = { showroomCode: string; showroomName: string; salesUnit: number; targetUnit: number | null; achievementPercent: number | null };

const defaultFilters: FilterState = { year: ["2026"], month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], branch: [], salesperson: [] };

function sum<T>(rows: T[], getValue: (row: T) => number) { return rows.reduce((total, row) => total + getValue(row), 0); }
function formatNumber(value: number) { return Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value); }
function formatCompact(value: number) { if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`; if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`; return formatNumber(value); }
function formatCurrency(value: number | null, currency: string) { return value === null ? "N/A" : `${formatCompact(value)} ${currency}`; }
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
function canonicalSalesperson(row: Pick<SalesRow | BookingRow, "salesperson" | "salespersonCode" | "salespersonName"> & { employeeCode?: string }, directory: EmployeeDirectory) {
  const match = employeeForRow(row, directory);
  return match?.salespersonName.trim() || row.salespersonName?.trim() || row.salesperson?.trim() || row.salespersonCode?.trim() || row.employeeCode?.trim() || "";
}
function isCurrentLiveEmployee(row: Pick<SalesRow | BookingRow, "salesperson" | "salespersonCode" | "salespersonName"> & { employeeCode?: string }, directory: EmployeeDirectory, inactiveNames: Set<string>) {
  if (directory.available) return Boolean(employeeForRow(row, directory));
  // When no Master Data rows exist, retain the approved legacy explicit
  // "(out)" marker rule; a transaction alone is not treated as a new identity.
  return isCurrentEmployee(row.salesperson, inactiveNames);
}
function canonicalBranch(value: string) { return operationalShowroomForBranch(value)?.code ?? value.trim(); }
function years(filters: FilterState) { return filters.year.map(Number).filter(Number.isFinite); }
function months(filters: FilterState) { return filters.month.map((month) => MONTHS.indexOf(month) + 1).filter((month) => month > 0); }
function matchesFilters(row: Pick<SourceRow, "year" | "month" | "branch" | "salesperson">, filters: FilterState) { const selectedYears = years(filters); const selectedMonths = months(filters); return (!selectedYears.length || (row.year !== null && selectedYears.includes(row.year))) && (!selectedMonths.length || (row.month !== null && selectedMonths.includes(row.month))) && (!filters.branch.length || filters.branch.includes(row.branch)) && (!filters.salesperson.length || filters.salesperson.includes(row.salesperson)); }
function targetForScope(data: DashboardData, filters: FilterState) { const selectedYears = years(filters); if (selectedYears.length !== 1 || selectedYears[0] !== data.plan.year || filters.branch.length || filters.salesperson.length) return null; const selectedMonths = months(filters); const indexes = selectedMonths.length ? selectedMonths.map((month) => month - 1) : data.plan.months.map((_, index) => index); const target = sum(indexes, (index) => data.plan.units[index] ?? 0); return target || null; }
function getShowroomTargetRows(data: DashboardData): ShowroomTargetRow[] {
  // The dashboard plan contains only company-wide monthly targets, not showroom targets.
  void data;
  return [];
}
function getShowroomAchievementRanking({ salesRows, targetRows, filters, branches }: { salesRows: SalesRow[]; targetRows: ShowroomTargetRow[]; filters: FilterState; branches: Array<{ code: string; name: string }> }): ShowroomAchievementRankingEntry[] {
  const selectedYears = years(filters); const selectedMonths = months(filters);
  return branches.map((showroom) => {
    const salesUnit = getSalesKpis(salesRows.filter((row) => operationalShowroomForBranch(row.branch)?.code === showroom.code)).salesUnit;
    const targetUnit = sum(targetRows.filter((row) => row.showroomCode === showroom.code && (!selectedYears.length || selectedYears.includes(row.year)) && (!selectedMonths.length || selectedMonths.includes(row.month))), (row) => row.targetUnit) || null;
    return { showroomCode: showroom.code, showroomName: showroom.name, salesUnit, targetUnit, achievementPercent: targetUnit === null ? null : (salesUnit / targetUnit) * 100 };
  }).sort((left, right) => (right.achievementPercent ?? -1) - (left.achievementPercent ?? -1) || right.salesUnit - left.salesUnit || left.showroomCode.localeCompare(right.showroomCode));
}
function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-[var(--radius-control-lg)] bg-[var(--surface-muted)] font-semibold text-[var(--text-secondary)]",
        large ? "size-14 text-sm" : "size-9 text-[11px]",
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

function ShowroomPerformance({ items }: { items: BranchMetric[] }) {
  return <Card className="h-full min-h-[420px] rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6"><h2 className="text-[19px] font-semibold leading-tight tracking-normal text-[var(--text-primary)]">Showroom Performance</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Active salespeople only. Sales, GP and bookings reflect the selected period.</p><div className="mt-6 overflow-x-auto rounded-[var(--radius-control-lg)] border border-[var(--border-subtle)]">{items.some((item) => item.salesUnit) ? <table className="kmm-tabular min-w-[900px] w-full text-left text-xs"><thead className="bg-[var(--surface-subtle)] text-[var(--text-secondary)]"><tr>{["#", "Showroom", "Target", "Sales", "Achievement", "GP", "GP%", "Booking", "Active Sales", "Health"].map((label) => <th key={label} className="h-11 whitespace-nowrap px-3 py-2 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-[var(--divider)] text-[var(--text-secondary)]">{items.map((item, index) => <tr key={item.code} className="h-12 transition-colors hover:bg-[var(--brand-50)]"><td className="px-3 py-2 text-[var(--text-tertiary)]">{index + 1}</td><td className="px-3 py-2"><p className="font-semibold text-[var(--text-primary)]">{item.code}</p><p className="mt-0.5 text-[var(--text-tertiary)]">{item.name}</p></td><td className="px-3 py-2 text-right font-semibold">{item.target ? formatNumber(item.target) : "N/A"}</td><td className="px-3 py-2 text-right font-semibold">{formatNumber(item.salesUnit)}</td><td className="px-3 py-2 text-right">{item.achievement === null ? "N/A" : `${item.achievement.toFixed(1)}%`}</td><td className="px-3 py-2 text-right font-semibold">{formatCompact(item.gp)}</td><td className="px-3 py-2 text-right">{item.gpPercent === null ? "N/A" : `${item.gpPercent.toFixed(1)}%`}</td><td className="px-3 py-2 text-right">{formatNumber(item.booking)}</td><td className="px-3 py-2 text-right"><Badge variant="outline">{item.people.length}</Badge></td><td className="px-3 py-2 text-right font-semibold text-[var(--brand-600)]">{item.health === null ? "N/A" : `${item.health.toFixed(0)}/100`}</td></tr>)}</tbody></table> : <EmptyState />}</div></Card>;
}

function ShowroomRanking({ items }: { items: ShowroomAchievementRankingEntry[] }) {
  const targetsAvailable = items.some((item) => item.targetUnit !== null);
  const peakSalesUnit = Math.max(...items.map((item) => item.salesUnit), 1);

  return (
    <ChartCard
      title="Showroom Ranking"
      subtitle={
        targetsAvailable
          ? "Ranked by showroom achievement"
          : "Ranked by sales unit"
      }
      minHeight={420}
      className="h-full"
    >
      {items.length ? (
        <div className="flex min-h-[278px] flex-col justify-evenly gap-5">
          {items.map((item, index) => {
            const achievement = item.achievementPercent;
            const width = targetsAvailable
              ? Math.min(achievement ?? 0, 100)
              : (item.salesUnit / peakSalesUnit) * 100;
            const color = targetsAvailable
              ? achievement !== null && achievement >= 100
                ? "bg-[var(--status-success)]"
                : achievement !== null && achievement >= 80
                  ? "bg-[var(--brand-500)]"
                  : "bg-[var(--brand-600)]"
              : "bg-[var(--text-tertiary)]";
            const metric = targetsAvailable
              ? `${achievement?.toFixed(1)}%`
              : `${formatNumber(item.salesUnit)} Units`;

            return (
              <div
                key={item.showroomCode}
                className="grid grid-cols-[24px_minmax(0,1fr)_76px] items-center gap-3 sm:grid-cols-[24px_minmax(120px,1fr)_minmax(120px,2fr)_76px]"
              >
                <span className="kmm-tabular text-sm font-semibold text-[var(--text-tertiary)]">
                  {index + 1}
                </span>
                <span className="min-w-0 text-sm font-semibold text-[var(--text-secondary)]">
                  {item.showroomCode}{" "}
                  <span className="block truncate font-normal text-[var(--text-tertiary)] sm:inline">
                    {item.showroomName}
                  </span>
                </span>
                <div className="hidden h-2 overflow-hidden rounded-full bg-[var(--surface-muted)] sm:block">
                  <div
                    className={cn("h-full rounded-full", color)}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="kmm-tabular text-right text-sm font-semibold text-[var(--text-primary)]">
                  {metric}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState />
      )}
    </ChartCard>
  );
}

function TeamSummary({ items, onSelect }: { items: BranchMetric[]; onSelect: (person: Person) => void }) { return <section className="space-y-4"><SectionHeader title="Team Summary" description="Showroom view for current employees." /><div className="grid gap-4 lg:grid-cols-3">{items.map((item) => { const ordered = [...item.people].sort((a, b) => b.achievement - a.achievement || b.salesUnit - a.salesUnit); const top = ordered[0]; const bottom = ordered.at(-1); return <Card key={item.code} className="min-h-[290px] rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--text-disabled)] hover:shadow-[var(--shadow-hover)]"><div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-semibold text-[var(--text-primary)]">{item.code}</h3><p className="mt-1 text-sm text-[var(--text-secondary)]">{item.name}</p></div><Badge variant="outline">{item.people.length} active</Badge></div><div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm"><Metric label="Showroom Manager" value="N/A" /><Metric label="Achievement" value={item.achievement === null ? "N/A" : `${item.achievement.toFixed(1)}%`} /><Metric label="GP%" value={item.gpPercent === null ? "N/A" : `${item.gpPercent.toFixed(1)}%`} /><Metric label="Conversion" value={item.conversion === null ? "N/A" : `${item.conversion.toFixed(1)}%`} /><Metric label="Booking / Person" value={item.people.length ? (item.booking / item.people.length).toFixed(1) : "N/A"} /></div><div className="mt-5 space-y-1 border-t border-[var(--divider)] pt-3"><PersonLink label="Top Performer" person={top} onSelect={onSelect} /><PersonLink label="Bottom Performer" person={bottom} onSelect={onSelect} /></div></Card>; })}</div></section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-xs text-[var(--text-tertiary)]">{label}</p><p className="kmm-tabular mt-1 break-words font-semibold leading-5 text-[var(--text-primary)]" title={value}>{value}</p></div>; }
function PersonLink({ label, person, onSelect }: { label: string; person?: Person; onSelect: (person: Person) => void }) { return <div className="flex min-h-11 items-center justify-between gap-3 text-xs"><span className="shrink-0 text-[var(--text-tertiary)]">{label}</span>{person ? <button type="button" className="min-h-11 min-w-0 truncate rounded-[var(--radius-control)] px-1.5 text-right font-semibold text-[var(--brand-600)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" onClick={() => onSelect(person)}>{person.name}</button> : <span className="font-semibold text-[var(--text-secondary)]">N/A</span>}</div>; }

function TopSalespeople({ people, onSelect, currency }: { people: Person[]; onSelect: (person: Person) => void; currency: string }) {
  const [rankBy, setRankBy] = useState<RankingMetric>("salesValue");
  const metricValue = (person: Person) => rankBy === "salesUnit" ? person.salesUnit : rankBy === "salesValue" ? person.salesValue : rankBy === "gp" ? person.gp : rankBy === "gpPercent" ? ratio(person.gp, person.salesValue) : rankBy === "commission" ? person.commission : ratio(person.commission, person.gp);
  const ranked = [...people].sort((left, right) => { const difference = (metricValue(right) ?? Number.NEGATIVE_INFINITY) - (metricValue(left) ?? Number.NEGATIVE_INFINITY); return difference || left.name.localeCompare(right.name); });
  return <section className="space-y-4"><SectionHeader title="Top Salespeople" description="Current employees only. Select a row to update Employee Detail." /><TableCard title="Salespeople Ranking" empty={!people.length} filters={<label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">Rank by<select value={rankBy} onChange={(event) => setRankBy(event.target.value as RankingMetric)} className="h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--brand-500)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><option value="salesUnit">Sales Unit</option><option value="salesValue">Sales Value</option><option value="gp">GP Value</option><option value="gpPercent">GP %</option><option value="commission">Commission</option><option value="commissionOfGp">Commission / GP %</option></select></label>}><div className="overflow-x-auto rounded-[var(--radius-control-lg)] border border-[var(--border-subtle)]"><table className="kmm-tabular min-w-[1280px] w-full text-left text-xs"><thead className="bg-[var(--surface-subtle)] text-[var(--text-secondary)]"><tr><th rowSpan={2} className="px-3 py-3 font-semibold">Rank</th><th rowSpan={2} className="px-3 py-3 font-semibold">Photo</th><th rowSpan={2} className="px-3 py-3 font-semibold">Name</th><th rowSpan={2} className="px-3 py-3 font-semibold">Showroom</th><th colSpan={2} className="border-l border-[var(--divider)] px-3 py-2 text-center font-semibold">Sales</th><th colSpan={2} className="border-l border-[var(--divider)] px-3 py-2 text-center font-semibold">GP</th><th colSpan={3} className="border-l border-[var(--divider)] px-3 py-2 text-center font-semibold">Commission</th></tr><tr><th className="border-l border-[var(--divider)] px-3 py-2 font-semibold">Unit</th><th className="px-3 py-2 font-semibold">Value</th><th className="border-l border-[var(--divider)] px-3 py-2 font-semibold">Value</th><th className="px-3 py-2 font-semibold">GP %</th><th className="border-l border-[var(--divider)] px-3 py-2 font-semibold">Value</th><th className="px-3 py-2 font-semibold">% of Sales</th><th className="px-3 py-2 font-semibold">% of GP</th></tr></thead><tbody className="divide-y divide-[var(--divider)] text-[var(--text-secondary)]">{ranked.map((person, index) => { const gpPercent = ratio(person.gp, person.salesValue); const commissionOfSales = ratio(person.commission, person.salesValue); const commissionOfGp = ratio(person.commission, person.gp); const commissionTone = commissionOfGp === null ? "text-[var(--text-secondary)]" : commissionOfGp <= 20 ? "text-[var(--status-success)]" : commissionOfGp <= 30 ? "text-[var(--brand-600)]" : "text-[var(--status-danger)]"; return <tr key={person.id} className="h-12 cursor-pointer transition-colors hover:bg-[var(--brand-50)] focus-visible:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]" onClick={() => onSelect(person)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(person); } }} tabIndex={0} aria-label={`View ${person.name} details`}><td className="px-3 py-2 font-semibold text-[var(--text-tertiary)]">{index + 1}</td><td className="px-3 py-2"><Avatar name={person.name} /></td><td className="px-3 py-2 font-semibold text-[var(--text-primary)]">{person.name}</td><td className="px-3 py-2">{person.branch}</td><td className="border-l border-[var(--divider)] px-3 py-2 text-right font-semibold">{formatNumber(person.salesUnit)}</td><td className="px-3 py-2 text-right font-semibold">{formatCurrency(person.salesValue, currency)}</td><td className="border-l border-[var(--divider)] px-3 py-2 text-right font-semibold">{formatCurrency(person.gp, currency)}</td><td className={cn("px-3 py-2 text-right font-semibold", gpPercent !== null && gpPercent >= 15 ? "text-[var(--status-success)]" : gpPercent !== null && gpPercent >= 5 ? "text-[var(--brand-600)]" : "text-[var(--status-danger)]")}>{gpPercent === null ? "N/A" : `${gpPercent.toFixed(1)}%`}</td><td className="border-l border-[var(--divider)] px-3 py-2 text-right font-semibold">{formatCurrency(person.commission, currency)}</td><td className="px-3 py-2 text-right">{commissionOfSales === null ? "N/A" : `${commissionOfSales.toFixed(1)}%`}</td><td className={cn("px-3 py-2 text-right font-semibold", commissionTone)}>{commissionOfGp === null ? "N/A" : `${commissionOfGp.toFixed(1)}%`}</td></tr>; })}</tbody></table></div></TableCard></section>;
}

function EmployeeDetail({ person, rows, currency }: { person: Person | null; rows: SalesRow[]; currency: string }) { const months = MONTHS.map((label, index) => ({ label, sales: getSalesKpis(rows.filter((row) => row.month === index + 1)).salesUnit })); const peak = Math.max(...months.map((item) => item.sales), 1); return <section className="space-y-4"><SectionHeader title="Employee Detail" description="Select a salesperson from the ranking table or team summary to update this view." />{person ? <Card className="rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6"><div className="flex flex-col gap-6 xl:grid xl:grid-cols-[280px_minmax(0,1fr)_minmax(300px,1.3fr)]"><div className="flex items-center gap-4 border-b border-[var(--divider)] pb-5 xl:block xl:border-b-0 xl:border-r xl:pb-0 xl:pr-6"><Avatar name={person.name} large /><div className="min-w-0 xl:mt-4"><p className="truncate text-lg font-semibold text-[var(--text-primary)]">{person.name}</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{person.branch}</p><p className="kmm-tabular mt-3 text-xs font-semibold text-[var(--brand-600)]">Rank #{person.rank} · Active employee</p></div></div><div className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3"><Metric label="Sales Unit" value={formatNumber(person.salesUnit)} /><Metric label="Sales Value" value={formatCurrency(person.salesValue, currency)} /><Metric label="GP Value" value={formatCurrency(person.gp, currency)} /><Metric label="GP %" value={`${ratio(person.gp, person.salesValue)?.toFixed(1) ?? "N/A"}${ratio(person.gp, person.salesValue) === null ? "" : "%"}`} /><Metric label="Commission" value={formatCurrency(person.commission, currency)} /><Metric label="Commission % of Sales" value={`${ratio(person.commission, person.salesValue)?.toFixed(1) ?? "N/A"}${ratio(person.commission, person.salesValue) === null ? "" : "%"}`} /><Metric label="Commission / GP" value={`${ratio(person.commission, person.gp)?.toFixed(1) ?? "N/A"}${ratio(person.commission, person.gp) === null ? "" : "%"}`} /></div><div><p className="text-sm font-semibold text-[var(--text-primary)]">Monthly Sales Trend</p><div className="mt-5 flex h-36 items-end gap-2 border-b border-[var(--divider)] pb-1">{months.map((item) => <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="kmm-tabular text-[10px] font-semibold text-[var(--text-secondary)]">{item.sales || ""}</span><span className="w-full rounded-t bg-[var(--brand-500)]" style={{ height: `${Math.max(item.sales ? 10 : 2, (item.sales / peak) * 96)}px` }} /><span className="text-[10px] text-[var(--text-tertiary)]">{item.label}</span></div>)}</div></div></div></Card> : <Card className="rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-8 shadow-[var(--shadow-card)]"><EmptyState message="No active employee is available in the selected scope." /></Card>}</section>; }

function exportPeople(people: Person[], companyCode: string) { const headings = ["Rank", "Name", "Showroom", "Sales", "GP", "Booking", "Achievement %"]; const rows = people.map((person) => [String(person.rank), person.name, person.branch, String(person.salesUnit), String(person.gp), String(person.booking), person.achievement.toFixed(1)]); const csv = [headings, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${companyCode.toLowerCase()}-team.csv`; anchor.click(); URL.revokeObjectURL(url); }

export function SalesOrganizationPage() {
  const { t } = useLocale();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? "";
  const companyCode = selectedCompany?.code ?? "KMM";
  const currency = selectedCompany?.currency ?? "MMK";
  const [filters, setFilters] = useState<FilterState>(defaultFilters); const [data, setData] = useState<DashboardData | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [salesPayload, operationalPayload] = await Promise.all([
        loadLiveSalesData({ allowFallback: false, companyId }),
        loadLiveOperationalData({ allowFallback: false, companyId }),
      ]);
      const employees = salesPayload.employees ?? [];
      const directory = makeEmployeeDirectory(
        employees,
        salesPayload.employeeMasterAvailable === true,
      );
      const sales = salesPayload.sales.map((row) => ({
        ...row,
        branch: canonicalBranch(row.branch),
        salesperson: canonicalSalesperson(row, directory),
      }));
      const booking = operationalPayload.booking.map((row) => ({
        ...row,
        branch: canonicalBranch(row.branch),
        salesperson: canonicalSalesperson(row, directory),
      }));
      setData({
        meta: { sourceUpdatedAt: salesPayload.meta.sourceUpdatedAt },
        plan: salesPayload.plan,
        sales,
        booking,
        employees,
        employeeMasterAvailable: directory.available,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load live team data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    queueMicrotask(() => { void loadData(); });
    const refresh = () => { void loadData(); };
    window.addEventListener("kmm:sales-imported", refresh);
    return () => window.removeEventListener("kmm:sales-imported", refresh);
  }, [companyId]);
  const employeeDirectory = useMemo(() => makeEmployeeDirectory(data?.employees ?? [], data?.employeeMasterAvailable === true), [data]);
  const inactiveNames = useMemo(() => new Set((data?.sales ?? []).filter((row) => isInactiveEmployeeName(row.salesperson)).map((row) => normalizeEmployeeBaseName(row.salesperson))), [data]);
  const filteredSales = useMemo(() => (data?.sales ?? []).filter((row) => matchesFilters(row, filters)), [data, filters]);
  const activeSales = useMemo(() => filteredSales.filter((row) => isCurrentLiveEmployee(row, employeeDirectory, inactiveNames)), [filteredSales, employeeDirectory, inactiveNames]);
  const filteredBooking = useMemo(() => (data?.booking ?? []).filter((row) => matchesFilters(row, filters)).filter((row) => isCurrentLiveEmployee(row, employeeDirectory, inactiveNames)), [data, filters, employeeDirectory, inactiveNames]);
  const totalTarget = data ? targetForScope(data, filters) : null;
  const activeUnitRows = useMemo(() => getEngineUnitSalesRows(activeSales), [activeSales]);
  const people = useMemo(() => { const groups = new Map<string, { name: string; rows: SalesRow[] }>(); activeSales.forEach((row) => { const identity = resolveCommissionIdentity(row, data?.employees ?? []); if (!identity) return; const group = groups.get(identity.key) ?? { name: identity.name, rows: [] }; group.rows.push(row); groups.set(identity.key, group); }); const preliminary = [...groups.entries()].map(([id, group]) => { const { rows, name } = group; const branch = [...new Set(rows.map((row) => row.branch).filter(Boolean))].sort((left, right) => rows.filter((row) => row.branch === right).length - rows.filter((row) => row.branch === left).length)[0] ?? "N/A"; const kpis = getSalesKpis(rows); const commission = rows.length && rows.every((row) => row.commission !== null) ? sum(rows, (row) => row.commission ?? 0) : null; const booking = filteredBooking.filter((row) => normalizeEmployeeBaseName(row.salesperson) === normalizeEmployeeBaseName(name)).length; return { id, name, branch, salesUnit: kpis.salesUnit, salesValue: kpis.salesValue ?? 0, gp: kpis.grossProfit ?? 0, commission, booking }; }); const perPersonTarget = totalTarget && preliminary.length ? totalTarget / preliminary.length : 0; return preliminary.map((person) => ({ ...person, target: perPersonTarget, achievement: perPersonTarget ? (person.salesUnit / perPersonTarget) * 100 : 0, conversion: person.booking ? (person.salesUnit / person.booking) * 100 : 0, rank: 0 })).sort((a, b) => b.achievement - a.achievement || b.salesUnit - a.salesUnit || a.name.localeCompare(b.name)).map((person, index) => ({ ...person, rank: index + 1 })); }, [activeSales, data?.employees, filteredBooking, totalTarget]);
  const branchDefinitions = useMemo(() => {
    const byCode = new Map(
      (selectedCompany?.branches ?? []).map((branch) => [branch.code, { code: branch.code, name: branch.name }]),
    );
    for (const code of [...activeSales, ...filteredBooking].map((row) => row.branch).filter(Boolean)) {
      if (!byCode.has(code)) {
        byCode.set(code, { code, name: operationalShowroomForBranch(code)?.name ?? code });
      }
    }
    return [...byCode.values()].sort((left, right) => left.code.localeCompare(right.code));
  }, [activeSales, filteredBooking, selectedCompany?.branches]);
  const branchMetrics = useMemo(() => { const totalUnits = getSalesUnit(activeUnitRows); return branchDefinitions.map((branch) => { const team = people.filter((person) => person.branch === branch.code); const salesRows = activeSales.filter((row) => row.branch === branch.code); const kpis = getSalesKpis(salesRows); const unit = kpis.salesUnit; const salesValue = kpis.salesValue ?? 0; const gp = kpis.grossProfit ?? 0; const booking = filteredBooking.filter((row) => row.branch === branch.code).length; const target = totalTarget ? totalTarget * (totalUnits ? unit / totalUnits : 1 / Math.max(branchDefinitions.length, 1)) : 0; const achievement = target ? (unit / target) * 100 : null; const gpPercent = salesValue ? (gp / salesValue) * 100 : null; const conversion = booking ? (unit / booking) * 100 : null; const health = achievement === null || conversion === null ? null : Math.min(100, achievement * 0.7 + Math.min(conversion, 100) * 0.3); return { code: branch.code, name: branch.name, people: team, target, salesUnit: unit, salesValue, gp, gpPercent, booking, achievement, conversion, health }; }); }, [people, activeSales, activeUnitRows, branchDefinitions, filteredBooking, totalTarget]);
  const showroomAchievementRanking = useMemo(() => getShowroomAchievementRanking({ salesRows: activeSales, targetRows: data ? getShowroomTargetRows(data) : [], filters, branches: branchDefinitions }), [activeSales, branchDefinitions, data, filters]);
  const bestShowroom = branchMetrics.find((item) => item.code === showroomAchievementRanking[0]?.showroomCode) ?? branchMetrics[0]; const bestSalesperson = people[0];
  const selectedPerson = people.find((person) => person.id === selectedPersonId) ?? bestSalesperson ?? null;
  const selectedRows = selectedPerson ? activeSales.filter((row) => resolveCommissionIdentity(row, data?.employees ?? [])?.key === selectedPerson.id) : [];
  const previousSalesValue = useMemo(() => { const selectedYears = years(filters); if (selectedYears.length !== 1) return null; const previous = { ...filters, year: [String(selectedYears[0] - 1)] }; const rows = (data?.sales ?? []).filter((row) => matchesFilters(row, previous)).filter((row) => isCurrentLiveEmployee(row, employeeDirectory, inactiveNames)); return getSalesKpis(rows).salesValue; }, [data, filters, employeeDirectory, inactiveNames]);
  const activeKpis = getSalesKpis(activeSales); const totalSalesValue = activeKpis.salesValue ?? 0; const totalGp = activeKpis.grossProfit ?? 0; const totalAchievement = totalTarget ? (activeKpis.salesUnit / totalTarget) * 100 : null; const totalGpPercent = totalSalesValue ? (totalGp / totalSalesValue) * 100 : null; const salesComparison = previousSalesValue && previousSalesValue !== 0 ? ((totalSalesValue - previousSalesValue) / previousSalesValue) * 100 : null;
  const filterOptions = useMemo(() => { const source = data?.sales ?? []; const matching = source.filter((row) => matchesFilters(row, { ...filters, salesperson: [] })); return { year: [...new Set(source.map((row) => String(row.year)).filter((value) => value !== "null"))].sort((a, b) => Number(b) - Number(a)), month: MONTHS, branch: [...new Set(source.map((row) => row.branch).filter(Boolean))].sort(), salesperson: [...new Set(matching.filter((row) => isCurrentLiveEmployee(row, employeeDirectory, inactiveNames)).map((row) => row.salesperson).filter(Boolean))].sort() }; }, [data, filters, employeeDirectory, inactiveNames]);
  function updateFilter(key: FilterKey, values: string[]) { setSelectedPersonId(null); setFilters((current) => ({ ...current, [key]: values, ...(key === "branch" ? { salesperson: [] } : {}) })); }
  return (
    <div className="kmm-sales-organization-page min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6">
          <div className="space-y-5 xl:space-y-6">
            <section aria-labelledby="sales-organization-title">
              <div
                className="mb-2 h-1 w-8 rounded-full bg-[var(--brand-500)]"
                aria-hidden="true"
              />
              <h1
                id="sales-organization-title"
                className="text-[28px] font-semibold leading-tight tracking-normal text-[var(--text-primary)] sm:text-[30px]"
              >
                {t("route.team.title")}
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                {t("route.team.subtitle").replaceAll("KMM", companyCode)}
              </p>
            </section>

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
                  aria-label="Team KPIs"
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:gap-3 2xl:gap-4"
                >
                  <KpiCard
                    variant="executive"
                    title="Active Salespeople"
                    value={people.length}
                    unit="People"
                    subtitle="Current employees only"
                  />
                  <KpiCard
                    variant="executive"
                    title="Showroom Achievement"
                    value={
                      totalAchievement === null
                        ? "N/A"
                        : `${totalAchievement.toFixed(1)}%`
                    }
                    subtitle="vs selected target"
                  />
                  <KpiCard
                    variant="executive"
                    title="Total Sales"
                    value={formatCompact(totalSalesValue)}
                    unit={currency}
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
                    value={formatCompact(totalGp)}
                    unit={currency}
                    subtitle={
                      totalGpPercent === null
                        ? "GP% N/A"
                        : `GP% ${totalGpPercent.toFixed(1)}%`
                    }
                  />
                  <KpiCard
                    variant="executive"
                    title="Best Showroom"
                    value={bestShowroom?.code ?? "N/A"}
                    subtitle={
                      bestShowroom?.achievement === null || !bestShowroom
                        ? "Achievement N/A"
                        : `${bestShowroom.achievement.toFixed(1)}% achievement`
                    }
                  />
                  <KpiCard
                    variant="executive"
                    title="Best Salesperson"
                    value={
                      bestSalesperson ? (
                        <span className="flex min-w-0 items-center gap-2 text-xl">
                          <Avatar name={bestSalesperson.name} />
                          <span className="truncate">
                            {bestSalesperson.name}
                          </span>
                        </span>
                      ) : (
                        "N/A"
                      )
                    }
                    subtitle={
                      bestSalesperson
                        ? `${bestSalesperson.branch} · ${bestSalesperson.achievement.toFixed(1)}% achievement`
                        : undefined
                    }
                  />
                </section>

                <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2 xl:items-stretch">
                  <ShowroomPerformance items={branchMetrics} />
                  <ShowroomRanking items={showroomAchievementRanking} />
                </section>
                <TeamSummary
                  items={branchMetrics}
                  onSelect={(person) => setSelectedPersonId(person.id)}
                />
                <TopSalespeople
                  people={people}
                  currency={currency}
                  onSelect={(person) => setSelectedPersonId(person.id)}
                />
                <EmployeeDetail
                  person={selectedPerson}
                  rows={selectedRows}
                  currency={currency}
                />
              </>
            )}
          </div>
      </main>
    </div>
  );
}
