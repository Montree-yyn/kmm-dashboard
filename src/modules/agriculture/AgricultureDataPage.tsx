"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, ChevronRight, Info, Sprout, X } from "lucide-react";
import { useLocale } from "../../../src/hooks/useLocale";
import { cn } from "../../../lib/utils";
import { agricultureCopy, agricultureCropName, agricultureGeographyLabel, agricultureImportanceLabel, agriculturePresenceLabel, agricultureRecordTypeLabel, agricultureSeasonLabel, agricultureVerificationLevelLabel } from "./agriculture.ui";
import { buildAgricultureDataView, type CropCard, type AgricultureDataView } from "./agriculture.data-view";
import { formatCropYear, formatNumber } from "./agriculture.data-charts";
import type { AgricultureOverviewPayload } from "./agriculture.types";
import { AgricultureSummaryCards } from "./AgricultureSummaryCards";
import { CropOverviewCards } from "./CropOverviewCards";
import { AgricultureAnalytics } from "./AgricultureAnalytics";
import { DataQualityPanel } from "./DataQualityPanel";
import { SourceSummary } from "./SourceSummary";
import { AgricultureDetailTable } from "./AgricultureDetailTable";

type Copy = ReturnType<typeof agricultureCopy>;
type Language = import("../../../src/locales").Language;

export function AgricultureDataPage({ overview, onViewGaps }: { overview: AgricultureOverviewPayload; onViewGaps?: () => void }) {
  const { language } = useLocale();
  const copy = agricultureCopy(language);
  const cv = copy.dataView;
  const [selectedCrop, setSelectedCrop] = useState<CropCard | null>(null);
  const [showMetricExplain, setShowMetricExplain] = useState(false);
  const view = useMemo(() => buildAgricultureDataView(overview), [overview]);
  const scopeLabel = useMemo(() => buildScopeLabel(view), [view]);

  return (
    <div className="space-y-5" data-agriculture-data-page>
      {/* Header + scope breadcrumb */}
      <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-600)]"><Sprout size={20} /></span>
            <div>
              <h2 className="text-[22px] font-semibold leading-tight text-[var(--text-primary)]">{cv.title}</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{cv.subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowMetricExplain((current) => !current)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Info size={14} />{cv.metricExplain}</button>
        </div>
        {showMetricExplain && <div className="mt-4 rounded-xl border border-[#e8edf2] bg-[#f7fafc] p-4 text-xs leading-6 text-[var(--text-secondary)]"><Info size={14} className="mb-1 text-[#496a9a]" />{cv.metricExplainBody}</div>}
        <ScopeBreadcrumb items={scopeLabel} label={cv.scope} />
      </section>

      <AgricultureSummaryCards summary={view.summary} copy={cv} />
      <CropOverviewCards crops={view.crops} copy={cv} language={language} onOpen={setSelectedCrop} />
      <AgricultureAnalytics view={view} copy={cv} language={language} />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
        <DataQualityPanel metrics={view.quality} gaps={view.openHighPriorityGaps} copy={cv} onViewGaps={() => onViewGaps?.()} />
        <SourceSummary sources={view.sources} copy={cv} />
      </section>

      <AgricultureDetailTable rows={view.detailRows} copy={cv} language={language} />

      <p className="flex items-start justify-center gap-2 px-4 text-center text-[11px] leading-5 text-[var(--text-tertiary)]"><Info size={13} className="mt-0.5 shrink-0" />{cv.footerNote}</p>

      {selectedCrop && <CropDetailDrawer crop={selectedCrop} copy={copy} language={language} onClose={() => setSelectedCrop(null)} onDeepDive={() => document.getElementById("agriculture-detail-table")?.scrollIntoView({ behavior: "smooth", block: "start" })} />}
    </div>
  );
}

function ScopeBreadcrumb({ items, label }: { items: string[]; label: string }) {
  if (!items.length) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-xs" aria-label={label}>
      <span className="font-semibold text-[var(--text-tertiary)]">{label}:</span>
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 && <ChevronRight size={13} className="text-[var(--text-disabled)]" />}
          <span className={cn("rounded-md px-2 py-1", index === items.length - 1 ? "bg-[#eef7eb] font-semibold text-[#47763d]" : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]")}>{item}</span>
        </span>
      ))}
    </div>
  );
}

