"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bean,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileDown,
  Info,
  Leaf,
  MapPin,
  RotateCcw,
  ShieldAlert,
  Sprout,
  Sun,
  TreePine,
  Wheat,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCompany } from "../../../src/hooks/useCompany";
import { useLocale } from "../../../src/hooks/useLocale";
import { cn } from "../../../lib/utils";
import { EmptyState } from "../../../components/design-system/empty-state";
import {
  agricultureCopy,
  agricultureCropName,
  agricultureSeasonLabel,
  agricultureSourceGeographyLabel,
  agricultureStageLabel,
  agricultureVerificationLevelLabel,
  localizedText,
} from "./agriculture.ui";
import { calendarDurationLabel } from "./agriculture.calendar";
import {
  buildCalendarView,
  currentMonthMarker,
  evidenceBadge,
  nearestHarvestWindow,
  stageCategory,
  calendarCsv,
  type CalendarStageCategory,
  type EvidenceTone,
  type MonthSpan,
  type SituationCard,
  type TimelineGroup,
} from "./agriculture.calendar-view";
import type { AgricultureOverviewPayload } from "./agriculture.types";
import { selectCurrentFieldVerifications } from "./agriculture.types";

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CROP_ICONS: Record<string, LucideIcon> = {
  RICE: Wheat,
  MAIZE: Wheat,
  BLACK_GRAM: Bean,
  GREEN_GRAM: Bean,
  CHICKPEA: Bean,
  GROUNDNUT: Sprout,
  SESAME: Sun,
  SUNFLOWER: Sun,
  RUBBER: TreePine,
  SUGARCANE: Sprout,
  COTTON: Sprout,
};

const CATEGORY_STYLE: Record<CalendarStageCategory, { bar: string; dot: string; chip: string; icon: string }> = {
  prep: { bar: "border-[#d3dab8] bg-[#e8ecd9] text-[#5f6b3a]", dot: "bg-[#a8b56e]", chip: "bg-[#f0f2e4] text-[#5f6b3a]", icon: "bg-[#eef0e2] text-[#6b7450]" },
  planting: { bar: "border-[#a8d4a2] bg-[#cde9c8] text-[#2f6e2a]", dot: "bg-[#3f9a4b]", chip: "bg-[#e8f6e6] text-[#2f6e2a]", icon: "bg-[#e9f6e6] text-[#3a8f5b]" },
  growth: { bar: "border-[#7fbf8c] bg-[#a8d9b0] text-[#1c5c30]", dot: "bg-[#2f9e63]", chip: "bg-[#e2f4e8] text-[#1c5c30]", icon: "bg-[#e2f4e8] text-[#1c7a41]" },
  nearHarvest: { bar: "border-[#f0d98a] bg-[#fdeec4] text-[#8a6a00]", dot: "bg-[#e0b420]", chip: "bg-[#fdf6dc] text-[#8a6a00]", icon: "bg-[#fdf6dc] text-[#b08a12]" },
  harvest: { bar: "border-[#f2bd90] bg-[#fadfc9] text-[#b45309]", dot: "bg-[#e07b39]", chip: "bg-[#fdefe2] text-[#b45309]", icon: "bg-[#fdefe2] text-[#c05f1e]" },
  tapping: { bar: "border-[#b3cfe8] bg-[#d9e7f7] text-[#2c5f8a]", dot: "bg-[#5a8db8]", chip: "bg-[#e9f1f9] text-[#2c5f8a]", icon: "bg-[#e9f1f9] text-[#3b6ea4]" },
  noData: { bar: "border-dashed border-[#d1d5db] bg-[#f3f4f6] text-[#9ca3af]", dot: "bg-[#d1d5db]", chip: "bg-[#f3f4f6] text-[#9ca3af]", icon: "bg-[#f3f4f6] text-[#9ca3af]" },
};

const EVIDENCE_STYLE: Record<EvidenceTone, string> = {
  verified: "border-[#b8dfb0] bg-[#e8f6e6] text-[#2f6e2a]",
  township: "border-[#b3cfe8] bg-[#e9f1f9] text-[#2c5f8a]",
  regional: "border-[#cfe5c8] bg-[#eef7eb] text-[#47763d]",
  historical: "border-[#e0e2e6] bg-[#f3f4f6] text-[#6b7280]",
  unverified: "border-[#f0d98a] bg-[#fffbeb] text-[#8a6a00]",
  noData: "border-dashed border-[#d1d5db] bg-[#f3f4f6] text-[#9ca3af]",
};

