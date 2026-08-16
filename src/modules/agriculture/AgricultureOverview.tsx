"use client";

import { useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import { useLocale } from "../../../src/hooks/useLocale";
import { cn } from "../../../lib/utils";
import { agricultureCopy } from "./agriculture.ui";
import { buildAgricultureOverviewView, type AgricultureOverviewView } from "./agriculture.overview-view";
import { isEligibleLocalCropPresence, type AgricultureOverviewPayload } from "./agriculture.types";
import { AgricultureKPICards } from "./AgricultureKPICards";
import { AgricultureIntelligenceMap } from "./AgricultureIntelligenceMap";
import { AreaIntelligencePanel } from "./AreaIntelligencePanel";
import { AgricultureInsightCard } from "./AgricultureInsightCard";
import { TopAgricultureRanking } from "./TopAgricultureRanking";
import { AgricultureQualityPanel } from "./AgricultureQualityPanel";

type AgricultureOverviewProps = {
  overview: AgricultureOverviewPayload;
  selectedLocationId: string;
  selectedWeatherLocationId: string;
  onWeatherLocationSelect: (locationId: string) => void;
};

export function AgricultureOverview({ overview, selectedLocationId }: AgricultureOverviewProps) {
  const { language } = useLocale();
  const copy = agricultureCopy(language);
  const [selectedId, setSelectedId] = useState<string | null>(selectedLocationId || null);
  const view = buildAgricultureOverviewView(overview, selectedId);
  const townshipIds = new Set(view.townships.map((point) => point.locationId));
  const eligiblePresenceKeys = new Set(overview.cropPresence.filter(isEligibleLocalCropPresence).map((row) => `${row.locationId}:${row.cropId}`));
  const townshipsWithPresence = view.townships.filter((point) => [...eligiblePresenceKeys].some((key) => key.startsWith(`${point.locationId}:`))).length;

  return (
    <div className="space-y-5" data-agriculture-overview>
      {/* Scope breadcrumb + presence confidence badge */}
      <ScopeBreadcrumb view={view} label={copy.overviewIntelligence.scope} presenceBadge={copy.overviewIntelligence.presenceBadge} townshipsWithPresence={townshipIds.size ? townshipsWithPresence : null} townshipTotal={townshipIds.size} />

      <AgricultureKPICards summary={view.summary} copy={copy.overviewIntelligence} />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(330px,0.9fr)]" aria-label={copy.overviewIntelligence.mapTitle}>
        <AgricultureIntelligenceMap townships={view.townships} selected={view.selectedPoint} onSelect={(point) => setSelectedId(point?.locationId ?? null)} copy={copy.overviewIntelligence} language={language} />
        <AreaIntelligencePanel point={view.selectedPoint} copy={copy.overviewIntelligence} language={language} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.2fr)_minmax(280px,0.95fr)]" aria-label={copy.overviewIntelligence.rankingTitle}>
        <AgricultureInsightCard top={view.ranking[0] ?? null} selected={view.selectedPoint} copy={copy.overviewIntelligence} language={language} />
        <TopAgricultureRanking rows={view.ranking} copy={copy.overviewIntelligence} language={language} />
        <AgricultureQualityPanel metrics={view.quality} copy={copy.overviewIntelligence} />
      </section>

      <p className="flex items-start justify-center gap-2 px-4 text-center text-[11px] leading-5 text-[var(--text-tertiary)]">
        <Info size={13} className="mt-0.5 shrink-0" />{copy.overviewIntelligence.footerNote}
      </p>
    </div>
  );
}

function ScopeBreadcrumb({ view, label, presenceBadge, townshipsWithPresence, townshipTotal }: { view: AgricultureOverviewView; label: string; presenceBadge: string; townshipsWithPresence: number | null; townshipTotal: number }) {
  const parts = [view.scope.country, view.scope.region, view.scope.township, view.scope.season].filter((part): part is string => Boolean(part));
  if (!parts.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-xs" aria-label={label}>
        <span className="font-semibold text-[var(--text-tertiary)]">{label}:</span>
        {parts.map((item, index) => (
          <span key={`${item}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 && <ChevronRight size={13} className="text-[var(--text-disabled)]" />}
            <span className={cn("rounded-md px-2 py-1", index === parts.length - 1 ? "bg-[#eef7eb] font-semibold text-[#47763d]" : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]")}>{item}</span>
          </span>
        ))}
      </div>
      {townshipsWithPresence !== null && (
        <span className="shrink-0 rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-tertiary)]">
          {presenceBadge.replace("{n}", String(townshipsWithPresence)).replace("{total}", String(townshipTotal))}
        </span>
      )}
    </div>
  );
}
