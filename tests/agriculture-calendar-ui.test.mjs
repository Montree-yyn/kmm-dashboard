import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const repoRoot = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");

/** Minimal AgricultureCalendarRow fixture mirroring the real local-D1 shapes. */
function calendarRow(overrides = {}) {
  return {
    calendarRecordId: "record",
    locationId: "MM-REG-BAGO",
    locationName: "Bago Region",
    cropId: "crop-rice",
    cropCode: "RICE",
    cropName: "Rice",
    seasonId: "season-main-monsoon",
    cropYear: null,
    seasonCode: "MAIN_MONSOON",
    seasonName: "Main monsoon",
    stageCode: "SOWING",
    baselineStartDate: null,
    baselineEndDate: null,
    calendarPrecision: "MONTH_RANGE",
    windowStartMonth: 5,
    windowEndMonth: 6,
    durationDaysMin: null,
    durationDaysMax: null,
    validFromYear: 2000,
    validToYear: null,
    estimatedStartDate: null,
    estimatedEndDate: null,
    sourceGeography: "REGIONAL",
    sourceId: "source-fao",
    sourceName: "FAO Myanmar lower-Myanmar paddy crop calendar",
    sourceUri: "https://example.com/fao",
    sourcePublicationDate: "2000-10",
    calendarType: "STATE_REGION_BASELINE",
    verificationLevel: "V4",
    confidenceScore: 100,
    inheritedFromLocationId: null,
    weatherAdjusted: false,
    calendarShiftStatus: null,
    calendarShiftDays: null,
    notes: null,
    ...overrides,
  };
}

function payloadOverrides(overrides = {}) {
  return {
    source: "local-d1",
    companyId: "company",
    dataStatus: "available",
    generatedAt: "2026-08-15T09:32:00.000Z",
    kpis: { activeCrops: 3, cultivatedArea: null, cultivatedAreaUnit: null, cultivatedAreaQualifier: null, sownArea: null, sownAreaUnit: null, harvestedArea: null, harvestedAreaUnit: null, production: null, productionUnit: null, harvestSeason: null, dataConfidence: null },
    locations: [],
    crops: [],
    cropPresence: [],
    statistics: [],
    varieties: [],
    historicalHazards: [],
    contexts: [],
    dataGaps: [],
    coverage: { pilotTownships: 0, townshipsWithFactualPresence: 0, townshipsWithAreaStatistics: 0, townshipsWithProductionData: 0, townshipsWithYieldData: 0, townshipsWithCalendar: 0, weatherMapped: 0, weatherMappingTotal: 0 },
    stateRegionCoverage: [],
    calendarCoverage: { townshipsWithTownshipCalendar: 0, nationalBaselines: 0, regionalBaselines: 0, stateRegionsWithBaseline: 0, cropsWithBaseline: 0, cropsWithoutCalendar: 0 },
    officialUnionYield: [],
    geographyScope: "TOWNSHIP",
    calendar: [],
    weatherState: [],
    opportunities: [],
    fieldVerifications: [],
    verificationCoverage: { verifiedTownships: 0, verifiedCrops: 0, currentVerifiedCount: 0, crossVerifiedCount: 0, localReportedCount: 0, currentStageCount: 0, openHighPriorityGaps: 0 },
    cropStages: [],
    verificationCount: 0,
    sourceCount: 0,
    weather: { availability: "UNAVAILABLE", source: null, fetchedAt: null, contract: null, locations: [], highRiskLocationCount: null, error: null },
    notes: [],
    ...overrides,
  };
}

const BAGO = { locationId: "MM-REG-BAGO", canonicalName: "Bago Region", townshipName: null, stateRegionName: "Bago", districtCode: null, districtName: null, townshipCode: null, countryCode: "MM", countryName: "Myanmar", geographyLevel: "STATE_REGION", alternateNames: [], latitude: null, longitude: null, kmmBranchCode: null, weatherLocationId: null, knownCropCount: 0, unknownCropCount: 0, verificationStatus: "UNKNOWN", salesTerritoryId: null };
const NATTALIN = { ...BAGO, locationId: "MM-BGO-NATTALIN", canonicalName: "Nattalin", townshipName: "Nattalin", stateRegionName: "Bago (West)", geographyLevel: "TOWNSHIP" };

