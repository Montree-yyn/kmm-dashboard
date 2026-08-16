"use client";

import { AlertTriangle, CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { cn } from "../../../lib/utils";
import { formatNumber } from "./agriculture.data-charts";
import type { QualityMetric, QualityTone } from "./agriculture.data-view";

type Copy = ReturnType<typeof import("./agriculture.ui").agricultureCopy>["dataView"];

const METRIC_KEY: Record<QualityMetric["key"], "qualityPresence" | "qualityArea" | "qualityYield" | "qualityCalendar" | "qualityVerification"> = {
  presence: "qualityPresence",
  area: "qualityArea",
  yield: "qualityYield",
  calendar: "qualityCalendar",
  verification: "qualityVerification",
};

export function DataQualityPanel({ metrics, gaps, copy, onViewGaps }: { metrics: QualityMetric[]; gaps: number; copy: Copy; onViewGaps: () => void }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]" data-agri-quality>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-[#fdf3e7] text-[#b45309]"><ShieldAlert size={16} /></span>
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{copy.qualityTitle}</h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{copy.qualitySub}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {metrics.map((metric) => <QualityMetricCard key={metric.key} metric={metric} copy={copy} />)}
      </div>
      {gaps > 0 && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--status-warning-bg)] bg-[var(--status-warning-bg)] p-3 text-xs leading-5 text-[var(--status-warning)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">{copy.gapsAlertTitle.replace("{n}", String(gaps))}</p>
              <p className="mt-0.5 text-[11px] leading-5">{copy.gapsAlertBody}</p>
            </div>
          </div>
          <button type="button" onClick={onViewGaps} className="shrink-0 rounded-lg border border-[var(--status-warning)] px-3 py-2 font-semibold transition hover:bg-[var(--status-warning)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">{copy.viewGaps}</button>
        </div>
      )}
    </section>
  );
}

function QualityMetricCard({ metric, copy }: { metric: QualityMetric; copy: Copy }) {
  const Icon = metric.tone === "good" ? CheckCircle2 : metric.tone === "partial" ? AlertTriangle : XCircle;
  const toneText = { good: copy.qualityVerified, partial: copy.qualityPartial, missing: copy.qualityMissing }[metric.tone];
  const toneStyle: Record<QualityTone, string> = {
    good: "text-[#2f6e2a]",
    partial: "text-[#8a6a00]",
    missing: "text-[#b91c1c]",
  };
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3">
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-[11px] font-semibold text-[var(--text-primary)]">{copy[METRIC_KEY[metric.key]]}</p>
        <Icon size={13} className={cn("shrink-0", toneStyle[metric.tone])} aria-hidden="true" />
      </div>
      <p className="mt-2 text-[16px] font-bold leading-none text-[var(--text-primary)]">{formatNumber(metric.value)} <span className="text-[10px] font-semibold text-[var(--text-secondary)]">/ {formatNumber(metric.total)}</span></p>
      <div className="mt-2 flex items-center justify-between gap-1">
        <span className={cn("text-[10px] font-bold", toneStyle[metric.tone])}>{metric.pct}% · {toneText}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e7eef4]">
        <div className={cn("h-full rounded-full", metric.tone === "good" ? "bg-[#3f9a4b]" : metric.tone === "partial" ? "bg-[#e0b420]" : "bg-[#dc2626]")} style={{ width: `${metric.pct}%` }} />
      </div>
    </div>
  );
}
