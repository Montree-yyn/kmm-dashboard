"use client";

import { ArrowRight, Info, Star } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { agricultureCropName, agricultureGeographyLabel, agricultureSeasonLabel } from "./agriculture.ui";
import { formatCropYear, formatNumber } from "./agriculture.data-charts";
import type { CropCard } from "./agriculture.data-view";

type Copy = ReturnType<typeof import("./agriculture.ui").agricultureCopy>["dataView"];
type Language = import("../../../src/locales").Language;

const CROP_ICONS: Record<string, typeof Star> = {
  RICE: Star,
  MAIZE: Star,
  BLACK_GRAM: Star,
  GREEN_GRAM: Star,
  CHICKPEA: Star,
  GROUNDNUT: Star,
  SESAME: Star,
  SUNFLOWER: Star,
  RUBBER: Star,
  SUGARCANE: Star,
  COTTON: Star,
};

export function CropOverviewCards({ crops, copy, language, onOpen }: { crops: CropCard[]; copy: Copy; language: Language; onOpen: (crop: CropCard) => void }) {
  if (!crops.length) {
    return (
      <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]">
        <SectionHead icon={<Info size={16} />} title={copy.keyCrops} subtitle={copy.keyCropsSub} />
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] p-5 text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{copy.noCrops}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{copy.noCropsHelp}</p>
        </div>
      </section>
    );
  }
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]" data-agri-crop-cards>
      <SectionHead icon={<LeafIcon />} title={copy.keyCrops} subtitle={copy.keyCropsSub} action={<span className="shrink-0 rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-tertiary)]">{copy.viewAllCrops.replace("{n}", String(crops.length))}</span>} />
      <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2 lg:grid lg:snap-none lg:grid-cols-2 lg:overflow-visible xl:grid-cols-3 2xl:grid-cols-5">
        {crops.map((crop) => <CropCardView key={crop.cropId} crop={crop} copy={copy} language={language} onOpen={() => onOpen(crop)} />)}
      </div>
    </section>
  );
}

function CropCardView({ crop, copy, language, onOpen }: { crop: CropCard; copy: Copy; language: Language; onOpen: () => void }) {
  const CropIcon = CROP_ICONS[crop.cropCode] ?? Star;
  const badge = recordTypeBadge(crop, copy);
  return (
    <button type="button" onClick={onOpen} className="group flex min-w-[240px] snap-start flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-4 text-left shadow-[var(--shadow-card)] transition hover:border-[#cfe5c8] hover:shadow-[var(--shadow-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 place-items-center rounded-lg bg-[#eef7eb] text-[#47763d]"><CropIcon size={17} /></span>
        {badge}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-bold text-[var(--text-primary)]">{agricultureCropName(crop.cropName, crop.cropCode, language)}</p>
          {crop.importanceLevel === "MAJOR" && <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#fdf3e7] px-1.5 py-0.5 text-[9px] font-bold text-[#b45309]"><Star size={9} fill="currentColor" />{copy.mainCrop}</span>}
        </div>
        {crop.seasonCode && <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">{agricultureSeasonLabel(crop.seasonCode, language)}</p>}
      </div>
      <div className="mt-auto">
        <p className="flex items-baseline gap-1 text-[19px] font-bold leading-tight text-[var(--text-primary)]">
          <span>{crop.area === null ? "—" : `${crop.areaQualifier === "MORE_THAN" ? ">" : ""}${formatNumber(crop.area)}`}</span>
          {crop.areaUnit && <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{crop.areaUnit}</span>}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{crop.year === null ? "" : `${copy.latestYear}: ${formatCropYear(crop.year)}`}{crop.seasonCode ? ` · ${agricultureSeasonLabel(crop.seasonCode, language)}` : ""}</p>
        <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#47763d]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[var(--text-secondary)]"><Info size={9} />{copy.level}: {agricultureGeographyLabel(crop.level, language)}</span>
          <ArrowRight size={11} className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
        </p>
      </div>
    </button>
  );
}

function recordTypeBadge(crop: CropCard, copy: Copy): ReactNode {
  const record = crop.recordType;
  if (record === "ACTUAL" || record === "ACTUAL_OFFICIAL") return <Badge className="border-[#b8dfb0] bg-[#e8f6e6] text-[#2f6e2a]">{copy.badgeActual}</Badge>;
  if (record === "TARGET") return <Badge className="border-[#f0d98a] bg-[#fdf6dc] text-[#8a6a00]">{copy.badgeTarget}</Badge>;
  if (record === "PLAN") return <Badge className="border-[#f0d98a] bg-[#fdf6dc] text-[#8a6a00]">{copy.badgePlan}</Badge>;
  if (record === "ESTIMATE") return <Badge className="border-[#e0e2e6] bg-[#f3f4f6] text-[#6b7280]">{copy.badgeEstimated}</Badge>;
  if (record === "REPORTED") return <Badge className="border-[#e0e2e6] bg-[#f3f4f6] text-[#6b7280]">{copy.badgeReported}</Badge>;
  if (crop.presenceStatus === "PROBABLE") return <Badge className="border-[#b3cfe8] bg-[#e9f1f9] text-[#2c5f8a]">{copy.badgeProbable}</Badge>;
  return null;
}

function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", className)}>{children}</span>;
}

function SectionHead({ icon, title, subtitle, action }: { icon: ReactNode; title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eef7eb] text-[#47763d]">{icon}</span>
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold text-[var(--text-primary)]">{title}</h2>
          <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function LeafIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>;
}