const DONUT_COLORS = ["#3f9a4b", "#5a8db8", "#e0b420", "#e07b39", "#a8b56e", "#94a3b8"];

type AgricultureCalendarProps = {
  overview: AgricultureOverviewPayload;
  onOpenAgricultureData?: () => void;
  onResetFilters?: () => void;
};

export function AgricultureCalendar({ overview, onOpenAgricultureData, onResetFilters }: AgricultureCalendarProps) {
  const { language } = useLocale();
  const { selectedCompany } = useCompany();
  const copy = agricultureCopy(language);
  const cv = copy.calendarView;
  const months = language === "th" ? TH_MONTHS : EN_MONTHS;

  const marker = useMemo(() => currentMonthMarker(new Date(), selectedCompany?.timeZone ?? "Asia/Yangon"), [selectedCompany?.timeZone]);
  const view = useMemo(() => buildCalendarView(overview, marker), [overview, marker]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showMainCropsOnly, setShowMainCropsOnly] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const visibleGroups = showMainCropsOnly && view.mainCropCount > 0 ? view.groups.filter((group) => group.mainCrop) : view.groups;
  const selectedGroup = view.groups.find((group) => group.key === selectedKey) ?? null;
  const mainCropsOnlyUnavailable = view.mainCropCount === 0;
  const monthLabel = `${months[marker.month - 1] ?? ""} ${marker.year}`;

  function downloadCsv() {
    const blob = new Blob([calendarCsv(view.groups)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kmm-crop-calendar-${marker.year}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5" data-agriculture-calendar>
      {/* Header */}
      <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eef7eb] text-[#47763d]"><CalendarDays size={20} /></span>
            <div>
              <h2 className="text-[22px] font-semibold leading-tight">{cv.title}</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{cv.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-2 text-xs text-[var(--text-secondary)]">
              <span className={cn("size-2 rounded-full", view.hasCurrentObservations ? "bg-[var(--status-success)]" : "bg-[var(--status-warning)]")} />
              {cv.updated} {formatUpdated(overview.generatedAt, language)}
            </span>
            <button type="button" onClick={() => setShowAbout((current) => !current)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)]"><Info size={14} />{cv.about}</button>
            <button type="button" onClick={downloadCsv} aria-label={cv.downloadAria} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)]"><Download size={14} />{cv.download}</button>
            {onResetFilters && <button type="button" onClick={onResetFilters} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 text-xs font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"><RotateCcw size={14} />{cv.resetFilters}</button>}
          </div>
        </div>
        {showAbout && <div className="mt-4 rounded-xl border border-[#e8edf2] bg-[#f7fafc] p-4 text-xs leading-6 text-[var(--text-secondary)]"><Info size={14} className="mb-1 text-[#496a9a]" />{cv.aboutBody}</div>}
        <ScopeBreadcrumb scope={view.scope} copy={cv} />
      </section>

      {/* Current month situation */}
      <section aria-labelledby="crop-calendar-situation">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarRange size={17} className="text-[#47763d]" />
            <h3 id="crop-calendar-situation" className="text-[17px] font-semibold">{cv.currentSituation} <span className="font-normal text-[var(--text-secondary)]">• {monthLabel}</span></h3>
          </div>
          <button type="button" onClick={() => document.getElementById("crop-calendar-12m")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#47763d] hover:underline">{cv.viewAll}<ArrowRight size={13} /></button>
        </div>
        {view.situationCards.length ? (
          <div className="flex snap-x gap-3 overflow-x-auto pb-2 lg:grid lg:snap-none lg:grid-cols-2 lg:overflow-visible xl:grid-cols-3 2xl:grid-cols-5">
            {view.situationCards.map((card) => <SituationCardView key={card.group.key} card={card} copy={cv} language={language} currentMonth={marker.month} onOpen={() => setSelectedKey(card.group.key)} />)}
          </div>
        ) : (
          <EmptyState title={cv.noSituationData} message={cv.noSituationDataHelp} className="min-h-[160px] rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)]" />
        )}
        {!view.hasCurrentObservations && <p className="mt-2 flex items-start gap-2 rounded-lg border border-[var(--status-warning-bg)] bg-[var(--status-warning-bg)] px-3 py-2 text-[11px] leading-5 text-[var(--status-warning)]"><ShieldAlert size={13} className="mt-0.5 shrink-0" />{cv.situationFootnote}</p>}
      </section>

      {/* 12-month timeline */}
      <section id="crop-calendar-12m" aria-labelledby="crop-calendar-timeline-title" className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-[var(--divider)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 id="crop-calendar-timeline-title" className="text-[19px] font-semibold">{cv.timelineTitle}</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{cv.timelineHelp}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className={cn("inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]", mainCropsOnlyUnavailable && "cursor-not-allowed opacity-50")} title={mainCropsOnlyUnavailable ? cv.noMainCropsHelp : undefined}>
              <span className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-[var(--surface-muted)] transition" aria-hidden="true">
                <span className={cn("inline-block size-4 rounded-full bg-white shadow transition-transform", showMainCropsOnly && "translate-x-4 bg-[#47763d]")} />
              </span>
              <input type="checkbox" className="sr-only" checked={showMainCropsOnly} disabled={mainCropsOnlyUnavailable} onChange={(event) => setShowMainCropsOnly(event.target.checked)} />
              {cv.mainCropsOnly}
            </label>
            <button type="button" onClick={downloadCsv} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#47763d] px-3 text-xs font-semibold text-white transition hover:bg-[#3a6532]"><FileDown size={14} />{cv.export}</button>
          </div>
        </div>
        {mainCropsOnlyUnavailable && <p className="border-b border-[var(--divider)] bg-[var(--surface-subtle)] px-5 py-2 text-[11px] text-[var(--text-tertiary)] sm:px-6">{cv.noMainCropsHelp}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[var(--divider)] px-5 py-3 text-[10px] font-semibold text-[var(--text-secondary)] sm:px-6">
          <LegendDot style={CATEGORY_STYLE.prep} label={cv.legendPrep} />
          <LegendDot style={CATEGORY_STYLE.planting} label={cv.legendPlanting} />
          <LegendDot style={CATEGORY_STYLE.growth} label={cv.legendGrowth} />
          <LegendDot style={CATEGORY_STYLE.nearHarvest} label={cv.legendNearHarvest} />
          <LegendDot style={CATEGORY_STYLE.harvest} label={cv.legendHarvest} />
          <LegendDot style={CATEGORY_STYLE.tapping} label={cv.legendTapping} />
          <LegendDot style={CATEGORY_STYLE.noData} label={cv.legendNoData} />
          <span className="ml-auto inline-flex items-center gap-1.5 text-[#2f8f6b]"><span className="h-3 w-px border-l-2 border-dashed border-[#2f8f6b]" />{cv.currentMonth}</span>
        </div>
        {visibleGroups.length ? (
          <div className="overflow-x-auto">
            <div className="relative min-w-[948px]">
              <div className="grid grid-cols-[180px_repeat(12,64px)] border-b border-[var(--divider)] px-0 pb-2 pt-4 text-center text-[11px] font-bold text-[var(--text-tertiary)]">
                <span className="pl-5 text-left">{cv.cropColumn}</span>
                {months.map((month) => <span key={month}>{month}</span>)}
              </div>
              {visibleGroups.map((group) => <TimelineRow key={group.key} group={group} copy={cv} language={language} onOpen={() => setSelectedKey(group.key)} />)}
              <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: 180 + (marker.month - 1) * 64, width: 64 }} aria-hidden="true">
                <div className="mx-auto mt-2 w-fit rounded-full bg-[#2f8f6b] px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">{monthLabel}</div>
                <div className="mx-auto h-[calc(100%-30px)] w-px border-l-2 border-dashed border-[#2f8f6b]/70" />
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title={cv.timelineEmpty} message={cv.timelineEmptyHelp} className="min-h-[240px]" />
        )}
      </section>

      {/* Lower analytics */}
      <section className="grid gap-5 xl:grid-cols-3">
        <AreaCard view={view} copy={cv} language={language} />
        <RelatedAreasCard overview={overview} view={view} copy={cv} language={language} />
        <SourcesCard view={view} copy={cv} language={language} />
      </section>
      {!view.hasCurrentObservations && (
        <p className="flex items-start justify-center gap-2 px-4 text-center text-[11px] leading-5 text-[var(--text-tertiary)]"><Info size={13} className="mt-0.5 shrink-0" />{cv.situationFootnote}</p>
      )}

      {/* Detail drawer */}
      {selectedGroup && <DetailDrawer group={selectedGroup} overview={overview} copy={cv} language={language} onClose={() => setSelectedKey(null)} onDeepDive={onOpenAgricultureData} />}
    </div>
  );
}

function ScopeBreadcrumb({ scope, copy }: { scope: ReturnType<typeof buildCalendarView>["scope"]; copy: ReturnType<typeof agricultureCopy>["calendarView"] }) {
  const levelLabel = ({ TOWNSHIP: copy.levelTownship, STATE_REGION: copy.levelStateRegion, REGIONAL: copy.levelRegional, NATIONAL: copy.levelNational, MIXED: copy.levelMixed, NONE: copy.levelNone } as const)[scope.dataLevel];
  const items = [
    scope.country,
    scope.region,
    scope.township,
    scope.season ?? copy.seasonUnknown,
  ].filter((item): item is string => Boolean(item));
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-xs" aria-label={copy.scope}>
      <span className="font-semibold text-[var(--text-tertiary)]">{copy.scope}:</span>
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 && <ChevronRight size={13} className="text-[var(--text-disabled)]" />}
          <span className={cn("rounded-md px-2 py-1", index === items.length - 1 ? "bg-[#eef7eb] font-semibold text-[#47763d]" : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]")}>{item}</span>
        </span>
      ))}
      <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] font-bold tracking-[0.04em] text-[var(--text-tertiary)]"><MapPin size={10} />{copy.scopeDataLevel}: {levelLabel}</span>
    </div>
  );
}

