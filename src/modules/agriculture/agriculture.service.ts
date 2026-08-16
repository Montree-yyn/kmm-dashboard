import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
import { getOperationsDb } from "../../../db";
import {
  agriCalendarEstimates,
  agriCropLocations,
  agriCropCalendars,
  agriCropStatistics,
  agriCropStages,
  agriCropVarieties,
  agriCropWeatherState,
  agriCrops,
  agriDataGaps,
  agriFieldVerifications,
  agriHistoricalHazards,
  agriLocationContexts,
  agriLocationCropVarieties,
  agriLocations,
  agriOpportunities,
  agriSeasons,
  agriSources,
} from "../../../db/schema";
import type { WeatherDataPayload } from "../weather/weather.types";
import type {
  AgricultureCalendarRow,
  AgricultureCropStageOption,
  AgricultureCropStatistic,
  AgricultureCropPresence,
  AgricultureCropSummary,
  AgricultureCropWeatherStateRow,
  AgricultureContextRow,
  AgricultureDataStatus,
  AgricultureDataGap,
  AgricultureHistoricalHazard,
  AgricultureHistoricalTrendRow,
  AgricultureFieldVerification,
  AgricultureFieldVerificationInput,
  AgricultureFieldVerificationLevel,
  AgricultureFieldVerificationStatus,
  AgricultureLocationSummary,
  AgricultureOfficialYieldRow,
  AgricultureOpportunityRow,
  AgricultureOverviewPayload,
  AgricultureVarietyRow,
  AgricultureTrendMetric,
  CalendarType,
  MeasurementQualifier,
  StatisticRecordType,
} from "./agriculture.types";
import {
  calculateAgricultureCoverage,
  calculateAgricultureCalendarCoverage,
  calculateStateRegionCoverage,
  calculateAgricultureVerificationCoverage,
  confidenceFromPresenceRecords,
  countEligibleLocalCrops,
  isEligibleActualStatistic,
  isEligibleLocalCropPresence,
} from "./agriculture.types";
import { bestCalendarRows, calendarSeasonLabel } from "./agriculture.calendar";
import { normalizeWeatherContract } from "../weather/weather.contract";

type AgricultureDb = Awaited<ReturnType<typeof getOperationsDb>>;

