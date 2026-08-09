"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ClipboardList,
  Database,
  RefreshCw,
  ShoppingCart,
  Target,
} from "lucide-react";
import { loadDailyManagementReport } from "../../lib/daily-management/client";
import type { DailyManagementPayload, DailyManagementSnapshot } from "../../lib/daily-management/types";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ErrorState } from "../design-system/error-state";
import { ExportButton } from "../design-system/export-button";
import { KpiCard } from "../design-system/kpi-card";
import { LoadingSkeleton } from "../design-system/loading-skeleton";
import { SectionHeader } from "../design-system/section-header";
import { StatusBadge } from "../design-system/status-badge";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Yangon",
});

function displayDate(value: string | null) {
  if (!value) return "Not available";
  return dateFormat.format(new Date(`${value}T12:00:00Z`));
}

function formatMoney(value: number | null) {
  if (value === null) return "N/A";
  if (Math.abs(value) >= 1_000_000_000) return `${number.format(value / 1_000_000_000)}B`;
  if (Math.abs(value) >= 1_000_000) return `${number.format(value / 1_000_000)}M`;
  return number.format(value);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadReport(snapshot: DailyManagementSnapshot) {
  const rows = [
    ["Type", "Date", "Branch", "Salesperson", "Model", "Units / Status"],
    ...snapshot.sales.today.map((row) => ["Sales", row.date, row.branch, row.salesperson, row.model, row.quantity]),
    ...snapshot.booking.today.map((row) => ["Booking", row.date, row.branch, row.salesperson, row.model, row.purchaseStatus]),
  ];
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kmm-daily-management-${snapshot.asOfDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function SourceDates({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]" aria-label="Source dates">
      <span className="rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-1.5">Sales through {displayDate(snapshot.sourceDates.sales)}</span>
      <span className="rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-1.5">Booking through {displayDate(snapshot.sourceDates.booking)}</span>
      <span className="rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-1.5">Stock snapshot {displayDate(snapshot.sourceDates.stock)}</span>
    </div>
  );
}

function ReportFilters({
  date,
  branch,
  branches,
  loading,
  onDateChange,
  onBranchChange,
  onApply,
  onRefresh,
  onExport,
}: {
  date: string;
  branch: string;
  branches: string[];
  loading: boolean;
  onDateChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  onApply: () => void;
  onRefresh: () => void;
  onExport: () => void;
}) {
  return (
    <Card className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
          Report date
          <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} className="h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-100)]" />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
          Branch
          <select value={branch} onChange={(event) => onBranchChange(event.target.value)} className="h-11 min-w-48 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-100)]">
            <option value="">All branches</option>
            {branches.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onApply} disabled={loading}>Apply</Button>
        <Button variant="outline" onClick={onRefresh} disabled={loading} aria-label="Refresh Daily Management Report"><RefreshCw size={16} />Refresh</Button>
        <ExportButton onClick={onExport} disabled={loading} />
      </div>
    </Card>
  );
}

function KpiStrip({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  return (
    <section aria-label="Daily management KPIs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      <KpiCard variant="executive" title="Sales Today" value={snapshot.sales.todayUnits} unit="Units" subtitle={`Report date ${displayDate(snapshot.asOfDate)}`} icon={<ShoppingCart size={18} />} />
      <KpiCard variant="executive" title="Sales MTD" value={snapshot.sales.mtdUnits} unit="Units" subtitle="Engine-unit sales through report date" icon={<CalendarDays size={18} />} />
      <KpiCard variant="executive" title="MTD Target" value="N/A" subtitle="Branch and salesperson targets are not in D1" icon={<Target size={18} />} empty />
      <KpiCard variant="executive" title="Booking Today" value={snapshot.booking.newToday} unit="Units" subtitle="New booking transactions" icon={<ClipboardList size={18} />} />
      <KpiCard variant="executive" title="Active Booking" value={snapshot.booking.activeUnits} unit="Units" subtitle="A/B/C HOT current pipeline" icon={<Database size={18} />} />
      <KpiCard variant="executive" title="Stock (Engine)" value={snapshot.stock.engineUnits} unit="Units" subtitle={`Value ${formatMoney(snapshot.stock.value)} MMK`} icon={<Boxes size={18} />} />
    </section>
  );
}

function SalesPerformance({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  return (
    <Card className="min-w-0 p-5">
      <SectionHeader title="1. Sales Performance" description="Actual MTD engine-unit sales; granular targets remain unavailable." />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
        <div className="overflow-x-auto rounded-[var(--radius-control-lg)] border border-[var(--border-default)]">
          <table className="w-full min-w-[460px] text-left text-sm">
            <thead className="bg-[var(--surface-subtle)] text-xs text-[var(--text-secondary)]"><tr><th className="px-3 py-3">Branch</th><th className="px-3 py-3 text-right">MTD Units</th><th className="px-3 py-3">Target</th><th className="px-3 py-3">Achievement</th></tr></thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {snapshot.sales.byBranch.length ? snapshot.sales.byBranch.map((row) => <tr key={row.branch}><td className="px-3 py-3 font-medium">{row.branch}</td><td className="kmm-tabular px-3 py-3 text-right font-semibold">{row.units}</td><td className="px-3 py-3 text-[var(--text-tertiary)]">N/A</td><td className="px-3 py-3"><StatusBadge status="inactive">Waiting for target</StatusBadge></td></tr>) : <tr><td colSpan={4} className="px-3 py-8 text-center text-[var(--text-tertiary)]">No MTD sales for this scope.</td></tr>}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top performers (MTD)</h3>
          <ol className="mt-3 space-y-2">
            {snapshot.sales.topSalespeople.length ? snapshot.sales.topSalespeople.map((row, index) => <li key={`${row.salesperson}-${index}`} className="flex items-center justify-between rounded-[var(--radius-control)] bg-[var(--surface-subtle)] px-3 py-2.5 text-sm"><span className="min-w-0 truncate"><span className="mr-2 text-[var(--text-tertiary)]">{index + 1}</span>{row.salesperson}</span><strong className="kmm-tabular ml-3">{row.units}</strong></li>) : <li className="rounded-[var(--radius-control)] bg-[var(--surface-subtle)] px-3 py-5 text-center text-sm text-[var(--text-tertiary)]">No performer data.</li>}
          </ol>
        </div>
      </div>
    </Card>
  );
}

function BookingPipeline({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  const stages = [
    { label: "New Today", value: snapshot.booking.newToday, tone: "bg-[var(--status-success)]" },
    { label: "A HOT", value: snapshot.booking.aHot, tone: "bg-[#E0A400]" },
    { label: "B HOT", value: snapshot.booking.bHot, tone: "bg-[var(--brand-500)]" },
    { label: "C HOT", value: snapshot.booking.cHot, tone: "bg-[var(--status-info)]" },
  ];
  const max = Math.max(...stages.map((stage) => stage.value), 1);
  return (
    <Card className="min-w-0 p-5">
      <SectionHeader title="2. Booking Pipeline" description="Current A/B/C HOT pipeline plus new bookings on the selected date." />
      <div className="mt-5 space-y-3">
        {stages.map((stage) => <div key={stage.label} className="grid grid-cols-[92px_minmax(0,1fr)_44px] items-center gap-3 text-sm"><span className="font-medium text-[var(--text-secondary)]">{stage.label}</span><div className="h-8 overflow-hidden rounded-[var(--radius-control)] bg-[var(--surface-muted)]"><div className={`grid h-full min-w-8 place-items-center rounded-[var(--radius-control)] text-xs font-bold text-white ${stage.tone}`} style={{ width: `${Math.max(8, (stage.value / max) * 100)}%` }}>{stage.value}</div></div><strong className="kmm-tabular text-right">{stage.value}</strong></div>)}
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {["Wait Approve", "Wait Delivery", "Cancel reason"].map((label) => <div key={label} className="rounded-[var(--radius-control)] border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] p-3"><p className="text-xs font-semibold text-[var(--text-secondary)]">{label}</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">Waiting for governed source</p></div>)}
      </div>
    </Card>
  );
}

function TodayDetail({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  const rows = [
    ...snapshot.sales.today.map((row) => ({ ...row, type: "Sale", status: `${row.quantity} unit${row.quantity === 1 ? "" : "s"}` })),
    ...snapshot.booking.today.map((row) => ({ ...row, type: "Booking", quantity: null, status: row.purchaseStatus })),
  ];
  return (
    <Card className="min-w-0 p-5">
      <SectionHeader title="3. Today’s Sales & Booking Detail" description="Transactions recorded on the selected report date." />
      <div className="mt-5 overflow-x-auto rounded-[var(--radius-control-lg)] border border-[var(--border-default)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[var(--surface-subtle)] text-xs text-[var(--text-secondary)]"><tr><th className="px-3 py-3">Type</th><th className="px-3 py-3">Branch</th><th className="px-3 py-3">Salesperson</th><th className="px-3 py-3">Model</th><th className="px-3 py-3">Status</th></tr></thead>
          <tbody className="divide-y divide-[var(--divider)]">
            {rows.length ? rows.map((row, index) => <tr key={`${row.type}-${row.branch}-${row.salesperson}-${row.model}-${index}`}><td className="px-3 py-3"><StatusBadge status={row.type === "Sale" ? "positive" : "warning"}>{row.type}</StatusBadge></td><td className="px-3 py-3">{row.branch}</td><td className="px-3 py-3">{row.salesperson}</td><td className="px-3 py-3 font-medium">{row.model}</td><td className="px-3 py-3">{row.status}</td></tr>) : <tr><td colSpan={5} className="px-3 py-10 text-center text-[var(--text-tertiary)]">No sales or booking transactions on this date.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StockHealth({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  const maxBranch = Math.max(...snapshot.stock.byBranch.map((row) => row.units), 1);
  const maxAge = Math.max(...snapshot.stock.aging.map((row) => row.units), 1);
  return (
    <Card className="min-w-0 p-5">
      <SectionHeader title="4. Stock Health Overview" description="Current KMM free-stock snapshot, value and aging." />
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="rounded-[var(--radius-control-lg)] bg-[var(--surface-subtle)] p-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Stock Value</p><p className="kmm-tabular mt-2 text-3xl font-semibold">{formatMoney(snapshot.stock.value)}</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">MMK · current persisted MSRP</p></div>
        <div><h3 className="text-sm font-semibold">By branch</h3><div className="mt-3 space-y-3">{snapshot.stock.byBranch.map((row) => <div key={row.branch}><div className="mb-1 flex justify-between text-xs"><span>{row.branch}</span><strong className="kmm-tabular">{row.units}</strong></div><div className="h-2 rounded-full bg-[var(--surface-muted)]"><div className="h-2 rounded-full bg-[var(--brand-500)]" style={{ width: `${(row.units / maxBranch) * 100}%` }} /></div></div>)}</div></div>
        <div><h3 className="text-sm font-semibold">Aging (engine units)</h3><div className="mt-3 space-y-3">{snapshot.stock.aging.map((row) => <div key={row.label}><div className="mb-1 flex justify-between text-xs"><span>{row.label} days</span><strong className="kmm-tabular">{row.units}</strong></div><div className="h-2 rounded-full bg-[var(--surface-muted)]"><div className={`h-2 rounded-full ${row.label === ">90" ? "bg-[var(--status-danger)]" : row.label === "61–90" ? "bg-[var(--status-warning)]" : "bg-[var(--status-success)]"}`} style={{ width: `${(row.units / maxAge) * 100}%` }} /></div></div>)}</div></div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2.5 text-xs text-[var(--text-secondary)]"><AlertTriangle size={15} className="text-[var(--status-warning)]" /><span>Physical Stock Location is not shown because the Excel Location column is not persisted in D1.</span></div>
    </Card>
  );
}

function BookingStockIntelligence({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  const tone = { shortage: "negative", high: "warning", balanced: "positive", unknown: "neutral" } as const;
  const label = { shortage: "Potential shortage", high: "High coverage", balanced: "Balanced", unknown: "No active demand" };
  return (
    <Card className="min-w-0 p-5">
      <SectionHeader title="5. Booking × Stock Intelligence" description="Read-only signal using current active booking and engine stock by exact model." />
      <div className="mt-5 overflow-x-auto rounded-[var(--radius-control-lg)] border border-[var(--border-default)]">
        <table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-[var(--surface-subtle)] text-xs text-[var(--text-secondary)]"><tr><th className="px-3 py-3">Model</th><th className="px-3 py-3 text-right">Active Booking</th><th className="px-3 py-3 text-right">Stock</th><th className="px-3 py-3 text-right">Coverage</th><th className="px-3 py-3">Signal</th></tr></thead><tbody className="divide-y divide-[var(--divider)]">{snapshot.bookingStock.length ? snapshot.bookingStock.map((row) => <tr key={row.model}><td className="px-3 py-3 font-medium">{row.model}</td><td className="kmm-tabular px-3 py-3 text-right">{row.activeBooking}</td><td className="kmm-tabular px-3 py-3 text-right">{row.stock}</td><td className="kmm-tabular px-3 py-3 text-right">{row.coverageMonths === null ? "—" : `${row.coverageMonths.toFixed(1)}x`}</td><td className="px-3 py-3"><StatusBadge status={tone[row.signal]}>{label[row.signal]}</StatusBadge></td></tr>) : <tr><td colSpan={5} className="px-3 py-8 text-center text-[var(--text-tertiary)]">No model intelligence available.</td></tr>}</tbody></table>
      </div>
    </Card>
  );
}

function Readiness({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  const items = [
    ["Target & Pace", snapshot.availability.target],
    ["Booking lifecycle", snapshot.availability.bookingLifecycle],
    ["Cancel reason", snapshot.availability.cancelReason],
    ["Stock location", snapshot.availability.stockLocation],
    ["Action workflow", snapshot.availability.actions],
    ["Daily note", snapshot.availability.notes],
  ] as const;
  return (
    <Card className="p-5">
      <SectionHeader title="6. Phase 1 Data Readiness" description="Missing fields remain visible as controlled gaps instead of synthetic management data." />
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map(([label, availability]) => <div key={label} className="rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{label}</h3><StatusBadge status={availability.available ? "positive" : "inactive"}>{availability.available ? "Ready" : "Waiting"}</StatusBadge></div><p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">{availability.reason}</p></div>)}
      </div>
    </Card>
  );
}

export function DailyManagementPage() {
  const [payload, setPayload] = useState<DailyManagementPayload | null>(null);
  const [date, setDate] = useState("");
  const [branch, setBranch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const filtersRef = useRef({ date: "", branch: "" });

  const load = useCallback(async (options: { date?: string; branch?: string } = {}) => {
    setLoading(true);
    setError("");
    try {
      const next = await loadDailyManagementReport(options);
      setPayload(next);
      setDate(next.snapshot.asOfDate);
      setBranch(next.snapshot.scope.branch ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Daily Management Report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    filtersRef.current = { date, branch };
  }, [date, branch]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    const refreshAfterImport = () => { void load(filtersRef.current); };
    window.addEventListener("kmm:sales-imported", refreshAfterImport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("kmm:sales-imported", refreshAfterImport);
    };
  }, [load]);

  const snapshot = payload?.snapshot;
  return (
    <div className="min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6">
        <div className="space-y-5 xl:space-y-6">
          <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between" aria-labelledby="daily-management-title">
            <div className="min-w-0"><div className="mb-2 h-1 w-8 rounded-full bg-[var(--brand-500)]" aria-hidden="true" /><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--brand-600)]">Daily Sales, Booking & Stock Overview</p><h1 id="daily-management-title" className="mt-1 text-[28px] font-semibold leading-tight tracking-normal sm:text-[30px]">KMM Daily Management Report</h1><p className="mt-1 text-sm text-[var(--text-secondary)]">One-minute operating view built only from persisted Sales, Booking and Stock data.</p></div>
            {snapshot && <SourceDates snapshot={snapshot} />}
          </section>

          <ReportFilters date={date} branch={branch} branches={snapshot?.availableBranches ?? []} loading={loading} onDateChange={setDate} onBranchChange={setBranch} onApply={() => void load({ date, branch })} onRefresh={() => void load({ date, branch })} onExport={() => snapshot && downloadReport(snapshot)} />

          {loading && <Card className="grid min-h-[360px] place-items-center p-8" aria-busy="true"><div className="w-full max-w-2xl space-y-4"><LoadingSkeleton variant="chart" /><p className="text-center text-sm text-[var(--text-secondary)]">Loading Daily Management Report from D1...</p></div></Card>}
          {error && !loading && <Card className="grid min-h-[360px] place-items-center border-[var(--status-danger)] p-8" role="alert"><ErrorState message={error} onRetry={() => void load({ date, branch })} /></Card>}
          {snapshot && !loading && !error && <>
            <KpiStrip snapshot={snapshot} />
            <div className="grid gap-5 xl:grid-cols-2"><SalesPerformance snapshot={snapshot} /><BookingPipeline snapshot={snapshot} /></div>
            <TodayDetail snapshot={snapshot} />
            <StockHealth snapshot={snapshot} />
            <BookingStockIntelligence snapshot={snapshot} />
            <Readiness snapshot={snapshot} />
          </>}
        </div>
      </main>
    </div>
  );
}