function buildScopeLabel(view: AgricultureDataView): string[] {
  const scope = view.scope;
  const parts = [scope.country, scope.region, scope.township, scope.season];
  return parts.filter((part): part is string => Boolean(part));
}

function CropDetailDrawer({ crop, copy, language, onClose, onDeepDive }: { crop: CropCard; copy: Copy; language: Language; onClose: () => void; onDeepDive?: () => void }) {
  const cv = copy.dataView;
  const common = copy.common;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={cv.drawerTitle}>
      <button type="button" className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onClose} aria-label={cv.drawerClose} />
      <div className="kmm-kai-panel fixed flex flex-col overflow-y-auto border-l border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-overlay)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--divider)] px-5 py-4">
          <h3 className="text-[17px] font-semibold text-[var(--text-primary)]">{cv.drawerTitle}</h3>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)]" aria-label={cv.drawerClose}><X size={16} /></button>
        </div>
        <div className="flex-1 space-y-5 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[#eef7eb] text-[#47763d]"><Sprout size={20} /></span>
            <div className="min-w-0">
              <p className="text-[17px] font-bold leading-tight text-[var(--text-primary)]">{agricultureCropName(crop.cropName, crop.cropCode, language)}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{cv.drawerLocation}: {crop.locations.join(", ")}</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#cfe5c8] bg-[#eef7eb] px-2 py-0.5 text-[10px] font-bold text-[#47763d]"><BadgeCheck size={10} />{crop.presenceStatus === "PROBABLE" ? cv.badgeProbable : cv.badgeActual}</span>
            </div>
          </div>

          <dl className="space-y-2.5 text-xs">
            <DetailRow label={cv.drawerArea} value={crop.area === null ? cv.drawerNoData : `${crop.areaQualifier === "MORE_THAN" ? ">" : ""}${formatNumber(crop.area)}${crop.areaUnit ? ` ${crop.areaUnit}` : ""}`} />
            <DetailRow label={cv.drawerYear} value={crop.year === null ? cv.drawerNoData : formatCropYear(crop.year)} />
            <DetailRow label={cv.drawerSeason} value={crop.seasonCode ? agricultureSeasonLabel(crop.seasonCode, language) : cv.drawerNoData} />
            <DetailRow label={cv.drawerRecordType} value={crop.recordType ? agricultureRecordTypeLabel(crop.recordType, language) : cv.drawerNoData} />
            <DetailRow label={cv.drawerPresence} value={agriculturePresenceLabel(crop.presenceStatus, language)} />
            <DetailRow label={cv.drawerLevel} value={crop.level ? agricultureGeographyLabel(crop.level, language) : cv.drawerNoData} />
            <DetailRow label={cv.drawerConfidence} value={crop.confidenceGrade ? agricultureVerificationLevelLabel(crop.confidenceGrade, language) : cv.drawerNoData} />
            <DetailRow label={cv.drawerImportance} value={crop.importanceLevel ? agricultureImportanceLabel(crop.importanceLevel, language) : cv.drawerNoData} />
            <DetailRow label={cv.drawerLocations} value={crop.locations.join(", ")} />
            <DetailRow label={cv.drawerSources} value={crop.sourceNames.length ? crop.sourceNames.join(" · ") : common.noData} />
          </dl>
        </div>
        {onDeepDive && (
          <div className="border-t border-[var(--divider)] p-4">
            <button type="button" onClick={onDeepDive} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#47763d] px-4 text-sm font-semibold text-white transition hover:bg-[#3a6532] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">{cv.drawerDeep}<ArrowRight size={15} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--divider)] pb-2.5 last:border-0">
      <dt className="shrink-0 text-[var(--text-secondary)]">{label}</dt>
      <dd className="min-w-0 text-right font-semibold leading-5 text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}