export async function getAgricultureOverview(
  db: AgricultureDb,
  companyId: string,
  weather: WeatherDataPayload | null,
  weatherError: string | null = null,
): Promise<AgricultureOverviewPayload> {
  const [locationRows, cropRows, stageRows, cropLocationRows, statisticRows, varietyRows, locationVarietyRows, hazardRows, calendarRows, estimateRows, weatherStateRows, opportunityRows, verificationRows, seasonRows, sourceRows, contextRows, gapRows] = await Promise.all([
    db.select().from(agriLocations).where(eq(agriLocations.isActive, true)).orderBy(asc(agriLocations.countryCode), asc(agriLocations.canonicalName)),
    db.select().from(agriCrops).where(eq(agriCrops.isActive, true)).orderBy(asc(agriCrops.cropCode)),
    db.select().from(agriCropStages).where(eq(agriCropStages.isActive, true)).orderBy(asc(agriCropStages.cropId), asc(agriCropStages.displayOrder)),
    db.select().from(agriCropLocations),
    db.select().from(agriCropStatistics).orderBy(asc(agriCropStatistics.locationId), asc(agriCropStatistics.cropId), asc(agriCropStatistics.cropYear)),
    db.select().from(agriCropVarieties).where(eq(agriCropVarieties.isActive, true)).orderBy(asc(agriCropVarieties.cropId), asc(agriCropVarieties.canonicalName)),
    db.select().from(agriLocationCropVarieties),
    db.select().from(agriHistoricalHazards).where(inArray(agriHistoricalHazards.verificationStatus, ["V1", "V2", "V3", "V4"])).orderBy(desc(agriHistoricalHazards.eventYear), asc(agriHistoricalHazards.locationId)),
    db.select().from(agriCropCalendars).where(inArray(agriCropCalendars.verificationLevel, ["V1", "V2", "V3", "V4"])).orderBy(asc(agriCropCalendars.locationId), asc(agriCropCalendars.cropId), asc(agriCropCalendars.stageCode)),
    db.select().from(agriCalendarEstimates).where(inArray(agriCalendarEstimates.verificationLevel, ["V2", "V3", "V4"])),
    db.select().from(agriCropWeatherState),
    db.select().from(agriOpportunities).where(and(
      eq(agriOpportunities.companyId, companyId),
      inArray(agriOpportunities.status, ["ACTIVE", "EXPIRING"]),
      isNotNull(agriOpportunities.stageCode),
      isNotNull(agriOpportunities.opportunityScore),
      isNotNull(agriOpportunities.confidenceScore),
      gte(agriOpportunities.confidenceScore, 35),
    )).orderBy(desc(agriOpportunities.priorityScore), desc(agriOpportunities.opportunityScore)),
    db.select().from(agriFieldVerifications).where(eq(agriFieldVerifications.companyId, companyId)),
    db.select().from(agriSeasons).where(eq(agriSeasons.isActive, true)),
    db.select().from(agriSources).orderBy(desc(agriSources.publicationDate), asc(agriSources.sourceName)),
    db.select().from(agriLocationContexts).where(inArray(agriLocationContexts.verificationStatus, ["V1", "V2", "V3", "V4"])).orderBy(asc(agriLocationContexts.locationId), asc(agriLocationContexts.contextType), asc(agriLocationContexts.evidenceYear)),
    db.select().from(agriDataGaps).orderBy(asc(agriDataGaps.locationId), asc(agriDataGaps.priority), asc(agriDataGaps.gapType)),
  ]);

  const cropMap = new Map(cropRows.map((row) => [row.cropId, row]));
  const locationMap = new Map(locationRows.map((row) => [row.locationId, row]));
  const sourceMap = new Map(sourceRows.map((row) => [row.sourceId, row]));
  const varietyMap = new Map(varietyRows.map((row) => [row.varietyId, row]));
  const seasonMap = new Map(seasonRows.map((row) => [row.seasonId, { code: row.seasonCode, name: row.seasonName }]));
  const cropStages: AgricultureCropStageOption[] = stageRows.map((row) => ({
    cropId: row.cropId,
    stageCode: row.stageCode,
    stageName: row.stageName,
    displayOrder: row.displayOrder,
  }));
  const weatherByLocationId = new Map(
    (weather?.locations ?? [])
      .filter((row) => Boolean(row.agricultureLocationId))
      .map((row) => [row.agricultureLocationId as string, row] as const),
  );
  const weatherByBranch = new Map((weather?.locations ?? []).filter((row) => Boolean(row.branchCode)).map((row) => [row.branchCode as string, row] as const));
  const locations: AgricultureLocationSummary[] = locationRows.map((row) => {
    const records = cropLocationRows.filter((candidate) => candidate.locationId === row.locationId);
    const knownCropCount = countEligibleLocalCrops(records);
    const unknownCropCount = records.filter((record) => record.presenceStatus === "UNKNOWN").length;
    const weatherLocation = weatherByLocationId.get(row.locationId)
      ?? (row.kmmBranchCode ? weatherByBranch.get(row.kmmBranchCode) : undefined);
    return {
      locationId: row.locationId,
      canonicalName: row.canonicalName,
      townshipName: row.townshipName,
      stateRegionName: row.stateRegionName,
      districtCode: row.districtCode,
      districtName: row.districtName,
      townshipCode: row.townshipCode,
      countryCode: row.countryCode,
      countryName: countryNameFromCode(row.countryCode),
      geographyLevel: normalizeGeographyLevel(row.geographyLevel, row.townshipName),
      alternateNames: parseStringArray(row.alternateNames),
      latitude: numberOrNull(row.latitude),
      longitude: numberOrNull(row.longitude),
      kmmBranchCode: row.kmmBranchCode,
      salesTerritoryId: row.salesTerritoryId,
      weatherLocationId: weatherLocation?.id ?? null,
      knownCropCount,
      unknownCropCount,
      verificationStatus: knownCropCount ? (unknownCropCount ? "PARTIAL" : "VERIFIED") : "UNKNOWN",
    };
  });

  const crops: AgricultureCropSummary[] = cropRows.map((row) => ({
    cropId: row.cropId,
    cropCode: row.cropCode,
    cropName: row.cropName,
    cropCycleType: row.cropCycleType,
    alternateNames: parseStringArray(row.alternateNames),
    isActive: row.isActive,
  }));
  const cropPresence: AgricultureCropPresence[] = cropLocationRows.map((row) => {
    const crop = cropMap.get(row.cropId);
    return {
      locationId: row.locationId,
      cropId: row.cropId,
      cropCode: crop?.cropCode ?? "UNKNOWN",
      cropName: crop?.cropName ?? "Unknown crop",
      presenceStatus: normalizePresenceStatus(row.presenceStatus),
      importanceLevel: row.importanceLevel,
      confidenceGrade: row.confidenceGrade,
      evidenceGeography: row.evidenceGeography,
      evidenceYear: row.evidenceYear,
      cultivatedArea: row.cultivatedArea,
      cultivatedAreaUnit: row.cultivatedAreaUnit,
      cultivatedAreaYear: row.cultivatedAreaYear,
      sourceId: row.sourceId,
      sourceName: row.sourceId ? sourceMap.get(row.sourceId)?.sourceName ?? null : null,
      sourceUri: row.sourceId ? sourceMap.get(row.sourceId)?.referenceUri ?? null : null,
      sourcePublicationDate: row.sourceId ? sourceMap.get(row.sourceId)?.publicationDate ?? null : null,
      notes: row.notes,
      localVerified: row.localVerified,
    };
  });
  const statistics: AgricultureCropStatistic[] = statisticRows.map((row) => {
    const location = locationMap.get(row.locationId);
    const crop = cropMap.get(row.cropId);
    const source = sourceMap.get(row.sourceId);
    return {
      statisticId: row.statisticId,
      locationId: row.locationId,
      locationName: location?.canonicalName ?? "Unknown location",
      cropId: row.cropId,
      cropCode: crop?.cropCode ?? "UNKNOWN",
      cropName: crop?.cropName ?? "Unknown crop",
      cropYear: row.cropYear,
      seasonCode: row.seasonCode,
      sownArea: row.sownArea,
      sownAreaUnit: row.sownAreaUnit,
      harvestedArea: row.harvestedArea,
      harvestedAreaUnit: row.harvestedAreaUnit,
      cultivatedArea: row.cultivatedArea,
      areaUnit: row.areaUnit,
      production: row.production,
      productionUnit: row.productionUnit,
      yieldValue: row.yieldValue,
      yieldUnit: row.yieldUnit,
      sourceId: row.sourceId,
      sourceName: source?.sourceName ?? null,
      sourceUri: source?.referenceUri ?? null,
      sourceTable: row.sourceTable ?? source?.sourceTable ?? null,
      sourceCropName: row.sourceCropName ?? null,
      sourceGeography: row.sourceGeography,
      geographyLevel: normalizeGeographyLevel(row.geographyLevel, location?.townshipName),
      sourceYear: row.sourceYear,
      recordType: normalizeStatisticRecordType(row.recordType),
      valueQualifier: normalizeMeasurementQualifier(row.valueQualifier),
      verificationStatus: row.verificationStatus,
      confidenceScore: row.confidenceScore,
      notes: row.notes,
    };
  });
  const officialUnionYield = mapOfficialUnionYield(statistics);
  const varieties: AgricultureVarietyRow[] = locationVarietyRows.map((row) => {
    const variety = varietyMap.get(row.varietyId);
    const crop = cropMap.get(row.cropId);
    const source = sourceMap.get(row.sourceId);
    return {
      locationCropVarietyId: row.locationCropVarietyId,
      locationId: row.locationId,
      locationName: locationMap.get(row.locationId)?.canonicalName ?? "Unknown location",
      cropId: row.cropId,
      cropName: crop?.cropName ?? "Unknown crop",
      varietyId: row.varietyId,
      canonicalName: variety?.canonicalName ?? "Unknown variety",
      alternateNames: parseStringArray(variety?.alternateNames ?? "[]"),
      localName: variety?.localName ?? null,
      countryCode: variety?.countryCode ?? null,
      seasonCode: row.seasonCode,
      evidenceYear: row.evidenceYear,
      sourceId: row.sourceId,
      sourceName: source?.sourceName ?? null,
      sourceUri: source?.referenceUri ?? null,
      verificationStatus: row.verificationStatus,
      confidenceScore: row.confidenceScore,
      notes: variety?.notes ?? null,
    };
  });
  const historicalHazards: AgricultureHistoricalHazard[] = hazardRows.map((row) => {
    const source = sourceMap.get(row.sourceId);
    return {
      hazardId: row.hazardId,
      locationId: row.locationId,
      locationName: locationMap.get(row.locationId)?.canonicalName ?? "Unknown location",
      hazardType: row.hazardType,
      eventStart: row.eventStart,
      eventEnd: row.eventEnd,
      eventYear: row.eventYear,
      severity: row.severity,
      affectedArea: row.affectedArea,
      affectedAreaUnit: row.affectedAreaUnit,
      description: row.description,
      sourceId: row.sourceId,
      sourceName: source?.sourceName ?? null,
      sourceUri: source?.referenceUri ?? null,
      verificationStatus: row.verificationStatus,
      confidenceScore: row.confidenceScore,
    };
  });
  const estimateMap = new Map(estimateRows.map((row) => [row.calendarRecordId, row]));
  const directCalendar: AgricultureCalendarRow[] = calendarRows.map((row) => {
    const location = locationMap.get(row.locationId);
    const crop = cropMap.get(row.cropId);
    const estimate = estimateMap.get(row.calendarRecordId);
    const season = row.seasonId ? seasonMap.get(row.seasonId) : undefined;
    return {
      calendarRecordId: row.calendarRecordId,
      locationId: row.locationId,
      locationName: location?.canonicalName ?? "Unknown location",
      cropId: row.cropId,
      cropCode: crop?.cropCode ?? "UNKNOWN",
      cropName: crop?.cropName ?? "Unknown crop",
      seasonId: row.seasonId,
      cropYear: row.cropYear,
      seasonCode: season?.code ?? null,
      seasonName: season?.name ?? null,
      stageCode: row.stageCode,
      baselineStartDate: row.baselineStartDate,
      baselineEndDate: row.baselineEndDate,
      calendarPrecision: normalizeCalendarPrecision(row.calendarPrecision),
      windowStartMonth: row.windowStartMonth,
      windowEndMonth: row.windowEndMonth,
      durationDaysMin: row.durationDaysMin,
      durationDaysMax: row.durationDaysMax,
      validFromYear: row.validFromYear,
      validToYear: row.validToYear,
      estimatedStartDate: estimate?.estimatedStartDate ?? null,
      estimatedEndDate: estimate?.estimatedEndDate ?? null,
      sourceGeography: row.sourceGeography,
      sourceId: row.sourceId,
      sourceName: row.sourceId ? sourceMap.get(row.sourceId)?.sourceName ?? null : null,
      sourceUri: row.sourceId ? sourceMap.get(row.sourceId)?.referenceUri ?? null : null,
      sourcePublicationDate: row.sourceId ? sourceMap.get(row.sourceId)?.publicationDate ?? null : null,
      calendarType: normalizeCalendarType(row.calendarType),
      verificationLevel: estimate?.verificationLevel ?? row.verificationLevel,
      confidenceScore: estimate?.confidenceScore ?? row.confidenceScore,
      inheritedFromLocationId: row.inheritedFromLocationId,
      weatherAdjusted: Boolean(estimate?.weatherAdjusted ?? row.weatherAdjusted),
      calendarShiftStatus: estimate?.calendarShiftStatus ?? row.calendarShiftStatus,
      calendarShiftDays: estimate?.calendarShiftDays ?? row.calendarShiftDays,
      notes: row.notes,
    };
  });
  const calendar = [...directCalendar, ...buildInheritedCalendarRows(directCalendar, locations)];
  const opportunities = opportunityRows.map((row): AgricultureOpportunityRow => ({
    opportunityId: row.opportunityId,
    locationId: row.locationId,
    locationName: row.locationId ? locationMap.get(row.locationId)?.canonicalName ?? null : null,
    cropId: row.cropId,
    cropCode: row.cropId ? cropMap.get(row.cropId)?.cropCode ?? null : null,
    cropName: row.cropId ? cropMap.get(row.cropId)?.cropName ?? null : null,
    stageCode: row.stageCode,
    opportunityType: row.opportunityType,
    machineCategory: row.machineCategory,
    opportunityScore: row.opportunityScore,
    confidenceScore: row.confidenceScore,
    priorityScore: row.priorityScore,
    windowStart: row.windowStart,
    windowEnd: row.windowEnd,
    reasonCodes: parseStringArray(row.reasonCodes),
    recommendedAction: row.recommendedAction,
    modelVersion: row.modelVersion,
    status: row.status,
  }));

  const weatherState: AgricultureCropWeatherStateRow[] = weatherStateRows
    .filter((row) => row.stateStatus !== "UNKNOWN" && row.qualityStatus !== "UNKNOWN")
    .map((row) => {
      const location = locationMap.get(row.locationId);
      const crop = cropMap.get(row.cropId);
      return {
        stateId: row.stateId,
        locationId: row.locationId,
        locationName: location?.canonicalName ?? "Unknown location",
        cropId: row.cropId,
        cropCode: crop?.cropCode ?? "UNKNOWN",
        cropName: crop?.cropName ?? "Unknown crop",
        stageCode: row.stageCode,
        weatherVariable: row.weatherVariable,
        observedValue: row.observedValue,
        unit: row.unit,
        riskType: row.riskType,
        stateStatus: row.stateStatus,
        source: row.source,
        provider: row.provider,
        retrievedAt: row.retrievedAt,
        qualityStatus: row.qualityStatus,
        reasonCodes: parseStringArray(row.reasonCodes),
        calculatedAt: row.calculatedAt,
      };
    });

  const contexts: AgricultureContextRow[] = contextRows.map((row) => {
    const source = sourceMap.get(row.sourceId);
    return {
      contextId: row.contextId,
      locationId: row.locationId,
      locationName: locationMap.get(row.locationId)?.canonicalName ?? "Unknown location",
      contextType: normalizeContextType(row.contextType),
      contextGeography: row.contextGeography,
      contextSubject: row.contextSubject,
      evidenceYear: row.evidenceYear,
      sourceId: row.sourceId,
      sourceName: source?.sourceName ?? null,
      sourceUri: source?.referenceUri ?? null,
      sourcePublicationDate: source?.publicationDate ?? null,
      verificationStatus: row.verificationStatus,
      confidenceScore: row.confidenceScore,
      notes: row.notes,
    };
  });
  const dataGaps: AgricultureDataGap[] = gapRows.map((row) => ({
    gapId: row.gapId,
    locationId: row.locationId,
    cropId: row.cropId,
    gapType: normalizeDataGapType(row.gapType),
    priority: normalizeDataGapPriority(row.priority),
    requiredGeography: row.requiredGeography,
    latestSourceYear: row.latestSourceYear,
    notes: row.notes,
    status: normalizeDataGapStatus(row.status),
  }));
  const fieldVerifications = verificationRows.map((row) => mapAgricultureFieldVerification(row, locationMap, cropMap));
  const verificationCoverage = calculateAgricultureVerificationCoverage(locations, fieldVerifications, dataGaps);

  const eligiblePresenceKeys = new Set(
    cropLocationRows
      .filter(isEligibleLocalCropPresence)
      .map((row) => `${row.locationId}:${row.cropId}`),
  );
  const knownCrops = new Set(cropLocationRows.filter(isEligibleLocalCropPresence).map((row) => row.cropId));
  const eligibleActualStatistics = dedupeStatistics(
    statistics.filter((row) => isEligibleActualStatistic(row) && eligiblePresenceKeys.has(`${row.locationId}:${row.cropId}`)),
  );
  const cultivatedAreaRows = eligibleActualStatistics.filter((row) => row.cultivatedArea !== null);
  const cultivatedArea = sumNumbers(cultivatedAreaRows.map((row) => row.cultivatedArea));
  const cultivatedAreaQualifier = cultivatedAreaRows.some((row) => row.valueQualifier === "MORE_THAN")
    ? "MORE_THAN"
    : cultivatedAreaRows.length ? cultivatedAreaRows[0]?.valueQualifier ?? null : null;
  const productionRows = eligibleActualStatistics.filter((row) => row.production !== null);
  const production = sumNumbers(productionRows.map((row) => row.production));
  const harvestRows = bestCalendarRows(calendar.filter((row) => row.stageCode === "HARVEST"));
  const harvestSeasonLabels = [...new Set(harvestRows.map(calendarSeasonLabel).filter(Boolean))];
  const harvestSeason = harvestSeasonLabels.length ? harvestSeasonLabels.join(", ") : null;
  const coverage = calculateAgricultureCoverage(locations, cropPresence, statistics, calendar);
  const stateRegionCoverage = calculateStateRegionCoverage(locations, statistics);
  const calendarCoverage = calculateAgricultureCalendarCoverage(locations, crops, directCalendar);
  const dataStatus = getDataStatus(knownCrops.size, calendar.length, opportunities.length, weatherState.length, statistics.length, sourceRows.length);
  const sharedWeather = weather?.contract ?? (weather ? normalizeWeatherContract(weather) : null);
  const weatherAvailability = weather?.cacheStatus === "live"
    ? "LIVE"
    : weather?.cacheStatus === "cached"
      ? "CACHED"
      : weather?.cacheStatus === "stale"
        ? "STALE"
        : "UNAVAILABLE";

  return {
    source: "local-d1",
    companyId,
    dataStatus,
    generatedAt: new Date().toISOString(),
    kpis: {
      activeCrops: knownCrops.size || null,
      cultivatedArea,
      cultivatedAreaUnit: cultivatedAreaRows[0]?.areaUnit ?? null,
      cultivatedAreaQualifier,
      sownArea: null,
      sownAreaUnit: null,
      harvestedArea: null,
      harvestedAreaUnit: null,
      production,
      productionUnit: productionRows[0]?.productionUnit ?? null,
      harvestSeason,
      dataConfidence: confidenceFromRecords(cropLocationRows, sourceRows),
    },
    locations,
    crops,
    cropPresence,
    statistics,
    varieties,
    historicalHazards,
    contexts,
    dataGaps,
    coverage,
    stateRegionCoverage,
    calendarCoverage,
    officialUnionYield,
    geographyScope: "TOWNSHIP",
    calendar,
    weatherState,
    opportunities,
    fieldVerifications,
    verificationCoverage,
    cropStages,
    verificationCount: verificationRows.length,
    sourceCount: sourceRows.length,
    weather: {
      availability: weatherAvailability,
      source: weather?.source ?? null,
      fetchedAt: weather?.fetchedAt ?? null,
      contract: sharedWeather,
      locations: weather?.locations ?? [],
      highRiskLocationCount: weather ? weather.locations.filter((row) => row.riskLevel === "HIGH").length : null,
      error: weatherError,
    },
    notes: [
      "Crop presence, statistics, crop stage, calendar, and hazard context are shown only when supported by local records.",
      "Actual cultivated area excludes TARGET, PLAN, ESTIMATE, REPORTED, UNKNOWN, and non-township records.",
      "Production and yield are source values only; no values are derived from area.",
      "State/Region actual statistics use CSO Myanmar Statistical Yearbook 2024 Table 9.12; Table 9.15 is Union-level, so state yield remains unavailable.",
      "The live weather layer is shared with Weather Intelligence; missing soil moisture and crop thresholds remain unavailable.",
    ],
  };
}

