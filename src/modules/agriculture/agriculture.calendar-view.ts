/**
 * Pure, React-free derivations for the Crop Calendar presentation layer.
 *
 * These functions are VIEW logic only. They never invent agronomic facts:
 * every badge, window, bar, and count is derived from AgricultureCalendarRow
 * / AgricultureCropStatistic / AgricultureCropPresence records that already
 * exist in the payload. "No data" stays "no data".
 */
import type { AgricultureOverviewPayload, AgricultureCalendarRow, AgricultureCropStatistic } from "./agriculture.types";
import { selectCurrentFieldVerifications } from "./agriculture.types";
import { bestCalendarRows } from "./agriculture.calendar";

export type CalendarStageCategory =
  | "prep"
  | "planting"
  | "growth"
  | "nearHarvest"
  | "harvest"
  | "tapping"
  | "noData";

export type EvidenceTone = "verified" | "township" | "regional" | "historical" | "unverified" | "noData";
export type SituationKind = "verifiedCurrent" | "inWindow" | "betweenWindows" | "beforeWindow" | "outsideWindows" | "noData";

export type MonthSpan = { start: number; end: number };

export type TimelineStage = {
  stageCode: string;
  category: CalendarStageCategory;
  segments: MonthSpan[];
  historical: boolean;
  inherited: boolean;
  row: AgricultureCalendarRow;
};

export type TimelineGroup = {
  key: string;
  locationId: string;
  locationName: string;
  cropId: string;
  cropCode: string;
  cropName: string;
  seasonKey: string;
  seasonRaw: string;
  cropYearLabel: string;
  stages: TimelineStage[];
  representative: AgricultureCalendarRow;
  mainCrop: boolean;
  historicalOnly: boolean;
  inherited: boolean;
};

export type SituationCard = {
  group: TimelineGroup;
  kind: SituationKind;
  badgeStageCode: string | null;
  badgeCategory: CalendarStageCategory | null;
  harvestStatus: "active" | "upcoming" | "noData";
  monthsToHarvest: number | null;
};

export type EvidenceBadge = {
  tone: EvidenceTone;
  key: "current" | "township" | "regional" | "historical" | "unverified" | "noData";
  verificationKey: "verified" | "reference" | "unverified";
  verificationLevel: string | null;
  confidenceScore: number | null;
};

export type AreaDonutSegment = {
  cropCode: string;
  value: number;
  percent: number;
  moreThan: boolean;
  others: boolean;
};

export type AreaDonut = {
  kind: "townshipActual" | "stateSown";
  unit: string;
  year: string | null;
  total: number;
  moreThan: boolean;
  segments: AreaDonutSegment[];
};

export type RelatedAreaRow = {
  locationName: string;
  cropCode: string;
  cropName: string;
  season: string;
  plantingWindow: MonthSpan | null;
  harvestWindow: MonthSpan | null;
  verificationLevel: string | null;
  historical: boolean;
};

export type SourceFact = {
  sourceId: string;
  name: string;
  uri: string | null;
  year: string | null;
  geography: string | null;
  verificationLevel: string;
  confidenceScore: number | null;
  recordCount: number;
  links: Array<"calendar" | "presence" | "statistics">;
};

export type PlanningScope = {
  country: string | null;
  region: string | null;
  township: string | null;
  season: string | null;
  dataLevel: "TOWNSHIP" | "STATE_REGION" | "REGIONAL" | "NATIONAL" | "MIXED" | "NONE";
};

export type CalendarView = {
  scope: PlanningScope;
  groups: TimelineGroup[];
  situationCards: SituationCard[];
  donut: AreaDonut | null;
  relatedAreas: RelatedAreaRow[];
  sources: SourceFact[];
  hasCurrentObservations: boolean;
  mainCropCount: number;
};

const PREP_STAGES = new Set(["LAND_PREPARATION", "NURSERY_SEED_PREP", "REPLANTING"]);
const PLANTING_STAGES = new Set(["SOWING", "PLANTING", "TRANSPLANTING_DIRECT_SEEDING"]);
const NEAR_HARVEST_STAGES = new Set(["MATURITY"]);
const HARVEST_STAGES = new Set(["HARVEST", "POST_HARVEST", "DRYING"]);
const TAPPING_STAGES = new Set(["TAPPING", "REDUCED_TAPPING"]);
const HARVEST_LIKE_STAGES = new Set(["HARVEST", "TAPPING", "DRYING", "POST_HARVEST"]);