function SituationCardView({ card, copy, language, currentMonth, onOpen }: { card: SituationCard; copy: ReturnType<typeof agricultureCopy>["calendarView"]; language: import("../../../src/locales").Language; currentMonth: number; onOpen: () => void }) {
  const group = card.group;
  const CropIcon = CROP_ICONS[group.cropCode] ?? Leaf;
  const category = card.badgeCategory ? stageCategory(card.badgeCategory) : "noData";
  const style = CATEGORY_STYLE[category];
  const harvest = nearestHarvestWindow(group, currentMonth);
  const cropName = agricultureCropName(group.cropName, group.cropCode, language);
  const season = agricultureSeasonLabel(group.seasonRaw, language);
  const windowLabel = harvest ? monthRangeLabel(harvest.span, language) : null;
  return (
    <button type="button" onClick={onOpen} className="group flex min-w-[240px] snap-start flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-4 text-left shadow-[var(--shadow-card)] transition hover:border-[#cfe5c8] hover:shadow-[var(--shadow-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
      <div className="flex items-start justify-between gap-2">
        <span className={cn("grid size-9 place-items-center rounded-lg", style.icon)}><CropIcon size={17} /></span>
        <SituationBadge card={card} copy={copy} language={language} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-[var(--text-primary)]">{cropName}</p>
        {season && <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">{season}</p>}
      </div>
      <div className="mt-auto">
        <p className="text-xs font-semibold leading-5 text-[var(--text-primary)]">
          {card.harvestStatus === "active"
            ? harvest?.tapping ? copy.inTappingWindow : copy.inHarvestWindow
            : card.harvestStatus === "upcoming" && card.monthsToHarvest !== null
              ? `${copy.monthsToHarvest} ${card.monthsToHarvest} ${harvest?.tapping ? copy.monthsToTapping : copy.monthsToHarvestSuffix}`
              : copy.noHarvestWindow}
          {windowLabel && <span className="font-normal text-[var(--text-secondary)]"> · {windowLabel}</span>}
        </p>
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{copy.typicalWindow} · {group.historicalOnly ? copy.historicalBadge : copy.referenceBadge}{group.inherited ? ` · ${copy.inheritedBadge}` : ""}</p>
        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#47763d]">{copy.detailLocation}: {group.locationName}<ArrowRight size={11} className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" /></p>
      </div>
    </button>
  );
}

function SituationBadge({ card, copy, language }: { card: SituationCard; copy: ReturnType<typeof agricultureCopy>["calendarView"]; language: import("../../../src/locales").Language }) {
  if (card.kind === "noData") {
    return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", EVIDENCE_STYLE.noData)}><ShieldAlert size={10} />{copy.badgeNoData}</span>;
  }
  if (card.kind === "verifiedCurrent" && card.badgeStageCode) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-[#b8dfb0] bg-[#e8f6e6] px-2 py-0.5 text-[10px] font-bold text-[#2f6e2a]"><BadgeCheck size={10} />{copy.verifiedStage}: {agricultureStageLabel(card.badgeStageCode, language)}</span>;
  }
  const category = card.badgeCategory ? stageCategory(card.badgeCategory) : "noData";
  const style = CATEGORY_STYLE[category];
  const stageLabel = card.badgeStageCode ? agricultureStageLabel(card.badgeStageCode, language) : null;
  const label = card.kind === "inWindow"
    ? stageLabel ? `${stageLabel} · ${copy.inReferenceWindow}` : copy.inReferenceWindow
    : card.kind === "betweenWindows" ? copy.stageBetween
    : card.kind === "beforeWindow" && stageLabel ? `${copy.stageBefore}${stageLabel}`
    : card.kind === "outsideWindows" ? copy.stageOutside
    : copy.inReferenceWindow;
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", style.chip)}><span className={cn("size-1.5 rounded-full", style.dot)} />{label}</span>;
}

function TimelineRow({ group, copy, language, onOpen }: { group: TimelineGroup; copy: ReturnType<typeof agricultureCopy>["calendarView"]; language: import("../../../src/locales").Language; onOpen: () => void }) {
  const CropIcon = CROP_ICONS[group.cropCode] ?? Leaf;
  const cropName = agricultureCropName(group.cropName, group.cropCode, language);
  const season = agricultureSeasonLabel(group.seasonRaw, language);
  const evidence = evidenceBadge(group.representative);
  return (
    <button type="button" onClick={onOpen} className="group grid w-full grid-cols-[180px_repeat(12,64px)] items-center border-b border-[var(--divider)] py-3 text-left transition last:border-0 hover:bg-[#fafdf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]">
      <div className="min-w-0 pr-3 pl-5">
        <div className="flex items-center gap-1.5">
          <CropIcon size={14} className="shrink-0 text-[#47763d]" />
          <p className="truncate text-xs font-bold text-[var(--text-primary)]">{cropName}</p>
        </div>
        {season && <p className="mt-1 truncate text-[10px] text-[var(--text-tertiary)]">{season}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {group.historicalOnly ? <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold", EVIDENCE_STYLE.historical)}><Clock3 size={9} />{copy.historicalBadge}</span> : <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold", EVIDENCE_STYLE[evidence.tone])}>{copy.referenceBadge}</span>}
          {group.inherited && <span className="rounded-full border border-[#e0e2e6] bg-[#fafbfc] px-1.5 py-0.5 text-[9px] font-bold text-[#6b7280]">{copy.inheritedBadge}</span>}
        </div>
      </div>
      <div className="col-span-12 -ml-[180px] grid grid-cols-12 items-center pl-[180px]">
        {group.stages.map((stage) => stage.segments.map((segment) => (
          <span key={`${stage.stageCode}-${segment.start}-${segment.end}`} style={{ gridColumn: `${segment.start} / ${segment.end + 1}` }} className={cn("relative flex h-6 items-center overflow-hidden rounded-md border px-1.5 text-[9px] font-bold", CATEGORY_STYLE[stage.category].bar, stage.historical && "bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.55)_0_4px,rgba(0,0,0,0.06)_4px_8px)]")} title={`${agricultureStageLabel(stage.stageCode, language)}: ${monthRangeLabel(segment, language)} · ${stage.row.sourceName ?? stage.row.sourceId ?? ""}`}>
            <span className="block truncate">{agricultureStageLabel(stage.stageCode, language)}{stage.historical ? ` · ${copy.historicalBadge}` : ""}</span>
          </span>
        )))}
      </div>
    </button>
  );
}