export async function listAgricultureLocations(db: AgricultureDb) {
  return db.select().from(agriLocations).where(eq(agriLocations.isActive, true)).orderBy(asc(agriLocations.countryCode), asc(agriLocations.canonicalName));
}

export async function listAgricultureCrops(db: AgricultureDb) {
  return db.select().from(agriCrops).where(eq(agriCrops.isActive, true)).orderBy(asc(agriCrops.cropCode));
}

export async function listAgricultureCalendar(db: AgricultureDb, locationId?: string, cropId?: string, seasonId?: string, cropYear?: number) {
  const conditions = [
    inArray(agriCropCalendars.verificationLevel, ["V1", "V2", "V3", "V4"]),
    locationId ? eq(agriCropCalendars.locationId, locationId) : undefined,
    cropId ? eq(agriCropCalendars.cropId, cropId) : undefined,
    seasonId ? eq(agriCropCalendars.seasonId, seasonId) : undefined,
    cropYear !== undefined ? eq(agriCropCalendars.cropYear, cropYear) : undefined,
  ].filter(Boolean);
  return db.select().from(agriCropCalendars).where(and(...conditions)).orderBy(asc(agriCropCalendars.locationId), asc(agriCropCalendars.cropId), asc(agriCropCalendars.stageCode));
}