const CATEGORY_ORDER: Record<CalendarStageCategory, number> = {
  prep: 10,
  planting: 20,
  growth: 30,
  nearHarvest: 40,
  harvest: 50,
  tapping: 60,
  noData: 70,
};

export function stageCategory(stageCode: string | null | undefined): CalendarStageCategory {
  const code = stageCode?.trim().toUpperCase() ?? "";
  if (PREP_STAGES.has(code)) return "prep";
  if (PLANTING_STAGES.has(code)) return "planting";
  if (NEAR_HARVEST_STAGES.has(code)) return "nearHarvest";
  if (HARVEST_STAGES.has(code)) return "harvest";
  if (TAPPING_STAGES.has(code)) return "tapping";
  if (code) return "growth";
  return "noData";
}

export function isHarvestLikeStage(stageCode: string | null | undefined) {
  return HARVEST_LIKE_STAGES.has((stageCode ?? "").trim().toUpperCase());
}

export function isPlantingLikeStage(stageCode: string | null | undefined) {
  const category = stageCategory(stageCode);
  return category === "prep" || category === "planting";
}

/** Current month marker, computed in the company time zone (presentation only). */
export function currentMonthMarker(now: Date, timeZone: string): { month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "numeric",
    year: "numeric",
  }).formatToParts(now);
  const month = Number(parts.find((part) => part.type === "month")?.value ?? now.getMonth() + 1);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? now.getFullYear());
  return { month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : 1, year: Number.isInteger(year) ? year : now.getFullYear() };
}

function adjustedMonth(start: number, currentMonth: number) {
  return start >= currentMonth ? start : start + 12;
}

function monthContains(segments: MonthSpan[], month: number) {
  return segments.some((segment) => month >= segment.start && month <= segment.end);
}

/**
 * Builds the Gantt-style 12-month groups from scoped calendar rows.
 * Duplicate stage rows (same location/crop/season/stage) are deduped by
 * calendarResolutionRank via bestCalendarRows; inherited rows survive.
 */
export function buildCalendarTimeline(rows: AgricultureCalendarRow[]): TimelineGroup[] {
  const deduped = bestCalendarRows(rows);
  const groups = new Map<string, TimelineGroup>();
  for (const row of deduped) {
    const seasonKey = row.seasonCode ?? row.seasonId ?? row.seasonName ?? "";
    const key = `${row.locationId}|${row.cropId}|${seasonKey}|${row.cropYear ?? ""}`;
    const existing = groups.get(key);
    const category = stageCategory(row.stageCode);
    const segments = calendarMonthSegmentsFor(row);
    if (!segments.length) continue;
    const stage: TimelineStage = {
      stageCode: row.stageCode,
      category,
      segments,
      historical: row.calendarType === "HISTORICAL_OBSERVED",
      inherited: Boolean(row.inheritedFromLocationId),
      row,
    };
    if (existing) {
      existing.stages.push(stage);
    } else {
      groups.set(key, {
        key,
        locationId: row.locationId,
        locationName: row.locationName,
        cropId: row.cropId,
        cropCode: row.cropCode,
        cropName: row.cropName,
        seasonKey,
        seasonRaw: row.seasonName ?? row.seasonCode ?? "",
        cropYearLabel: row.cropYear ? `${row.cropYear}/${String((row.cropYear + 1) % 100).padStart(2, "0")}` : "",
        stages: [stage],
        representative: row,
        mainCrop: false,
        historicalOnly: row.calendarType === "HISTORICAL_OBSERVED",
        inherited: stage.inherited,
      });
    }
  }
  for (const group of groups.values()) {
    group.stages.sort((left, right) => CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category] || left.stageCode.localeCompare(right.stageCode));
    group.historicalOnly = group.stages.every((stage) => stage.historical);
    group.inherited = group.stages.some((stage) => stage.inherited);
  }
  return [...groups.values()].sort((left, right) => left.locationName.localeCompare(right.locationName) || left.cropName.localeCompare(right.cropName) || left.seasonKey.localeCompare(right.seasonKey));
}

