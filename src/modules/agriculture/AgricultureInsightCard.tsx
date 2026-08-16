"use client";

import { Sparkles } from "lucide-react";
import { agricultureCropName } from "./agriculture.ui";
import { formatNumber } from "./agriculture.data-charts";
import type { RankingRow, TownshipPoint } from "./agriculture.overview-view";

type Copy = ReturnType<typeof import("./agriculture.ui").agricultureCopy>["overviewIntelligence"];
type Language = import("../../../src/locales").Language;

export function AgricultureInsightCard({ top, selected, copy, language }: { top: RankingRow | null; selected: TownshipPoint | null; copy: Copy; language: Language }) {
  const hasArea = Boolean(top);
  const hasWindow = Boolean(selected?.plantingWindow);

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]" data-agri-intel-insight>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-[#fff2e7] text-[var(--brand-600)]"><Sparkles size={16} /></span>
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{copy.insightTitle}</h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{copy.insightSub}</p>
        </div>
      </div>
      {!hasArea && !hasWindow ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] p-4 text-xs text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text-primary)]">{copy.insightNoData}</p>
          <p className="mt-1 text-[11px] leading-5">{copy.insightNoDataHelp}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {top && (
            <p className="text-sm font-semibold leading-6 text-[var(--text-primary)]">
              {copy.insightMainArea.replace("{area}", `${top.name} · ${top.areaQualifier === "MORE_THAN" ? ">" : ""}${formatNumber(top.area)}${top.areaUnit ? ` ${top.areaUnit}` : ""}`)}
            </p>
          )}
          {top?.mainCropName && (
            <p className="text-xs leading-5 text-[var(--text-secondary)]">{copy.insightMainCrop.replace("{crop}", agricultureCropName(top.mainCropName, top.mainCropCode ?? "", language))}</p>
          )}
          {hasWindow && selected?.plantingWindow && (
            <p className="text-xs leading-5 text-[var(--text-secondary)]">
              {copy.insightMainCrop.replace("{crop}", selected.name)} · {copy.currentSeason}: {selected.plantingWindow}{selected.seasonLabel ? ` · ${selected.seasonLabel}` : ""}
            </p>
          )}
          <p className="rounded-lg border border-[#e8edf2] bg-[#f7fafc] px-3 py-2 text-[10px] leading-5 text-[var(--text-secondary)]">{copy.insightCalendarHelp}</p>
          {selected && selected.opportunityCount > 0 && (
            <p className="text-xs font-semibold text-[#b45309]">{copy.insightOpportunity.replace("{level}", selected.opportunityLevel)}</p>
          )}
        </div>
      )}
    </section>
  );
}