export async function listAgricultureStatistics(db: AgricultureDb, locationId?: string, cropId?: string) {
  const conditions = [
    locationId ? eq(agriCropStatistics.locationId, locationId) : undefined,
    cropId ? eq(agriCropStatistics.cropId, cropId) : undefined,
  ].filter(Boolean);
  return db.select().from(agriCropStatistics).where(and(...conditions)).orderBy(asc(agriCropStatistics.locationId), asc(agriCropStatistics.cropId), asc(agriCropStatistics.cropYear));
}

export async function listAgricultureOfficialYield(db: AgricultureDb, cropId?: string, fromYear?: number, toYear?: number) {
  const conditions = [
    eq(agriCropStatistics.recordType, "ACTUAL_OFFICIAL"),
    eq(agriCropStatistics.sourceGeography, "NATIONAL"),
    eq(agriCropStatistics.geographyLevel, "NATIONAL"),
    inArray(agriCropStatistics.verificationStatus, ["V1", "V2", "V3", "V4"]),
    isNotNull(agriCropStatistics.yieldValue),
    cropId ? eq(agriCropStatistics.cropId, cropId) : undefined,
    fromYear !== undefined ? gte(agriCropStatistics.cropYear, fromYear) : undefined,
    toYear !== undefined ? lte(agriCropStatistics.cropYear, toYear) : undefined,
  ].filter(Boolean);
  const [rows, locations, crops, sources] = await Promise.all([
    db.select().from(agriCropStatistics).where(and(...conditions)).orderBy(asc(agriCropStatistics.cropId), asc(agriCropStatistics.cropYear), asc(agriCropStatistics.seasonCode)),
    db.select().from(agriLocations),
    db.select().from(agriCrops),
    db.select().from(agriSources),
  ]);
  const locationMap = new Map(locations.map((row) => [row.locationId, row]));
  const cropMap = new Map(crops.map((row) => [row.cropId, row]));
  const sourceMap = new Map(sources.map((row) => [row.sourceId, row]));
  return rows.flatMap((row): AgricultureOfficialYieldRow[] => {
    if (row.cropYear === null || row.yieldValue === null || row.yieldUnit === null) return [];
    const location = locationMap.get(row.locationId);
    const crop = cropMap.get(row.cropId);
    const source = sourceMap.get(row.sourceId);
    return [{
      statisticId: row.statisticId,
      locationId: row.locationId,
      locationName: location?.canonicalName ?? "Myanmar Union",
      cropId: row.cropId,
      cropCode: crop?.cropCode ?? "UNKNOWN",
      cropName: crop?.cropName ?? "Unknown crop",
      cropYear: row.cropYear,
      seasonCode: row.seasonCode,
      yieldValue: row.yieldValue,
      yieldUnit: row.yieldUnit,
      sourceId: row.sourceId,
      sourceName: source?.sourceName ?? null,
      sourceUri: source?.referenceUri ?? null,
      sourceTable: row.sourceTable ?? source?.sourceTable ?? null,
      sourceCropName: row.sourceCropName ?? null,
      sourceGeography: row.sourceGeography,
      geographyLevel: normalizeGeographyLevel(row.geographyLevel, location?.townshipName),
      recordType: "ACTUAL_OFFICIAL",
      verificationStatus: row.verificationStatus,
      confidenceScore: row.confidenceScore,
      notes: row.notes,
    }];
  });
}

export async function listAgricultureHistoricalTrend(
  db: AgricultureDb,
  options: { geography?: string; cropId?: string; fromYear?: number; toYear?: number; metric?: AgricultureTrendMetric } = {},
): Promise<AgricultureHistoricalTrendRow[]> {
  const metric = options.metric ?? "SOWN_AREA";
  const conditions = [
    eq(agriCropStatistics.recordType, "ACTUAL"),
    eq(agriCropStatistics.sourceGeography, "STATE_REGION"),
    eq(agriCropStatistics.geographyLevel, "STATE_REGION"),
    inArray(agriCropStatistics.verificationStatus, ["V1", "V2", "V3", "V4"]),
    options.geography ? eq(agriCropStatistics.locationId, options.geography) : undefined,
    options.cropId ? eq(agriCropStatistics.cropId, options.cropId) : undefined,
    options.fromYear !== undefined ? gte(agriCropStatistics.cropYear, options.fromYear) : undefined,
    options.toYear !== undefined ? lte(agriCropStatistics.cropYear, options.toYear) : undefined,
  ].filter(Boolean);
  const [rows, locations, crops, sources] = await Promise.all([
    db.select().from(agriCropStatistics).where(and(...conditions)).orderBy(asc(agriCropStatistics.locationId), asc(agriCropStatistics.cropId), asc(agriCropStatistics.cropYear)),
    db.select().from(agriLocations),
    db.select().from(agriCrops),
    db.select().from(agriSources),
  ]);
  const locationMap = new Map(locations.map((row) => [row.locationId, row]));
  const cropMap = new Map(crops.map((row) => [row.cropId, row]));
  const sourceMap = new Map(sources.map((row) => [row.sourceId, row]));
  return rows.flatMap((row): AgricultureHistoricalTrendRow[] => {
    if (row.cropYear === null) return [];
    const value = metric === "SOWN_AREA" ? row.sownArea : metric === "HARVESTED_AREA" ? row.harvestedArea : row.production;
    if (value === null || !Number.isFinite(value)) return [];
    const location = locationMap.get(row.locationId);
    const crop = cropMap.get(row.cropId);
    const source = sourceMap.get(row.sourceId);
    return [{
      locationId: row.locationId,
      locationName: location?.canonicalName ?? "Unknown location",
      cropId: row.cropId,
      cropCode: crop?.cropCode ?? "UNKNOWN",
      cropName: crop?.cropName ?? "Unknown crop",
      cropYear: row.cropYear,
      metric,
      value,
      unit: metric === "PRODUCTION" ? row.productionUnit : metric === "SOWN_AREA" ? row.sownAreaUnit : row.harvestedAreaUnit,
      sourceId: row.sourceId,
      sourceName: source?.sourceName ?? null,
      sourceTable: row.sourceTable ?? source?.sourceTable ?? null,
      sourceGeography: row.sourceGeography,
      geographyLevel: normalizeGeographyLevel(row.geographyLevel, location?.townshipName),
      verificationStatus: row.verificationStatus,
      confidenceScore: row.confidenceScore,
    }];
  });
}

