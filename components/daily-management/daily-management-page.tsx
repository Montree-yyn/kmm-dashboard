"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Database,
  PackageCheck,
  ShoppingCart,
  Target,
  WalletCards,
} from "lucide-react";
import { dailyManagementMock as report } from "../../lib/daily-management/mock-data";
import { Card } from "../ui/card";
import { ExportButton } from "../design-system/export-button";
import { StatusBadge } from "../design-system/status-badge";

const icons: Record<string, ReactNode> = {
  salesToday: <ShoppingCart size={20} />,
  salesMtd: <CalendarDays size={20} />,
  target: <Target size={20} />,
  bookingToday: <ClipboardCheck size={20} />,
  activeBooking: <ClipboardList size={20} />,
  stockEngine: <Boxes size={20} />,
  stockValue: <WalletCards size={20} />,
};

const tones = {
  green: "text-[#218739] bg-[#EDF8EF]",
  blue: "text-[#2F7ED8] bg-[#EDF5FF]",
  teal: "text-[#138F8B] bg-[#EAF8F7]",
  purple: "text-[#7C3FA0] bg-[#F5EEFA]",
  orange: "text-[var(--brand-600)] bg-[var(--brand-50)]",
} as const;

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadMockup() {
  const rows = [
    ["MOCKUP DATA — NOT FOR OPERATIONAL USE"],
    ["Report Date", report.reportDate],
    [],
    ["KPI", "Value", "Unit", "Detail"],
    ...report.kpis.map((item) => [item.label, item.value, item.unit, item.detail]),
    [],
    ["Branch", "Sales MTD", "Target", "Achievement", "vs Pace"],
    ...report.salesPerformance.branches.map((item) => [item.branch, item.sales, item.target, item.achievement, item.pace]),
  ];
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kmm-daily-management-mockup-${report.reportDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function SectionBar({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-t-[var(--radius-card)] bg-[var(--brand-500)] px-4 py-2 text-white">
      <h2 className="text-sm font-bold sm:text-[15px]">{title}</h2>
      {action}
    </div>
  );
}

function KpiStrip() {
  return (
    <section aria-label="Daily management mockup KPIs" className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
      {report.kpis.map((item) => (
        <Card key={item.key} className="min-h-[122px] p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.04em] text-[var(--text-secondary)]">{item.label}</p>
            <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${tones[item.tone]}`}>{icons[item.key]}</span>
          </div>
          <p className="kmm-tabular mt-1 flex items-baseline gap-2 text-[30px] font-semibold leading-none tracking-[-0.03em]">
            {item.value}<span className="text-[11px] font-semibold tracking-normal text-[var(--text-secondary)]">{item.unit}</span>
          </p>
          <p className={`mt-3 text-[11px] ${item.key === "stockValue" || item.key === "target" ? "font-semibold text-[var(--status-danger)]" : "text-[var(--text-secondary)]"}`}>{item.detail}</p>
        </Card>
      ))}
    </section>
  );
}

function PerformerList({ title, rows, attention = false }: { title: string; rows: readonly { name: string; result: string; achievement: string }[]; attention?: boolean }) {
  return (
    <div>
      <h3 className={`text-xs font-bold ${attention ? "text-[var(--status-danger)]" : "text-[var(--text-primary)]"}`}>{title}</h3>
      <ol className="mt-2 divide-y divide-[var(--divider)]">
        {rows.map((row, index) => (
          <li key={row.name} className="grid grid-cols-[22px_minmax(0,1fr)_48px_42px] items-center gap-2 py-2 text-xs">
            <span className={attention ? "text-[var(--status-danger)]" : "text-[var(--status-success)]"}>{index + 1}</span>
            <span className="truncate font-medium">{row.name}</span>
            <span className="kmm-tabular text-right">{row.result}</span>
            <span className={`kmm-tabular text-right font-semibold ${attention ? "text-[var(--status-danger)]" : "text-[var(--status-success)]"}`}>{row.achievement}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SalesPerformance() {
  return (
    <Card className="min-w-0 overflow-hidden">
      <SectionBar title="1. SALES PERFORMANCE" />
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(230px,0.75fr)]">
        <div className="overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border-default)]">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="bg-[var(--surface-subtle)] text-[var(--text-secondary)]"><tr><th className="px-3 py-2.5">Branch</th><th className="px-3 py-2.5 text-right">Sales</th><th className="px-3 py-2.5 text-right">Target</th><th className="px-3 py-2.5 text-right">Ach.</th><th className="px-3 py-2.5 text-right">vs Pace</th></tr></thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {report.salesPerformance.branches.map((row) => <tr key={row.branch}><td className="px-3 py-3 font-medium">{row.branch}</td><td className="kmm-tabular px-3 py-3 text-right font-semibold">{row.sales}</td><td className="kmm-tabular px-3 py-3 text-right">{row.target}</td><td className="kmm-tabular px-3 py-3 text-right font-semibold">{row.achievement}</td><td className={`kmm-tabular px-3 py-3 text-right font-semibold ${row.pace.startsWith("+") ? "text-[var(--status-success)]" : "text-[var(--status-danger)]"}`}>{row.pace}</td></tr>)}
              <tr className="bg-[var(--surface-subtle)] font-bold"><td className="px-3 py-3">Total</td><td className="kmm-tabular px-3 py-3 text-right">10</td><td className="kmm-tabular px-3 py-3 text-right">48</td><td className="kmm-tabular px-3 py-3 text-right">20.8%</td><td className="kmm-tabular px-3 py-3 text-right text-[var(--status-danger)]">-4</td></tr>
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <PerformerList title="Top Performers (MTD)" rows={report.salesPerformance.top} />
          <PerformerList title="Need Attention" rows={report.salesPerformance.attention} attention />
        </div>
      </div>
    </Card>
  );
}

function BookingPipeline() {
  return (
    <Card className="min-w-0 overflow-hidden">
      <SectionBar title="2. BOOKING PIPELINE" action={<span className="flex items-center gap-1.5 text-xs font-semibold"><AlertTriangle size={15} />Cancel Today: {report.cancellation.total} Unit</span>} />
      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(300px,1fr)_minmax(240px,0.85fr)]">
        <ol className="mx-auto grid w-full max-w-[430px] gap-1" aria-label="Booking funnel stages">
          {report.bookingPipeline.map((stage) => (
            <li key={stage.label} className="grid grid-cols-[minmax(170px,1fr)_120px] items-center gap-3">
              <div className="mx-auto grid h-9 place-items-center text-sm font-bold text-white shadow-sm" style={{ width: `${stage.width}%`, backgroundColor: stage.color, clipPath: "polygon(6% 0, 94% 0, 86% 100%, 14% 100%)" }}>{stage.value}</div>
              <span className="text-xs font-semibold text-[var(--text-primary)]">{stage.label}</span>
            </li>
          ))}
        </ol>
        <div className="self-center rounded-[var(--radius-control-lg)] border border-[var(--border-default)]">
          <h3 className="border-b border-[var(--divider)] px-3 py-2.5 text-xs font-bold">Booking Cancel Today</h3>
          <div className="grid grid-cols-[1fr_52px] bg-[var(--surface-subtle)] px-3 py-2 text-[11px] font-semibold"><span>Reason</span><span className="text-right">Units</span></div>
          <div className="grid grid-cols-[1fr_52px] gap-2 px-3 py-3 text-xs"><span>{report.cancellation.reason}</span><strong className="kmm-tabular text-right">1</strong></div>
          <div className="grid grid-cols-[1fr_52px] border-t border-[var(--divider)] px-3 py-2.5 text-xs font-bold text-[var(--status-danger)]"><span>Total</span><span className="kmm-tabular text-right">1</span></div>
        </div>
      </div>
    </Card>
  );
}

function TodayDetail() {
  return (
    <Card className="min-w-0 overflow-hidden">
      <SectionBar title="3. TODAY’S SALES & BOOKING DETAIL" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[830px] text-left text-xs">
          <thead className="bg-[var(--surface-subtle)] text-[var(--text-secondary)]"><tr><th className="px-3 py-2.5">No.</th><th className="px-3 py-2.5">Branch</th><th className="px-3 py-2.5">Salesperson</th><th className="px-3 py-2.5">Model</th><th className="px-3 py-2.5 text-right">Sales Today</th><th className="px-3 py-2.5 text-right">Sales MTD</th><th className="px-3 py-2.5 text-right">A HOT</th><th className="px-3 py-2.5 text-right">B HOT</th><th className="px-3 py-2.5">Status</th></tr></thead>
          <tbody className="divide-y divide-[var(--divider)]">
            {report.todayDetail.map((row, index) => <tr key={`${row.salesperson}-${row.model}`}><td className="px-3 py-2.5">{index + 1}</td><td className="px-3 py-2.5">{row.branch}</td><td className="px-3 py-2.5 font-medium">{row.salesperson}</td><td className="px-3 py-2.5 font-medium">{row.model}</td><td className="kmm-tabular px-3 py-2.5 text-right">{row.salesToday}</td><td className="kmm-tabular px-3 py-2.5 text-right">{row.salesMtd}</td><td className="kmm-tabular px-3 py-2.5 text-right">{row.aHot}</td><td className="kmm-tabular px-3 py-2.5 text-right">{row.bHot}</td><td className="px-3 py-2.5"><StatusBadge status={row.tone}>{row.status}</StatusBadge></td></tr>)}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StockHealth() {
  const maxLocation = Math.max(...report.stock.locations.map((row) => row.units));
  const agingGradient = `conic-gradient(${report.stock.aging.map((row, index) => {
    const start = report.stock.aging.slice(0, index).reduce((sum, item) => sum + item.percent, 0);
    return `${row.color} ${start}% ${start + row.percent}%`;
  }).join(", ")})`;
  return (
    <Card className="min-w-0 overflow-hidden">
      <SectionBar title="4. STOCK HEALTH OVERVIEW" />
      <div className="grid gap-px bg-[var(--divider)] md:grid-cols-2 2xl:grid-cols-4">
        <div className="bg-[var(--surface-default)] p-4"><h3 className="text-xs font-bold text-[#3C6E25]">4.1 STOCK VALUE</h3><p className="kmm-tabular mt-3 text-3xl font-semibold">{report.stock.value}<span className="ml-2 text-xs">M MMK</span></p><p className="mt-4 text-xs text-[var(--text-secondary)]">vs Jul-26 <strong className="ml-2 text-[var(--status-danger)]">{report.stock.previousMonthChange} ↓</strong></p></div>
        <div className="bg-[var(--surface-default)] p-4"><h3 className="text-xs font-bold text-[#3C6E25]">4.2 PSI (ENGINE)</h3><dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between"><dt>Sales (MTD)</dt><dd className="font-semibold">10 Units</dd></div><div className="flex justify-between"><dt>Booking (Active)</dt><dd className="font-semibold">79 Units</dd></div><div className="flex justify-between"><dt>Stock (Engine)</dt><dd className="font-semibold">83 Units</dd></div></dl><p className="mt-5 text-center text-xs font-semibold">PSI <strong className="kmm-tabular ml-2 text-2xl text-[var(--brand-600)]">{report.stock.psi}</strong> Months</p></div>
        <div className="bg-[var(--surface-default)] p-4"><h3 className="text-xs font-bold text-[#3C6E25]">4.3 LOCATION OF STOCK</h3><div className="mt-3 space-y-2">{report.stock.locations.map((row) => <div key={row.label} className="grid grid-cols-[112px_minmax(60px,1fr)_28px] items-center gap-2 text-[11px]"><span className="truncate">{row.label}</span><div className="h-2.5 bg-[var(--surface-muted)]"><div className="h-full bg-[var(--brand-500)]" style={{ width: `${(row.units / maxLocation) * 100}%` }} /></div><strong className="kmm-tabular text-right">{row.units}</strong></div>)}</div></div>
        <div className="bg-[var(--surface-default)] p-4"><h3 className="text-xs font-bold text-[#3C6E25]">4.4 AGING STOCK (ENGINE)</h3><div className="mt-3 flex items-center gap-4"><div className="relative size-28 shrink-0 rounded-full" style={{ background: agingGradient }}><div className="absolute inset-[22px] grid place-items-center rounded-full bg-[var(--surface-default)] text-center"><strong className="kmm-tabular text-xl">83</strong><span className="-mt-3 text-[10px]">Units</span></div></div><ul className="min-w-0 space-y-2">{report.stock.aging.map((row) => <li key={row.label} className="flex items-center gap-2 text-[11px]"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} /><span className="min-w-0 flex-1">{row.label}</span><strong className="kmm-tabular">{row.units} ({row.percent}%)</strong></li>)}</ul></div><p className="mt-3 rounded-[var(--radius-control)] bg-[#FFF0EE] px-3 py-2 text-center text-xs font-bold text-[var(--status-danger)]">33 Units &gt; 90 Days</p></div>
      </div>
    </Card>
  );
}

function BookingStock() {
  return (
    <Card className="min-w-0 overflow-hidden">
      <SectionBar title="5. BOOKING × STOCK INTELLIGENCE" />
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-[var(--surface-subtle)] text-[var(--text-secondary)]"><tr><th className="px-3 py-2.5">Model</th><th className="px-3 py-2.5 text-right">A HOT</th><th className="px-3 py-2.5 text-right">B HOT</th><th className="px-3 py-2.5 text-right">Total</th><th className="px-3 py-2.5 text-right">Stock</th><th className="px-3 py-2.5 text-right">Coverage</th><th className="px-3 py-2.5">Status</th></tr></thead><tbody className="divide-y divide-[var(--divider)]">{report.bookingStock.map((row) => <tr key={row.model}><td className="px-3 py-3 font-medium">{row.model}</td><td className="kmm-tabular px-3 py-3 text-right">{row.aHot}</td><td className="kmm-tabular px-3 py-3 text-right">{row.bHot}</td><td className="kmm-tabular px-3 py-3 text-right font-semibold">{row.total}</td><td className="kmm-tabular px-3 py-3 text-right">{row.stock}</td><td className="kmm-tabular px-3 py-3 text-right">{row.coverage}</td><td className="px-3 py-3"><StatusBadge status={row.tone}>{row.status}</StatusBadge></td></tr>)}</tbody></table></div>
    </Card>
  );
}

function ActionRequired() {
  return (
    <Card className="min-w-0 overflow-hidden">
      <SectionBar title="6. ACTION REQUIRED (Top Priority)" action={<span className="grid size-6 place-items-center rounded-full bg-white text-xs font-bold text-[var(--status-danger)]">3</span>} />
      <div className="divide-y divide-[var(--divider)] px-4">
        {report.actions.map((item) => <div key={item.title} className="grid grid-cols-[22px_minmax(0,1fr)_78px] gap-2 py-3 text-xs"><AlertTriangle size={18} className={item.tone === "negative" ? "text-[var(--status-danger)]" : "text-[var(--status-warning)]"} /><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-[11px] text-[var(--text-secondary)]">{item.detail} · Owner: {item.owner}</p></div><span className="self-center rounded-[var(--radius-control)] border border-[var(--border-default)] px-2 py-1.5 text-center text-[11px] font-semibold">{item.action}</span></div>)}
      </div>
    </Card>
  );
}

function ManagementNotes() {
  return (
    <Card className="min-w-0 overflow-hidden">
      <SectionBar title="7. DAILY MANAGEMENT NOTE" />
      <div className="grid gap-px bg-[var(--divider)] sm:grid-cols-3">
        {report.notes.map((column) => <div key={column.title} className="bg-[var(--surface-default)] p-4"><h3 className="rounded-[var(--radius-control)] bg-[#EDF6FA] px-2 py-2 text-xs font-bold">{column.title}</h3><ul className="mt-3 space-y-2 pl-4 text-[11px] leading-5">{column.items.map((item) => <li key={item} className="list-disc">{item}</li>)}</ul></div>)}
      </div>
    </Card>
  );
}

export function DailyManagementPage() {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1800px] p-4 sm:p-5 xl:p-6">
        <div className="space-y-4">
          <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between" aria-labelledby="daily-management-title">
            <div className="min-w-0"><h1 id="daily-management-title" className="text-[27px] font-semibold leading-tight tracking-[-0.025em] sm:text-[31px]">KMM Daily Management Report</h1><p className="mt-1 text-sm text-[var(--text-secondary)]">Daily Sales, Booking & Stock Overview</p></div>
            <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-[var(--radius-pill)] bg-[#FFF1DD] px-3 py-2 font-bold text-[#A65300]">Mockup Mode · Sample Data</span><span className="rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-2"><CalendarDays size={14} className="mr-1.5 inline" />09 Aug 2026 (Sun)</span><span className="rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-2">Last update {report.lastUpdated}</span><ExportButton onClick={downloadMockup} /></div>
          </section>

          <div role="note" className="flex items-center gap-2 rounded-[var(--radius-control-lg)] border border-[#F3C97A] bg-[#FFF8E8] px-4 py-2.5 text-xs text-[#754600]"><Database size={16} className="shrink-0" /><span>ตัวเลขทั้งหมดในหน้านี้เป็นข้อมูลตัวอย่างสำหรับตรวจรูปแบบ ยังไม่ใช่ข้อมูล Production</span></div>

          <KpiStrip />
          <div className="grid gap-4 2xl:grid-cols-[0.95fr_1.05fr]"><SalesPerformance /><BookingPipeline /></div>
          <div className="grid gap-4 2xl:grid-cols-[0.8fr_1.2fr]"><TodayDetail /><StockHealth /></div>
          <div className="grid gap-4 2xl:grid-cols-[1.05fr_0.8fr_1.15fr]"><BookingStock /><ActionRequired /><ManagementNotes /></div>

          <footer className="flex flex-col gap-1 border-t border-[var(--divider)] pt-3 text-[10px] text-[var(--text-tertiary)] sm:flex-row sm:justify-between"><span>Remark: MTD = Month To Date</span><span>Data Source: Mockup sample · replace with governed Sales, Booking and Stock sources before release</span><span className="flex items-center gap-1"><PackageCheck size={12} />Prepared for KMM Sales Division</span></footer>
        </div>
      </main>
    </div>
  );
}
