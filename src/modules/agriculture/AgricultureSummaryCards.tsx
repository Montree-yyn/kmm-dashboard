"use client";

import { Building2, Leaf, MapPinned, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import type { DataViewSummary } from "./agriculture.data-view";
import { formatCropYear, formatNumber } from "./agriculture.data-charts";

type Copy = ReturnType<typeof import("./agriculture.ui").agricultureCopy>["dataView"];

export function AgricultureSummaryCards({ summary, copy }: { summary: DataViewSummary; copy: Copy }) {
  const confidenceLabel = ({ high: copy.confidenceHigh, medium: copy.confidenceMedium, low: copy.confidenceLow, none: copy.confidenceNone } as const)[summary.confidenceBand];
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={copy.title} data-agri-summary-cards>
      <SummaryCard icon={<Leaf size={18} />} iconClass="bg-[#eef7eb] text-[#47763d]">
        <CardLabel text={copy.summaryCrops} />
        <p className="text-[26px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]">{summary.cropCount === null ? "—" : formatNumber(summary.cropCount)}</p>
        <CardSub text={copy.summaryCropsSub.replace("{n}", formatNumber(summary.sourceCount))} />
      </SummaryCard>
      <SummaryCard icon={<MapPinned size={18} />} iconClass="bg-[#e9f1f9] text-[#2c5f8a]">
        <CardLabel text={copy.summaryArea} />
        <p className="flex items-baseline gap-1 text-[26px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
          <span>{summary.area === null ? "—" : `${summary.areaQualifier === "MORE_THAN" ? ">" : ""}${formatNumber(summary.area)}`}</span>
          {summary.areaUnit && <span className="text-xs font-semibold text-[var(--text-secondary)]">{summary.areaUnit}</span>}
        </p>
        <CardSub text={summary.areaYear === null ? "" : copy.summaryAreaSub.replace("{year}", formatCropYear(summary.areaYear))} />
      </SummaryCard>
      <SummaryCard icon={<Building2 size={18} />} iconClass="bg-[#f3effb] text-[#6d4fa1]">
        <CardLabel text={copy.summaryTownship} />
        <p className="flex items-baseline gap-1 text-[26px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
          <span>{formatNumber(summary.townshipsWithArea)}</span>
          {copy.townshipUnit && <span className="text-xs font-semibold text-[var(--text-secondary)]">{copy.townshipUnit}</span>}
        </p>
        <CardSub text={summary.townshipTotal > 0 ? copy.summaryTownshipSub.replace("{n}", formatNumber(summary.townshipTotal)) : ""} />
      </SummaryCard>
      <SummaryCard icon={<ShieldCheck size={18} />} iconClass="bg-[#fdf3e7] text-[#b45309]" emphasized>
        <CardLabel text={copy.summaryConfidence} />
        <p className="flex items-baseline gap-2 text-[26px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
          <span>{summary.confidence === null ? "—" : `${summary.confidence}%`}</span>
          <span className="text-xs font-semibold text-[var(--text-secondary)]">{confidenceLabel}</span>
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]" role="progressbar" aria-valuenow={summary.confidence ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={copy.summaryConfidence}>
          <div className="h-full rounded-full bg-[var(--brand-500)]" style={{ width: `${summary.confidence ?? 0}%` }} />
        </div>
      </SummaryCard>
    </section>
  );
}

function SummaryCard({ icon, iconClass, emphasized = false, children }: { icon: ReactNode; iconClass: string; emphasized?: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-4 shadow-[var(--shadow-card)] sm:p-5", emphasized && "border-[var(--brand-200)]")}>
      <span className={cn("grid size-9 place-items-center rounded-lg", iconClass)}>{icon}</span>
      {children}
    </div>
  );
}

function CardLabel({ text }: { text: string }) {
  return <p className="text-[11px] font-semibold leading-4 text-[var(--text-secondary)]">{text}</p>;
}

function CardSub({ text }: { text: string }) {
  if (!text) return null;
  return <p className="text-[10px] leading-4 text-[var(--text-tertiary)]">{text}</p>;
}