export async function listAgricultureVarieties(db: AgricultureDb, locationId?: string, cropId?: string) {
  const conditions = [
    locationId ? eq(agriLocationCropVarieties.locationId, locationId) : undefined,
    cropId ? eq(agriLocationCropVarieties.cropId, cropId) : undefined,
  ].filter(Boolean);
  return db.select().from(agriLocationCropVarieties).where(and(...conditions)).orderBy(asc(agriLocationCropVarieties.locationId), asc(agriLocationCropVarieties.cropId), asc(agriLocationCropVarieties.evidenceYear));
}

export async function listAgricultureHistoricalHazards(db: AgricultureDb, locationId?: string) {
  return db.select().from(agriHistoricalHazards).where(and(
    inArray(agriHistoricalHazards.verificationStatus, ["V1", "V2", "V3", "V4"]),
    locationId ? eq(agriHistoricalHazards.locationId, locationId) : undefined,
  )).orderBy(desc(agriHistoricalHazards.eventYear), asc(agriHistoricalHazards.locationId));
}

export async function listAgricultureCropWeatherState(db: AgricultureDb) {
  const [rows, locationRows, cropRows] = await Promise.all([
    db.select().from(agriCropWeatherState),
    db.select().from(agriLocations),
    db.select().from(agriCrops),
  ]);
  const locations = new Map(locationRows.map((row) => [row.locationId, row.canonicalName]));
  const crops = new Map(cropRows.map((row) => [row.cropId, row]));
  return rows
    .filter((row) => row.stateStatus !== "UNKNOWN" && row.qualityStatus !== "UNKNOWN")
    .map((row): AgricultureCropWeatherStateRow => ({
      stateId: row.stateId,
      locationId: row.locationId,
      locationName: locations.get(row.locationId) ?? "Unknown location",
      cropId: row.cropId,
      cropCode: crops.get(row.cropId)?.cropCode ?? "UNKNOWN",
      cropName: crops.get(row.cropId)?.cropName ?? "Unknown crop",
      stageCode: row.stageCode,
      weatherVariable: row.weatherVariable,
      observedValue: row.observedValue,
      unit: row.unit,
      riskType: row.riskType,
      stateStatus: row.stateStatus,
      source: row.source,
      provider: row.provider,
      retrievedAt: row.retrievedAt,
      qualityStatus: row.qualityStatus,
      reasonCodes: parseStringArray(row.reasonCodes),
      calculatedAt: row.calculatedAt,
    }));
}

export async function listAgricultureOpportunities(db: AgricultureDb, companyId: string, filters: { locationId?: string; cropId?: string; seasonId?: string; salespersonId?: string; machineCategory?: string; priority?: string; confidence?: string }) {
  const confidence = filters.confidence ? Number(filters.confidence) : null;
  const conditions = [
    eq(agriOpportunities.companyId, companyId),
    filters.locationId ? eq(agriOpportunities.locationId, filters.locationId) : undefined,
    filters.cropId ? eq(agriOpportunities.cropId, filters.cropId) : undefined,
    filters.seasonId ? eq(agriOpportunities.seasonId, filters.seasonId) : undefined,
    filters.salespersonId ? eq(agriOpportunities.salespersonId, filters.salespersonId) : undefined,
    filters.machineCategory ? eq(agriOpportunities.machineCategory, filters.machineCategory) : undefined,
    filters.priority ? eq(agriOpportunities.status, filters.priority) : undefined,
    isNotNull(agriOpportunities.stageCode),
    isNotNull(agriOpportunities.opportunityScore),
    isNotNull(agriOpportunities.confidenceScore),
    gte(agriOpportunities.confidenceScore, 35),
    confidence !== null && Number.isFinite(confidence) ? eq(agriOpportunities.confidenceScore, confidence) : undefined,
  ].filter(Boolean);
  return db.select().from(agriOpportunities).where(and(...conditions)).orderBy(desc(agriOpportunities.priorityScore), desc(agriOpportunities.opportunityScore));
}

export async function listAgricultureVerifications(db: AgricultureDb, companyId: string, locationId?: string) {
  const [rows, locationRows, cropRows] = await Promise.all([
    db.select().from(agriFieldVerifications).where(and(eq(agriFieldVerifications.companyId, companyId), locationId ? eq(agriFieldVerifications.locationId, locationId) : undefined)).orderBy(desc(agriFieldVerifications.verifiedAt)),
    db.select().from(agriLocations),
    db.select().from(agriCrops),
  ]);
  return rows.map((row) => mapAgricultureFieldVerification(row, new Map(locationRows.map((location) => [location.locationId, location])), new Map(cropRows.map((crop) => [crop.cropId, crop]))));
}

export class AgricultureInputError extends Error {
  readonly status = 422;
}

