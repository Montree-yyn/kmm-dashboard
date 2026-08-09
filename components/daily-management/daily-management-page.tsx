"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CircleX,
  FilePenLine,
  PackageCheck,
  ShoppingCart,
  Target,
  WalletCards,
} from "lucide-react";
import { dailyManagementMock as report } from "../../lib/daily-management/mock-data";
import {
  DAILY_MANAGEMENT_INPUT_PUBLISHED,
  defaultDailyManagementInput,
  loadPublishedDailyManagementInput,
  type DailyManagementInputSnapshot,
} from "../../lib/daily-management/input-storage";
import { Card } from "../ui/card";
import { ExportButton } from "../design-system/export-button";
import { StatusBadge } from "../design-system/status-badge";

const icons: Record<string, ReactNode> = {
  salesToday: <ShoppingCart size={17} />,
  salesMtd: <CalendarDays size={17} />,
  target: <Target size={17} />,
  bookingToday: <ClipboardCheck size={17} />,
  activeBooking: <ClipboardList size={17} />,
  stockEngine: <Boxes size={17} />,
  stockValue: <WalletCards size={17} />,
  cancelToday: <CircleX size={17} />,
};

const tones = {
  green: "text-[#18813A] bg-[#EAF7EE]",
  blue: "text-[#246FC7] bg-[#EAF3FD]",
  teal: "text-[#087F7B] bg-[#E7F7F5]",
  purple: "text-[#704197] bg-[#F3ECF8]",
  orange: "text-[#C45100] bg-[#FFF1E6]",
} as const;

const panelClass = "min-w-0 overflow-hidden border-[#E8E9ED] shadow-[0_8px_24px_rgba(27,31,42,0.06)]";

type KpiMetricItem = {
  key: string;
  label: string;
  value: string;
  unit: string;
  detail: string;
  tone: keyof typeof tones;
};

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