test("stageCategory maps canonical stages to 6 visual categories and never fabricates stages", async () => {
  const view = await tsImport("../src/modules/agriculture/agriculture.calendar-view.ts", import.meta.url);
  assert.equal(view.stageCategory("LAND_PREPARATION"), "prep");
  assert.equal(view.stageCategory("NURSERY_SEED_PREP"), "prep");
  assert.equal(view.stageCategory("SOWING"), "planting");
  assert.equal(view.stageCategory("PLANTING"), "planting");
  assert.equal(view.stageCategory("TRANSPLANTING_DIRECT_SEEDING"), "planting");
  assert.equal(view.stageCategory("VEGETATIVE"), "growth");
  assert.equal(view.stageCategory("TILLERING"), "growth");
  assert.equal(view.stageCategory("FLOWERING"), "growth");
  assert.equal(view.stageCategory("GRAIN_FILLING"), "growth");
  assert.equal(view.stageCategory("MATURITY"), "nearHarvest");
  assert.equal(view.stageCategory("HARVEST"), "harvest");
  assert.equal(view.stageCategory("POST_HARVEST"), "harvest");
  assert.equal(view.stageCategory("TAPPING"), "tapping");
  assert.equal(view.stageCategory(null), "noData");
  assert.equal(view.stageCategory("MADE_UP_STAGE"), "growth");
});

test("timeline groups by crop+season, dedupes duplicate stage rows, and splits cross-year spans", async () => {
  const view = await tsImport("../src/modules/agriculture/agriculture.calendar-view.ts", import.meta.url);
  const riceSowing = calendarRow({ stageCode: "SOWING", windowStartMonth: 5, windowEndMonth: 6 });
  const duplicateSowing = calendarRow({ calendarRecordId: "dup", stageCode: "SOWING", windowStartMonth: 5, windowEndMonth: 6 });
  const riceHarvest = calendarRow({ stageCode: "HARVEST", windowStartMonth: 10, windowEndMonth: 12 });
  const rubberTapping = calendarRow({ cropId: "crop-rubber", cropCode: "RUBBER", cropName: "Rubber", seasonCode: "PERENNIAL", seasonName: "Perennial", stageCode: "TAPPING", windowStartMonth: 10, windowEndMonth: 1, calendarType: "REGIONAL_BASELINE", sourceId: "source-rubber", sourceName: "Rubber baseline", verificationLevel: "V1", confidenceScore: 25 });
  const groups = view.buildCalendarTimeline([riceSowing, duplicateSowing, riceHarvest, rubberTapping]);
  assert.equal(groups.length, 2);
  const rice = groups.find((group) => group.cropCode === "RICE");
  assert.equal(rice.stages.length, 2, "duplicate SOWING rows must collapse to one stage");
  const harvest = rice.stages.find((stage) => stage.stageCode === "HARVEST");
  assert.deepEqual(harvest.segments, [{ start: 10, end: 12 }]);
  const rubber = groups.find((group) => group.cropCode === "RUBBER");
  assert.deepEqual(rubber.stages[0].segments, [{ start: 10, end: 12 }, { start: 1, end: 1 }], "cross-year window splits into two segments");
});

test("current month marker respects the company time zone", async () => {
  const view = await tsImport("../src/modules/agriculture/agriculture.calendar-view.ts", import.meta.url);
  // 2026-02-01 00:30 UTC = 07:30 in Bangkok (Feb) but 19:30 on Jan 31 in New York.
  const instant = new Date("2026-02-01T00:30:00.000Z");
  assert.deepEqual(view.currentMonthMarker(instant, "Asia/Bangkok"), { month: 2, year: 2026 });
  assert.deepEqual(view.currentMonthMarker(instant, "America/New_York"), { month: 1, year: 2026 });
  assert.deepEqual(view.currentMonthMarker(new Date("2026-08-15T04:00:00.000Z"), "Asia/Yangon"), { month: 8, year: 2026 });
});

