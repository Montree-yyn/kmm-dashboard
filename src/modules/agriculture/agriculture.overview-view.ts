/**
 * Pure, React-free derivations for the Agriculture Intelligence overview
 * dashboard.
 *
 * VIEW logic only. Every KPI, map point, ranking row, crop mix share, and
 * quality metric is derived from records that already exist in the payload
 * (crop presence, statistics, coverage, calendar, hazards, weather). Nothing
 * is invented: no area, yield, stage, opportunity, or risk value is fabricated
 * when the payload has no source for it — "no data" stays "no data".
 *
 * Map bridging: agriculture township locations are linked to the vector-map
 * polygons through the canonical township master (township_id). Locations that
 * do not resolve (or have no data) simply render as "no data" — never as a
 * made-up value.
 */
import type {
  AgricultureOverviewPayload,
  MeasurementQualifier,
  StatisticRecordType,
} from "./agriculture.types";
import {
  isEligibleActualStatistic,
  isEligibleLocalCropPresence,
} from "./agriculture.types";
import { resolveSalesGeography } from "../../../lib/marketing/township-geography";
import townshipMaster from "../../../data/master-townships.json";

type MasterTownship = { township_id: string; township: string; state_region: string };
const master = townshipMaster as MasterTownship[];

const BOUNDARY_CANONICAL_IDS = new Set(master.map((record) => record.township_id));

export type ConfidenceBand = "high" | "medium" | "low" | "none";

export type QualityTone = "good" | "partial" | "missing";

export type OverviewSummary = {
  cropCount: number | null;
  area: number | null;
  areaUnit: string | null;
  areaQualifier: MeasurementQualifier | null;
  areaYear: number | null;
  townshipsWithArea: number;
  townshipTotal: number;
  confidence: number | null;
  confidenceBand: ConfidenceBand;
  weatherMapped: number;
  weatherMappingTotal: number;
};

export type DensityBand = "high" | "medium" | "low" | "none";

export type TownshipPoint = {
  locationId: string;
  name: string;
  stateRegion: string | null;
  canonicalId: string | null;
  density: number | null;
  densityBand: DensityBand;
  densityQualifier: MeasurementQualifier | null;
  densityUnit: string | null;
  mainCropCode: string | null;
  mainCropName: string | null;
  mainCropArea: number | null;
  cropCount: number;
  confidenceGrade: string | null;
  hasPresence: boolean;
  hasCalendar: boolean;
  opportunityLevel: "high" | "medium" | "low" | "none";
  opportunityCount: number;
  floodRisk: boolean;
  hazardCount: number;
  hasWeather: boolean;
  rainfallMm: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
  cropMix: CropMixSlice[] | null;
  plantingWindow: string | null;
  seasonLabel: string | null;
};

export type CropMixSlice = {
  cropCode: string;
  cropName: string;
  area: number;
  percent: number;
  moreThan: boolean;
};

export type RankingRow = {
  rank: number;
  canonicalId: string | null;
  locationId: string;
  name: string;
  mainCropCode: string | null;
  mainCropName: string | null;
  area: number;
  areaQualifier: MeasurementQualifier | null;
  areaUnit: string | null;
  confidenceGrade: string | null;
  densityBand: DensityBand;
};

export type QualityMetric = {
  key: "presence" | "area" | "yield" | "calendar" | "weather" | "verification";
  value: number;
  total: number;
  pct: number;
  tone: QualityTone;
};

export type OverviewScope = {
  country: string | null;
  region: string | null;
  township: string | null;
  season: string | null;
};

export type AgricultureOverviewView = {
  summary: OverviewSummary;
  townships: TownshipPoint[];
  ranking: RankingRow[];
  cropMix: CropMixSlice[] | null;
  quality: QualityMetric[];
  scope: OverviewScope;
  openGaps: number;
  hazardLocations: string[];
  hasOpportunityData: boolean;
  hasWeatherRiskData: boolean;
  selectedPoint: TownshipPoint | null;
};