function calendarMonthSegmentsFor(row: AgricultureCalendarRow): MonthSpan[] {
  const start = monthNumber(row.windowStartMonth) ?? monthFromDate(row.baselineStartDate);
  const end = monthNumber(row.windowEndMonth) ?? monthFromDate(row.baselineEndDate) ?? start;
  if (!start || !end) return [];
  return end >= start ? [{ start, end }] : [{ start, end: 12 }, { start: 1, end }];
}

function monthNumber(value: number | null | undefined) {
  return value && value >= 1 && value <= 12 ? value : null;
}

function monthFromDate(value: string | null) {
  const month = value?.match(/^\d{4}-(\d{2})/)?.[1];
  return month ? monthNumber(Number(month)) : null;
}

/** Nearest harvest-like window (by next occurrence), used for the situation card window line. */
export function nearestHarvestWindow(group: TimelineGroup, currentMonth: number): { span: MonthSpan; tapping: boolean } | null {
  let best: { span: MonthSpan; tapping: boolean } | null = null;
  let bestDelta = Infinity;
  for (const stage of group.stages) {
    if (!isHarvestLikeStage(stage.stageCode)) continue;
    for (const segment of stage.segments) {
      const delta = adjustedMonth(segment.start, currentMonth) - currentMonth;
      if (delta < bestDelta) {
        bestDelta = delta;
        best = { span: segment, tapping: stageCategory(stage.stageCode) === "tapping" };
      }
    }
  }
  return best;
}

/** Months (1–12) from the current month to the next harvest-like window. */
export function monthsToHarvest(group: TimelineGroup, currentMonth: number): { status: "active" | "upcoming" | "noData"; months: number | null } {
  const harvestWindows = group.stages.filter((stage) => isHarvestLikeStage(stage.stageCode) && stage.segments.length);
  if (!harvestWindows.length) return { status: "noData", months: null };
  if (harvestWindows.some((stage) => monthContains(stage.segments, currentMonth))) return { status: "active", months: 0 };
  let months: number | null = null;
  for (const stage of harvestWindows) {
    for (const segment of stage.segments) {
      const delta = adjustedMonth(segment.start, currentMonth) - currentMonth;
      if (months === null || delta < months) months = delta;
    }
  }
  return { status: "upcoming", months: months ?? null };
}

/**
 * Situation badge derivation — strictly window-derived, never an agronomic claim.
 * "verifiedCurrent" only fires when an APPROVED local field verification carries
 * a currentStage for this location+crop.
 */
export function deriveSituationCard(
  group: TimelineGroup,
  currentMonth: number,
  verifiedStage: string | null = null,
): SituationCard {
  const harvest = monthsToHarvest(group, currentMonth);
  if (verifiedStage) {
    return { group, kind: "verifiedCurrent", badgeStageCode: verifiedStage, badgeCategory: stageCategory(verifiedStage), harvestStatus: harvest.status, monthsToHarvest: harvest.months };
  }
  if (!group.stages.length) {
    return { group, kind: "noData", badgeStageCode: null, badgeCategory: null, harvestStatus: harvest.status, monthsToHarvest: harvest.months };
  }
  const active = group.stages.find((stage) => monthContains(stage.segments, currentMonth));
  if (active) {
    return { group, kind: "inWindow", badgeStageCode: active.stageCode, badgeCategory: active.category, harvestStatus: harvest.status, monthsToHarvest: harvest.months };
  }
  const sorted = [...group.stages].sort((left, right) => {
    const leftStart = Math.min(...left.segments.map((segment) => adjustedMonth(segment.start, currentMonth)));
    const rightStart = Math.min(...right.segments.map((segment) => adjustedMonth(segment.start, currentMonth)));
    return leftStart - rightStart;
  });
  const next = sorted[0];
  if (next) {
    const plantEndedBeforeNow = group.stages.some((stage) => isPlantingLikeStage(stage.stageCode) && stage.segments.every((segment) => segment.end < currentMonth));
    if (isHarvestLikeStage(next.stageCode) && plantEndedBeforeNow) {
      return { group, kind: "betweenWindows", badgeStageCode: next.stageCode, badgeCategory: "growth", harvestStatus: harvest.status, monthsToHarvest: harvest.months };
    }
    return { group, kind: "beforeWindow", badgeStageCode: next.stageCode, badgeCategory: next.category, harvestStatus: harvest.status, monthsToHarvest: harvest.months };
  }
  return { group, kind: "outsideWindows", badgeStageCode: null, badgeCategory: null, harvestStatus: harvest.status, monthsToHarvest: harvest.months };
}