test("situation cards derive badge and months-to-harvest from real windows only", async () => {
  const view = await tsImport("../src/modules/agriculture/agriculture.calendar-view.ts", import.meta.url);
  const rice = view.buildCalendarTimeline([
    calendarRow({ stageCode: "SOWING", windowStartMonth: 5, windowEndMonth: 6 }),
    calendarRow({ stageCode: "HARVEST", windowStartMonth: 10, windowEndMonth: 12 }),
  ])[0];

  // August: after sowing (May–Jun), before harvest (Oct–Dec) → mid-cycle, 2 months to harvest.
  const inAugust = view.deriveSituationCard(rice, 8);
  assert.equal(inAugust.kind, "betweenWindows");
  assert.equal(inAugust.badgeCategory, "growth");
  assert.deepEqual([inAugust.harvestStatus, inAugust.monthsToHarvest], ["upcoming", 2]);

  // October: inside the harvest window → active, 0 months.
  const inOctober = view.deriveSituationCard(rice, 10);
  assert.equal(inOctober.kind, "inWindow");
  assert.equal(inOctober.badgeStageCode, "HARVEST");
  assert.deepEqual([inOctober.harvestStatus, inOctober.monthsToHarvest], ["active", 0]);

  // January: harvest (Oct–Dec) passed, next sowing in May → before-window, 9 months to next harvest.
  const inJanuary = view.deriveSituationCard(rice, 1);
  assert.equal(inJanuary.kind, "beforeWindow");
  assert.equal(inJanuary.badgeStageCode, "SOWING");
  assert.equal(inJanuary.monthsToHarvest, 9);

  // Crop with no month data produces no group (no fabricated bar) and the
  // derived card stays noData without claiming any stage.
  assert.equal(view.buildCalendarTimeline([calendarRow({ windowStartMonth: null, windowEndMonth: null, baselineStartDate: null, baselineEndDate: null })]).length, 0);
  const emptyGroup = { key: "x", locationId: "l", locationName: "L", cropId: "c", cropCode: "RICE", cropName: "Rice", seasonKey: "", seasonRaw: "", cropYearLabel: "", stages: [], representative: calendarRow({}), mainCrop: false, historicalOnly: false, inherited: false };
  const empty = view.deriveSituationCard(emptyGroup, 8);
  assert.equal(empty.kind, "noData");
  assert.equal(empty.badgeStageCode, null);
});

test("evidence badges separate current, township, regional, historical, and unverified", async () => {
  const view = await tsImport("../src/modules/agriculture/agriculture.calendar-view.ts", import.meta.url);
  assert.deepEqual(view.evidenceBadge(calendarRow({ calendarType: "CURRENT_OBSERVED" })).tone, "verified");
  assert.deepEqual(view.evidenceBadge(calendarRow({ calendarType: "HISTORICAL_OBSERVED" })).tone, "historical");
  assert.deepEqual(view.evidenceBadge(calendarRow({ sourceGeography: "TOWNSHIP", inheritedFromLocationId: null })).tone, "township");
  assert.deepEqual(view.evidenceBadge(calendarRow({ sourceGeography: "TOWNSHIP", inheritedFromLocationId: "MM-REG-BAGO" })).tone, "regional");
  assert.deepEqual(view.evidenceBadge(calendarRow({ verificationLevel: "V4", confidenceScore: 100 })).tone, "regional");
  assert.deepEqual(view.evidenceBadge(calendarRow({ verificationLevel: "V1", confidenceScore: 25 })).tone, "unverified");
  assert.deepEqual(view.evidenceBadge(calendarRow({ verificationLevel: "V0" })).tone, "unverified");
});

test("no-data scope yields empty groups, empty cards, null donut, and empty sources", async () => {
  const view = await tsImport("../src/modules/agriculture/agriculture.calendar-view.ts", import.meta.url);
  const payload = payloadOverrides();
  const result = view.buildCalendarView(payload, { month: 8, year: 2026 });
  assert.equal(result.groups.length, 0);
  assert.equal(result.situationCards.length, 0);
  assert.equal(result.donut, null);
  assert.equal(result.relatedAreas.length, 0);
  assert.equal(result.sources.length, 0);
  assert.equal(result.hasCurrentObservations, false);
});

test("historical vs current distinction: historicalOnly groups and hasCurrentObservations", async () => {
  const view = await tsImport("../src/modules/agriculture/agriculture.calendar-view.ts", import.meta.url);
  const historical = view.buildCalendarTimeline([calendarRow({ calendarType: "HISTORICAL_OBSERVED", stageCode: "HARVEST", windowStartMonth: 11, windowEndMonth: 12 })]);
  assert.equal(historical[0].historicalOnly, true);
  assert.equal(historical[0].stages[0].historical, true);

  const payload = payloadOverrides({
    calendar: [calendarRow({ calendarType: "HISTORICAL_OBSERVED", stageCode: "HARVEST", windowStartMonth: 11, windowEndMonth: 12 })],
    fieldVerifications: [{ verificationId: "v1", companyId: "company", locationId: "MM-REG-BAGO", locationName: "Bago Region", cropId: "crop-rice", cropCode: "RICE", cropName: "Rice", cropYear: 2026, seasonCode: null, cropPresence: "YES", importance: "MAJOR", estimatedArea: null, areaUnit: null, areaQuality: "UNKNOWN", plantingStartMonth: null, plantingEndMonth: null, harvestStartMonth: null, harvestEndMonth: null, currentStage: "HARVEST", irrigationType: "RAIN_FED", mechanizationLevel: "UNKNOWN", commonMachines: [], notes: null, fieldName: "LOCAL_FIELD_VERIFICATION", proposedValue: "{}", verificationLevel: "V4", evidence: "branch", sourceId: null, verifiedBy: "u", verifiedRole: "manager", verifiedAt: "2026-08-01T00:00:00.000Z", verificationMethod: "BRANCH_REPORT", confidenceScore: 100, status: "APPROVED", reviewedBy: null, reviewedAt: null, createdAt: "2026-08-01T00:00:00.000Z", createdBy: "u", updatedAt: "2026-08-01T00:00:00.000Z", updatedBy: "u" }],
  });
  const result = view.buildCalendarView(payload, { month: 8, year: 2026 });
  assert.equal(result.hasCurrentObservations, true);
  assert.equal(result.situationCards[0].kind, "verifiedCurrent");
});