export function buildAgricultureOverviewView(
  overview: AgricultureOverviewPayload,
  selectedLocationId: string | null,
): AgricultureOverviewView {
  const townships = overview.locations
    .filter((location) => location.geographyLevel === "TOWNSHIP")
    .map((location) => buildTownshipPoint(overview, location));
  const summary = buildSummary(overview);
  const cropMix = buildCropMix(overview);
  const ranking = buildRanking(townships);
  const hazardLocations = [...new Set(overview.historicalHazards.map((row) => row.locationId))];
  const hasOpportunityData = overview.opportunities.length > 0;
  const hasWeatherRiskData = overview.weatherState.some((row) => row.riskType !== null);
  const selectedPoint = townships.find((point) => point.locationId === selectedLocationId) ?? null;
  return {
    summary,
    townships,
    ranking,
    cropMix,
    quality: buildQuality(overview),
    scope: buildScope(overview),
    openGaps: overview.verificationCoverage.openHighPriorityGaps,
    hazardLocations,
    hasOpportunityData,
    hasWeatherRiskData,
    selectedPoint,
  };
}

function buildSummary(overview: AgricultureOverviewPayload): OverviewSummary {
  const kpis = overview.kpis;
  const confidence = kpis.dataConfidence;
  const confidenceBand: ConfidenceBand = confidence === null ? "none" : confidence >= 70 ? "high" : confidence >= 40 ? "medium" : "low";
  const areaRows = overview.statistics.filter(isEligibleActualStatistic);
  const areaYear = areaRows.reduce<number | null>((latest, row) => row.cropYear !== null && (latest === null || row.cropYear > latest) ? row.cropYear : latest, null);
  return {
    cropCount: kpis.activeCrops,
    area: kpis.cultivatedArea,
    areaUnit: kpis.cultivatedAreaUnit,
    areaQualifier: kpis.cultivatedAreaQualifier,
    areaYear,
    townshipsWithArea: overview.coverage.townshipsWithAreaStatistics,
    townshipTotal: overview.coverage.pilotTownships,
    confidence,
    confidenceBand,
    weatherMapped: overview.coverage.weatherMapped,
    weatherMappingTotal: overview.coverage.weatherMappingTotal,
  };
}

/** Latest ACTUAL area per location+crop (summed across crops), or null when the scope has none. */
function actualAreaByLocation(overview: AgricultureOverviewPayload): Map<string, { value: number; qualifier: MeasurementQualifier | null; unit: string | null; year: number | null }> {
  const latestPerKey = new Map<string, AgricultureOverviewPayload["statistics"][number]>();
  for (const row of overview.statistics.filter(isEligibleActualStatistic)) {
    const key = `${row.locationId}:${row.cropCode}`;
    const current = latestPerKey.get(key);
    if (!current || (row.cropYear ?? 0) > (current.cropYear ?? 0)) latestPerKey.set(key, row);
  }
  const byLocation = new Map<string, { value: number; qualifier: MeasurementQualifier | null; unit: string | null; year: number | null }>();
  for (const row of latestPerKey.values()) {
    if (row.cultivatedArea === null || !Number.isFinite(row.cultivatedArea)) continue;
    const current = byLocation.get(row.locationId);
    byLocation.set(row.locationId, {
      value: (current?.value ?? 0) + row.cultivatedArea,
      qualifier: row.valueQualifier === "MORE_THAN" || current?.qualifier === "MORE_THAN" ? "MORE_THAN" : (current?.qualifier ?? row.valueQualifier ?? null),
      unit: row.areaUnit ?? current?.unit ?? null,
      year: Math.max(current?.year ?? 0, row.cropYear ?? 0) || null,
    });
  }
  return byLocation;
}

function densityBandFor(value: number | null): DensityBand {
  if (value === null) return "none";
  if (value >= 10000) return "high";
  if (value >= 2000) return "medium";
  return "low";
}

