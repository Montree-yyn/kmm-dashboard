import type {
  SharedWeatherContract,
  WeatherLocation,
} from "../weather/weather.types";

export type AgricultureDataStatus = "available" | "partial" | "needs_verification" | "unavailable";
export type AgricultureGeographyLevel = "TOWNSHIP" | "STATE_REGION" | "REGIONAL" | "NATIONAL" | "NATIONAL_REGIONAL";
export type AgricultureGeographyScope = "ALL" | "STATE_REGION" | "REGIONAL" | "TOWNSHIP";
export type PresenceStatus = "CONFIRMED_PRESENT" | "PROBABLE" | "HISTORICAL" | "UNKNOWN" | "CONFIRMED_ABSENT";
export type ConfidenceGrade = "V0" | "V1" | "V2" | "V3" | "V4" | "UNKNOWN";
export type StatisticRecordType = "ACTUAL" | "ACTUAL_OFFICIAL" | "TARGET" | "PLAN" | "ESTIMATE" | "REPORTED";
export type MeasurementQualifier = "EXACT" | "APPROXIMATE" | "MORE_THAN" | "LESS_THAN" | "RANGE" | "UNKNOWN";
export type CalendarType = "AUTHORITATIVE_BASELINE" | "REGIONAL_BASELINE" | "STATE_REGION_BASELINE" | "HISTORICAL_OBSERVED" | "CURRENT_OBSERVED";
export type AgricultureCalendarPrecision = "MONTH" | "EARLY_MONTH" | "MID_MONTH" | "LATE_MONTH" | "MONTH_RANGE" | "SEASON_ONLY";
export type AgricultureTrendMetric = "SOWN_AREA" | "HARVESTED_AREA" | "PRODUCTION";
export type AgricultureContextType = "HISTORICAL_ADMIN_REFERENCE" | "HISTORICAL_REFERENCE" | "DISTRICT_CONTEXT" | "NEARBY_TOWNSHIP_REFERENCE" | "FARMLAND_CONTEXT" | "AGRICULTURE_CONTEXT" | "VALUE_CHAIN" | "TRADE_CONTEXT";
export type AgricultureDataGapType = "CROP_PRESENCE" | "CULTIVATED_AREA" | "PRODUCTION" | "YIELD" | "CALENDAR" | "CURRENT_STAGE" | "VARIETY" | "COORDINATES" | "WEATHER_MAPPING";
export type AgricultureDataGapPriority = "HIGH" | "MEDIUM" | "LOW";
export type AgricultureDataGapStatus = "OPEN" | "PARTIAL" | "RESOLVED";

export type AgricultureKpis = {
  activeCrops: number | null;
  cultivatedArea: number | null;
  cultivatedAreaUnit: string | null;
  cultivatedAreaQualifier: MeasurementQualifier | null;
  sownArea: number | null;
  sownAreaUnit: string | null;
  harvestedArea: number | null;
  harvestedAreaUnit: string | null;
  production: number | null;
  productionUnit: string | null;
  harvestSeason: string | null;
  dataConfidence: number | null;
};

export type AgricultureLocationSummary = {
  locationId: string;
  canonicalName: string;
  townshipName: string | null;
  stateRegionName: string | null;
  districtCode: string | null;
  districtName: string | null;
  townshipCode: string | null;
  countryCode: string;
  countryName: string;
  geographyLevel: AgricultureGeographyLevel;
  alternateNames: string[];
  latitude: number | null;
  longitude: number | null;
  kmmBranchCode: string | null;
  weatherLocationId: string | null;
  knownCropCount: number;
  unknownCropCount: number;
  verificationStatus: "VERIFIED" | "PARTIAL" | "UNKNOWN";
  salesTerritoryId: string | null;
};

export type AgricultureCropSummary = {
  cropId: string;
  cropCode: string;
  cropName: string;
  cropCycleType: string;
  alternateNames: string[];
  isActive: boolean;
};

