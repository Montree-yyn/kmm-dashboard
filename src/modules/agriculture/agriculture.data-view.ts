/**
 * Pure, React-free derivations for the Agriculture Data enterprise dashboard.
 *
 * VIEW logic only. Every KPI, card, chart point, quality metric, and source
 * count is derived from records that already exist in the payload (crop
 * presence, statistics, coverage, verification coverage, calendar). Nothing is
 * invented: no area, yield, stage, or confidence value is fabricated when the
 * payload has no source for it — "no data" stays "no data".
 *
 * Area basis is kept explicit:
 *   - KPI / donut / ranking / trend use ELIGIBLE ACTUAL records only
 *     (township cultivatedArea, or state/region sownArea for state scope).
 *   - Crop cards surface the crop's latest REPORTED area (presence row) with
 *     the record type of the matching statistic (ACTUAL / TARGET / PLAN), so a
 *     plan figure is never presented as verified actual.
 */
import type {
  AgricultureCropStatistic,
  AgricultureOverviewPayload,
  MeasurementQualifier,
  StatisticRecordType,
} from "./agriculture.types";
import {
  isEligibleActualStatistic,
  isEligibleLocalCropPresence,
  isEligibleStateRegionStatistic,
} from "./agriculture.types";

export type QualityTone = "good" | "partial" | "missing";

export type DataViewSummary = {
  cropCount: number | null;
  sourceCount: number;
  area: number | null;
  areaUnit: string | null;
  areaQualifier: MeasurementQualifier | null;
  areaYear: number | null;
  townshipsWithArea: number;
  townshipTotal: number;
  confidence: number | null;
  confidenceBand: "high" | "medium" | "low" | "none";
};

export type CropCard = {
  cropId: string;
  cropCode: string;
  cropName: string;
  area: number | null;
  areaUnit: string | null;
  areaQualifier: MeasurementQualifier | null;
  year: number | null;
  seasonCode: string | null;
  recordType: StatisticRecordType | null;
  presenceStatus: string;
  importanceLevel: string;
  level: string | null;
  locations: string[];
  confidenceGrade: string | null;
  sourceNames: string[];
};

export type DonutSegment = {
  cropCode: string;
  value: number;
  percent: number;
  moreThan: boolean;
};

export type Donut = {
  total: number;
  moreThan: boolean;
  segments: DonutSegment[];
};

export type RankingPoint = {
  locationName: string;
  value: number;
  moreThan: boolean;
};

export type TrendPoint = {
  label: string;
  year: number;
  value: number;
};

export type QualityMetric = {
  key: "presence" | "area" | "yield" | "calendar" | "verification";
  value: number;
  total: number;
  pct: number;
  tone: QualityTone;
};

export type SourceGroup = {
  sourceId: string;
  name: string;
  uri: string | null;
  recordCount: number;
  kinds: Array<"presence" | "statistics" | "calendar" | "yield" | "varieties" | "contexts">;
};

export type DetailRow = {
  locationName: string;
  cropCode: string;
  cropName: string;
  presenceStatus: string;
  confidenceGrade: string | null;
  evidenceGeography: string | null;
  evidenceYear: number | null;
  cropYear: number | null;
  seasonCode: string | null;
  recordType: StatisticRecordType | null;
  area: number | null;
  areaUnit: string | null;
  areaQualifier: MeasurementQualifier | null;
  sourceName: string | null;
  sourceId: string | null;
};

export type DataScope = {
  country: string | null;
  region: string | null;
  township: string | null;
  season: string | null;
};

export type AgricultureDataView = {
  summary: DataViewSummary;
  crops: CropCard[];
  donut: Donut | null;
  ranking: RankingPoint[];
  trend: TrendPoint[];
  trendUnit: string | null;
  trendYears: number;
  quality: QualityMetric[];
  openHighPriorityGaps: number;
  sources: SourceGroup[];
  detailRows: DetailRow[];
  scope: DataScope;
};