test("area donut uses only eligible ACTUAL township records and falls back to state sown area", async () => {
  const view = await tsImport("../src/modules/agriculture/agriculture.calendar-view.ts", import.meta.url);
  const statistic = (overrides = {}) => ({
    statisticId: "s", locationId: "MM-BGO-NATTALIN", locationName: "Nattalin", cropId: "crop-groundnut", cropCode: "GROUNDNUT", cropName: "Groundnut", cropYear: 2024, seasonCode: null, sownArea: null, sownAreaUnit: null, harvestedArea: null, harvestedAreaUnit: null, cultivatedArea: 2730, areaUnit: "acres", production: null, productionUnit: null, yieldValue: null, yieldUnit: null, sourceId: "src", sourceName: "Nattalin groundnut", sourceUri: null, sourceTable: null, sourceCropName: null, sourceGeography: "TOWNSHIP", geographyLevel: "TOWNSHIP", sourceYear: 2024, recordType: "ACTUAL", valueQualifier: "EXACT", verificationStatus: "V1", confidenceScore: 25, notes: null, ...overrides,
  });
  const presence = (cropId, cropCode, cropName) => ({ locationId: "MM-BGO-NATTALIN", cropId, cropCode, cropName, presenceStatus: "CONFIRMED_PRESENT", importanceLevel: "UNKNOWN", confidenceGrade: "V1", evidenceGeography: "TOWNSHIP", evidenceYear: 2024, cultivatedArea: null, cultivatedAreaUnit: null, cultivatedAreaYear: null, sourceId: "src", sourceName: "src", sourceUri: null, sourcePublicationDate: null, notes: null, localVerified: false });

  // PLAN/TARGET rows must never enter the donut (same rule as the KPI).
  const payload = payloadOverrides({
    locations: [NATTALIN],
    cropPresence: [
      presence("crop-groundnut", "GROUNDNUT", "Groundnut"),
      presence("crop-rice", "RICE", "Rice"),
      presence("crop-sesame", "SESAME", "Sesame"),
    ],
    statistics: [
      statistic({}),
      statistic({ cropId: "crop-rice", cropCode: "RICE", cropName: "Rice", cultivatedArea: 110262, recordType: "PLAN" }),
      statistic({ cropId: "crop-sesame", cropCode: "SESAME", cropName: "Sesame", cultivatedArea: 1988 }),
    ],
  });
  const donut = view.areaDonutData(payload);
  assert.equal(donut.kind, "townshipActual");
  assert.equal(donut.segments.length, 2, "PLAN rice must be excluded");
  assert.equal(donut.total, 4718);
  assert.deepEqual(donut.segments.map((segment) => segment.cropCode), ["GROUNDNUT", "SESAME"]);

  // State/region scope falls back to CSO sown area (V4 ACTUAL).
  const statePayload = payloadOverrides({
    locations: [BAGO],
    statistics: [statistic({ locationId: "MM-REG-BAGO", locationName: "Bago Region", cropId: "crop-rice", cropCode: "RICE", cropName: "Rice", cultivatedArea: null, areaUnit: null, sownArea: 3123616, sownAreaUnit: "Acre", sourceGeography: "STATE_REGION", geographyLevel: "STATE_REGION", verificationStatus: "V4", confidenceScore: 100, sourceId: "cso" })],
  });
  const stateDonut = view.areaDonutData(statePayload);
  assert.equal(stateDonut.kind, "stateSown");
  assert.equal(stateDonut.segments[0].value, 3123616);

  // No reliable area at all → null (never an empty-but-present chart).
  assert.equal(view.areaDonutData(payloadOverrides({ locations: [BAGO] })), null);
});