export type AgricultureCropPresence = {
  locationId: string;
  cropId: string;
  cropCode: string;
  cropName: string;
  presenceStatus: PresenceStatus;
  importanceLevel: string;
  confidenceGrade: string;
  evidenceGeography: string | null;
  evidenceYear: number | null;
  cultivatedArea: string | null;
  cultivatedAreaUnit: string | null;
  cultivatedAreaYear: number | null;
  sourceId: string | null;
  sourceName: string | null;
  sourceUri: string | null;
  sourcePublicationDate: string | null;
  notes: string | null;
  localVerified: boolean;
};

export type AgricultureCalendarRow = {
  calendarRecordId: string;
  locationId: string;
  locationName: string;
  cropId: string;
  cropCode: string;
  cropName: string;
  seasonId: string | null;
  cropYear: number | null;
  seasonCode: string | null;
  seasonName: string | null;
  stageCode: string;
  baselineStartDate: string | null;
  baselineEndDate: string | null;
  calendarPrecision: AgricultureCalendarPrecision;
  windowStartMonth: number | null;
  windowEndMonth: number | null;
  durationDaysMin: number | null;
  durationDaysMax: number | null;
  validFromYear: number | null;
  validToYear: number | null;
  estimatedStartDate: string | null;
  estimatedEndDate: string | null;
  sourceGeography: string | null;
  sourceId: string | null;
  sourceName: string | null;
  sourceUri: string | null;
  sourcePublicationDate: string | null;
  calendarType: CalendarType;
  verificationLevel: string;
  confidenceScore: number | null;
  inheritedFromLocationId: string | null;
  weatherAdjusted: boolean;
  calendarShiftStatus: string;
  calendarShiftDays: number | null;
  notes: string | null;
};

export type AgricultureCalendarCoverage = {
  townshipsWithTownshipCalendar: number;
  nationalBaselines: number;
  regionalBaselines: number;
  stateRegionsWithBaseline: number;
  cropsWithBaseline: number;
  cropsWithoutCalendar: number;
};

export type AgricultureHistoricalTrendRow = {
  locationId: string;
  locationName: string;
  cropId: string;
  cropCode: string;
  cropName: string;
  cropYear: number;
  metric: AgricultureTrendMetric;
  value: number;
  unit: string | null;
  sourceId: string;
  sourceName: string | null;
  sourceTable: string | null;
  sourceGeography: string;
  geographyLevel: AgricultureGeographyLevel;
  verificationStatus: string;
  confidenceScore: number | null;
};

export type AgricultureOfficialYieldRow = {
  statisticId: string;
  locationId: string;
  locationName: string;
  cropId: string;
  cropCode: string;
  cropName: string;
  cropYear: number;
  seasonCode: string | null;
  yieldValue: number;
  yieldUnit: string;
  sourceId: string;
  sourceName: string | null;
  sourceUri: string | null;
  sourceTable: string | null;
  sourceCropName: string | null;
  sourceGeography: string;
  geographyLevel: AgricultureGeographyLevel;
  recordType: "ACTUAL_OFFICIAL";
  verificationStatus: string;
  confidenceScore: number | null;
  notes: string | null;
};

export type AgricultureCropStatistic = {
  statisticId: string;
  locationId: string;
  locationName: string;
  cropId: string;
  cropCode: string;
  cropName: string;
  cropYear: number | null;
  seasonCode: string | null;
  sownArea: number | null;
  sownAreaUnit: string | null;
  harvestedArea: number | null;
  harvestedAreaUnit: string | null;
  cultivatedArea: number | null;
  areaUnit: string | null;
  production: number | null;
  productionUnit: string | null;
  yieldValue: number | null;
  yieldUnit: string | null;
  sourceId: string;
  sourceName: string | null;
  sourceUri: string | null;
  sourceTable: string | null;
  sourceCropName: string | null;
  sourceGeography: string;
  geographyLevel: AgricultureGeographyLevel;
  sourceYear: number | null;
  recordType: StatisticRecordType;
  valueQualifier: MeasurementQualifier;
  verificationStatus: string;
  confidenceScore: number | null;
  notes: string | null;
};

export type AgricultureVarietyRow = {
  locationCropVarietyId: string;
  locationId: string;
  locationName: string;
  cropId: string;
  cropName: string;
  varietyId: string;
  canonicalName: string;
  alternateNames: string[];
  localName: string | null;
  countryCode: string | null;
  seasonCode: string | null;
  evidenceYear: number | null;
  sourceId: string;
  sourceName: string | null;
  sourceUri: string | null;
  verificationStatus: string;
  confidenceScore: number | null;
  notes: string | null;
};