export function buildAgricultureDataView(overview: AgricultureOverviewPayload): AgricultureDataView {
  const stateScope = overview.geographyScope === "STATE_REGION";
  const locations = new Map(overview.locations.map((location) => [location.locationId, location]));
  const summary = buildSummary(overview, stateScope);
  return {
    summary,
    crops: buildCropCards(overview, locations),
    donut: buildDonut(overview, stateScope),
    ranking: buildRanking(overview, stateScope),
    ...buildTrend(overview, stateScope),
    quality: buildQuality(overview),
    openHighPriorityGaps: overview.verificationCoverage.openHighPriorityGaps,
    sources: buildSources(overview),
    detailRows: buildDetailRows(overview, locations),
    scope: buildScope(overview),
  };
}

function buildSummary(overview: AgricultureOverviewPayload, stateScope: boolean): DataViewSummary {
  const kpis = overview.kpis;
  const area = stateScope ? kpis.sownArea : kpis.cultivatedArea;
  const areaUnit = stateScope ? kpis.sownAreaUnit : kpis.cultivatedAreaUnit;
  const areaQualifier = stateScope ? null : kpis.cultivatedAreaQualifier;
  const areaRows = overview.statistics.filter((row) => stateScope
    ? isEligibleStateRegionStatistic(row) && typeof row.sownArea === "number"
    : isEligibleActualStatistic(row));
  const areaYear = areaRows.reduce<number | null>((latest, row) => row.cropYear !== null && (latest === null || row.cropYear > latest) ? row.cropYear : latest, null);
  const confidence = kpis.dataConfidence;
  const confidenceBand: DataViewSummary["confidenceBand"] = confidence === null ? "none" : confidence >= 70 ? "high" : confidence >= 40 ? "medium" : "low";
  return {
    cropCount: kpis.activeCrops,
    sourceCount: overview.sourceCount,
    area,
    areaUnit,
    areaQualifier,
    areaYear,
    townshipsWithArea: overview.coverage.townshipsWithAreaStatistics,
    townshipTotal: overview.coverage.pilotTownships,
    confidence,
    confidenceBand,
  };
}

/** Latest area statistic per location+crop (any eligible record type) for the crop card season/record-type badge. */
function latestStatisticFor(statistics: AgricultureCropStatistic[], locationId: string, cropId: string): AgricultureCropStatistic | null {
  let best: AgricultureCropStatistic | null = null;
  for (const row of statistics) {
    if (row.locationId !== locationId || row.cropId !== cropId) continue;
    if (!/^V[1-4]$/.test(row.verificationStatus)) continue;
    const better = best === null
      || (row.cropYear ?? -1) > (best.cropYear ?? -1)
      || ((row.cropYear ?? -1) === (best.cropYear ?? -1) && row.recordType === "ACTUAL" && best.recordType !== "ACTUAL");
    if (better) best = row;
  }
  return best;
}

function buildCropCards(overview: AgricultureOverviewPayload, locations: Map<string, AgricultureOverviewPayload["locations"][number]>): CropCard[] {
  const byCrop = new Map<string, CropCard>();
  for (const row of overview.cropPresence.filter(isEligibleLocalCropPresence)) {
    const stat = latestStatisticFor(overview.statistics, row.locationId, row.cropId);
    const existing = byCrop.get(row.cropId);
    const locationName = locations.get(row.locationId)?.canonicalName ?? row.locationId;
    if (existing) {
      if (!existing.locations.includes(locationName)) {
        existing.locations.push(locationName);
      }
      const source = row.sourceName ?? row.sourceId;
      if (source && !existing.sourceNames.includes(source)) existing.sourceNames.push(source);
      continue;
    }
    const area = parseArea(row.cultivatedArea) ?? stat?.cultivatedArea ?? null;
    const areaUnit = row.cultivatedAreaUnit ?? stat?.areaUnit ?? null;
    const areaQualifier = stat?.valueQualifier ?? null;
    const year = row.cultivatedAreaYear ?? stat?.cropYear ?? row.evidenceYear ?? null;
    byCrop.set(row.cropId, {
      cropId: row.cropId,
      cropCode: row.cropCode,
      cropName: row.cropName,
      area,
      areaUnit,
      areaQualifier,
      year,
      seasonCode: stat?.seasonCode ?? null,
      recordType: stat?.recordType ?? null,
      presenceStatus: row.presenceStatus,
      importanceLevel: row.importanceLevel,
      level: row.evidenceGeography ?? null,
      locations: [locationName],
      confidenceGrade: row.confidenceGrade ?? null,
      sourceNames: [row.sourceName ?? row.sourceId].filter((source): source is string => Boolean(source)),
    });
  }
  return [...byCrop.values()].sort((left, right) => {
    const byImportance = Number(right.importanceLevel === "MAJOR") - Number(left.importanceLevel === "MAJOR");
    if (byImportance !== 0) return byImportance;
    return (right.area ?? -1) - (left.area ?? -1);
  });
}