test("planning scope breadcrumb reflects the real geography level", async () => {
  const view = await tsImport("../src/modules/agriculture/agriculture.calendar-view.ts", import.meta.url);
  const township = view.planningScope(payloadOverrides({
    locations: [NATTALIN],
    calendar: [calendarRow({ locationId: "MM-BGO-NATTALIN", locationName: "Nattalin", cropYear: 2026 })],
  }));
  assert.deepEqual(township, { country: "Myanmar", region: "Bago (West)", township: "Nattalin", season: "2026/27", dataLevel: "TOWNSHIP" });

  const region = view.planningScope(payloadOverrides({ locations: [BAGO] }));
  assert.equal(region.region, "Bago Region");
  assert.equal(region.township, null);
  assert.equal(region.dataLevel, "STATE_REGION");

  const mixed = view.planningScope(payloadOverrides({ locations: [BAGO, NATTALIN] }));
  assert.equal(mixed.dataLevel, "MIXED");
  assert.equal(mixed.township, null);
});

test("months to harvest handles cross-year tapping and no-window cases", async () => {
  const view = await tsImport("../src/modules/agriculture/agriculture.calendar-view.ts", import.meta.url);
  const rubber = view.buildCalendarTimeline([calendarRow({ cropId: "crop-rubber", cropCode: "RUBBER", cropName: "Rubber", seasonCode: "PERENNIAL", seasonName: "Perennial", stageCode: "TAPPING", windowStartMonth: 10, windowEndMonth: 1 })])[0];
  assert.deepEqual(view.monthsToHarvest(rubber, 8), { status: "upcoming", months: 2 });
  assert.deepEqual(view.monthsToHarvest(rubber, 10), { status: "active", months: 0 });
  assert.deepEqual(view.monthsToHarvest(rubber, 3), { status: "upcoming", months: 7 });
  const noHarvest = view.buildCalendarTimeline([calendarRow({ stageCode: "SOWING", windowStartMonth: 5, windowEndMonth: 6 })])[0];
  assert.deepEqual(view.monthsToHarvest(noHarvest, 8), { status: "noData", months: null });
});

test("sources aggregate provenance across calendar, presence, and statistics without inventing entries", async () => {
  const view = await tsImport("../src/modules/agriculture/agriculture.calendar-view.ts", import.meta.url);
  const payload = payloadOverrides({
    calendar: [calendarRow({ sourceId: "fao", sourceName: "FAO calendar", sourcePublicationDate: "2007", verificationLevel: "V4", confidenceScore: 100 })],
    cropPresence: [{ locationId: "X", cropId: "c", cropCode: "RICE", cropName: "Rice", presenceStatus: "CONFIRMED_PRESENT", importanceLevel: "UNKNOWN", confidenceGrade: "V1", evidenceGeography: "TOWNSHIP", evidenceYear: 2024, cultivatedArea: null, cultivatedAreaUnit: null, cultivatedAreaYear: null, sourceId: "fao", sourceName: "FAO calendar", sourceUri: null, sourcePublicationDate: null, notes: null, localVerified: false }],
    statistics: [],
  });
  const sources = view.sourceFacts(payload);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].sourceId, "fao");
  assert.equal(sources[0].recordCount, 2);
  assert.equal(sources[0].verificationLevel, "V4");
  assert.deepEqual(sources[0].links.sort(), ["calendar", "presence"]);
});

test("CSV export is deterministic and data-only", async () => {
  const view = await tsImport("../src/modules/agriculture/agriculture.calendar-view.ts", import.meta.url);
  const groups = view.buildCalendarTimeline([calendarRow({ stageCode: "HARVEST", windowStartMonth: 10, windowEndMonth: 12 })]);
  const csv = view.calendarCsv(groups);
  assert.match(csv, /^"location","crop","crop_code"/);
  assert.ok(csv.split("\n").length >= 2);
  assert.match(csv, /"HARVEST"/);
});

test("Calendar view code never fabricates agronomic claims or hardcoded dates", async () => {
  const source = read("src/modules/agriculture/agriculture.calendar-view.ts");
  const component = read("src/modules/agriculture/AgricultureCalendar.tsx");
  const ui = read("src/modules/agriculture/agriculture.ui.ts");
  // No "currently planting/growing" claims — only reference-window language.
  assert.doesNotMatch(source, /กำลัง|currently planting|currently growing/i);
  // No yield/seed rate/fertilizer/machine recommendations invented by the view.
  assert.doesNotMatch(source, /seed rate|fertilizer|machine recommendation/i);
  // No hardcoded business dates.
  assert.doesNotMatch(source, /2026-0\d-\d\d/);
  // The page renders only derivations from ./agriculture.calendar-view and never fakes "no data" as real.
  assert.match(component, /buildCalendarView/);
  assert.doesNotMatch(ui, /กำลังปลูก|กำลังเจริญเติบโต/i);
});