function PanelHeader({ index, title, action }: { index: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--divider)] bg-[color-mix(in_srgb,var(--surface-default)_96%,var(--surface-subtle))] px-3.5 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-[8px] bg-[#FFF0E4] text-[10px] font-bold text-[#C45100]">{index}</span>
        <h2 className="truncate text-[13px] font-semibold tracking-[-0.012em] text-[var(--text-primary)] sm:text-sm">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function KpiStrip({ input }: { input: DailyManagementInputSnapshot }) {
  const salesMtd = Number(report.kpis.find((item) => item.key === "salesMtd")?.value ?? 0);
  const achievement = input.target.mtdTarget ? `${((salesMtd / input.target.mtdTarget) * 100).toFixed(1)}%` : "—";
  const items: KpiMetricItem[] = report.kpis.map((item) => item.key === "target" ? { ...item, value: String(input.target.mtdTarget), detail: `${achievement} achievement · ${salesMtd - input.target.expectedPace} vs pace` } : item);
  const dailyItems: KpiMetricItem[] = [
    items.find((item) => item.key === "salesToday"),
    items.find((item) => item.key === "bookingToday"),
    { key: "cancelToday", label: "Cancel Today", value: String(input.bookingLifecycle.cancelUnits), unit: "Units", detail: input.bookingLifecycle.cancelReason || "No cancellation", tone: "orange" as const },
  ].filter((item): item is KpiMetricItem => Boolean(item));
  const cumulativeItems = items.filter((item) => !["salesToday", "bookingToday"].includes(item.key));

  const metrics = (metricItems: KpiMetricItem[]) => metricItems.map((item) => (
    <div key={item.key} className="group min-w-0 bg-[var(--surface-default)] px-3 py-2.5 transition-colors hover:bg-[#FCFCFD]">
      <div className="flex items-center gap-2">
        <span className={`grid size-7 shrink-0 place-items-center rounded-[9px] ${tones[item.tone]}`}>{icons[item.key]}</span>
        <p className="text-[9px] font-bold uppercase tracking-[0.05em] text-[var(--text-secondary)]">{item.label}</p>
      </div>
      <p className="kmm-tabular mt-1.5 flex min-w-0 items-baseline gap-1.5 text-[22px] font-semibold leading-none tracking-[-0.03em] sm:text-[24px]">
        <span>{item.value}</span><span className="text-[9px] font-semibold tracking-normal text-[var(--text-secondary)]">{item.unit}</span>
      </p>
      <p className={`mt-1.5 min-h-3 text-[9px] leading-3 ${item.key === "stockValue" || item.key === "target" || item.key === "cancelToday" ? "font-semibold text-[var(--status-danger)]" : "text-[var(--text-secondary)]"}`}>{item.detail}</p>
    </div>
  ));

  return (
    <Card className={panelClass} role="region" aria-label="Daily and cumulative management KPIs">
      <div className="grid gap-px bg-[var(--divider)] md:grid-cols-[116px_minmax(0,1fr)]">
        <div className="flex items-center justify-between gap-3 bg-[#F4FBF7] px-3 py-2.5 md:block"><span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#267145]">Daily Pulse</span><span className="mt-1 hidden text-[8px] leading-3 text-[#5D7967] md:block">Today’s operating movement</span></div>
        <div className="grid grid-cols-1 gap-px bg-[var(--divider)] sm:grid-cols-3">{metrics(dailyItems)}</div>
        <div className="flex items-center justify-between gap-3 bg-[#FFF7F0] px-3 py-2.5 md:block"><span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#A34A09]">Cumulative</span><span className="mt-1 hidden text-[8px] leading-3 text-[#806653] md:block">MTD and current position</span></div>
        <div className="grid grid-cols-1 gap-px bg-[var(--divider)] sm:grid-cols-2 xl:grid-cols-5">{metrics(cumulativeItems)}</div>
      </div>
    </Card>
  );
}

function PerformerList({ title, rows, attention = false }: { title: string; rows: readonly { name: string; result: string; achievement: string }[]; attention?: boolean }) {
  return (
    <div className="min-w-0">
      <h3 className={`text-[10px] font-bold uppercase tracking-[0.04em] ${attention ? "text-[var(--status-danger)]" : "text-[var(--text-secondary)]"}`}>{title}</h3>
      <ol className="mt-1.5 divide-y divide-[var(--divider)]">
        {rows.map((row, index) => (
          <li key={row.name} className="grid grid-cols-[16px_minmax(0,1fr)_36px] items-center gap-1.5 py-1.5 text-[10px]">
            <span className={`grid size-4 place-items-center rounded-full text-[8px] font-bold ${attention ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)]" : "bg-[var(--status-success-bg)] text-[var(--status-success)]"}`}>{index + 1}</span>
            <span className="min-w-0"><span className="block break-words font-medium leading-3">{row.name}</span><span className="kmm-tabular text-[8px] text-[var(--text-tertiary)]">{row.result}</span></span>
            <span className={`kmm-tabular text-right font-semibold ${attention ? "text-[var(--status-danger)]" : "text-[var(--status-success)]"}`}>{row.achievement}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SalesPerformance() {
  return (
    <Card className={panelClass}>
      <PanelHeader index="1" title="Sales Performance" />
      <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
        <div className="min-w-0">
          <div role="table" aria-label="Branch sales performance" className="hidden text-[10px] sm:block">
            <div role="row" className="grid grid-cols-[minmax(120px,1.6fr)_repeat(4,minmax(36px,0.6fr))] gap-1 rounded-t-[10px] bg-[var(--surface-subtle)] px-2 py-2 font-semibold text-[var(--text-secondary)]"><span>Branch</span><span className="text-right">Sales</span><span className="text-right">Target</span><span className="text-right">Ach.</span><span className="text-right">Pace</span></div>
            {report.salesPerformance.branches.map((row) => <div role="row" key={row.branch} className="grid grid-cols-[minmax(120px,1.6fr)_repeat(4,minmax(36px,0.6fr))] items-center gap-1 border-b border-[var(--divider)] px-2 py-2"><span className="break-words font-medium leading-3">{row.branch}</span><strong className="kmm-tabular text-right">{row.sales}</strong><span className="kmm-tabular text-right">{row.target}</span><strong className="kmm-tabular text-right">{row.achievement}</strong><strong className={`kmm-tabular text-right ${row.pace.startsWith("+") ? "text-[var(--status-success)]" : "text-[var(--status-danger)]"}`}>{row.pace}</strong></div>)}
            <div role="row" className="grid grid-cols-[minmax(120px,1.6fr)_repeat(4,minmax(36px,0.6fr))] gap-1 rounded-b-[10px] bg-[#FAFAFB] px-2 py-2 font-bold"><span>Total</span><span className="kmm-tabular text-right">10</span><span className="kmm-tabular text-right">48</span><span className="kmm-tabular text-right">20.8%</span><span className="kmm-tabular text-right text-[var(--status-danger)]">-4</span></div>
          </div>
          <div className="grid gap-2 sm:hidden">{report.salesPerformance.branches.map((row) => <div key={row.branch} className="rounded-[10px] bg-[var(--surface-subtle)] p-2.5"><div className="flex items-center justify-between gap-2"><strong className="truncate text-[11px]">{row.branch}</strong><span className={`text-[10px] font-bold ${row.pace.startsWith("+") ? "text-[var(--status-success)]" : "text-[var(--status-danger)]"}`}>{row.pace}</span></div><div className="mt-2 grid grid-cols-3 gap-2 text-center text-[9px] text-[var(--text-secondary)]"><span>Sales<strong className="mt-0.5 block text-xs text-[var(--text-primary)]">{row.sales}</strong></span><span>Target<strong className="mt-0.5 block text-xs text-[var(--text-primary)]">{row.target}</strong></span><span>Ach.<strong className="mt-0.5 block text-xs text-[var(--text-primary)]">{row.achievement}</strong></span></div></div>)}</div>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-3"><PerformerList title="Top Performers" rows={report.salesPerformance.top} /><PerformerList title="Need Attention" rows={report.salesPerformance.attention} attention /></div>
      </div>
    </Card>
  );
}

function BookingPipeline({ input }: { input: DailyManagementInputSnapshot }) {
  const lifecycleValues: Record<string, number> = { "Wait Approve": input.bookingLifecycle.waitApprove, "Wait Delivery": input.bookingLifecycle.waitDelivery, "Delivered Today": input.bookingLifecycle.deliveredToday };
  const stages = report.bookingPipeline.map((stage) => ({ ...stage, value: lifecycleValues[stage.label] ?? stage.value }));
  const maxValue = Math.max(...stages.map((stage) => stage.value), 1);
  return (
    <Card className={panelClass}>
      <PanelHeader index="2" title="Booking Pipeline" action={<span className="flex items-center gap-1 rounded-full bg-[var(--status-danger-bg)] px-2 py-1 text-[9px] font-bold text-[var(--status-danger)]"><AlertTriangle size={12} />{input.bookingLifecycle.cancelUnits} cancel</span>} />
      <div className="grid gap-3 p-3">
        <div className="space-y-2" role="img" aria-label="Booking pipeline distribution">
          {stages.map((stage) => (
            <div key={stage.label} className="grid grid-cols-[82px_minmax(0,1fr)_28px] items-center gap-2">
              <span className="truncate text-[9px] font-semibold text-[var(--text-secondary)]" title={stage.label}>{stage.label}</span>
              <div className="h-5 overflow-hidden rounded-full bg-[#F0F1F4]"><div className="flex h-full min-w-5 items-center justify-end rounded-full pr-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]" style={{ width: `${Math.max(7, (stage.value / maxValue) * 100)}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${stage.color} 68%, white), ${stage.color})` }}><span className="text-[8px] font-bold text-white">{stage.value}</span></div></div>
              <strong className="kmm-tabular text-right text-[10px]">{stage.value}</strong>
            </div>
          ))}
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-[12px] bg-[#FFF6F3] px-3 py-2.5"><span className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-[0.04em] text-[#A3422D]">Cancellation Today</span><span className="mt-0.5 block text-[8px] leading-3 text-[#75483E]">{input.bookingLifecycle.cancelReason || "No cancellation"}</span></span><strong className="kmm-tabular shrink-0 text-xl font-semibold text-[var(--status-danger)]">{input.bookingLifecycle.cancelUnits}<span className="ml-1 text-[8px]">unit</span></strong></div>
      </div>
    </Card>
  );
}

function TodayDetail() {
  return (
    <Card className={panelClass}>
      <PanelHeader index="3" title="Today’s Sales & Booking Detail" />
      <div role="table" aria-label="Today's sales and booking detail" className="hidden text-[9px] sm:block">
        <div role="row" className="grid grid-cols-[50px_minmax(95px,0.8fr)_minmax(125px,1.3fr)_58px_62px_86px] gap-2 bg-[var(--surface-subtle)] px-3 py-2 font-semibold text-[var(--text-secondary)]"><span>Branch</span><span>Salesperson</span><span>Model</span><span className="text-center">Sales<br />T / MTD</span><span className="text-center">Booking<br />A / B</span><span>Status</span></div>
        {report.todayDetail.map((row) => <div role="row" key={`${row.salesperson}-${row.model}`} className="grid grid-cols-[50px_minmax(95px,0.8fr)_minmax(125px,1.3fr)_58px_62px_86px] items-center gap-2 border-b border-[var(--divider)] px-3 py-2"><span>{row.branch}</span><span className="break-words font-medium leading-3">{row.salesperson}</span><span className="break-words font-medium leading-3">{row.model}</span><span className="kmm-tabular text-center">{row.salesToday} / {row.salesMtd}</span><span className="kmm-tabular text-center">{row.aHot} / {row.bHot}</span><StatusBadge status={row.tone} className="min-h-0 max-w-full px-1.5 py-0.5 text-[8px] leading-3">{row.status}</StatusBadge></div>)}
      </div>
      <div className="grid gap-2 p-3 sm:hidden">{report.todayDetail.map((row) => <div key={`${row.salesperson}-${row.model}`} className="rounded-[11px] bg-[var(--surface-subtle)] p-2.5"><div className="flex items-start justify-between gap-2"><span className="min-w-0"><strong className="block truncate text-[11px]">{row.salesperson}</strong><span className="mt-0.5 block truncate text-[9px] text-[var(--text-secondary)]">{row.branch} · {row.model}</span></span><StatusBadge status={row.tone} className="min-h-0 shrink-0 px-1.5 py-0.5 text-[8px] leading-3">{row.status}</StatusBadge></div><div className="mt-2 flex gap-4 text-[9px]"><span>Sales <strong>{row.salesToday}/{row.salesMtd}</strong></span><span>Booking <strong>{row.aHot}/{row.bHot}</strong></span></div></div>)}</div>
    </Card>
  );
}

function StockHealth() {
  const maxLocation = Math.max(...report.stock.locations.map((row) => row.units));
  const agingGradient = "conic-gradient(from -90deg, #54A948 0 24%, #FFFFFF 24% 25%, #F6C43C 25% 51%, #FFFFFF 51% 52%, #F28C28 52% 59%, #FFFFFF 59% 60%, #EF4B2F 60% 99%, #FFFFFF 99% 100%)";
  return (
    <Card className={panelClass}>
      <PanelHeader index="4" title="Stock Health Overview" />
      <div className="grid gap-px bg-[var(--divider)] sm:grid-cols-2">
        <div className="bg-[var(--surface-default)] p-3"><p className="text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-secondary)]">Stock Value</p><p className="kmm-tabular mt-2 text-[22px] font-semibold tracking-[-0.025em]">{report.stock.value}<span className="ml-1.5 text-[9px]">M MMK</span></p><p className="mt-2 inline-flex rounded-full bg-[var(--status-danger-bg)] px-2 py-1 text-[9px] font-bold text-[var(--status-danger)]">{report.stock.previousMonthChange} vs Jul</p></div>
        <div className="bg-[var(--surface-default)] p-3"><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-secondary)]">PSI Engine</p><strong className="kmm-tabular text-xl text-[var(--brand-600)]">{report.stock.psi}<span className="ml-1 text-[8px] text-[var(--text-secondary)]">mo.</span></strong></div><div className="mt-3 grid grid-cols-3 gap-1 rounded-[10px] bg-[var(--surface-subtle)] p-2 text-center text-[8px] text-[var(--text-secondary)]"><span>Sales<strong className="mt-0.5 block text-[11px] text-[var(--text-primary)]">10</strong></span><span>Booking<strong className="mt-0.5 block text-[11px] text-[var(--text-primary)]">79</strong></span><span>Stock<strong className="mt-0.5 block text-[11px] text-[var(--text-primary)]">83</strong></span></div></div>
        <div className="bg-[var(--surface-default)] p-3"><p className="text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-secondary)]">Stock Distribution</p><div className="mt-2 space-y-1.5">{report.stock.locations.map((row) => <div key={row.label} className="grid grid-cols-[84px_minmax(0,1fr)_20px] items-center gap-1.5 text-[8px]"><span className="truncate" title={row.label}>{row.label}</span><div className="h-2 overflow-hidden rounded-full bg-[#F0F1F4]"><div className="h-full rounded-full bg-gradient-to-r from-[#FFA45C] to-[var(--brand-500)]" style={{ width: `${(row.units / maxLocation) * 100}%` }} /></div><strong className="kmm-tabular text-right">{row.units}</strong></div>)}</div></div>
        <div className="bg-[var(--surface-default)] p-3"><div className="flex items-center justify-between gap-2"><p className="text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-secondary)]">Stock Aging</p><span className="rounded-full bg-[var(--status-danger-bg)] px-2 py-1 text-[8px] font-bold text-[var(--status-danger)]">40% high risk</span></div><div className="mt-2 grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3"><div className="relative mx-auto size-24" role="img" aria-label="Stock aging: 33 of 83 units are older than 90 days"><div className="absolute inset-0 rounded-full border border-[#ECEEF1] bg-[#F8F9FA]" /><div className="absolute inset-1 rounded-full shadow-[0_8px_18px_rgba(31,41,55,0.10)]" style={{ background: agingGradient }} /><div className="absolute inset-[20px] grid place-items-center rounded-full bg-white shadow-[inset_0_0_0_1px_#ECEEF1]"><span className="text-center"><strong className="kmm-tabular block text-lg leading-none text-[var(--status-danger)]">33</strong><span className="mt-1 block text-[7px] font-semibold text-[var(--text-secondary)]">&gt; 90 days</span></span></div><span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#202124] px-2 py-0.5 text-[7px] font-bold text-white shadow-sm">83 total</span></div><ul className="min-w-0 space-y-1.5">{report.stock.aging.map((row) => <li key={row.label} className="grid grid-cols-[8px_minmax(0,1fr)_48px] items-center gap-1.5 text-[8px]"><span className="size-2 rounded-full" style={{ backgroundColor: row.color }} /><span className="leading-3">{row.label}</span><strong className="kmm-tabular text-right">{row.units} · {row.percent}%</strong></li>)}</ul></div></div>
      </div>
    </Card>
  );
}

function BookingStock() {
  return (
    <Card className={panelClass}>
      <PanelHeader index="5" title="Booking × Stock Intelligence" />
      <div role="table" aria-label="Booking and stock intelligence" className="hidden text-[9px] sm:block"><div role="row" className="grid grid-cols-[minmax(120px,1.4fr)_54px_64px_76px_minmax(96px,0.9fr)] gap-1 bg-[var(--surface-subtle)] px-3 py-2 font-semibold text-[var(--text-secondary)]"><span>Model</span><span className="text-center">A / B</span><span className="text-center">Book / Stock</span><span className="text-center">Coverage</span><span>Status</span></div>{report.bookingStock.map((row) => <div role="row" key={row.model} className="grid grid-cols-[minmax(120px,1.4fr)_54px_64px_76px_minmax(96px,0.9fr)] items-center gap-1 border-b border-[var(--divider)] px-3 py-2"><strong className="break-words leading-3">{row.model}</strong><span className="kmm-tabular text-center">{row.aHot} / {row.bHot}</span><span className="kmm-tabular text-center">{row.total} / {row.stock}</span><span className="kmm-tabular text-center">{row.coverage}</span><StatusBadge status={row.tone} className="min-h-0 max-w-full px-1.5 py-0.5 text-[8px] leading-3">{row.status}</StatusBadge></div>)}</div>
      <div className="grid gap-2 p-3 sm:hidden">{report.bookingStock.map((row) => <div key={row.model} className="rounded-[10px] bg-[var(--surface-subtle)] p-2.5"><div className="flex items-start justify-between gap-2"><strong className="text-[10px]">{row.model}</strong><StatusBadge status={row.tone} className="min-h-0 shrink-0 px-1.5 py-0.5 text-[8px] leading-3">{row.status}</StatusBadge></div><div className="mt-2 grid grid-cols-3 text-center text-[8px] text-[var(--text-secondary)]"><span>A/B<strong className="block text-[10px] text-[var(--text-primary)]">{row.aHot}/{row.bHot}</strong></span><span>Book/Stock<strong className="block text-[10px] text-[var(--text-primary)]">{row.total}/{row.stock}</strong></span><span>Coverage<strong className="block text-[10px] text-[var(--text-primary)]">{row.coverage}</strong></span></div></div>)}</div>
    </Card>
  );
}

function ActionRequired({ input }: { input: DailyManagementInputSnapshot }) {
  return (
    <Card className={panelClass}>
      <PanelHeader index="6" title="Action Required" action={<span className="rounded-full bg-[var(--status-danger-bg)] px-2 py-1 text-[8px] font-bold text-[var(--status-danger)]">{input.actions.length} priorities</span>} />
      <div className="divide-y divide-[var(--divider)] px-3">{input.actions.map((item) => <div key={item.title} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 py-2.5"><span className={`mt-0.5 grid size-4 place-items-center rounded-full ${item.priority === "critical" ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)]" : "bg-[var(--status-warning-bg)] text-[var(--status-warning)]"}`}><AlertTriangle size={10} /></span><div className="min-w-0"><p className="text-[10px] font-semibold leading-3.5">{item.title}</p><p className="mt-0.5 text-[8px] leading-3 text-[var(--text-secondary)]">{item.detail} · {item.owner}</p><span className="mt-1 inline-flex rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[8px] font-semibold">{item.nextStep}</span></div></div>)}</div>
    </Card>
  );
}

function ManagementNotes({ input }: { input: DailyManagementInputSnapshot }) {
  const noteColumns = [{ title: "Situation", items: input.notes.situation.split("\n").filter(Boolean) }, { title: "Decision", items: input.notes.decision.split("\n").filter(Boolean) }, { title: "Tomorrow", items: input.notes.tomorrowFocus.split("\n").filter(Boolean) }];
  return (
    <Card className={panelClass}>
      <PanelHeader index="7" title="Daily Management Note" />
      <div className="grid gap-px bg-[var(--divider)] sm:grid-cols-3">{noteColumns.map((column) => <div key={column.title} className="min-w-0 bg-[var(--surface-default)] p-3"><h3 className="text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-secondary)]">{column.title}</h3><ul className="mt-2 space-y-1.5 text-[8px] leading-3.5">{column.items.map((item) => <li key={item} className="flex gap-1.5"><span className="mt-1 size-1 shrink-0 rounded-full bg-[var(--brand-500)]" /><span>{item}</span></li>)}</ul></div>)}</div>
    </Card>
  );
}

export function DailyManagementPage() {
  const [input, setInput] = useState<DailyManagementInputSnapshot>(() => structuredClone(defaultDailyManagementInput));
  useEffect(() => { const refresh = () => setInput(loadPublishedDailyManagementInput()); refresh(); window.addEventListener(DAILY_MANAGEMENT_INPUT_PUBLISHED, refresh); return () => window.removeEventListener(DAILY_MANAGEMENT_INPUT_PUBLISHED, refresh); }, []);
  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#F6F7F9] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1900px] p-3 sm:p-4 xl:px-5 xl:py-4">
        <div className="space-y-3">
          <section className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between" aria-labelledby="daily-management-title">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 id="daily-management-title" className="text-[23px] font-semibold leading-tight tracking-[-0.025em] sm:text-[26px]">KMM Daily Management Report</h1><span className="rounded-full bg-[#FFF0E4] px-2.5 py-1 text-[9px] font-bold text-[#9D4300]">Mockup · Sample Data</span></div><p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">Daily Sales, Booking & Stock Overview · ตัวเลขยังไม่ใช่ข้อมูล Production</p></div>
            <div className="flex flex-wrap items-center gap-2 text-[10px]"><span className="rounded-[10px] border border-[var(--border-default)] bg-white px-3 py-2"><CalendarDays size={12} className="mr-1.5 inline" />{input.reportDate}</span><span className="rounded-[10px] border border-[var(--border-default)] bg-white px-3 py-2">Updated {input.publishedAt ? new Date(input.publishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : report.lastUpdated}</span><Link href="/daily-management/input" className="inline-flex min-h-11 items-center gap-2 rounded-[11px] border border-[var(--border-default)] bg-white px-3 font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><FilePenLine size={14} />Update Inputs</Link><ExportButton onClick={downloadMockup} /></div>
          </section>
          <KpiStrip input={input} />
          <div className="grid gap-3 xl:grid-cols-[1.35fr_0.65fr]"><SalesPerformance /><BookingPipeline input={input} /></div>
          <div className="grid gap-3 xl:grid-cols-[1.08fr_0.92fr]"><TodayDetail /><StockHealth /></div>
          <div className="grid gap-3 xl:grid-cols-[1.18fr_0.82fr]"><BookingStock /><ActionRequired input={input} /></div>
          <ManagementNotes input={input} />
          <footer className="flex flex-col gap-1 border-t border-[var(--divider)] pt-2 text-[8px] text-[var(--text-tertiary)] sm:flex-row sm:justify-between"><span>MTD = Month To Date</span><span>Mockup sample · replace with governed sources before release</span><span className="flex items-center gap-1"><PackageCheck size={10} />KMM Sales Division</span></footer>
        </div>
      </main>
    </div>
  );
}