export async function createAgricultureFieldVerification(
  db: AgricultureDb,
  companyId: string,
  input: AgricultureFieldVerificationInput,
) {
  const now = new Date().toISOString();
  const [location] = await db.select().from(agriLocations).where(and(eq(agriLocations.locationId, input.locationId), eq(agriLocations.isActive, true))).limit(1);
  if (!location || normalizeGeographyLevel(location.geographyLevel, location.townshipName) !== "TOWNSHIP") throw new AgricultureInputError("Local field verification requires an active township location.");
  const [crop] = await db.select().from(agriCrops).where(and(eq(agriCrops.cropId, input.cropId), eq(agriCrops.isActive, true))).limit(1);
  if (!crop) throw new AgricultureInputError("The selected crop is not an active Agriculture crop.");
  if (input.cropYear !== 2026) throw new AgricultureInputError("Local field verification is scoped to crop year 2026.");
  if (!isOneOf(input.cropPresence, ["YES", "NO", "UNKNOWN"] as const)) throw new AgricultureInputError("cropPresence must be YES, NO, or UNKNOWN.");
  if (!isOneOf(input.importance, ["MAJOR", "SECONDARY", "MINOR", "UNKNOWN"] as const)) throw new AgricultureInputError("importance is invalid.");
  if (!isOneOf(input.areaQuality, ["KNOWN", "APPROXIMATE", "UNKNOWN"] as const)) throw new AgricultureInputError("areaQuality is invalid.");
  if (!isOneOf(input.irrigationType, ["RAIN_FED", "IRRIGATED", "MIXED", "UNKNOWN"] as const)) throw new AgricultureInputError("irrigationType is invalid.");
  if (!isOneOf(input.mechanizationLevel, ["LOW", "MEDIUM", "HIGH", "UNKNOWN"] as const)) throw new AgricultureInputError("mechanizationLevel is invalid.");
  if (!isOneOf(input.verificationMethod, ["FIELD_VISIT", "BRANCH_REPORT", "SALESPERSON_REPORT", "CUSTOMER_REPORT", "MANAGER_CONFIRMATION", "OTHER"] as const)) throw new AgricultureInputError("verificationMethod is invalid.");
  if (!isOneOf(input.verificationLevel, ["V2", "V3", "V4"] as const)) throw new AgricultureInputError("verificationLevel must be V2, V3, or V4.");
  const months = {
    plantingStartMonth: validateMonth(input.plantingStartMonth, "plantingStartMonth"),
    plantingEndMonth: validateMonth(input.plantingEndMonth, "plantingEndMonth"),
    harvestStartMonth: validateMonth(input.harvestStartMonth, "harvestStartMonth"),
    harvestEndMonth: validateMonth(input.harvestEndMonth, "harvestEndMonth"),
  };
  const estimatedArea = input.estimatedArea === null || input.estimatedArea === undefined ? null : input.estimatedArea;
  if (estimatedArea !== null && (!Number.isFinite(estimatedArea) || estimatedArea < 0)) throw new AgricultureInputError("estimatedArea must be a non-negative number or UNKNOWN.");
  if (estimatedArea === null && input.areaQuality !== "UNKNOWN") throw new AgricultureInputError("areaQuality must be UNKNOWN when estimatedArea is empty.");
  if (estimatedArea !== null && input.areaQuality === "UNKNOWN") throw new AgricultureInputError("areaQuality is required when estimatedArea is provided.");
  const currentStage = input.currentStage?.trim() && input.currentStage.trim() !== "UNKNOWN" ? input.currentStage.trim() : null;
  if (currentStage) {
    const [stage] = await db.select().from(agriCropStages).where(and(eq(agriCropStages.cropId, input.cropId), eq(agriCropStages.stageCode, currentStage), eq(agriCropStages.isActive, true))).limit(1);
    if (!stage) throw new AgricultureInputError("currentStage must match an active canonical crop stage.");
  }
  const notes = normalizeBoundedText(input.notes, "notes", 4000);
  const evidenceValue = normalizeBoundedText(input.evidence, "evidence", 4000);
  if (!evidenceValue) throw new AgricultureInputError("evidence is required.");
  const evidence = evidenceValue;
  const seasonCode = normalizeBoundedText(input.seasonCode, "seasonCode", 80);
  const areaUnit = normalizeBoundedText(input.areaUnit, "areaUnit", 40);
  const commonMachines = [...new Set(input.commonMachines.filter((machine) => typeof machine === "string").map((machine) => machine.trim()).filter(Boolean))];
  if (commonMachines.length > 12 || commonMachines.some((machine) => machine.length > 80)) throw new AgricultureInputError("commonMachines contains an invalid value.");
  const confidenceScore = input.confidenceScore === null || input.confidenceScore === undefined ? ({ V2: 50, V3: 75, V4: 100 } as const)[input.verificationLevel] : input.confidenceScore;
  if (!Number.isInteger(confidenceScore) || confidenceScore < 0 || confidenceScore > 100) throw new AgricultureInputError("confidenceScore must be an integer from 0 to 100.");
  const verificationId = input.verificationId ?? crypto.randomUUID();
  const proposedValue = JSON.stringify({
    cropYear: 2026,
    cropPresence: input.cropPresence,
    importance: input.importance,
    estimatedArea,
    areaQuality: input.areaQuality,
    currentStage,
  });
  await db.insert(agriFieldVerifications).values({
    verificationId,
    companyId,
    locationId: input.locationId,
    cropId: input.cropId,
    cropYear: 2026,
    seasonCode,
    cropPresence: input.cropPresence,
    importance: input.importance,
    estimatedArea,
    areaUnit,
    areaQuality: input.areaQuality,
    ...months,
    currentStage,
    irrigationType: input.irrigationType,
    mechanizationLevel: input.mechanizationLevel,
    commonMachines: JSON.stringify(commonMachines),
    notes,
    fieldName: "LOCAL_FIELD_VERIFICATION",
    proposedValue,
    verificationLevel: input.verificationLevel,
    evidence,
    verifiedRole: input.verifiedRole ?? null,
    verificationMethod: input.verificationMethod,
    confidenceScore,
    sourceId: input.sourceId ?? null,
    verifiedBy: input.verifiedBy,
    verifiedAt: now,
    status: "PENDING",
    createdBy: input.verifiedBy,
    updatedAt: now,
    updatedBy: input.verifiedBy,
  });

  const closableGapTypes = [
    input.cropPresence !== "UNKNOWN" ? "CROP_PRESENCE" : null,
    estimatedArea !== null && input.areaQuality !== "UNKNOWN" ? "CULTIVATED_AREA" : null,
    months.plantingStartMonth !== null || months.plantingEndMonth !== null || months.harvestStartMonth !== null || months.harvestEndMonth !== null ? "CALENDAR" : null,
    currentStage ? "CURRENT_STAGE" : null,
  ].filter((value): value is "CROP_PRESENCE" | "CULTIVATED_AREA" | "CALENDAR" | "CURRENT_STAGE" => Boolean(value));
  const closedGapTypes: string[] = [];
  if (closableGapTypes.length) {
    const matchingGaps = await db.select().from(agriDataGaps).where(and(
      eq(agriDataGaps.locationId, input.locationId),
      or(eq(agriDataGaps.cropId, input.cropId), isNull(agriDataGaps.cropId)),
      inArray(agriDataGaps.gapType, closableGapTypes),
      inArray(agriDataGaps.status, ["OPEN", "PARTIAL"]),
    ));
    for (const gap of matchingGaps) {
      const note = `Local field verification ${verificationId} recorded at ${input.verificationLevel}.`;
      await db.update(agriDataGaps).set({
        status: "RESOLVED",
        latestSourceYear: 2026,
        notes: [gap.notes, note].filter(Boolean).join(" "),
        updatedAt: now,
        updatedBy: input.verifiedBy,
      }).where(eq(agriDataGaps.gapId, gap.gapId));
      closedGapTypes.push(gap.gapType);
    }
  }
  return { verificationId, verificationLevel: input.verificationLevel, closedGapTypes: [...new Set(closedGapTypes)] };
}

export async function reviewAgricultureFieldVerification(
  db: AgricultureDb,
  companyId: string,
  input: { verificationId: string; status: "APPROVED" | "REJECTED"; verificationLevel?: AgricultureFieldVerificationLevel; reviewedBy: string },
) {
  if (!isOneOf(input.status, ["APPROVED", "REJECTED"] as const)) throw new AgricultureInputError("status must be APPROVED or REJECTED.");
  if (input.verificationLevel !== undefined && !isOneOf(input.verificationLevel, ["V2", "V3", "V4"] as const)) throw new AgricultureInputError("verificationLevel must be V2, V3, or V4.");
  const [row] = await db.select().from(agriFieldVerifications).where(and(eq(agriFieldVerifications.companyId, companyId), eq(agriFieldVerifications.verificationId, input.verificationId))).limit(1);
  if (!row) throw new AgricultureInputError("The verification record was not found for this company.");
  const now = new Date().toISOString();
  const verificationLevel = input.verificationLevel ?? normalizeVerificationLevel(row.verificationLevel);
  await db.update(agriFieldVerifications).set({
    status: input.status,
    verificationLevel,
    reviewedBy: input.reviewedBy,
    reviewedAt: now,
    updatedAt: now,
    updatedBy: input.reviewedBy,
  }).where(and(eq(agriFieldVerifications.companyId, companyId), eq(agriFieldVerifications.verificationId, input.verificationId)));
  return { verificationId: input.verificationId, status: input.status, verificationLevel };
}