export type AgricultureHistoricalHazard = {
  hazardId: string;
  locationId: string;
  locationName: string;
  hazardType: string;
  eventStart: string | null;
  eventEnd: string | null;
  eventYear: number | null;
  severity: string | null;
  affectedArea: number | null;
  affectedAreaUnit: string | null;
  description: string | null;
  sourceId: string;
  sourceName: string | null;
  sourceUri: string | null;
  verificationStatus: string;
  confidenceScore: number | null;
};

export type AgricultureContextRow = {
  contextId: string;
  locationId: string;
  locationName: string;
  contextType: AgricultureContextType;
  contextGeography: string;
  contextSubject: string;
  evidenceYear: number | null;
  sourceId: string;
  sourceName: string | null;
  sourceUri: string | null;
  sourcePublicationDate: string | null;
  verificationStatus: string;
  confidenceScore: number | null;
  notes: string | null;
};

export type AgricultureDataGap = {
  gapId: string;
  locationId: string;
  cropId: string | null;
  gapType: AgricultureDataGapType;
  priority: AgricultureDataGapPriority;
  requiredGeography: string;
  latestSourceYear: number | null;
  notes: string | null;
  status: AgricultureDataGapStatus;
};

export type AgricultureCoverage = {
  pilotTownships: number;
  townshipsWithFactualPresence: number;
  townshipsWithAreaStatistics: number;
  townshipsWithProductionData: number;
  townshipsWithYieldData: number;
  townshipsWithCalendar: number;
  weatherMapped: number;
  weatherMappingTotal: number;
};

export type AgricultureStateRegionCoverage = {
  locationId: string;
  locationName: string;
  stateRegionName: string | null;
  geographyLevel: AgricultureGeographyLevel;
  years: number[];
  crops: string[];
  recordCount: number;
  sownRecordCount: number;
  harvestedRecordCount: number;
  productionRecordCount: number;
  yieldRecordCount: number;
};

export type AgricultureOpportunityRow = {
  opportunityId: string;
  locationId: string | null;
  locationName: string | null;
  cropId: string | null;
  cropCode: string | null;
  cropName: string | null;
  stageCode: string | null;
  opportunityType: string;
  machineCategory: string | null;
  opportunityScore: number | null;
  confidenceScore: number | null;
  priorityScore: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  reasonCodes: string[];
  recommendedAction: string | null;
  modelVersion: string;
  status: string;
};

export type AgricultureCropWeatherStateRow = {
  stateId: string;
  locationId: string;
  locationName: string;
  cropId: string;
  cropCode: string;
  cropName: string;
  stageCode: string;
  weatherVariable: string;
  observedValue: string | null;
  unit: string | null;
  riskType: string | null;
  stateStatus: string;
  source: string | null;
  provider: string | null;
  retrievedAt: string | null;
  qualityStatus: string;
  reasonCodes: string[];
  calculatedAt: string | null;
};

export type AgricultureWeatherLayer = {
  availability: "LIVE" | "CACHED" | "STALE" | "UNAVAILABLE";
  source: string | null;
  fetchedAt: string | null;
  contract: SharedWeatherContract | null;
  locations: WeatherLocation[];
  highRiskLocationCount: number | null;
  error: string | null;
};

export type AgricultureFieldVerificationLevel = "V2" | "V3" | "V4";
export type AgricultureFieldVerificationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type AgricultureCropPresenceAnswer = "YES" | "NO" | "UNKNOWN";
export type AgricultureVerificationImportance = "MAJOR" | "SECONDARY" | "MINOR" | "UNKNOWN";
export type AgricultureAreaQuality = "KNOWN" | "APPROXIMATE" | "UNKNOWN";
export type AgricultureIrrigationType = "RAIN_FED" | "IRRIGATED" | "MIXED" | "UNKNOWN";
export type AgricultureMechanizationLevel = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
export type AgricultureVerificationMethod = "FIELD_VISIT" | "BRANCH_REPORT" | "SALESPERSON_REPORT" | "CUSTOMER_REPORT" | "MANAGER_CONFIRMATION" | "OTHER";