export function evidenceBadge(row: Pick<AgricultureCalendarRow, "calendarType" | "sourceGeography" | "inheritedFromLocationId" | "verificationLevel" | "confidenceScore">): EvidenceBadge {
  if (row.calendarType === "CURRENT_OBSERVED") {
    return { tone: "verified", key: "current", verificationKey: "verified", verificationLevel: row.verificationLevel, confidenceScore: row.confidenceScore };
  }
  if (row.calendarType === "HISTORICAL_OBSERVED") {
    return { tone: "historical", key: "historical", verificationKey: "reference", verificationLevel: row.verificationLevel, confidenceScore: row.confidenceScore };
  }
  if (row.sourceGeography === "TOWNSHIP" && !row.inheritedFromLocationId) {
    return { tone: "township", key: "township", verificationKey: "verified", verificationLevel: row.verificationLevel, confidenceScore: row.confidenceScore };
  }
  const verifiedLevel = /^V[34]$/.test(row.verificationLevel ?? "");
  if (verifiedLevel) {
    return { tone: "regional", key: "regional", verificationKey: "verified", verificationLevel: row.verificationLevel, confidenceScore: row.confidenceScore };
  }
  return { tone: "unverified", key: "unverified", verificationKey: "unverified", verificationLevel: row.verificationLevel, confidenceScore: row.confidenceScore };
}

export function planningScope(overview: AgricultureOverviewPayload): PlanningScope {
  const locations = overview.locations;
  const levels = [...new Set(locations.map((location) => location.geographyLevel))];
  const dataLevel: PlanningScope["dataLevel"] = levels.length === 1
    ? levels[0] as PlanningScope["dataLevel"]
    : levels.length === 0 ? "NONE" : "MIXED";
  const single = locations.length === 1 ? locations[0] : null;
  const country = single?.countryName ?? (levels.length ? uniqueNonEmpty(locations.map((location) => location.countryName)) : null);
  const region = single ? (single.geographyLevel === "TOWNSHIP" ? single.stateRegionName ?? null : single.canonicalName) : null;
  const township = single?.geographyLevel === "TOWNSHIP" ? single.canonicalName : null;
  const years = overview.calendar
    .map((row) => row.cropYear ?? (row.validFromYear !== null && row.validFromYear !== undefined ? row.validFromYear : null))
    .filter((year): year is number => typeof year === "number" && Number.isFinite(year));
  const season = years.length
    ? `${Math.min(...years)}/${String((Math.max(...years) + 1) % 100).padStart(2, "0")}`
    : null;
  return { country, region, township, season, dataLevel };
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.filter(Boolean))].join(", ") || null;
}

/** Reliable area mix. Prefers eligible ACTUAL township cultivated area (latest year per crop), falls back to state/region CSO sown area. */
export function areaDonutData(overview: AgricultureOverviewPayload): AreaDonut | null {
  const township = townshipActualSegments(overview);
  if (township) return township;
  return stateSownSegments(overview);
}

function townshipActualSegments(overview: AgricultureOverviewPayload): AreaDonut | null {
  const eligiblePresence = new Set(
    overview.cropPresence
      .filter((row) => (row.presenceStatus === "CONFIRMED_PRESENT" || row.presenceStatus === "PROBABLE") && row.evidenceGeography === "TOWNSHIP")
      .map((row) => `${row.locationId}:${row.cropId}`),
  );
  const rows = overview.statistics.filter((row) =>
    row.recordType === "ACTUAL"
    && row.sourceGeography === "TOWNSHIP"
    && /^V[1-4]$/.test(row.verificationStatus)
    && typeof row.cultivatedArea === "number"
    && Number.isFinite(row.cultivatedArea)
    && eligiblePresence.has(`${row.locationId}:${row.cropId}`),
  );
  if (!rows.length) return null;
  const latestPerCrop = new Map<string, AgricultureCropStatistic>();
  for (const row of rows) {
    const key = `${row.locationId}:${row.cropId}`;
    const current = latestPerCrop.get(key);
    if (!current || (row.cropYear ?? 0) > (current.cropYear ?? 0)) latestPerCrop.set(key, row);
  }
  return buildDonut([...latestPerCrop.values()].map((row) => ({ cropCode: row.cropCode, value: row.cultivatedArea as number, qualifier: row.valueQualifier })), "townshipActual", rows[0]?.areaUnit ?? null, latestYearLabel(rows));
}