function LegendDot({ style, label }: { style: (typeof CATEGORY_STYLE)[CalendarStageCategory]; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={cn("size-2 rounded-full", style.dot)} />{label}</span>;
}

function AreaCard({ view, copy, language }: { view: ReturnType<typeof buildCalendarView>; copy: ReturnType<typeof agricultureCopy>["calendarView"]; language: import("../../../src/locales").Language }) {
  const donut = view.donut;
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]" data-area-donut>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-[#eef7eb] text-[#47763d]"><Sprout size={16} /></span>
        <div><h3 className="text-[16px] font-semibold">{copy.areaByCrop}</h3><p className="mt-0.5 text-[10px] font-semibold tracking-[0.04em] text-[var(--text-tertiary)]">{donut?.kind === "stateSown" ? copy.areaByCropState : copy.areaByCropTownship}{donut?.year ? ` · ${donut.year}` : ""}</p></div>
      </div>
      {donut ? (
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative size-36 shrink-0">
            <div className="size-full rounded-full" style={{ background: conicGradient(donut.segments) }} aria-hidden="true" />
            <div className="absolute inset-[22px] grid place-items-center rounded-full bg-white text-center shadow-inner">
              <div><p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{copy.areaTotal}</p><p className="text-lg font-bold leading-tight text-[var(--text-primary)]">{donut.moreThan ? ">" : ""}{formatNumber(donut.total)}</p><p className="text-[10px] text-[var(--text-tertiary)]">{donut.unit}</p></div>
            </div>
          </div>
          <ul className="w-full min-w-0 space-y-2">
            {donut.segments.map((segment, index) => {
              const name = segment.others ? copy.areaOthers : agricultureCropName(null, segment.cropCode, language);
              return (
                <li key={`${segment.cropCode}-${index}`} className="flex items-center gap-2 text-[11px]">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-[var(--text-primary)]">{name}</span>
                  <span className="text-[var(--text-secondary)]">{segment.percent}%</span>
                  <strong className="tabular-nums text-[var(--text-primary)]">{segment.moreThan ? ">" : ""}{formatNumber(segment.value)}</strong>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <EmptyState title={copy.areaNoData} message={copy.areaNoDataHelp} className="mt-3 min-h-[150px] rounded-xl border border-dashed" />
      )}
    </section>
  );
}

function RelatedAreasCard({ overview, view, copy, language }: { overview: AgricultureOverviewPayload; view: ReturnType<typeof buildCalendarView>; copy: ReturnType<typeof agricultureCopy>["calendarView"]; language: import("../../../src/locales").Language }) {
  const rows = view.relatedAreas;
  const townshipCount = overview.locations.filter((location) => location.geographyLevel === "TOWNSHIP").length;
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]" data-related-areas>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-[#e9f1f9] text-[#2c5f8a]"><MapPin size={16} /></span>
        <div><h3 className="text-[16px] font-semibold">{copy.relatedAreas}</h3>{townshipCount > 0 && rows.length > 0 && <p className="mt-0.5 text-[10px] font-semibold text-[var(--text-tertiary)]">{rows.length} {copy.sourcesRecords}</p>}</div>
      </div>
      {rows.length ? (
        <div className="mt-4 max-h-[280px] overflow-y-auto rounded-xl border border-[var(--border-default)]">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 border-b border-[var(--divider)] bg-[var(--surface-subtle)] text-[9px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]"><tr><th className="px-3 py-2 font-semibold">{copy.relatedAreasCol}</th><th className="px-3 py-2 font-semibold">{copy.relatedCropCol}</th><th className="px-3 py-2 font-semibold">{copy.relatedWindowCol}</th><th className="px-3 py-2 font-semibold">V</th></tr></thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {rows.map((row) => (
                <tr key={`${row.locationName}-${row.cropCode}`}>
                  <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">{row.locationName}</td>
                  <td className="px-3 py-2">{agricultureCropName(row.cropName, row.cropCode, language)}{row.historical && <span className="ml-1 rounded-full border border-[#e0e2e6] bg-[#f3f4f6] px-1 py-0.5 text-[8px] font-bold text-[#6b7280]">{copy.relatedHistoricalTag}</span>}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{windowPairLabel(row.plantingWindow, row.harvestWindow, language, copy)}</td>
                  <td className="px-3 py-2">{row.verificationLevel ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={copy.relatedNoData} message={copy.relatedNoDataHelp} className="mt-3 min-h-[150px] rounded-xl border border-dashed" />
      )}
    </section>
  );
}

function SourcesCard({ view, copy, language }: { view: ReturnType<typeof buildCalendarView>; copy: ReturnType<typeof agricultureCopy>["calendarView"]; language: import("../../../src/locales").Language }) {
  const sources = view.sources;
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]" data-sources-card>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-[#fdf6dc] text-[#8a6a00]"><Info size={16} /></span>
        <div><h3 className="text-[16px] font-semibold">{copy.sourcesTitle}</h3>{sources.length > 0 && <p className="mt-0.5 text-[10px] font-semibold text-[var(--text-tertiary)]">{sources.length} {copy.sourcesRecords}</p>}</div>
      </div>
      {sources.length ? (
        <ul className="mt-4 max-h-[280px] space-y-2 overflow-y-auto pr-1">
          {sources.map((source) => {
            const tone: EvidenceTone = source.verificationLevel === "V3" || source.verificationLevel === "V4" ? "verified" : source.verificationLevel === "V1" || source.verificationLevel === "V2" ? "unverified" : "noData";
            const badge = source.verificationLevel === "V3" || source.verificationLevel === "V4" ? copy.badgeVerified : source.verificationLevel === "V1" || source.verificationLevel === "V2" ? copy.badgeUnverified : copy.badgeNoData;
            return (
              <li key={source.sourceId} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[11px] font-semibold leading-5 text-[var(--text-primary)]">{source.name}</p>
                  {source.uri && <a href={source.uri} target="_blank" rel="noreferrer" className="mt-0.5 shrink-0 text-[var(--text-tertiary)] transition hover:text-[#47763d]" aria-label={source.name}><ExternalLink size={12} /></a>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                  {source.year && <span className="rounded-md bg-white px-1.5 py-0.5 font-semibold">{copy.sourcesYear}: {source.year}</span>}
                  {source.geography && <span className="rounded-md bg-white px-1.5 py-0.5">{copy.sourcesGeography}: {agricultureSourceGeographyLabel(source.geography, language)}</span>}
                  <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-bold", EVIDENCE_STYLE[tone])}>{badge}</span>
                  {source.confidenceScore !== null && <span>· {source.confidenceScore}</span>}
                  <span className="text-[var(--text-tertiary)]">· {source.recordCount} {copy.sourcesRecords}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title={copy.sourcesEmpty} className="mt-3 min-h-[150px] rounded-xl border border-dashed" />
      )}
    </section>
  );
}

function DetailDrawer({ group, overview, copy, language, onClose, onDeepDive }: { group: TimelineGroup; overview: AgricultureOverviewPayload; copy: ReturnType<typeof agricultureCopy>["calendarView"]; language: import("../../../src/locales").Language; onClose: () => void; onDeepDive?: () => void }) {
  const CropIcon = CROP_ICONS[group.cropCode] ?? Leaf;
  const cropName = agricultureCropName(group.cropName, group.cropCode, language);
  const season = agricultureSeasonLabel(group.seasonRaw, language);
  const evidence = evidenceBadge(group.representative);
  const sources = [...new Set(group.stages.map((stage) => stage.row.sourceName ?? stage.row.sourceId ?? "").filter(Boolean))];
  const sourceYear = group.stages.map((stage) => stage.row.sourcePublicationDate ?? (stage.row.validFromYear !== null ? String(stage.row.validFromYear) : null)).find((year): year is string => Boolean(year)) ?? null;
  const durations = [...new Set(group.stages.map((stage) => calendarDurationLabel(stage.row, language)).filter((label): label is string => Boolean(label)))];
  const localYield = overview.statistics.find((row) => row.locationId === group.locationId && row.cropId === group.cropId && row.recordType === "ACTUAL" && row.sourceGeography !== "NATIONAL" && row.yieldValue !== null && row.yieldUnit !== null);
  const verifiedCurrent = selectCurrentFieldVerifications(overview.fieldVerifications).find((row) => row.locationId === group.locationId && row.cropId === group.cropId && row.currentStage);
  const evidenceLabel = evidenceLabelFor(evidence, copy);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={copy.detailTitle}>
      <button type="button" className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onClose} aria-label={copy.detailClose} />
      <div className="kmm-kai-panel fixed flex flex-col overflow-y-auto border-l border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-overlay)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--divider)] px-5 py-4">
          <h3 className="text-[17px] font-semibold">{copy.detailTitle}</h3>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)]" aria-label={copy.detailClose}><X size={16} /></button>
        </div>
        <div className="flex-1 space-y-5 p-5">
          <div className="flex items-start gap-3">
            <span className={cn("grid size-11 place-items-center rounded-xl", CATEGORY_STYLE[group.stages[0]?.category ?? "noData"].icon)}><CropIcon size={20} /></span>
            <div className="min-w-0">
              <p className="text-[17px] font-bold leading-tight text-[var(--text-primary)]">{cropName}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.detailLocation}: {group.locationName}</p>
              {season && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{copy.detailSeason}: {season}{group.cropYearLabel ? ` · ${group.cropYearLabel}` : ""}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold", EVIDENCE_STYLE[evidence.tone])}><CheckCircle2 size={11} />{evidenceLabel}</span>
            {group.historicalOnly && <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold", EVIDENCE_STYLE.historical)}><Clock3 size={11} />{copy.historicalBadge}</span>}
            {verifiedCurrent?.currentStage && <span className="inline-flex items-center gap-1 rounded-full border border-[#b8dfb0] bg-[#e8f6e6] px-2 py-1 text-[10px] font-bold text-[#2f6e2a]"><BadgeCheck size={11} />{copy.verifiedStage}: {agricultureStageLabel(verifiedCurrent.currentStage, language)}</span>}
          </div>

          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{copy.detailStageWindows}</h4>
            <ul className="mt-2 space-y-1.5">
              {group.stages.map((stage) => (
                <li key={`${stage.stageCode}-${stage.segments.map((segment) => segment.start).join("-")}`} className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-xs">
                  <span className={cn("size-2.5 shrink-0 rounded-full", CATEGORY_STYLE[stage.category].dot)} />
                  <span className="font-semibold text-[var(--text-primary)]">{agricultureStageLabel(stage.stageCode, language)}</span>
                  <span className="ml-auto text-[var(--text-secondary)]">{stage.segments.map((segment) => monthRangeLabel(segment, language)).join(" + ")}</span>
                </li>
              ))}
              {!group.stages.length && <li className="rounded-lg border border-dashed border-[var(--border-default)] px-3 py-2 text-xs text-[var(--text-tertiary)]">{copy.detailNoWindow}</li>}
            </ul>
          </section>

          <dl className="space-y-2.5 text-xs">
            {durations.length > 0 && <DetailRow label={copy.detailDuration} value={durations.join(" · ")} />}
            <DetailRow label={copy.detailSource} value={sources.join(" · ") || localizedText(language, "ไม่ระบุแหล่งข้อมูล", "Source N/A")} />
            <DetailRow label={copy.detailSourceYear} value={sourceYear ?? localizedText(language, "ไม่ระบุปี", "Year N/A")} />
            <DetailRow label={copy.detailEvidence} value={agricultureSourceGeographyLabel(group.representative.sourceGeography, language)} />
            <DetailRow label={copy.detailVerification} value={agricultureVerificationLevelLabel(group.representative.verificationLevel, language)} />
            <DetailRow label={copy.detailConfidence} value={group.representative.confidenceScore !== null ? String(group.representative.confidenceScore) : localizedText(language, "ไม่มีข้อมูล", "N/A")} />
            <DetailRow label={copy.detailYield} value={localYield && localYield.yieldValue !== null ? `${formatNumber(localYield.yieldValue)} ${localYield.yieldUnit}` : copy.detailYieldNoData} />
          </dl>

          {group.representative.sourceUri && (
            <a href={group.representative.sourceUri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#47763d] hover:underline"><ExternalLink size={12} />{copy.detailSource}: {group.representative.sourceName ?? group.representative.sourceId}</a>
          )}
        </div>
        {onDeepDive && (
          <div className="border-t border-[var(--divider)] p-4">
            <button type="button" onClick={onDeepDive} className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-lg bg-[#47763d] px-4 text-sm font-semibold text-white transition hover:bg-[#3a6532]">{copy.detailDeep}<ArrowRight size={15} /></button>
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

function evidenceLabelFor(evidence: ReturnType<typeof evidenceBadge>, copy: ReturnType<typeof agricultureCopy>["calendarView"]) {
  if (evidence.key === "current") return copy.badgeVerified;
  if (evidence.key === "township") return `${copy.levelTownship} · ${copy.badgeReference}`;
  if (evidence.key === "historical") return copy.historicalBadge;
  if (evidence.key === "unverified") return copy.badgeUnverified;
  if (evidence.key === "noData") return copy.badgeNoData;
  return `${copy.levelStateRegion} · ${copy.badgeReference}`;
}

function monthRangeLabel(span: MonthSpan, language: import("../../../src/locales").Language) {
  const names = language === "th" ? TH_MONTHS : EN_MONTHS;
  const start = names[span.start - 1];
  const end = names[span.end - 1];
  if (!start || !end) return "";
  return span.start === span.end ? start : `${start}–${end}`;
}

function windowPairLabel(planting: MonthSpan | null, harvest: MonthSpan | null, language: import("../../../src/locales").Language, copy: ReturnType<typeof agricultureCopy>["calendarView"]) {
  const parts: string[] = [];
  if (planting) parts.push(`${copy.legendPlanting} ${monthRangeLabel(planting, language)}`);
  if (harvest) parts.push(`${copy.legendHarvest} ${monthRangeLabel(harvest, language)}`);
  if (!parts.length) return "—";
  return parts.join(" → ");
}

function conicGradient(segments: Array<{ percent: number }>) {
  let cursor = 0;
  const stops: string[] = [];
  segments.forEach((segment, index) => {
    const color = DONUT_COLORS[index % DONUT_COLORS.length];
    stops.push(`${color} ${cursor}% ${(cursor + segment.percent).toFixed(2)}%`);
    cursor += segment.percent;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatUpdated(value: string, language: import("../../../src/locales").Language) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", { calendar: "gregory", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  } catch {
    return value;
  }
}