function buildTownshipPoint(overview: AgricultureOverviewPayload, location: AgricultureOverviewPayload["locations"][number]): TownshipPoint {
  const areas = actualAreaByLocation(overview);
  const area = areas.get(location.locationId) ?? null;
  const presence = overview.cropPresence
    .filter((row) => row.locationId === location.locationId && isEligibleLocalCropPresence(row))
    .sort((left, right) => importanceRank(left.importanceLevel) - importanceRank(right.importanceLevel) || Number(right.confidenceGrade?.replace(/\D/g, "") ?? 0) - Number(left.confidenceGrade?.replace(/\D/g, "") ?? 0));
  const mainPresence = presence[0] ?? null;
  const weather = overview.weather.locations.find((row) => row.id === location.weatherLocationId) ?? null;
  const opportunityRows = overview.opportunities.filter((row) => row.locationId === location.locationId);
  const hazards = overview.historicalHazards.filter((row) => row.locationId === location.locationId);
  const calendarCount = overview.calendar.filter((row) => row.locationId === location.locationId).length;
  const floodRisk = hazards.some((row) => row.hazardType === "FLOOD");
  const maxOpportunity = Math.max(...opportunityRows.map((row) => row.priorityScore ?? row.opportunityScore ?? 0), 0);
  const opportunityLevel = !opportunityRows.length ? "none" : maxOpportunity >= 70 ? "high" : maxOpportunity >= 40 ? "medium" : "low";
  const resolution = resolveSalesGeography(location.stateRegionName, location.canonicalName, BOUNDARY_CANONICAL_IDS);
  const calendarRows = overview.calendar.filter((row) => row.locationId === location.locationId);
  const planting = calendarRows.find((row) => row.stageCode === "PLANTING" || row.stageCode === "SOWING") ?? null;
  const plantingWindow = planting
    ? planting.windowStartMonth !== null && planting.windowEndMonth !== null
      ? `${monthName(planting.windowStartMonth)}-${monthName(planting.windowEndMonth)}`
      : null
    : null;
  const seasonLabel = planting?.seasonName ?? planting?.seasonCode ?? null;
  return {
    locationId: location.locationId,
    name: location.canonicalName,
    stateRegion: location.stateRegionName,
    canonicalId: resolution.canonicalLocationId,
    density: area?.value ?? null,
    densityBand: densityBandFor(area?.value ?? null),
    densityQualifier: area?.qualifier ?? null,
    densityUnit: area?.unit ?? null,
    mainCropCode: mainPresence?.cropCode ?? null,
    mainCropName: mainPresence?.cropName ?? null,
    mainCropArea: mainPresence?.cultivatedArea ? parseArea(mainPresence.cultivatedArea) : null,
    cropCount: new Set(presence.map((row) => row.cropId)).size,
    confidenceGrade: mainPresence?.confidenceGrade ?? null,
    hasPresence: presence.length > 0,
    hasCalendar: calendarCount > 0,
    opportunityLevel,
    opportunityCount: opportunityRows.length,
    floodRisk,
    hazardCount: hazards.length,
    hasWeather: Boolean(weather),
    rainfallMm: weather ? weather.forecast.reduce((sum, day) => sum + day.rainfallMm, 0) : null,
    temperatureC: weather?.temperature ?? null,
    humidityPct: weather?.humidity ?? null,
    cropMix: buildLocalCropMix(overview, location.locationId),
    plantingWindow,
    seasonLabel,
  };
}

/** ACTUAL crop mix for one township (latest year per crop, summed). */
function buildLocalCropMix(overview: AgricultureOverviewPayload, locationId: string): CropMixSlice[] | null {
  const latestPerKey = new Map<string, AgricultureOverviewPayload["statistics"][number]>();
  for (const row of overview.statistics.filter(isEligibleActualStatistic).filter((row) => row.locationId === locationId)) {
    const key = row.cropCode;
    const current = latestPerKey.get(key);
    if (!current || (row.cropYear ?? 0) > (current.cropYear ?? 0)) latestPerKey.set(key, row);
  }
  const totals = new Map<string, { value: number; moreThan: boolean }>();
  for (const row of latestPerKey.values()) {
    if (row.cultivatedArea === null || !Number.isFinite(row.cultivatedArea)) continue;
    const current = totals.get(row.cropCode);
    totals.set(row.cropCode, {
      value: (current?.value ?? 0) + row.cultivatedArea,
      moreThan: Boolean(current?.moreThan) || row.valueQualifier === "MORE_THAN",
    });
  }
  const sorted = [...totals.entries()].map(([cropCode, record]) => ({ cropCode, ...record })).sort((left, right) => right.value - left.value);
  const total = sorted.reduce((sum, record) => sum + record.value, 0);
  if (!total || !Number.isFinite(total)) return null;
  return sorted.map((record) => ({
    cropCode: record.cropCode,
    cropName: cropNameFor(overview, record.cropCode),
    area: record.value,
    percent: Math.round((record.value / total) * 1000) / 10,
    moreThan: record.moreThan,
  }));
}

