"use client";

import { Trophy } from "lucide-react";
import { cn } from "../../../lib/utils";
import { agricultureCropName, agricultureVerificationLevelLabel } from "./agriculture.ui";
import { formatNumber } from "./agriculture.data-charts";
import type { RankingRow, DensityBand } from "./agriculture.overview-view";

type Copy = ReturnType<typeof import("./agriculture.ui").agricultureCopy>["overviewIntelligence"];
type Language = import("../../../src/locales").Language;

const BAND_CLASS: Record<DensityBand, string> = {
  high: "border-[#b8dfb0] bg-[#e8f6e6] text-[#2f6e2a]",
  medium: "border-[#f0d98a] bg-[#fdf6dc] text-[#8a6a00]",
  low: "border-[#f3cfb8] bg-[#fdf0e7] text-[#b45309]",
  none: "border-[#e0e2e6] bg-[#f3f4f6] text-[#6b7280]",
};

export function TopAgricultureRanking({ rows, copy, language }: { rows: RankingRow[]; copy: Copy; language: Language }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]" data-agri-intel-ranking>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-[#fdf6dc] text-[#8a6a00]"><Trophy size={16} /></span>
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{copy.rankingTitle}</h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{copy.rankingSub}</p>
        </div>
      </div>
      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead className="border-b border-[var(--divider)] text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              <tr>
                <th className="pb-2 pr-2 font-semibold">{copy.rankingColRank}</th>
                <th className="pb-2 pr-2 font-semibold">{copy.rankingColArea}</th>
                <th className="pb-2 pr-2 font-semibold">{copy.rankingColCrop}</th>
                <th className="pb-2 pr-2 text-right font-semibold">{copy.rankingColAcres}</th>
                <th className="pb-2 text-right font-semibold">{copy.rankingColConfidence}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {rows.map((row) => (
                <tr key={row.locationId} className="align-middle">
                  <td className="py-2.5 pr-2 text-[var(--text-tertiary)]">{row.rank}</td>
                  <td className="py-2.5 pr-2 font-semibold text-[var(--text-primary)]">{row.name}</td>
                  <td className="py-2.5 pr-2 text-[var(--text-secondary)]">{row.mainCropName ? agricultureCropName(row.mainCropName, row.mainCropCode ?? "", language) : "—"}</td>
                  <td className="py-2.5 pr-2 text-right tabular-nums text-[var(--text-primary)]">{row.areaQualifier === "MORE_THAN" ? ">" : ""}{formatNumber(row.area)}{row.areaUnit ? ` ${row.areaUnit}` : ""}</td>
                  <td className="py-2.5 text-right"><ConfidenceBadge row={row} language={language} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] p-4 text-xs text-[var(--text-secondary)]">{copy.rankingEmpty}</p>
      )}
    </section>
  );
}

function ConfidenceBadge({ row, language }: { row: RankingRow; language: Language }) {
  const label = row.confidenceGrade ? agricultureVerificationLevelLabel(row.confidenceGrade, language) : "—";
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold", BAND_CLASS[row.densityBand])}>{label}</span>;
}