function parseArea(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Per crop, latest year per location (then summed across locations). */
function areaRowsFor(overview: AgricultureOverviewPayload, stateScope: boolean) {
  const eligible = overview.statistics.filter((row) => stateScope
    ? isEligibleStateRegionStatistic(row) && typeof row.sownArea === "number" && Number.isFinite(row.sownArea)
    : isEligibleActualStatistic(row));
  const value = (row: AgricultureCropStatistic) => stateScope ? row.sownArea as number : row.cultivatedArea as number;
  return { eligible, value };
}

function buildDonut(overview: AgricultureOverviewPayload, stateScope: boolean): Donut | null {
  const { eligible, value } = areaRowsFor(overview, stateScope);
  const latestPerKey = new Map<string, AgricultureCropStatistic>();
  for (const row of eligible) {
    const key = `${row.locationId}:${row.cropCode}`;
    const current = latestPerKey.get(key);
    if (!current || (row.cropYear ?? 0) > (current.cropYear ?? 0)) latestPerKey.set(key, row);
  }
  const totals = new Map<string, { value: number; moreThan: boolean }>();
  for (const row of latestPerKey.values()) {
    const amount = value(row);
    const current = totals.get(row.cropCode);
    totals.set(row.cropCode, {
      value: (current?.value ?? 0) + amount,
      moreThan: Boolean(current?.moreThan) || row.valueQualifier === "MORE_THAN",
    });
  }
  const sorted = [...totals.entries()].map(([cropCode, record]) => ({ cropCode, ...record })).sort((left, right) => right.value - left.value);
  const total = sorted.reduce((sum, record) => sum + record.value, 0);
  if (!total || !Number.isFinite(total)) return null;
  return {
    total,
    moreThan: sorted.some((record) => record.moreThan),
    segments: sorted.slice(0, 6).map((record) => ({
      cropCode: record.cropCode,
      value: record.value,
      percent: Math.round((record.value / total) * 1000) / 10,
      moreThan: record.moreThan,
    })),
  };
}

function buildRanking(overview: AgricultureOverviewPayload, stateScope: boolean): RankingPoint[] {
  const { eligible, value } = areaRowsFor(overview, stateScope);
  const latestPerKey = new Map<string, AgricultureCropStatistic>();
  for (const row of eligible) {
    const key = `${row.locationId}:${row.cropCode}`;
    const current = latestPerKey.get(key);
    if (!current || (row.cropYear ?? 0) > (current.cropYear ?? 0)) latestPerKey.set(key, row);
  }
  const totals = new Map<string, { value: number; moreThan: boolean }>();
  for (const row of latestPerKey.values()) {
    const current = totals.get(row.locationName);
    totals.set(row.locationName, {
      value: (current?.value ?? 0) + value(row),
      moreThan: Boolean(current?.moreThan) || row.valueQualifier === "MORE_THAN",
    });
  }
  return [...totals.entries()]
    .map(([locationName, record]) => ({ locationName, ...record }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);
}

function buildTrend(overview: AgricultureOverviewPayload, stateScope: boolean): { trend: TrendPoint[]; trendUnit: string | null; trendYears: number } {
  const { eligible, value } = areaRowsFor(overview, stateScope);
  const perYear = new Map<number, number>();
  for (const row of eligible) {
    if (row.cropYear === null) continue;
    perYear.set(row.cropYear, (perYear.get(row.cropYear) ?? 0) + value(row));
  }
  const unit = eligible[0] ? (stateScope ? eligible[0].sownAreaUnit : eligible[0].areaUnit) : null;
  const trend = [...perYear.entries()]
    .map(([year, total]) => ({ label: `${year}/${String((year + 1) % 100).padStart(2, "0")}`, year, value: Math.round(total) }))
    .sort((left, right) => left.year - right.year);
  return { trend, trendUnit: unit, trendYears: trend.length };
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
    metric("verification", verification.verifiedTownships),
  ];
}

function buildSources(overview: AgricultureOverviewPayload): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  const bump = (sourceId: string | null, name: string | null, uri: string | null, kind: SourceGroup["kinds"][number]) => {
    if (!sourceId) return;
    const existing = groups.get(sourceId);
    if (existing) {
      existing.recordCount += 1;
      if (!existing.kinds.includes(kind)) existing.kinds.push(kind);
      return;
    }
    groups.set(sourceId, { sourceId, name: name ?? sourceId, uri, recordCount: 1, kinds: [kind] });
  };
  for (const row of overview.cropPresence) bump(row.sourceId, row.sourceName, row.sourceUri, "presence");
  for (const row of overview.statistics) bump(row.sourceId, row.sourceName, row.sourceUri, "statistics");
  for (const row of overview.calendar) bump(row.sourceId, row.sourceName, row.sourceUri, "calendar");
  for (const row of overview.officialUnionYield) bump(row.sourceId, row.sourceName, row.sourceUri, "yield");
  for (const row of overview.varieties) bump(row.sourceId, row.sourceName, row.sourceUri, "varieties");
  for (const row of overview.contexts) bump(row.sourceId, row.sourceName, row.sourceUri, "contexts");
  return [...groups.values()].sort((left, right) => right.recordCount - left.recordCount || left.name.localeCompare(right.name));
}