function stateSownSegments(overview: AgricultureOverviewPayload): AreaDonut | null {
  const rows = overview.statistics.filter((row) =>
    row.recordType === "ACTUAL"
    && row.sourceGeography === "STATE_REGION"
    && row.geographyLevel === "STATE_REGION"
    && /^V[1-4]$/.test(row.verificationStatus)
    && typeof row.sownArea === "number"
    && Number.isFinite(row.sownArea),
  );
  if (!rows.length) return null;
  const latestYear = rows.reduce<number | null>((latest, row) => (row.cropYear !== null && (latest === null || row.cropYear > latest) ? row.cropYear : latest), null);
  const latestRows = latestYear === null ? rows : rows.filter((row) => row.cropYear === latestYear);
  return buildDonut(latestRows.map((row) => ({ cropCode: row.cropCode, value: row.sownArea as number, qualifier: row.valueQualifier })), "stateSown", latestRows[0]?.sownAreaUnit ?? null, latestYear === null ? null : String(latestYear));
}

function buildDonut(entries: Array<{ cropCode: string; value: number; qualifier: string }>, kind: "townshipActual" | "stateSown", unit: string | null, year: string | null): AreaDonut | null {
  const totals = new Map<string, { value: number; qualifier: string }>();
  for (const entry of entries) {
    const current = totals.get(entry.cropCode);
    totals.set(entry.cropCode, { value: (current?.value ?? 0) + entry.value, qualifier: current?.qualifier === "MORE_THAN" || entry.qualifier === "MORE_THAN" ? "MORE_THAN" : entry.qualifier });
  }
  const sorted = [...totals.entries()]
    .map(([cropCode, record]) => ({ cropCode, value: record.value, qualifier: record.qualifier }))
    .sort((left, right) => right.value - left.value);
  const total = sorted.reduce((sum, record) => sum + record.value, 0);
  if (!total || !Number.isFinite(total)) return null;
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const segments: AreaDonutSegment[] = top.map((record) => ({
    cropCode: record.cropCode,
    value: record.value,
    percent: Math.round((record.value / total) * 1000) / 10,
    moreThan: record.qualifier === "MORE_THAN",
    others: false,
  }));
  if (rest.length) {
    const restTotal = rest.reduce((sum, record) => sum + record.value, 0);
    segments.push({
      cropCode: "",
      value: restTotal,
      percent: Math.round((restTotal / total) * 1000) / 10,
      moreThan: rest.some((record) => record.qualifier === "MORE_THAN"),
      others: true,
    });
  }
  return {
    kind,
    unit: unit ?? "Acre",
    year,
    total,
    moreThan: sorted.some((record) => record.qualifier === "MORE_THAN"),
    segments,
  };
}

function latestYearLabel(rows: AgricultureCropStatistic[]) {
  const latest = rows.reduce<number | null>((current, row) => (row.cropYear !== null && (current === null || row.cropYear > current) ? row.cropYear : current), null);
  return latest === null ? null : String(latest);
}