/** ACTUAL crop mix for the whole scope (latest year per location+crop, summed). */
function buildCropMix(overview: AgricultureOverviewPayload): CropMixSlice[] | null {
  const latestPerKey = new Map<string, AgricultureOverviewPayload["statistics"][number]>();
  for (const row of overview.statistics.filter(isEligibleActualStatistic)) {
    const key = `${row.locationId}:${row.cropCode}`;
    const current = latestPerKey.get(key);
    if (!current || (row.cropYear ?? 0) > (current.cropYear ?? 0)) latestPerKey.set(key, row);
  }
  const totals = new Map<string, { value: number; moreThan: boolean }>();
  for (const row of latestPerKey.values()) {
    if (row.cultivatedArea === null || !Number.isFinite(row.cultivatedArea)) continue;
    const current = totals.get(row.cropCode);
    totals.set(row.cropCode, {
      value: (current?.value ?? 0) + row.cultivatedArea,
      moreThan: Boolean(current?.moreThan) || row.valueQualifier === "MORE_THAN",
    });
  }
  const sorted = [...totals.entries()].map(([cropCode, record]) => ({ cropCode, ...record })).sort((left, right) => right.value - left.value);
  const total = sorted.reduce((sum, record) => sum + record.value, 0);
  if (!total || !Number.isFinite(total)) return null;
  return sorted.map((record) => ({
    cropCode: record.cropCode,
    cropName: cropNameFor(overview, record.cropCode),
    area: record.value,
    percent: Math.round((record.value / total) * 1000) / 10,
    moreThan: record.moreThan,
  }));
}

function buildRanking(townships: TownshipPoint[]): RankingRow[] {
  return townships
    .filter((point) => point.density !== null && point.density > 0)
    .sort((left, right) => (right.density ?? 0) - (left.density ?? 0))
    .slice(0, 5)
    .map((point, index) => ({
      rank: index + 1,
      canonicalId: point.canonicalId,
      locationId: point.locationId,
      name: point.name,
      mainCropCode: point.mainCropCode,
      mainCropName: point.mainCropName,
      area: point.density ?? 0,
      areaQualifier: point.densityQualifier,
      areaUnit: point.densityUnit,
      confidenceGrade: point.confidenceGrade,
      densityBand: point.densityBand,
    }));
}

function buildQuality(overview: AgricultureOverviewPayload): QualityMetric[] {
  const coverage = overview.coverage;
  const verification = overview.verificationCoverage;
  const total = coverage.pilotTownships;
  const metric = (key: QualityMetric["key"], value: number): QualityMetric => ({
    key,
    value,
    total,
    pct: total > 0 ? Math.round((value / total) * 100) : 0,
    tone: total === 0 ? "missing" : value / total >= 0.7 ? "good" : value / total >= 0.4 ? "partial" : "missing",
  });
  return [
    metric("presence", coverage.townshipsWithFactualPresence),
    metric("area", coverage.townshipsWithAreaStatistics),
    metric("yield", coverage.townshipsWithYieldData),
    metric("calendar", coverage.townshipsWithCalendar),
    metric("weather", coverage.weatherMapped),
    metric("verification", verification.verifiedTownships),
  ];
}

function buildScope(overview: AgricultureOverviewPayload): OverviewScope {
  const locations = overview.locations;
  const single = locations.length === 1 ? locations[0] : null;
  const country = single?.countryName ?? uniqueNonEmpty(locations.map((location) => location.countryName));
  const region = single
    ? single.geographyLevel === "TOWNSHIP" ? single.stateRegionName ?? null : single.canonicalName
    : null;
  const township = single?.geographyLevel === "TOWNSHIP" ? single.canonicalName : null;
  const years = overview.statistics
    .map((row) => row.cropYear)
    .filter((year): year is number => typeof year === "number");
  const latestYear = years.length ? Math.max(...years) : null;
  const season = latestYear === null ? null : `${latestYear}/${String((latestYear + 1) % 100).padStart(2, "0")}`;
  return { country, region, township, season };
}

function cropNameFor(overview: AgricultureOverviewPayload, cropCode: string) {
  return overview.crops.find((crop) => crop.cropCode === cropCode)?.cropName ?? cropCode;
}

function parseArea(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function importanceRank(value: string) {
  return ({ MAJOR: 0, SECONDARY: 1, MINOR: 2, UNKNOWN: 3 } as Record<string, number>)[value] ?? 3;
}

function monthName(month: number) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[(month - 1 + 12) % 12] ?? String(month);
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.filter(Boolean))].join(", ") || null;
}

export type { StatisticRecordType };