function buildDetailRows(overview: AgricultureOverviewPayload, locations: Map<string, AgricultureOverviewPayload["locations"][number]>): DetailRow[] {
  const rows: DetailRow[] = [];
  for (const row of overview.cropPresence.filter(isEligibleLocalCropPresence)) {
    const stat = latestStatisticFor(overview.statistics, row.locationId, row.cropId);
    rows.push({
      locationName: locations.get(row.locationId)?.canonicalName ?? row.locationId,
      cropCode: row.cropCode,
      cropName: row.cropName,
      presenceStatus: row.presenceStatus,
      confidenceGrade: row.confidenceGrade ?? null,
      evidenceGeography: row.evidenceGeography ?? null,
      evidenceYear: row.evidenceYear ?? null,
      cropYear: stat?.cropYear ?? row.cultivatedAreaYear ?? null,
      seasonCode: stat?.seasonCode ?? null,
      recordType: stat?.recordType ?? null,
      area: parseArea(row.cultivatedArea) ?? stat?.cultivatedArea ?? null,
      areaUnit: row.cultivatedAreaUnit ?? stat?.areaUnit ?? null,
      areaQualifier: stat?.valueQualifier ?? null,
      sourceName: row.sourceName ?? row.sourceId,
      sourceId: row.sourceId,
    });
  }
  return rows.sort((left, right) => (right.cropYear ?? 0) - (left.cropYear ?? 0) || left.locationName.localeCompare(right.locationName) || left.cropName.localeCompare(right.cropName));
}

function buildScope(overview: AgricultureOverviewPayload): DataScope {
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

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.filter(Boolean))].join(", ") || null;
}