export function relatedAreaRows(overview: AgricultureOverviewPayload): RelatedAreaRow[] {
  const townshipIds = new Set(overview.locations.filter((location) => location.geographyLevel === "TOWNSHIP").map((location) => location.locationId));
  const grouped = new Map<string, RelatedAreaRow>();
  const push = (row: RelatedAreaRow) => {
    const key = `${row.locationName}|${row.cropCode}`;
    grouped.set(key, row);
  };
  for (const row of bestCalendarRows(overview.calendar)) {
    if (!townshipIds.has(row.locationId)) continue;
    const category = stageCategory(row.stageCode);
    const window: MonthSpan | null = calendarMonthSegmentsFor(row).length ? { start: calendarMonthSegmentsFor(row)[0].start, end: calendarMonthSegmentsFor(row)[0].end } : null;
    const existing = grouped.get(`${row.locationName}|${row.cropCode}`);
    if (isPlantingLikeStage(row.stageCode)) {
      push({
        locationName: row.locationName,
        cropCode: row.cropCode,
        cropName: row.cropName,
        season: row.seasonName ?? row.seasonCode ?? "",
        plantingWindow: window,
        harvestWindow: existing?.harvestWindow ?? null,
        verificationLevel: existing?.verificationLevel ?? row.verificationLevel,
        historical: existing?.historical ?? row.calendarType === "HISTORICAL_OBSERVED",
      });
    } else if (isHarvestLikeStage(row.stageCode)) {
      push({
        locationName: row.locationName,
        cropCode: row.cropCode,
        cropName: row.cropName,
        season: row.seasonName ?? row.seasonCode ?? "",
        plantingWindow: existing?.plantingWindow ?? null,
        harvestWindow: window,
        verificationLevel: existing?.verificationLevel ?? row.verificationLevel,
        historical: existing?.historical ?? row.calendarType === "HISTORICAL_OBSERVED",
      });
    } else if (category !== "noData" && !existing) {
      push({
        locationName: row.locationName,
        cropCode: row.cropCode,
        cropName: row.cropName,
        season: row.seasonName ?? row.seasonCode ?? "",
        plantingWindow: null,
        harvestWindow: null,
        verificationLevel: row.verificationLevel,
        historical: row.calendarType === "HISTORICAL_OBSERVED",
      });
    }
  }
  for (const presence of overview.cropPresence) {
    if (!townshipIds.has(presence.locationId) || presence.presenceStatus === "UNKNOWN") continue;
    const locationName = overview.locations.find((location) => location.locationId === presence.locationId)?.canonicalName ?? presence.locationId;
    const key = `${locationName}|${presence.cropCode}`;
    if (!grouped.has(key)) {
      push({
        locationName,
        cropCode: presence.cropCode,
        cropName: presence.cropName,
        season: "",
        plantingWindow: null,
        harvestWindow: null,
        verificationLevel: presence.confidenceGrade,
        historical: false,
      });
    }
  }
  return [...grouped.values()].sort((left, right) => left.locationName.localeCompare(right.locationName) || left.cropName.localeCompare(right.cropName));
}

export function sourceFacts(overview: AgricultureOverviewPayload): SourceFact[] {
  const sources = new Map<string, SourceFact>();
  const bump = (sourceId: string | null, name: string | null, uri: string | null, year: string | null, geography: string | null, verificationLevel: string | null, confidenceScore: number | null, link: SourceFact["links"][number]) => {
    if (!sourceId) return;
    const existing = sources.get(sourceId);
    const levelRank = (level: string | null) => ({ V0: 0, V1: 1, V2: 2, V3: 3, V4: 4 } as Record<string, number>)[level ?? ""] ?? -1;
    if (existing) {
      existing.recordCount += 1;
      if (levelRank(verificationLevel) > levelRank(existing.verificationLevel)) {
        existing.verificationLevel = verificationLevel ?? existing.verificationLevel;
        existing.confidenceScore = confidenceScore ?? existing.confidenceScore;
      }
      if (year && (!existing.year || year > existing.year)) existing.year = year;
      if (geography && geography !== existing.geography) existing.geography = [existing.geography, geography].filter(Boolean).join(" · ");
      if (!existing.links.includes(link)) existing.links.push(link);
      return;
    }
    sources.set(sourceId, {
      sourceId,
      name: name ?? sourceId,
      uri,
      year,
      geography,
      verificationLevel: verificationLevel ?? "UNKNOWN",
      confidenceScore,
      recordCount: 1,
      links: [link],
    });
  };
  for (const row of overview.calendar) {
    bump(row.sourceId, row.sourceName, row.sourceUri, yearFromDate(row.sourcePublicationDate) ?? yearFromNumber(row.validFromYear), row.sourceGeography, row.verificationLevel, row.confidenceScore, "calendar");
  }
  for (const row of overview.cropPresence) {
    if (row.presenceStatus === "UNKNOWN") continue;
    bump(row.sourceId, row.sourceName, row.sourceUri, row.evidenceYear === null ? null : String(row.evidenceYear), row.evidenceGeography, row.confidenceGrade, confidenceGradeScore(row.confidenceGrade), "presence");
  }
  for (const row of overview.statistics) {
    bump(row.sourceId, row.sourceName, row.sourceUri, row.sourceYear === null ? null : String(row.sourceYear), row.sourceGeography, row.verificationStatus, row.confidenceScore, "statistics");
  }
  return [...sources.values()].sort((left, right) => (right.year ?? "").localeCompare(left.year ?? "") || left.name.localeCompare(right.name));
}