function mapAgricultureFieldVerification(
  row: typeof agriFieldVerifications.$inferSelect,
  locationMap: Map<string, typeof agriLocations.$inferSelect>,
  cropMap: Map<string, typeof agriCrops.$inferSelect>,
): AgricultureFieldVerification {
  const crop = row.cropId ? cropMap.get(row.cropId) : undefined;
  return {
    verificationId: row.verificationId,
    companyId: row.companyId,
    locationId: row.locationId,
    locationName: locationMap.get(row.locationId)?.canonicalName ?? "Unknown location",
    cropId: row.cropId,
    cropCode: crop?.cropCode ?? null,
    cropName: crop?.cropName ?? null,
    cropYear: row.cropYear,
    seasonCode: row.seasonCode,
    cropPresence: normalizeCropPresenceAnswer(row.cropPresence),
    importance: normalizeVerificationImportance(row.importance),
    estimatedArea: row.estimatedArea,
    areaUnit: row.areaUnit,
    areaQuality: normalizeAreaQuality(row.areaQuality),
    plantingStartMonth: row.plantingStartMonth,
    plantingEndMonth: row.plantingEndMonth,
    harvestStartMonth: row.harvestStartMonth,
    harvestEndMonth: row.harvestEndMonth,
    currentStage: row.currentStage,
    irrigationType: normalizeIrrigationType(row.irrigationType),
    mechanizationLevel: normalizeMechanizationLevel(row.mechanizationLevel),
    commonMachines: parseStringArray(row.commonMachines),
    notes: row.notes,
    fieldName: row.fieldName,
    proposedValue: row.proposedValue,
    verificationLevel: normalizeVerificationLevel(row.verificationLevel),
    evidence: row.evidence,
    sourceId: row.sourceId,
    verifiedBy: row.verifiedBy,
    verifiedRole: row.verifiedRole,
    verifiedAt: row.verifiedAt,
    verificationMethod: normalizeVerificationMethod(row.verificationMethod),
    confidenceScore: row.confidenceScore,
    status: normalizeVerificationStatus(row.status),
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}

function normalizeBoundedText(value: string | null | undefined, field: string, maxLength: number) {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new AgricultureInputError(`${field} is too long.`);
  return normalized || null;
}

function validateMonth(value: number | null | undefined, field: string) {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 1 || value > 12) throw new AgricultureInputError(`${field} must be a month from 1 to 12 or UNKNOWN.`);
  return value;
}

function normalizeCropPresenceAnswer(value: string): AgricultureFieldVerification["cropPresence"] {
  return isOneOf(value, ["YES", "NO", "UNKNOWN"] as const) ? value : "UNKNOWN";
}

function normalizeVerificationImportance(value: string): AgricultureFieldVerification["importance"] {
  return isOneOf(value, ["MAJOR", "SECONDARY", "MINOR", "UNKNOWN"] as const) ? value : "UNKNOWN";
}

function normalizeAreaQuality(value: string): AgricultureFieldVerification["areaQuality"] {
  return isOneOf(value, ["KNOWN", "APPROXIMATE", "UNKNOWN"] as const) ? value : "UNKNOWN";
}

function normalizeIrrigationType(value: string): AgricultureFieldVerification["irrigationType"] {
  return isOneOf(value, ["RAIN_FED", "IRRIGATED", "MIXED", "UNKNOWN"] as const) ? value : "UNKNOWN";
}

function normalizeMechanizationLevel(value: string): AgricultureFieldVerification["mechanizationLevel"] {
  return isOneOf(value, ["LOW", "MEDIUM", "HIGH", "UNKNOWN"] as const) ? value : "UNKNOWN";
}

function normalizeVerificationMethod(value: string): AgricultureFieldVerification["verificationMethod"] {
  return isOneOf(value, ["FIELD_VISIT", "BRANCH_REPORT", "SALESPERSON_REPORT", "CUSTOMER_REPORT", "MANAGER_CONFIRMATION", "OTHER"] as const) ? value : "OTHER";
}

function normalizeVerificationLevel(value: string): AgricultureFieldVerificationLevel {
  return isOneOf(value, ["V2", "V3", "V4"] as const) ? value : "V2";
}

function normalizeVerificationStatus(value: string): AgricultureFieldVerificationStatus {
  return isOneOf(value, ["PENDING", "APPROVED", "REJECTED"] as const) ? value : "PENDING";
}

export async function listAgricultureSources(db: AgricultureDb) {
  return db.select().from(agriSources).orderBy(desc(agriSources.publicationDate), asc(agriSources.sourceName));
}

export async function listAgricultureContexts(db: AgricultureDb, locationId?: string) {
  const [rows, locationRows, sourceRows] = await Promise.all([
    db.select().from(agriLocationContexts).where(and(
      inArray(agriLocationContexts.verificationStatus, ["V1", "V2", "V3", "V4"]),
      locationId ? eq(agriLocationContexts.locationId, locationId) : undefined,
    )).orderBy(asc(agriLocationContexts.locationId), asc(agriLocationContexts.contextType), asc(agriLocationContexts.evidenceYear)),
    db.select().from(agriLocations),
    db.select().from(agriSources),
  ]);
  const locations = new Map(locationRows.map((row) => [row.locationId, row.canonicalName]));
  const sources = new Map(sourceRows.map((row) => [row.sourceId, row]));
  return rows.map((row): AgricultureContextRow => ({
    contextId: row.contextId,
    locationId: row.locationId,
    locationName: locations.get(row.locationId) ?? "Unknown location",
    contextType: normalizeContextType(row.contextType),
    contextGeography: row.contextGeography,
    contextSubject: row.contextSubject,
    evidenceYear: row.evidenceYear,
    sourceId: row.sourceId,
    sourceName: sources.get(row.sourceId)?.sourceName ?? null,
    sourceUri: sources.get(row.sourceId)?.referenceUri ?? null,
    sourcePublicationDate: sources.get(row.sourceId)?.publicationDate ?? null,
    verificationStatus: row.verificationStatus,
    confidenceScore: row.confidenceScore,
    notes: row.notes,
  }));
}

export async function listAgricultureDataGaps(db: AgricultureDb, locationId?: string) {
  const rows = await db.select().from(agriDataGaps).where(locationId ? eq(agriDataGaps.locationId, locationId) : undefined).orderBy(asc(agriDataGaps.locationId), asc(agriDataGaps.priority), asc(agriDataGaps.gapType));
  return rows.map((row): AgricultureDataGap => ({
    gapId: row.gapId,
    locationId: row.locationId,
    cropId: row.cropId,
    gapType: normalizeDataGapType(row.gapType),
    priority: normalizeDataGapPriority(row.priority),
    requiredGeography: row.requiredGeography,
    latestSourceYear: row.latestSourceYear,
    notes: row.notes,
    status: normalizeDataGapStatus(row.status),
  }));
}

