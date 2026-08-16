"use client";

import { CheckCircle2, AlertTriangle, XCircle, ShieldAlert, ArrowRight } from "lucide-react";
import { cn } from "../../../lib/utils";
import { formatNumber } from "./agriculture.data-charts";
import type { QualityMetric, QualityTone } from "./agriculture.overview-view";

type Copy = ReturnType<typeof import("./agriculture.ui").agricultureCopy>["overviewIntelligence"];

const METRIC_KEY: Record<QualityMetric["key"], "qualityPresence" | "qualityArea" | "qualityYield" | "qualityCalendar" | "qualityWeather" | "qualityVerification"> = {
  presence: "qualityPresence",
  area: "qualityArea",
  yield: "qualityYield",
  calendar: "qualityCalendar",
  weather: "qualityWeather",
  verification: "qualityVerification",
};

export function AgricultureQualityPanel({ metrics, copy, onViewGaps }: { metrics: QualityMetric[]; copy: Copy; onViewGaps?: () => void }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]" data-agri-intel-quality>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-[#fdf3e7] text-[#b45309]"><ShieldAlert size={16} /></span>
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{copy.qualityTitle}</h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{copy.qualitySub}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {metrics.map((metric) => <QualityRow key={metric.key} metric={metric} copy={copy} />)}
      </div>
      {onViewGaps && (
        <button type="button" onClick={onViewGaps} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#47763d] transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          {copy.viewGaps}<ArrowRight size={13} />
        </button>
      )}
    </section>
  );
}

function QualityRow({ metric, copy }: { metric: QualityMetric; copy: Copy }) {
  const Icon = metric.tone === "good" ? CheckCircle2 : metric.tone === "partial" ? AlertTriangle : XCircle;
  const toneText = { good: copy.qualityVerified, partial: copy.qualityPartial, missing: copy.qualityMissing }[metric.tone];
  const toneStyle: Record<QualityTone, string> = {
    good: "text-[#2f6e2a]",
    partial: "text-[#8a6a00]",
    missing: "text-[#b91c1c]",
  };
  const barColor = metric.tone === "good" ? "bg-[#3f9a4b]" : metric.tone === "partial" ? "bg-[#e0b420]" : "bg-[#dc2626]";
  return (
    <div className="flex items-center gap-3">
      <div className="w-[38%] min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className={cn("shrink-0", toneStyle[metric.tone])} aria-hidden="true" />
          <p className="truncate text-[11px] font-semibold text-[var(--text-primary)]">{copy[METRIC_KEY[metric.key]]}</p>
        </div>
        <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{formatNumber(metric.value)}/{formatNumber(metric.total)} · {metric.pct}%</p>
      </div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e7eef4]">
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${metric.pct}%` }} />
      </div>
      <span className={cn("w-12 shrink-0 text-right text-[10px] font-bold", toneStyle[metric.tone])}>{toneText}</span>
    </div>
  );
}
