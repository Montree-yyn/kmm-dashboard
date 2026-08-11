"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FilePenLine,
  PackageCheck,
  ShoppingCart,
  Target,
  WalletCards,
} from "lucide-react";
import { loadDailyManagementReport } from "../../lib/daily-management/client";
import type { DailyManagementSnapshot } from "../../lib/daily-management/types";
import { loadDailyManagementInput } from "../../lib/daily-management/input-client";
import {
  DAILY_MANAGEMENT_INPUT_PUBLISHED,
  type DailyManagementInputSnapshot,
} from "../../lib/daily-management/input-storage";
import { Card } from "../ui/card";
import { ExportButton } from "../design-system/export-button";
import { StatusBadge } from "../design-system/status-badge";
import { useLocale } from "../../src/hooks/useLocale";

const icons: Record<string, ReactNode> = {
  salesToday: <ShoppingCart size={17} />,
  salesMtd: <CalendarDays size={17} />,
  target: <Target size={17} />,
  bookingToday: <ClipboardCheck size={17} />,
  activeBooking: <ClipboardList size={17} />,
  stockEngine: <Boxes size={17} />,
  stockValue: <WalletCards size={17} />,
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

type BadgeTone = "positive" | "negative" | "warning" | "neutral" | "active" | "inactive";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadReport(input: DailyManagementInputSnapshot, snapshot: DailyManagementSnapshot | null) {
  const rows = [
    ["KMM DAILY MANAGEMENT REPORT"],
    ["Report Date", input.reportDate],
    ["Data source", snapshot ? "D1 Sales, Booking and Stock" : "Report data is loading"],
    [],
    ["KPI", "Value", "Unit", "Detail"],
    ["Sales Today", snapshot?.sales.todayUnits ?? "—", "Units", "D1"],
    ["Sales MTD", snapshot?.sales.mtdUnits ?? "—", "Units", "D1"],
    ["MTD Target", input.target.mtdTarget, "Units", `Expected pace ${input.target.expectedPace}`],
    ["Booking Today", snapshot?.booking.newToday ?? "—", "Units", "D1"],
    ["Active Booking", snapshot?.booking.activeUnits ?? "—", "Units", "D1"],
    ["Stock (Engine)", snapshot?.stock.engineUnits ?? "—", "Units", "D1"],
    [],
    ["Branch", "Sales MTD"],
    ...(snapshot?.sales.byBranch.map((item) => [item.branch, item.units]) ?? []),
  ];
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kmm-daily-management-${input.reportDate}.csv`;
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

function KpiStrip({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  const targetDetail = snapshot.target
    ? snapshot.target.evaluationEligible
      ? `${snapshot.target.achievementPercent?.toFixed(1) ?? "—"}% achievement · gap ${snapshot.target.gap?.toLocaleString() ?? "—"}`
      : `Approved target · context only · ${snapshot.target.sourceVersion}`
    : snapshot.scope.branch
      ? "Company target is not applied to a branch scope"
      : "No approved monthly target";
  const kpis: KpiMetricItem[] = [
    { key: "salesToday", label: "Sales Today", value: String(snapshot.sales.todayUnits), unit: "Units", detail: `D1 data · ${snapshot.asOfDate}`, tone: "green" },
    { key: "salesMtd", label: "Sales MTD", value: String(snapshot.sales.mtdUnits), unit: "Units", detail: `Through ${snapshot.asOfDate}`, tone: "blue" },
    { key: "target", label: "Monthly Target", value: snapshot.target ? String(snapshot.target.monthlyUnits) : "—", unit: "Units", detail: targetDetail, tone: "teal" },
    { key: "bookingToday", label: "Booking Today", value: String(snapshot.booking.newToday), unit: "Units", detail: `D1 data · ${snapshot.asOfDate}`, tone: "purple" },
    { key: "activeBooking", label: "Active Booking", value: String(snapshot.booking.activeUnits), unit: "Units", detail: "Canonical A/B/C HOT", tone: "orange" },
    { key: "stockEngine", label: "Stock (Engine)", value: String(snapshot.stock.engineUnits), unit: "Units", detail: snapshot.sourceDates.stock ? `Snapshot ${snapshot.sourceDates.stock}` : "Snapshot date unavailable", tone: "teal" },
  ];

  return (
    <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Daily management KPIs">
      {kpis.map((item) => {
        const urgent = item.key === "target" && snapshot.target?.evaluationEligible && (snapshot.target.achievementPercent ?? 100) < 100;
        return (
          <Card key={item.key} className={`${panelClass} min-h-[122px] bg-white p-3`}>
            <div className="flex items-center justify-between gap-2"><p className="text-[9px] font-bold uppercase tracking-[0.06em] text-[var(--text-secondary)]">{item.label}</p><span className={`grid size-7 shrink-0 place-items-center rounded-[9px] ring-1 ring-inset ring-black/[0.03] ${tones[item.tone]}`}>{icons[item.key]}</span></div>
            <p className="kmm-tabular mt-2 flex min-w-0 items-baseline gap-1.5 text-[25px] font-semibold leading-none tracking-[-0.035em]"><span>{item.value}</span><span className="text-[8px] font-semibold tracking-normal text-[var(--text-secondary)]">{item.unit}</span></p>
            <p className={`relative z-10 mt-2 min-h-6 text-[8px] font-medium leading-3 ${urgent ? "text-[var(--status-danger)]" : "text-[var(--text-secondary)]"}`}>{item.detail}</p>
          </Card>
        );
      })}
    </section>
  );
}

function PerformerList({ title, rows }: { title: string; rows: readonly { name: string; result: string; achievement: string }[] }) {
  return (
    <div className="min-w-0">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--text-secondary)]">{title}</h3>
      <ol className="mt-1.5 divide-y divide-[var(--divider)]">
        {rows.map((row, index) => (
          <li key={row.name} className="grid grid-cols-[16px_minmax(0,1fr)_36px] items-center gap-1.5 py-1.5 text-[10px]">
            <span className="grid size-4 place-items-center rounded-full bg-[var(--status-success-bg)] text-[8px] font-bold text-[var(--status-success)]">{index + 1}</span>
            <span className="min-w-0"><span className="block break-words font-medium leading-3">{row.name}</span><span className="kmm-tabular text-[8px] text-[var(--text-tertiary)]">{row.result}</span></span>
            <span className="kmm-tabular text-right font-semibold text-[var(--status-success)]">{row.achievement}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SalesPerformance({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  const branches = snapshot.sales.byBranch.map((row) => ({ branch: row.branch, sales: row.units }));
  const maxBranchSales = Math.max(...branches.map((item) => item.sales), 1);
  const topPerformers = snapshot.sales.topSalespeople.map((row) => ({ name: row.salesperson, result: `${row.units} units`, achievement: "MTD" }));
  return (
    <Card className={panelClass}>
      <PanelHeader index="1" title="Sales Performance" action={<span className="rounded-full bg-[var(--surface-subtle)] px-2 py-1 text-[8px] font-bold text-[var(--text-secondary)]">{snapshot.sales.mtdUnits} MTD units</span>} />
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_190px]">
        <div className="min-w-0 rounded-[14px] border border-[#ECEEF2] bg-white p-3" role="img" aria-label="Branch sales mix relative to the highest-selling branch">
          <div className="mb-3 flex items-center justify-between gap-3"><span className="text-[9px] font-bold uppercase tracking-[0.05em] text-[var(--text-secondary)]">Branch sales mix</span><span className="text-[8px] text-[var(--text-tertiary)]">Relative scale</span></div>
          <div className="space-y-3">{branches.map((row) => <div key={row.branch} className="grid grid-cols-[minmax(110px,0.85fr)_minmax(110px,1.4fr)_50px] items-center gap-3"><span className="min-w-0 text-[9px] font-semibold leading-3">{row.branch}</span><div className="relative h-3 overflow-hidden rounded-full bg-[#ECEEF2]"><div className="h-full rounded-full bg-[var(--brand-500)]" style={{ width: `${Math.max(4, (row.sales / maxBranchSales) * 100)}%` }} /></div><span className="kmm-tabular text-right text-[9px]"><strong>{row.sales}</strong><span className="text-[var(--text-tertiary)]"> units</span></span></div>)}</div>
          <div className="mt-3 border-t border-[var(--divider)] pt-2 text-[8px] text-[var(--text-secondary)]">MTD total <strong className="kmm-tabular text-[var(--text-primary)]">{snapshot.sales.mtdUnits} units</strong> · branch targets are not available</div>
        </div>
        <div className="min-w-0 rounded-[14px] bg-[#F8FBF9] p-3"><PerformerList title="Top Performers" rows={topPerformers} /></div>
      </div>
    </Card>
  );
}

function BookingPipeline({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  const stages = [
    { label: "New Today", value: snapshot.booking.newToday, color: "#61AF4D" },
    { label: "A HOT", value: snapshot.booking.aHot, color: "#D6A500" },
    { label: "B HOT", value: snapshot.booking.bHot, color: "#F97316" },
    { label: "C HOT", value: snapshot.booking.cHot, color: "#8B4BB5" },
    { label: "Active Booking", value: snapshot.booking.activeUnits, color: "#3B82F6" },
  ];
  const maxValue = Math.max(...stages.map((stage) => stage.value), 1);
  return (
    <Card className={panelClass}>
      <PanelHeader index="2" title="Booking Pipeline" action={<span className="rounded-full bg-[var(--surface-subtle)] px-2 py-1 text-[8px] font-bold text-[var(--text-secondary)]">Canonical HOT status</span>} />
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
        <div className="flex min-w-0 items-start gap-2 rounded-[12px] bg-[var(--surface-subtle)] px-3 py-2.5 text-[9px] leading-4 text-[var(--text-secondary)]"><AlertTriangle className="mt-0.5 shrink-0" size={13} /><span>Wait Approve, Wait Delivery, Delivered Today and cancellation are unavailable until canonical lifecycle events are persisted.</span></div>
      </div>
    </Card>
  );
}

function TodayDetail({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  const rows = [
    ...snapshot.sales.today.map((row) => ({ branch: row.branch, salesperson: row.salesperson, model: row.model, salesToday: row.quantity, salesMtd: snapshot.sales.bySalesperson.find((item) => item.salesperson === row.salesperson)?.units ?? 0, aHot: 0, bHot: 0, status: "Sales", tone: "positive" })),
    ...snapshot.booking.today.map((row) => ({ branch: row.branch, salesperson: row.salesperson, model: row.model, salesToday: 0, salesMtd: 0, aHot: row.purchaseStatus === "A HOT" ? 1 : 0, bHot: row.purchaseStatus === "B HOT" ? 1 : 0, status: row.purchaseStatus, tone: "warning" })),
  ];
  return (
    <Card className={panelClass}>
      <PanelHeader index="3" title="Today’s Sales & Booking Detail" />
      <div role="table" aria-label="Today's sales and booking detail" className="hidden text-[9px] sm:block">
        <div role="row" className="grid grid-cols-[50px_minmax(95px,0.8fr)_minmax(125px,1.3fr)_58px_62px_86px] gap-2 bg-[var(--surface-subtle)] px-3 py-2 font-semibold text-[var(--text-secondary)]"><span>Branch</span><span>Salesperson</span><span>Model</span><span className="text-center">Sales<br />T / MTD</span><span className="text-center">Booking<br />A / B</span><span>Status</span></div>
        {rows.map((row, index) => <div role="row" key={`${row.salesperson}-${row.model}-${row.status}-${index}`} className="grid grid-cols-[50px_minmax(95px,0.8fr)_minmax(125px,1.3fr)_58px_62px_86px] items-center gap-2 border-b border-[var(--divider)] px-3 py-2"><span>{row.branch}</span><span className="break-words font-medium leading-3">{row.salesperson}</span><span className="break-words font-medium leading-3">{row.model}</span><span className="kmm-tabular text-center">{row.salesToday} / {row.salesMtd}</span><span className="kmm-tabular text-center">{row.aHot} / {row.bHot}</span><StatusBadge status={row.tone as BadgeTone} className="min-h-0 max-w-full px-1.5 py-0.5 text-[8px] leading-3">{row.status}</StatusBadge></div>)}
      </div>
      <div className="grid gap-2 p-3 sm:hidden">{rows.map((row, index) => <div key={`${row.salesperson}-${row.model}-${row.status}-${index}`} className="rounded-[11px] bg-[var(--surface-subtle)] p-2.5"><div className="flex items-start justify-between gap-2"><span className="min-w-0"><strong className="block truncate text-[11px]">{row.salesperson}</strong><span className="mt-0.5 block truncate text-[9px] text-[var(--text-secondary)]">{row.branch} · {row.model}</span></span><StatusBadge status={row.tone as BadgeTone} className="min-h-0 shrink-0 px-1.5 py-0.5 text-[8px] leading-3">{row.status}</StatusBadge></div><div className="mt-2 flex gap-4 text-[9px]"><span>Sales <strong>{row.salesToday}/{row.salesMtd}</strong></span><span>Booking <strong>{row.aHot}/{row.bHot}</strong></span></div></div>)}</div>
    </Card>
  );
}

function StockHealth({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  const locations = snapshot.stock.byBranch.map((row) => ({ label: row.branch, units: row.units }));
  const liveAging = snapshot.stock.aging.map((row) => ({
    label: row.label === "0–30" ? "≤ 30 Days" : row.label === ">90" ? "91+ Days" : `${row.label} Days`,
    units: row.units,
    percent: snapshot.stock.engineUnits ? Math.round((row.units / snapshot.stock.engineUnits) * 100) : 0,
    color: row.label === "0–30" ? "#54A948" : row.label === "31–60" ? "#D6A500" : row.label === "61–90" ? "#F28C28" : row.label === ">90" ? "#EF4B2F" : "#8C8F96",
  }));
  const maxLocation = Math.max(...locations.map((row) => row.units), 1);
  const agingSegments = liveAging.filter((row) => row.units > 0).reduce<{ cursor: number; values: string[] }>((result, row) => {
    const next = result.cursor + (snapshot.stock.engineUnits ? (row.units / snapshot.stock.engineUnits) * 100 : 0);
    return { cursor: next, values: [...result.values, `${row.color} ${result.cursor}% ${next}%`] };
  }, { cursor: 0, values: [] }).values;
  const agingGradient = agingSegments.length
    ? `conic-gradient(from -90deg, ${agingSegments.join(", ")})`
    : "#ECEEF1";
  const highRisk = liveAging.find((row) => row.label === "91+ Days") ?? { units: 0, percent: 0 };
  return (
    <Card className={panelClass}>
      <PanelHeader index="4" title="Stock Health Overview" />
      <div className="grid gap-px bg-[var(--divider)] sm:grid-cols-2">
        <div className="bg-[var(--surface-default)] p-3"><p className="text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-secondary)]">Stock Value</p><p className="kmm-tabular mt-2 break-words text-[18px] font-semibold tracking-[-0.025em]">{snapshot.stock.value === null ? "N/A" : snapshot.stock.value.toLocaleString("en-US")}<span className="ml-1.5 text-[9px]">MMK</span></p><p className="mt-2 inline-flex rounded-full bg-[var(--surface-subtle)] px-2 py-1 text-[9px] font-bold text-[var(--text-secondary)]">Snapshot {snapshot.sourceDates.stock ?? "unavailable"}</p></div>
        <div className="bg-[var(--surface-default)] p-3"><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-secondary)]">PSI Engine</p><strong className="kmm-tabular text-xl text-[var(--text-secondary)]">N/A</strong></div><p className="mt-2 text-[9px] leading-4 text-[var(--text-secondary)]">PSI remains unavailable until its period and denominator are approved.</p><div className="mt-3 grid grid-cols-3 gap-1 rounded-[10px] bg-[var(--surface-subtle)] p-2 text-center text-[8px] text-[var(--text-secondary)]"><span>Sales<strong className="mt-0.5 block text-[11px] text-[var(--text-primary)]">{snapshot.sales.mtdUnits}</strong></span><span>Booking<strong className="mt-0.5 block text-[11px] text-[var(--text-primary)]">{snapshot.booking.activeUnits}</strong></span><span>Stock<strong className="mt-0.5 block text-[11px] text-[var(--text-primary)]">{snapshot.stock.engineUnits}</strong></span></div></div>
        <div className="bg-[var(--surface-default)] p-3"><p className="text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-secondary)]">Stock Distribution</p><div className="mt-2 space-y-1.5">{locations.map((row) => <div key={row.label} className="grid grid-cols-[84px_minmax(0,1fr)_20px] items-center gap-1.5 text-[8px]"><span className="truncate" title={row.label}>{row.label}</span><div className="h-2 overflow-hidden rounded-full bg-[#F0F1F4]"><div className="h-full rounded-full bg-gradient-to-r from-[#FFA45C] to-[var(--brand-500)]" style={{ width: `${(row.units / maxLocation) * 100}%` }} /></div><strong className="kmm-tabular text-right">{row.units}</strong></div>)}</div></div>
        <div className="bg-[var(--surface-default)] p-3"><div className="flex items-center justify-between gap-2"><p className="text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-secondary)]">Stock Aging</p><span className="rounded-full bg-[var(--status-danger-bg)] px-2 py-1 text-[8px] font-bold text-[var(--status-danger)]">{highRisk.percent}% high risk</span></div><div className="mt-2 grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3"><div className="relative mx-auto size-24" role="img" aria-label={`Stock aging: ${highRisk.units} units over 90 days out of ${snapshot.stock.engineUnits}`}><div className="absolute inset-0 rounded-full border border-[#ECEEF1] bg-[#F8F9FA]" /><div className="absolute inset-1 rounded-full shadow-[0_8px_18px_rgba(31,41,55,0.10)]" style={{ background: agingGradient }} /><div className="absolute inset-[20px] grid place-items-center rounded-full bg-white shadow-[inset_0_0_0_1px_#ECEEF1]"><span className="text-center"><strong className="kmm-tabular block text-lg leading-none text-[var(--status-danger)]">{highRisk.units}</strong><span className="mt-1 block text-[7px] font-semibold text-[var(--text-secondary)]">&gt; 90 days</span></span></div><span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#202124] px-2 py-0.5 text-[7px] font-bold text-white shadow-sm">{snapshot.stock.engineUnits} total</span></div><ul className="min-w-0 space-y-1.5">{liveAging.map((row) => <li key={row.label} className="grid grid-cols-[8px_minmax(0,1fr)_48px] items-center gap-1.5 text-[8px]"><span className="size-2 rounded-full" style={{ backgroundColor: row.color }} /><span className="leading-3">{row.label}</span><strong className="kmm-tabular text-right">{row.units} · {row.percent}%</strong></li>)}</ul></div></div>
      </div>
    </Card>
  );
}

function BookingStock({ snapshot }: { snapshot: DailyManagementSnapshot }) {
  const rows = snapshot.bookingStock.map((row) => ({ model: row.model, aHot: "—", bHot: "—", total: row.activeBooking, stock: row.stock, coverage: row.coverageMonths === null ? "—" : `${row.coverageMonths.toFixed(1)} Month`, status: row.signal === "shortage" ? "Potential shortage" : row.signal === "high" ? "High stock" : row.signal === "balanced" ? "Normal" : "No booking", tone: row.signal === "shortage" ? "negative" : row.signal === "balanced" ? "positive" : "warning" }));
  return (
    <Card className={panelClass}>
      <PanelHeader index="5" title="Booking × Stock Intelligence" />
      <div role="table" aria-label="Booking and stock intelligence" className="hidden text-[9px] sm:block"><div role="row" className="grid grid-cols-[minmax(120px,1.4fr)_54px_64px_76px_minmax(96px,0.9fr)] gap-1 bg-[var(--surface-subtle)] px-3 py-2 font-semibold text-[var(--text-secondary)]"><span>Model</span><span className="text-center">A / B</span><span className="text-center">Book / Stock</span><span className="text-center">Coverage</span><span>Status</span></div>{rows.map((row) => <div role="row" key={row.model} className="grid grid-cols-[minmax(120px,1.4fr)_54px_64px_76px_minmax(96px,0.9fr)] items-center gap-1 border-b border-[var(--divider)] px-3 py-2"><strong className="break-words leading-3">{row.model}</strong><span className="kmm-tabular text-center">{row.aHot} / {row.bHot}</span><span className="kmm-tabular text-center">{row.total} / {row.stock}</span><span className="kmm-tabular text-center">{row.coverage}</span><StatusBadge status={row.tone as BadgeTone} className="min-h-0 max-w-full px-1.5 py-0.5 text-[8px] leading-3">{row.status}</StatusBadge></div>)}</div>
      <div className="grid gap-2 p-3 sm:hidden">{rows.map((row) => <div key={row.model} className="rounded-[10px] bg-[var(--surface-subtle)] p-2.5"><div className="flex items-start justify-between gap-2"><strong className="text-[10px]">{row.model}</strong><StatusBadge status={row.tone as BadgeTone} className="min-h-0 shrink-0 px-1.5 py-0.5 text-[8px] leading-3">{row.status}</StatusBadge></div><div className="mt-2 grid grid-cols-3 text-center text-[8px] text-[var(--text-secondary)]"><span>A/B<strong className="block text-[10px] text-[var(--text-primary)]">{row.aHot}/{row.bHot}</strong></span><span>Book/Stock<strong className="block text-[10px] text-[var(--text-primary)]">{row.total}/{row.stock}</strong></span><span>Coverage<strong className="block text-[10px] text-[var(--text-primary)]">{row.coverage}</strong></span></div></div>)}</div>
    </Card>
  );
}

function ActionRequired({ input }: { input: DailyManagementInputSnapshot }) {
  return (
    <Card className={panelClass}>
      <PanelHeader index="6" title="Action Required" action={<span className="rounded-full bg-[var(--status-danger-bg)] px-2 py-1 text-[8px] font-bold text-[var(--status-danger)]">{input.actions.length} priorities</span>} />
      {input.actions.length ? <div className="divide-y divide-[var(--divider)] px-3">{input.actions.map((item) => <div key={`${item.title}-${item.owner}`} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 py-2.5"><span className={`mt-0.5 grid size-4 place-items-center rounded-full ${item.priority === "critical" ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)]" : "bg-[var(--status-warning-bg)] text-[var(--status-warning)]"}`}><AlertTriangle size={10} /></span><div className="min-w-0"><p className="text-[10px] font-semibold leading-3.5">{item.title}</p><p className="mt-0.5 text-[8px] leading-3 text-[var(--text-secondary)]">{item.detail} · {item.owner}</p><span className="mt-1 inline-flex rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[8px] font-semibold">{item.nextStep}</span></div></div>)}</div> : <p className="p-4 text-[10px] text-[var(--text-secondary)]">No published management actions for this report.</p>}
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
  const { t } = useLocale();
  const [input, setInput] = useState<DailyManagementInputSnapshot | null>(null);
  const [snapshot, setSnapshot] = useState<DailyManagementSnapshot | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [timeZone, setTimeZone] = useState("Asia/Yangon");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      setLoadState("loading");
      setReportError(null);
      setInput(null);
      setSnapshot(null);
      try {
        const remote = await loadDailyManagementInput("published");
        if (!active) return;
        if (!remote) {
          setLoadState("empty");
          return;
        }
        const live = await loadDailyManagementReport({ date: remote.reportDate, branch: remote.branch === "All Branches" ? undefined : remote.branch });
        if (active) {
          setInput(remote);
          setSnapshot(live.snapshot);
          setTimeZone(live.timeZone);
          setReportError(null);
          setLoadState("ready");
        }
      } catch (error) {
        if (active) {
          setReportError(error instanceof Error ? error.message : "Unable to load D1 report data.");
          setLoadState("error");
        }
      }
    };
    void refresh();
    window.addEventListener(DAILY_MANAGEMENT_INPUT_PUBLISHED, refresh);
    return () => { active = false; window.removeEventListener(DAILY_MANAGEMENT_INPUT_PUBLISHED, refresh); };
  }, [refreshKey]);
  const ready = loadState === "ready" && input !== null && snapshot !== null;
  const publishedTime = input?.publishedAt
    ? new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(input.publishedAt))
    : null;
  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#F6F7F9] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1900px] p-3 sm:p-4 xl:px-5 xl:py-4">
        <div className="space-y-3">
          <section className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between" aria-labelledby="daily-management-title">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 id="daily-management-title" className="text-[23px] font-semibold leading-tight tracking-[-0.025em] sm:text-[26px]">{t("route.dailyManagement.title")}</h1><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${ready ? "bg-[#EAF7EE] text-[#18813A]" : loadState === "error" ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)]" : "bg-[#FFF0E4] text-[#9D4300]"}`}>{ready ? "Live · D1 Data" : loadState === "error" ? "D1 unavailable" : loadState === "empty" ? "No published report" : "Loading D1 data"}</span></div><p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{reportError ? `D1 unavailable: ${reportError}` : t("route.dailyManagement.subtitle")}</p></div>
            <div className="flex flex-wrap items-center gap-2 text-[10px]">{input && <><span className="rounded-[10px] border border-[var(--border-default)] bg-white px-3 py-2"><CalendarDays size={12} className="mr-1.5 inline" />{input.reportDate}</span><span className="rounded-[10px] border border-[var(--border-default)] bg-white px-3 py-2">Updated {publishedTime ?? "unavailable"} · {timeZone}</span></>}<Link href="/daily-management/input" className="inline-flex min-h-11 items-center gap-2 rounded-[11px] border border-[var(--border-default)] bg-white px-3 font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><FilePenLine size={14} />Update Inputs</Link>{ready && <ExportButton onClick={() => downloadReport(input, snapshot)} />}</div>
          </section>
          {!ready ? <Card className={`${panelClass} grid min-h-64 place-items-center p-8 text-center`} role={loadState === "error" ? "alert" : "status"}><div className="max-w-md"><strong className="text-sm">{loadState === "loading" ? "Loading authenticated D1 data…" : loadState === "empty" ? "No published Daily Management input" : "Daily Management data could not be loaded"}</strong><p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{loadState === "empty" ? "Publish a Daily Management input before opening the report. No sample values are shown." : loadState === "error" ? reportError : "The report remains blank until the live response is complete."}</p>{loadState === "error" && <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="mt-4 min-h-10 rounded-[10px] bg-[var(--brand-500)] px-4 text-[11px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Retry</button>}</div></Card> : <>
            <KpiStrip snapshot={snapshot} />
            <div className="grid gap-3 xl:grid-cols-[1.35fr_0.65fr]"><SalesPerformance snapshot={snapshot} /><BookingPipeline snapshot={snapshot} /></div>
            <div className="grid gap-3 xl:grid-cols-[1.08fr_0.92fr]"><TodayDetail snapshot={snapshot} /><StockHealth snapshot={snapshot} /></div>
            <div className="grid gap-3 xl:grid-cols-[1.18fr_0.82fr]"><BookingStock snapshot={snapshot} /><ActionRequired input={input} /></div>
            <ManagementNotes input={input} />
            <footer className="flex flex-col gap-1 border-t border-[var(--divider)] pt-2 text-[8px] text-[var(--text-tertiary)] sm:flex-row sm:justify-between"><span>MTD = Month To Date</span><span>Operational data: authenticated D1 Sales, Booking and Stock</span><span className="flex items-center gap-1"><PackageCheck size={10} />KMM Sales Division</span></footer>
          </>}
        </div>
      </main>
    </div>
  );
}