export type AgricultureCropStageOption = {
  cropId: string;
  stageCode: string;
  stageName: string;
  displayOrder: number;
};

export type AgricultureFieldVerification = {
  verificationId: string;
  companyId: string;
  locationId: string;
  locationName: string;
  cropId: string | null;
  cropCode: string | null;
  cropName: string | null;
  cropYear: number | null;
  seasonCode: string | null;
  cropPresence: AgricultureCropPresenceAnswer;
  importance: AgricultureVerificationImportance;
  estimatedArea: number | null;
  areaUnit: string | null;
  areaQuality: AgricultureAreaQuality;
  plantingStartMonth: number | null;
  plantingEndMonth: number | null;
  harvestStartMonth: number | null;
  harvestEndMonth: number | null;
  currentStage: string | null;
  irrigationType: AgricultureIrrigationType;
  mechanizationLevel: AgricultureMechanizationLevel;
  commonMachines: string[];
  notes: string | null;
  fieldName: string;
  proposedValue: string;
  verificationLevel: AgricultureFieldVerificationLevel;
  evidence: string;
  sourceId: string | null;
  verifiedBy: string;
  verifiedRole: string | null;
  verifiedAt: string;
  verificationMethod: AgricultureVerificationMethod;
  confidenceScore: number | null;
  status: AgricultureFieldVerificationStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type AgricultureFieldVerificationInput = {
  verificationId?: string;
  locationId: string;
  cropId: string;
  cropYear: number;
  seasonCode?: string | null;
  cropPresence: AgricultureCropPresenceAnswer;
  importance: AgricultureVerificationImportance;
  estimatedArea?: number | null;
  areaUnit?: string | null;
  areaQuality: AgricultureAreaQuality;
  plantingStartMonth?: number | null;
  plantingEndMonth?: number | null;
  harvestStartMonth?: number | null;
  harvestEndMonth?: number | null;
  currentStage?: string | null;
  irrigationType: AgricultureIrrigationType;
  mechanizationLevel: AgricultureMechanizationLevel;
  commonMachines: string[];
  notes?: string | null;
  verificationMethod: AgricultureVerificationMethod;
  verificationLevel: AgricultureFieldVerificationLevel;
  confidenceScore?: number | null;
  evidence: string;
  sourceId?: string | null;
  verifiedBy: string;
  verifiedRole?: string | null;
};

export type AgricultureFieldVerificationReviewInput = {
  verificationId: string;
  status: "APPROVED" | "REJECTED";
  verificationLevel?: AgricultureFieldVerificationLevel;
  reviewedBy: string;
};

export type AgricultureVerificationCoverage = {
  verifiedTownships: number;
  verifiedCrops: number;
  currentVerifiedCount: number;
  crossVerifiedCount: number;
  localReportedCount: number;
  currentStageCount: number;
  openHighPriorityGaps: number;
};

export type AgricultureOverviewPayload = {
  source: "local-d1";
  companyId: string;
  dataStatus: AgricultureDataStatus;
  generatedAt: string;
  kpis: AgricultureKpis;
  locations: AgricultureLocationSummary[];
  crops: AgricultureCropSummary[];
  cropPresence: AgricultureCropPresence[];
  statistics: AgricultureCropStatistic[];
  varieties: AgricultureVarietyRow[];
  historicalHazards: AgricultureHistoricalHazard[];
  contexts: AgricultureContextRow[];
  dataGaps: AgricultureDataGap[];
  coverage: AgricultureCoverage;
  stateRegionCoverage: AgricultureStateRegionCoverage[];
  calendarCoverage: AgricultureCalendarCoverage;
  officialUnionYield: AgricultureOfficialYieldRow[];
  geographyScope: AgricultureGeographyScope;
  calendar: AgricultureCalendarRow[];
  weatherState: AgricultureCropWeatherStateRow[];
  opportunities: AgricultureOpportunityRow[];
  fieldVerifications: AgricultureFieldVerification[];
  verificationCoverage: AgricultureVerificationCoverage;
  cropStages: AgricultureCropStageOption[];
  verificationCount: number;
  sourceCount: number;
  weather: AgricultureWeatherLayer;
  notes: string[];
};

export type AgricultureListResponse<T> = {
  source: "local-d1";
  companyId: string;
  dataStatus: AgricultureDataStatus;
  rows: T[];
};

type CropPresenceEvidence = {
  cropId?: string;
  presenceStatus: string;
  evidenceGeography?: string | null;
  confidenceGrade?: string | null;
  sourceId?: string | null;
};

export function isEligibleLocalCropPresence(row: CropPresenceEvidence) {
  return (row.presenceStatus === "CONFIRMED_PRESENT" || row.presenceStatus === "PROBABLE")
    && row.evidenceGeography === "TOWNSHIP";
}

export function countEligibleLocalCrops(rows: CropPresenceEvidence[]) {
  return new Set(rows.filter(isEligibleLocalCropPresence).map((row) => row.cropId).filter((cropId): cropId is string => Boolean(cropId))).size;
}

export function isActiveFieldVerification(row: Pick<AgricultureFieldVerification, "verificationLevel" | "status">) {
  return /^V[2-4]$/.test(row.verificationLevel) && row.status !== "REJECTED";
}

export function fieldVerificationLevelRank(level: string) {
  return ({ V2: 2, V3: 3, V4: 4 } as Record<string, number>)[level] ?? 0;
}

export function selectCurrentFieldVerifications(rows: AgricultureFieldVerification[]) {
  const selected = new Map<string, AgricultureFieldVerification>();
  for (const row of rows) {
    if (!row.cropId || !isActiveFieldVerification(row)) continue;
    const key = `${row.locationId}:${row.cropId}`;
    const previous = selected.get(key);
    if (!previous) {
      selected.set(key, row);
      continue;
    }
    const levelDelta = fieldVerificationLevelRank(row.verificationLevel) - fieldVerificationLevelRank(previous.verificationLevel);
    if (levelDelta > 0 || (levelDelta === 0 && row.verifiedAt.localeCompare(previous.verifiedAt) > 0)) selected.set(key, row);
  }
  return [...selected.values()].sort((left, right) => left.locationName.localeCompare(right.locationName) || (left.cropName ?? "").localeCompare(right.cropName ?? ""));
}

export function calculateAgricultureVerificationCoverage(
  locations: Pick<AgricultureLocationSummary, "locationId" | "geographyLevel">[],
  rows: AgricultureFieldVerification[],
  gaps: Pick<AgricultureDataGap, "locationId" | "priority" | "status">[],
): AgricultureVerificationCoverage {
  const townshipIds = new Set(locations.filter((location) => location.geographyLevel === "TOWNSHIP").map((location) => location.locationId));
  const activeRows = rows.filter((row) => townshipIds.has(row.locationId) && isActiveFieldVerification(row));
  const currentRows = selectCurrentFieldVerifications(activeRows);
  const pairCount = (candidateRows: AgricultureFieldVerification[]) => new Set(candidateRows.filter((row) => row.cropId).map((row) => `${row.locationId}:${row.cropId}`)).size;
  return {
    verifiedTownships: new Set(activeRows.map((row) => row.locationId)).size,
    verifiedCrops: pairCount(activeRows),
    currentVerifiedCount: pairCount(currentRows.filter((row) => row.verificationLevel === "V4")),
    crossVerifiedCount: pairCount(currentRows.filter((row) => row.verificationLevel === "V3")),
    localReportedCount: pairCount(currentRows.filter((row) => row.verificationLevel === "V2")),
    currentStageCount: pairCount(currentRows.filter((row) => Boolean(row.currentStage))),
    openHighPriorityGaps: new Set(gaps.filter((gap) => townshipIds.has(gap.locationId) && gap.priority === "HIGH" && gap.status !== "RESOLVED").map((gap) => gap.locationId)).size,
  };
}

export function isEligibleActualStatistic(row: Pick<AgricultureCropStatistic, "recordType" | "sourceGeography" | "verificationStatus" | "cultivatedArea">) {
  return isEligibleActualStatisticRecord(row)
    && typeof row.cultivatedArea === "number"
    && Number.isFinite(row.cultivatedArea);
}

export function isEligibleActualStatisticRecord(row: Pick<AgricultureCropStatistic, "recordType" | "sourceGeography" | "verificationStatus">) {
  return row.recordType === "ACTUAL"
    && row.sourceGeography === "TOWNSHIP"
    && /^V[1-4]$/.test(row.verificationStatus);
}

export function isEligibleStateRegionStatistic(row: Pick<AgricultureCropStatistic, "recordType" | "sourceGeography" | "geographyLevel" | "verificationStatus">) {
  return row.recordType === "ACTUAL"
    && row.sourceGeography === "STATE_REGION"
    && row.geographyLevel === "STATE_REGION"
    && /^V[1-4]$/.test(row.verificationStatus);
}

export function calculateAgricultureCoverage(
  locations: Pick<AgricultureLocationSummary, "locationId" | "weatherLocationId" | "geographyLevel">[],
  cropPresence: Pick<AgricultureCropPresence, "locationId" | "cropId" | "presenceStatus" | "evidenceGeography">[],
  statistics: Pick<AgricultureCropStatistic, "locationId" | "cropId" | "cultivatedArea" | "production" | "yieldValue" | "recordType" | "sourceGeography" | "verificationStatus">[],
  calendar: Array<Pick<AgricultureCalendarRow, "locationId"> & Partial<Pick<AgricultureCalendarRow, "inheritedFromLocationId" | "sourceGeography">>> = [],
): AgricultureCoverage {
  const townshipLocations = locations.filter((location) => location.geographyLevel === "TOWNSHIP");
  const locationIds = new Set(townshipLocations.map((location) => location.locationId));
  const eligiblePresenceKeys = new Set(
    cropPresence
      .filter(isEligibleLocalCropPresence)
      .map((row) => `${row.locationId}:${row.cropId}`),
  );
  const eligibleStatistics = statistics.filter(
    (row) => isEligibleActualStatisticRecord(row) && eligiblePresenceKeys.has(`${row.locationId}:${row.cropId}`),
  );
  const locationCount = (rows: Array<{ locationId: string }>) => new Set(rows.filter((row) => locationIds.has(row.locationId)).map((row) => row.locationId)).size;
  return {
    pilotTownships: townshipLocations.length,
    townshipsWithFactualPresence: locationCount([...eligiblePresenceKeys].map((key) => ({ locationId: key.split(":")[0] ?? "" }))),
    townshipsWithAreaStatistics: locationCount(eligibleStatistics.filter((row) => typeof row.cultivatedArea === "number" && Number.isFinite(row.cultivatedArea))),
    townshipsWithProductionData: locationCount(eligibleStatistics.filter((row) => typeof row.production === "number" && Number.isFinite(row.production))),
    townshipsWithYieldData: locationCount(eligibleStatistics.filter((row) => typeof row.yieldValue === "number" && Number.isFinite(row.yieldValue))),
    townshipsWithCalendar: locationCount(calendar.filter((row) => row.inheritedFromLocationId === undefined || row.inheritedFromLocationId === null)),
    weatherMapped: townshipLocations.filter((location) => Boolean(location.weatherLocationId)).length,
    weatherMappingTotal: townshipLocations.length,
  };
}

export function calculateAgricultureCalendarCoverage(
  locations: Pick<AgricultureLocationSummary, "locationId" | "geographyLevel">[],
  crops: Pick<AgricultureCropSummary, "cropId">[],
  calendar: Pick<AgricultureCalendarRow, "locationId" | "cropId" | "calendarType" | "sourceGeography" | "inheritedFromLocationId">[],
): AgricultureCalendarCoverage {
  const directRows = calendar.filter((row) => row.inheritedFromLocationId === undefined || row.inheritedFromLocationId === null);
  const townshipIds = new Set(locations.filter((location) => location.geographyLevel === "TOWNSHIP").map((location) => location.locationId));
  const stateIds = new Set(locations.filter((location) => location.geographyLevel === "STATE_REGION").map((location) => location.locationId));
  const regionalIds = new Set(locations.filter((location) => location.geographyLevel === "REGIONAL").map((location) => location.locationId));
  const nationalIds = new Set(locations.filter((location) => location.geographyLevel === "NATIONAL").map((location) => location.locationId));
  const baselineTypes = new Set<CalendarType>(["AUTHORITATIVE_BASELINE", "REGIONAL_BASELINE", "STATE_REGION_BASELINE"]);
  const townshipCalendarLocations = new Set(directRows.filter((row) => townshipIds.has(row.locationId) && row.sourceGeography === "TOWNSHIP").map((row) => row.locationId));
  const regionalBaselineLocations = new Set(directRows.filter((row) => regionalIds.has(row.locationId) && baselineTypes.has(row.calendarType)).map((row) => row.locationId));
  const nationalBaselineLocations = new Set(directRows.filter((row) => nationalIds.has(row.locationId) && baselineTypes.has(row.calendarType)).map((row) => row.locationId));
  const stateBaselineLocations = new Set(directRows.filter((row) => stateIds.has(row.locationId) && baselineTypes.has(row.calendarType)).map((row) => row.locationId));
  const baselineCrops = new Set(directRows.filter((row) => baselineTypes.has(row.calendarType)).map((row) => row.cropId));
  return {
    townshipsWithTownshipCalendar: townshipCalendarLocations.size,
    nationalBaselines: nationalBaselineLocations.size,
    regionalBaselines: regionalBaselineLocations.size,
    stateRegionsWithBaseline: stateBaselineLocations.size,
    cropsWithBaseline: baselineCrops.size,
    cropsWithoutCalendar: Math.max(crops.length - baselineCrops.size, 0),
  };
}

export function calculateStateRegionCoverage(
  locations: Pick<AgricultureLocationSummary, "locationId" | "canonicalName" | "stateRegionName" | "geographyLevel">[],
  statistics: Pick<AgricultureCropStatistic, "locationId" | "cropCode" | "cropYear" | "sownArea" | "harvestedArea" | "production" | "yieldValue" | "recordType" | "sourceGeography" | "geographyLevel" | "verificationStatus">[],
): AgricultureStateRegionCoverage[] {
  const locationMap = new Map(locations.filter((location) => location.geographyLevel === "STATE_REGION").map((location) => [location.locationId, location]));
  const grouped = new Map<string, typeof statistics>();
  for (const row of statistics) {
    if (!isEligibleStateRegionStatistic(row) || !locationMap.has(row.locationId)) continue;
    const group = grouped.get(row.locationId) ?? [];
    group.push(row);
    grouped.set(row.locationId, group);
  }
  return [...grouped.entries()].map(([locationId, rows]) => {
    const location = locationMap.get(locationId);
    return {
      locationId,
      locationName: location?.canonicalName ?? "Unknown location",
      stateRegionName: location?.stateRegionName ?? null,
      geographyLevel: "STATE_REGION" as const,
      years: [...new Set(rows.map((row) => row.cropYear).filter((year): year is number => typeof year === "number"))].sort((a, b) => a - b),
      crops: [...new Set(rows.map((row) => row.cropCode))].sort(),
      recordCount: rows.length,
      sownRecordCount: rows.filter((row) => typeof row.sownArea === "number" && Number.isFinite(row.sownArea)).length,
      harvestedRecordCount: rows.filter((row) => typeof row.harvestedArea === "number" && Number.isFinite(row.harvestedArea)).length,
      productionRecordCount: rows.filter((row) => typeof row.production === "number" && Number.isFinite(row.production)).length,
      yieldRecordCount: rows.filter((row) => typeof row.yieldValue === "number" && Number.isFinite(row.yieldValue)).length,
    };
  }).sort((a, b) => a.locationName.localeCompare(b.locationName));
}

export function confidenceFromPresenceRecords(rows: CropPresenceEvidence[]) {
  const seenSources = new Set<string>();
  const scores: number[] = [];
  for (const row of rows) {
    if (!isEligibleLocalCropPresence(row) || !row.sourceId || seenSources.has(row.sourceId)) continue;
    seenSources.add(row.sourceId);
    const score = { V0: 0, V1: 25, V2: 50, V3: 75, V4: 100 }[row.confidenceGrade ?? ""] ?? 0;
    if (score > 0) scores.push(score);
  }
  return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
}