export async function getAgricultureConfidenceDetail(db: AgricultureDb) {
  const [presenceRows, sourceRows] = await Promise.all([
    db.select().from(agriCropLocations),
    db.select().from(agriSources),
  ]);
  const groups = new Map<string, number>();
  for (const row of presenceRows) {
    const key = `${row.confidenceGrade}/${row.presenceStatus}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return {
    source: "local-d1" as const,
    totalRecordCount: presenceRows.length,
    verifiedRecordCount: presenceRows.filter(isEligibleLocalCropPresence).length,
    sourceCount: sourceRows.length,
    groups: [...groups.entries()].map(([key, recordCount]) => {
      const [confidenceGrade, presenceStatus] = key.split("/");
      return { confidenceGrade, presenceStatus, recordCount };
    }),
  };
}

function getDataStatus(knownCrops: number, calendarCount: number, opportunityCount: number, weatherStateCount: number, statisticCount: number, sourceCount: number): AgricultureDataStatus {
  if (knownCrops || calendarCount || opportunityCount || weatherStateCount || statisticCount) return sourceCount ? "available" : "partial";
  return "needs_verification";
}

function dedupeStatistics(rows: AgricultureCropStatistic[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = [row.locationId, row.cropId, row.cropYear ?? "", row.seasonCode ?? "", row.recordType, row.sourceId].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sumNumbers(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return present.length ? present.reduce((sum, value) => sum + value, 0) : null;
}

function confidenceFromRecords(records: Array<{ presenceStatus: string; evidenceGeography: string | null; confidenceGrade: string; sourceId: string | null }>, sources: Array<{ sourceId: string }>) {
  const sourceIds = new Set(sources.map((source) => source.sourceId));
  return confidenceFromPresenceRecords(records.filter((record) => record.sourceId && sourceIds.has(record.sourceId)));
}

function countryNameFromCode(countryCode: string) {
  return ({ MM: "Myanmar", TH: "Thailand" } as Record<string, string>)[countryCode.toUpperCase()] ?? countryCode;
}

function normalizePresenceStatus(value: string) {
  return ["CONFIRMED_PRESENT", "PROBABLE", "HISTORICAL", "UNKNOWN", "CONFIRMED_ABSENT"].includes(value)
    ? value as AgricultureCropPresence["presenceStatus"]
    : "UNKNOWN";
}

function normalizeStatisticRecordType(value: string): StatisticRecordType {
  return ["ACTUAL", "ACTUAL_OFFICIAL", "TARGET", "PLAN", "ESTIMATE", "REPORTED"].includes(value)
    ? value as StatisticRecordType
    : "REPORTED";
}

function normalizeMeasurementQualifier(value: string): MeasurementQualifier {
  return ["EXACT", "APPROXIMATE", "MORE_THAN", "LESS_THAN", "RANGE", "UNKNOWN"].includes(value)
    ? value as MeasurementQualifier
    : "UNKNOWN";
}

function normalizeCalendarType(value: string): CalendarType {
  return ["AUTHORITATIVE_BASELINE", "REGIONAL_BASELINE", "STATE_REGION_BASELINE", "HISTORICAL_OBSERVED", "CURRENT_OBSERVED"].includes(value)
    ? value as CalendarType
    : "AUTHORITATIVE_BASELINE";
}

function normalizeCalendarPrecision(value: string | null | undefined): AgricultureCalendarRow["calendarPrecision"] {
  return ["MONTH", "EARLY_MONTH", "MID_MONTH", "LATE_MONTH", "MONTH_RANGE", "SEASON_ONLY"].includes(value ?? "")
    ? value as AgricultureCalendarRow["calendarPrecision"]
    : "MONTH";
}

function buildInheritedCalendarRows(rows: AgricultureCalendarRow[], locations: AgricultureLocationSummary[]) {
  const locationMap = new Map(locations.map((location) => [location.locationId, location]));
  const stateRows = rows.filter((row) => {
    const location = locationMap.get(row.locationId);
    return location?.geographyLevel === "STATE_REGION"
      && ["AUTHORITATIVE_BASELINE", "REGIONAL_BASELINE", "STATE_REGION_BASELINE"].includes(row.calendarType);
  });
  const directKeys = new Set(
    rows
      .filter((row) => row.inheritedFromLocationId === null && row.sourceGeography === "TOWNSHIP")
      .map((row) => `${row.locationId}:${row.cropId}:${row.seasonId ?? row.seasonCode ?? ""}`),
  );
  const inherited: AgricultureCalendarRow[] = [];
  for (const township of locations.filter((location) => location.geographyLevel === "TOWNSHIP")) {
    const parent = stateRows.find((row) => regionKey(locationMap.get(row.locationId)) === regionKey(township));
    if (!parent) continue;
    for (const row of stateRows.filter((candidate) => candidate.locationId === parent.locationId)) {
      const directKey = `${township.locationId}:${row.cropId}:${row.seasonId ?? row.seasonCode ?? ""}`;
      if (directKeys.has(directKey)) continue;
      inherited.push({
        ...row,
        calendarRecordId: `${row.calendarRecordId}:inherited:${township.locationId}`,
        locationId: township.locationId,
        locationName: township.canonicalName,
        inheritedFromLocationId: parent.locationId,
        notes: `Inherited context from ${parent.locationName}. ${row.notes ?? ""}`.trim(),
      });
    }
  }
  return inherited;
}

function regionKey(location: AgricultureLocationSummary | undefined) {
  return (location?.stateRegionName ?? location?.canonicalName ?? "")
    .toLowerCase()
    .replace(/\s+(region|state)$/i, "")
    .replace(/\s+\((east|west|north|south)\)$/i, "")
    .trim();
}

function normalizeContextType(value: string): AgricultureContextRow["contextType"] {
  const allowed = ["HISTORICAL_ADMIN_REFERENCE", "HISTORICAL_REFERENCE", "DISTRICT_CONTEXT", "NEARBY_TOWNSHIP_REFERENCE", "FARMLAND_CONTEXT", "AGRICULTURE_CONTEXT", "VALUE_CHAIN", "TRADE_CONTEXT"] as const;
  return allowed.includes(value as typeof allowed[number]) ? value as AgricultureContextRow["contextType"] : "HISTORICAL_REFERENCE";
}

function normalizeDataGapType(value: string): AgricultureDataGap["gapType"] {
  const allowed = ["CROP_PRESENCE", "CULTIVATED_AREA", "PRODUCTION", "YIELD", "CALENDAR", "CURRENT_STAGE", "VARIETY", "COORDINATES", "WEATHER_MAPPING"] as const;
  return allowed.includes(value as typeof allowed[number]) ? value as AgricultureDataGap["gapType"] : "CROP_PRESENCE";
}

function normalizeDataGapPriority(value: string): AgricultureDataGap["priority"] {
  return ["HIGH", "MEDIUM", "LOW"].includes(value) ? value as AgricultureDataGap["priority"] : "LOW";
}

function normalizeDataGapStatus(value: string): AgricultureDataGap["status"] {
  return ["OPEN", "PARTIAL", "RESOLVED"].includes(value) ? value as AgricultureDataGap["status"] : "OPEN";
}

function normalizeGeographyLevel(value: string | null | undefined, townshipName: string | null | undefined): AgricultureLocationSummary["geographyLevel"] {
  if (["TOWNSHIP", "STATE_REGION", "REGIONAL", "NATIONAL", "NATIONAL_REGIONAL"].includes(value ?? "")) {
    return value as AgricultureLocationSummary["geographyLevel"];
  }
  return townshipName ? "TOWNSHIP" : "STATE_REGION";
}

function mapOfficialUnionYield(statistics: AgricultureCropStatistic[]): AgricultureOfficialYieldRow[] {
  return statistics.flatMap((row): AgricultureOfficialYieldRow[] => {
    if (row.recordType !== "ACTUAL_OFFICIAL" || row.sourceGeography !== "NATIONAL" || row.geographyLevel !== "NATIONAL" || row.cropYear === null || row.yieldValue === null || row.yieldUnit === null) return [];
    return [{
      statisticId: row.statisticId,
      locationId: row.locationId,
      locationName: row.locationName,
      cropId: row.cropId,
      cropCode: row.cropCode,
      cropName: row.cropName,
      cropYear: row.cropYear,
      seasonCode: row.seasonCode,
      yieldValue: row.yieldValue,
      yieldUnit: row.yieldUnit,
      sourceId: row.sourceId,
      sourceName: row.sourceName,
      sourceUri: row.sourceUri,
      sourceTable: row.sourceTable,
      sourceCropName: row.sourceCropName,
      sourceGeography: row.sourceGeography,
      geographyLevel: row.geographyLevel,
      recordType: "ACTUAL_OFFICIAL",
      verificationStatus: row.verificationStatus,
      confidenceScore: row.confidenceScore,
      notes: row.notes,
    }];
  });
}

function parseStringArray(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function numberOrNull(value: string | null) {
  const parsed = value === null ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