function yearFromDate(value: string | null) {
  return value?.match(/^(\d{4})/)?.[1] ?? null;
}

function yearFromNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function confidenceGradeScore(grade: string | null) {
  return ({ V0: 0, V1: 25, V2: 50, V3: 75, V4: 100 } as Record<string, number>)[grade ?? ""] ?? null;
}

/** CSV export of the visible timeline — data only, one row per stage window. */
export function calendarCsv(groups: TimelineGroup[]): string {
  const header = ["location", "crop", "crop_code", "season", "crop_year", "stage", "category", "start_month", "end_month", "cross_year", "historical", "source", "verification", "confidence"];
  const rows = groups.flatMap((group) =>
    group.stages.map((stage) => [
      group.locationName,
      group.cropName,
      group.cropCode,
      group.seasonRaw,
      group.cropYearLabel,
      stage.stageCode,
      stage.category,
      stage.segments.map((segment) => segment.start).join("|"),
      stage.segments.map((segment) => segment.end).join("|"),
      stage.segments.length > 1 ? "yes" : "no",
      stage.historical ? "yes" : "no",
      stage.row.sourceName ?? stage.row.sourceId ?? "",
      stage.row.verificationLevel ?? "",
      stage.row.confidenceScore ?? "",
    ]),
  );
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  return [header.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
}

/** Single entry point used by the Crop Calendar page. */
export function buildCalendarView(overview: AgricultureOverviewPayload, marker: { month: number; year: number }): CalendarView {
  const groups = buildCalendarTimeline(overview.calendar);
  const mainCropIds = new Set(
    overview.cropPresence
      .filter((row) => row.presenceStatus !== "UNKNOWN" && row.importanceLevel === "MAJOR")
      .map((row) => row.cropId),
  );
  for (const group of groups) group.mainCrop = mainCropIds.has(group.cropId);
  const verifiedStages = new Map(
    selectCurrentFieldVerifications(overview.fieldVerifications)
      .filter((row) => row.currentStage && row.cropId)
      .map((row) => [`${row.locationId}:${row.cropId}`, row.currentStage] as const),
  );
  const situationCards = groups.map((group) => deriveSituationCard(group, marker.month, verifiedStages.get(`${group.locationId}:${group.cropId}`) ?? null));
  situationCards.sort((left, right) => {
    const priority = (card: SituationCard) => (card.group.mainCrop ? 0 : 1) + (card.kind === "noData" ? 2 : 0);
    const byImportance = priority(left) - priority(right);
    if (byImportance !== 0) return byImportance;
    const byHarvest = (left.monthsToHarvest ?? 99) - (right.monthsToHarvest ?? 99);
    if (byHarvest !== 0) return byHarvest;
    return left.group.cropName.localeCompare(right.group.cropName);
  });
  const hasCurrentObservations = overview.calendar.some((row) => row.calendarType === "CURRENT_OBSERVED")
    || selectCurrentFieldVerifications(overview.fieldVerifications).some((row) => Boolean(row.currentStage));
  return {
    scope: planningScope(overview),
    groups,
    situationCards: situationCards.slice(0, 6),
    donut: areaDonutData(overview),
    relatedAreas: relatedAreaRows(overview),
    sources: sourceFacts(overview),
    hasCurrentObservations,
    mainCropCount: groups.filter((group) => group.mainCrop).length,
  };
}
