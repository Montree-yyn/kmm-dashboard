import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const repoRoot = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");

function localOperationsDatabase() {
  const root = path.join(repoRoot, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  if (!existsSync(root)) return null;
  return readdirSync(root)
    .filter((name) => name.endsWith(".sqlite"))
    .map((name) => path.join(root, name))
    .find((database) => {
      try {
        return Number(JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='agri_crops';"], { encoding: "utf8" }))[0]?.count ?? 0) === 1;
      } catch {
        return false;
      }
    }) ?? null;
}

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runtimeDatabase(database) {
  return {
    prepare(query) {
      return {
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
        async all() {
          let index = 0;
          const bound = query.replaceAll("?", () => sql(this.values[index++]));
          const output = execFileSync("sqlite3", ["-json", database, bound], { encoding: "utf8" });
          return { results: output.trim() ? JSON.parse(output) : [] };
        },
      };
    },
  };
}

function drizzleD1Database(database) {
  return {
    prepare(query) {
      let values = [];
      const statement = {
        bind(...boundValues) {
          values = boundValues;
          return statement;
        },
        async all() {
          const bound = query.replaceAll("?", () => sql(values.shift()));
          const output = execFileSync("sqlite3", ["-json", database, bound], { encoding: "utf8" });
          return { results: output.trim() ? JSON.parse(output) : [] };
        },
        async raw() {
          const bound = query.replaceAll("?", () => sql(values.shift()));
          const output = execFileSync("sqlite3", ["-json", database, bound], { encoding: "utf8" });
          const rows = output.trim() ? JSON.parse(output) : [];
          return rows.map((row) => Object.keys(row).map((key) => row[key]));
        },
        async run() {
          const bound = query.replaceAll("?", () => sql(values.shift()));
          execFileSync("sqlite3", [database, bound], { encoding: "utf8" });
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
}

test("Agriculture migrations are incremental and seed only evidence-safe master data", async () => {
  const migrationFiles = [
    "0024_agriculture_a01_master.sql",
    "0025_agriculture_a02_locations.sql",
    "0026_agriculture_a03_calendar.sql",
    "0027_agriculture_a04_verification.sql",
    "0028_agriculture_a05_weather_extension.sql",
    "0029_agriculture_a06_opportunities.sql",
    "0030_kai_agriculture_intents.sql",
    "0031_agriculture_a01_rubber_stage_fix.sql",
    "0032_agriculture_a14_factual_seed.sql",
    "0033_agriculture_data_completion_master.sql",
    "0034_agriculture_evidence_classification.sql",
    "0035_agriculture_location_master_completion.sql",
    "0036_agriculture_gap_closure_context.sql",
    "0037_agriculture_state_region_backbone.sql",
    "0038_agriculture_calendar_seasonal_backbone.sql",
    "0039_agriculture_calendar_yield_expansion.sql",
    "0040_agriculture_local_field_verification.sql",
  ];
  for (const file of migrationFiles) assert.ok(read(`drizzle/operations/${file}`).length > 0, file);
  const locations = read("drizzle/operations/0025_agriculture_a02_locations.sql");
  assert.match(locations, /presence_status[\s\S]*UNKNOWN/);
  assert.doesNotMatch(locations, /CONFIRMED_PRESENT/);
  const opportunities = read("drizzle/operations/0029_agriculture_a06_opportunities.sql");
  assert.doesNotMatch(opportunities, /INSERT.*agri_opportunities/s);
  const factualSeed = read("drizzle/operations/0032_agriculture_a14_factual_seed.sql");
  assert.match(factualSeed, /INSERT OR IGNORE INTO `agri_sources`/);
  assert.match(factualSeed, /source-phase1a14-fao-rice-national/);
  assert.match(factualSeed, /source-phase1a14-rubber-national-regional/);
  assert.doesNotMatch(factualSeed, /INSERT(?: OR IGNORE)? INTO\s+`agri_opportunities`/i);
  assert.doesNotMatch(factualSeed, /INSERT(?: OR IGNORE)? INTO\s+`agri_service_providers`/i);
  assert.doesNotMatch(factualSeed, /12,842|2,156|368|87%|Score 92/);
  const completionSeed = read("drizzle/operations/0033_agriculture_data_completion_master.sql");
  assert.match(completionSeed, /CREATE TABLE IF NOT EXISTS `agri_crop_statistics`/);
  assert.match(completionSeed, /value_qualifier/);
  assert.match(completionSeed, /record_type/);
  assert.match(completionSeed, /Historical hazard context only/);
  assert.doesNotMatch(completionSeed, /INSERT(?: OR IGNORE)? INTO\s+`agri_opportunities`/i);
  const locationCompletion = read("drizzle/operations/0035_agriculture_location_master_completion.sql");
  assert.match(locationCompletion, /data\/master-townships\.json/);
  assert.match(locationCompletion, /district_name/);
  assert.match(locationCompletion, /source_date` = NULL/);
  assert.doesNotMatch(locationCompletion, /latitude|longitude/);
  const gapClosure = read("drizzle/operations/0036_agriculture_gap_closure_context.sql");
  assert.match(gapClosure, /CREATE TABLE IF NOT EXISTS `agri_location_contexts`/);
  assert.match(gapClosure, /CREATE TABLE IF NOT EXISTS `agri_data_gaps`/);
  assert.match(gapClosure, /HISTORICAL_ADMIN_REFERENCE/);
  assert.match(gapClosure, /Gyobingauk is not Tharrawaddy Township/);
  assert.match(gapClosure, /over 900 acres/);
  assert.match(gapClosure, /does not change Myawaddy crop presence/);
  assert.match(gapClosure, /Open-Meteo geocoding/);
  assert.doesNotMatch(gapClosure, /INSERT(?: OR IGNORE)? INTO\s+`agri_crop_statistics`/i);
  assert.doesNotMatch(gapClosure, /INSERT(?: OR IGNORE)? INTO\s+`agri_crop_locations`/i);
  assert.doesNotMatch(gapClosure, /INSERT(?: OR IGNORE)? INTO\s+`agri_opportunities`/i);
  const stateRegionBackbone = read("drizzle/operations/0037_agriculture_state_region_backbone.sql");
  assert.match(stateRegionBackbone, /Table 9\.12/);
  assert.match(stateRegionBackbone, /STATE_REGION/);
  assert.match(stateRegionBackbone, /source-cso-msyb-2024-agri-9-15/);
  assert.match(stateRegionBackbone, /no yield is derived/i);
  assert.doesNotMatch(stateRegionBackbone, /INSERT(?: OR IGNORE)? INTO\s+`agri_opportunities`/i);
  const seasonalBackbone = read("drizzle/operations/0038_agriculture_calendar_seasonal_backbone.sql");
  assert.match(seasonalBackbone, /calendar_precision/);
  assert.match(seasonalBackbone, /window_start_month/);
  assert.match(seasonalBackbone, /STATE_REGION_BASELINE/);
  assert.match(seasonalBackbone, /REGIONAL_BASELINE/);
  assert.match(seasonalBackbone, /PERENNIAL/);
  assert.match(seasonalBackbone, /Lower Myanmar/);
  assert.doesNotMatch(seasonalBackbone, /INSERT(?: OR IGNORE)? INTO\s+`agri_opportunities`/i);
  const expansion = read("drizzle/operations/0039_agriculture_calendar_yield_expansion.sql");
  assert.match(expansion, /duration_days_min/);
  assert.match(expansion, /ACTUAL_OFFICIAL/);
  assert.match(expansion, /Table 9\.15/);
  assert.match(expansion, /source-phase4-fao-lower-myanmar-cropping-pattern-2007/);
  assert.match(expansion, /REGIONAL/);
  assert.doesNotMatch(expansion, /INSERT(?: OR IGNORE)? INTO\s+`agri_opportunities`/i);
  const localVerification = read("drizzle/operations/0040_agriculture_local_field_verification.sql");
  assert.match(localVerification, /crop_presence/);
  assert.match(localVerification, /current_stage/);
  assert.match(localVerification, /verification_method/);
  assert.match(localVerification, /reviewed_by/);
  assert.doesNotMatch(localVerification, /agri_opportunities/);
});

test("Local field verification selects current truth by level and preserves UNKNOWN", async () => {
  const types = await tsImport("../src/modules/agriculture/agriculture.types.ts", import.meta.url);
  const row = (verificationId, verificationLevel, verifiedAt, overrides = {}) => ({
    verificationId,
    companyId: "company",
    locationId: "township-a",
    locationName: "Township A",
    cropId: "crop-rice",
    cropCode: "RICE",
    cropName: "Rice",
    cropYear: 2026,
    seasonCode: null,
    cropPresence: "UNKNOWN",
    importance: "UNKNOWN",
    estimatedArea: null,
    areaUnit: null,
    areaQuality: "UNKNOWN",
    plantingStartMonth: null,
    plantingEndMonth: null,
    harvestStartMonth: null,
    harvestEndMonth: null,
    currentStage: null,
    irrigationType: "UNKNOWN",
    mechanizationLevel: "UNKNOWN",
    commonMachines: [],
    notes: null,
    fieldName: "LOCAL_FIELD_VERIFICATION",
    proposedValue: "{}",
    verificationLevel,
    evidence: "local report",
    sourceId: null,
    verifiedBy: "user",
    verifiedRole: "manager",
    verifiedAt,
    verificationMethod: "BRANCH_REPORT",
    confidenceScore: 50,
    status: "PENDING",
    reviewedBy: null,
    reviewedAt: null,
    createdAt: verifiedAt,
    createdBy: "user",
    updatedAt: verifiedAt,
    updatedBy: "user",
    ...overrides,
  });
  const selected = types.selectCurrentFieldVerifications([
    row("v2", "V2", "2026-01-01T00:00:00.000Z"),
    row("v3", "V3", "2026-01-02T00:00:00.000Z"),
    row("v4", "V4", "2026-01-01T00:00:00.000Z", { currentStage: "HARVEST" }),
    row("rejected", "V4", "2026-02-01T00:00:00.000Z", { status: "REJECTED" }),
  ]);
  assert.deepEqual(selected.map((item) => item.verificationId), ["v4"]);
  assert.equal(selected[0].currentStage, "HARVEST");
  assert.equal(types.isActiveFieldVerification(row("unknown", "V2", "2026-01-01T00:00:00.000Z")), true);
  const coverage = types.calculateAgricultureVerificationCoverage(
    [{ locationId: "township-a", geographyLevel: "TOWNSHIP" }, { locationId: "township-b", geographyLevel: "TOWNSHIP" }, { locationId: "state-a", geographyLevel: "STATE_REGION" }],
    [...selected, row("v2b", "V2", "2026-03-01T00:00:00.000Z", { locationId: "township-b", locationName: "Township B", cropId: "crop-rubber", cropName: "Rubber" })],
    [{ locationId: "township-a", priority: "HIGH", status: "OPEN" }, { locationId: "township-b", priority: "HIGH", status: "OPEN" }, { locationId: "township-a", priority: "HIGH", status: "RESOLVED" }],
  );
  assert.deepEqual(coverage, { verifiedTownships: 2, verifiedCrops: 2, currentVerifiedCount: 1, crossVerifiedCount: 0, localReportedCount: 1, currentStageCount: 1, openHighPriorityGaps: 2 });
});

test("Local field verification write path is additive, V2-stable, and closes only matching gaps", { skip: !localOperationsDatabase() }, async () => {
  const sourceDatabase = localOperationsDatabase();
  const tempRoot = mkdtempSync(path.join(tmpdir(), "kmm-agri-field-verification-"));
  const database = path.join(tempRoot, "operations.sqlite");
  copyFileSync(sourceDatabase, database);
  const schema = await tsImport("../db/schema.ts", import.meta.url);
  const drizzleModule = await import("drizzle-orm/d1");
  const service = await tsImport("../src/modules/agriculture/agriculture.service.ts", import.meta.url);
  const db = drizzleModule.drizzle(drizzleD1Database(database), { schema });
  const before = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS public_rows FROM agri_crop_locations WHERE location_id = 'MM-MON-MUDON' AND crop_id = 'crop-rice';"], { encoding: "utf8" }))[0];
  const result = await service.createAgricultureFieldVerification(db, "test-company", {
    locationId: "MM-MON-MUDON",
    cropId: "crop-rice",
    cropYear: 2026,
    seasonCode: null,
    cropPresence: "YES",
    importance: "UNKNOWN",
    estimatedArea: null,
    areaUnit: null,
    areaQuality: "UNKNOWN",
    plantingStartMonth: null,
    plantingEndMonth: null,
    harvestStartMonth: null,
    harvestEndMonth: null,
    currentStage: null,
    irrigationType: "UNKNOWN",
    mechanizationLevel: "UNKNOWN",
    commonMachines: ["Combine"],
    notes: "Local report",
    verificationMethod: "BRANCH_REPORT",
    verificationLevel: "V2",
    confidenceScore: null,
    evidence: "Branch report",
    sourceId: null,
    verifiedBy: "field-user",
    verifiedRole: "manager",
  });
  assert.equal(result.verificationLevel, "V2");
  assert.deepEqual(result.closedGapTypes, ["CROP_PRESENCE"]);
  const after = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS public_rows FROM agri_crop_locations WHERE location_id = 'MM-MON-MUDON' AND crop_id = 'crop-rice';"], { encoding: "utf8" }))[0];
  assert.deepEqual(after, before);
  const verification = JSON.parse(execFileSync("sqlite3", ["-json", database, `SELECT crop_presence, verification_level, current_stage, common_machines, confidence_score FROM agri_field_verifications WHERE verification_id = '${result.verificationId}';`], { encoding: "utf8" }))[0];
  assert.deepEqual(verification, { crop_presence: "YES", verification_level: "V2", current_stage: null, common_machines: "[\"Combine\"]", confidence_score: 50 });
  const gaps = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT gap_type, status FROM agri_data_gaps WHERE location_id = 'MM-MON-MUDON' AND gap_type IN ('CROP_PRESENCE','PRODUCTION','YIELD','VARIETY','CURRENT_STAGE') ORDER BY gap_type;"], { encoding: "utf8" }));
  assert.deepEqual(gaps, [
    { gap_type: "CROP_PRESENCE", status: "RESOLVED" },
    { gap_type: "CURRENT_STAGE", status: "OPEN" },
    { gap_type: "PRODUCTION", status: "OPEN" },
    { gap_type: "VARIETY", status: "OPEN" },
    { gap_type: "YIELD", status: "OPEN" },
  ]);
  const publicBeforeNo = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT presence_status, source_id FROM agri_crop_locations WHERE location_id = 'MM-MON-MUDON' AND crop_id = 'crop-rice';"], { encoding: "utf8" }))[0];
  await service.createAgricultureFieldVerification(db, "test-company", {
    locationId: "MM-MON-MUDON", cropId: "crop-rice", cropYear: 2026, seasonCode: null, cropPresence: "NO", importance: "UNKNOWN", estimatedArea: null, areaUnit: null, areaQuality: "UNKNOWN", plantingStartMonth: null, plantingEndMonth: null, harvestStartMonth: null, harvestEndMonth: null, currentStage: null, irrigationType: "UNKNOWN", mechanizationLevel: "UNKNOWN", commonMachines: [], notes: "Correction report", verificationMethod: "BRANCH_REPORT", verificationLevel: "V2", confidenceScore: null, evidence: "Correction report", sourceId: null, verifiedBy: "field-user", verifiedRole: "manager",
  });
  const publicAfterNo = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT presence_status, source_id FROM agri_crop_locations WHERE location_id = 'MM-MON-MUDON' AND crop_id = 'crop-rice';"], { encoding: "utf8" }))[0];
  assert.deepEqual(publicAfterNo, publicBeforeNo);
  const opportunityCount = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_opportunities;"], { encoding: "utf8" }))[0];
  assert.equal(opportunityCount.count, 0);
});

test("Agriculture deterministic opportunity engine enforces confidence gates", async () => {
  const engine = await tsImport("../src/modules/agriculture/agriculture.logic.ts", import.meta.url);
  const strong = engine.calculateAgricultureOpportunity({
    cropStageProximity: 100,
    customerContractorFit: 100,
    machineGap: 100,
    cropImportance: 100,
    weatherSuitabilityOrRisk: 100,
    salesBookingHistory: 100,
    confidenceScore: 90,
    stageKnown: true,
  });
  assert.equal(strong.opportunityScore, 100);
  assert.equal(strong.band, "CRITICAL");
  assert.equal(strong.recommendationAllowed, true);

  const unknownStage = engine.calculateAgricultureOpportunity({
    cropStageProximity: 100,
    customerContractorFit: 100,
    machineGap: 100,
    cropImportance: 100,
    weatherSuitabilityOrRisk: 100,
    salesBookingHistory: 100,
    confidenceScore: 90,
    stageKnown: false,
  });
  assert.ok(unknownStage.opportunityScore < 60);
  assert.equal(unknownStage.recommendationAllowed, false);
  assert.ok(unknownStage.reasonCodes.includes("NEEDS_VERIFICATION"));

  const lowConfidence = engine.calculateAgricultureOpportunity({
    cropStageProximity: 100,
    customerContractorFit: 100,
    machineGap: 100,
    cropImportance: 100,
    weatherSuitabilityOrRisk: 100,
    salesBookingHistory: 100,
    confidenceScore: 20,
    stageKnown: true,
  });
  assert.ok(lowConfidence.opportunityScore < 80);
  assert.equal(lowConfidence.recommendationAllowed, false);
});

test("Local Agriculture D1 contains factual Phase 1A.14 seed and preserves safety boundaries", { skip: !localOperationsDatabase() }, () => {
  const database = localOperationsDatabase();
  const rows = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT (SELECT COUNT(*) FROM agri_crops) AS crops, (SELECT COUNT(*) FROM agri_crop_stages) AS crop_stages, (SELECT COUNT(*) FROM agri_locations) AS locations, (SELECT COUNT(*) FROM agri_crop_locations) AS crop_locations, (SELECT COUNT(*) FROM agri_crop_locations WHERE presence_status <> 'UNKNOWN') AS known_presence, (SELECT COUNT(*) FROM agri_crop_locations WHERE presence_status = 'UNKNOWN') AS unknown_presence, (SELECT COUNT(*) FROM agri_sources) AS sources, (SELECT COUNT(*) FROM agri_seasons) AS seasons, (SELECT COUNT(*) FROM agri_crop_statistics) AS statistics, (SELECT COUNT(*) FROM agri_crop_varieties) AS varieties, (SELECT COUNT(*) FROM agri_location_crop_varieties) AS location_varieties, (SELECT COUNT(*) FROM agri_historical_hazards) AS hazards, (SELECT COUNT(*) FROM agri_crop_calendars) AS calendars, (SELECT COUNT(*) FROM agri_calendar_estimates) AS calendar_estimates, (SELECT COUNT(*) FROM agri_field_verifications) AS field_verifications, (SELECT COUNT(*) FROM agri_opportunities) AS opportunities, (SELECT COUNT(*) FROM agri_location_contexts) AS contexts, (SELECT COUNT(*) FROM agri_data_gaps) AS data_gaps;"], { encoding: "utf8" }))[0];
  assert.equal(rows.crops, 14);
  assert.equal(rows.locations, 14);
  assert.equal(rows.crop_locations, 64);
  assert.equal(rows.crop_stages, 65);
  assert.equal(rows.known_presence, 9);
  assert.equal(rows.unknown_presence, 55);
  assert.equal(rows.sources, 28);
  assert.equal(rows.seasons, 8);
  assert.equal(rows.statistics, 220);
  assert.equal(rows.varieties, 5);
  assert.equal(rows.location_varieties, 5);
  assert.equal(rows.hazards, 2);
  assert.equal(rows.calendars, 17);
  assert.equal(rows.calendar_estimates, 0);
  assert.equal(rows.field_verifications, 0);
  assert.equal(rows.opportunities, 0);
  assert.equal(rows.contexts, 10);
  assert.equal(rows.data_gaps, 85);

  const localCropCounts = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT l.canonical_name, COUNT(DISTINCT cl.crop_id) AS active_crops FROM agri_crop_locations cl JOIN agri_locations l ON l.location_id = cl.location_id WHERE cl.presence_status IN ('CONFIRMED_PRESENT', 'PROBABLE') AND cl.evidence_geography = 'TOWNSHIP' GROUP BY l.canonical_name ORDER BY l.canonical_name;"], { encoding: "utf8" }));
  assert.deepEqual(localCropCounts, [
    { canonical_name: "Kyaikmaraw", active_crops: 1 },
    { canonical_name: "Mudon", active_crops: 2 },
    { canonical_name: "Nattalin", active_crops: 4 },
    { canonical_name: "Thanbyuzayat", active_crops: 1 },
  ]);

  const confidenceRows = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT l.canonical_name, ROUND(AVG(CASE cl.confidence_grade WHEN 'V1' THEN 25 WHEN 'V2' THEN 50 WHEN 'V3' THEN 75 WHEN 'V4' THEN 100 ELSE NULL END)) AS confidence_score, COUNT(DISTINCT cl.source_id) AS source_count, COUNT(DISTINCT s.source_id) AS matched_source_count FROM agri_crop_locations cl JOIN agri_locations l ON l.location_id = cl.location_id JOIN agri_sources s ON s.source_id = cl.source_id WHERE cl.presence_status IN ('CONFIRMED_PRESENT', 'PROBABLE') AND cl.evidence_geography = 'TOWNSHIP' AND l.canonical_name IN ('Nattalin', 'Mudon') GROUP BY l.canonical_name ORDER BY l.canonical_name;"], { encoding: "utf8" }));
  assert.deepEqual(confidenceRows, [
    { canonical_name: "Mudon", confidence_score: 25, source_count: 2, matched_source_count: 2 },
    { canonical_name: "Nattalin", confidence_score: 25, source_count: 4, matched_source_count: 4 },
  ]);

  const factualRows = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT l.canonical_name, c.crop_code, cl.presence_status, cl.confidence_grade, cl.evidence_geography, cl.evidence_year, cl.cultivated_area, cl.source_id FROM agri_crop_locations cl JOIN agri_locations l ON l.location_id = cl.location_id JOIN agri_crops c ON c.crop_id = cl.crop_id WHERE cl.presence_status <> 'UNKNOWN' ORDER BY l.canonical_name, c.crop_code;"], { encoding: "utf8" }));
  assert.deepEqual(factualRows.map((row) => `${row.canonical_name}|${row.crop_code}|${row.presence_status}|${row.confidence_grade}|${row.evidence_geography}|${row.evidence_year ?? ""}|${row.cultivated_area ?? ""}|${row.source_id}`).sort(), [
    "Kyaikmaraw|RUBBER|CONFIRMED_PRESENT|V1|TOWNSHIP|2024||source-phase1a14-kyaikmaraw-rubber",
    "Mawlamyine|RUBBER|PROBABLE|V1|REGIONAL|||source-phase1a14-mawlamyine-rubber",
    "Mudon|RICE|CONFIRMED_PRESENT|V1|TOWNSHIP|2024|>75000|source-phase1a14-mudon-rice",
    "Mudon|RUBBER|CONFIRMED_PRESENT|V1|TOWNSHIP|||source-phase1a14-mudon-rubber",
    "Nattalin|GROUNDNUT|CONFIRMED_PRESENT|V1|TOWNSHIP|2024|2730|source-phase1a14-nattalin-groundnut",
    "Nattalin|RICE|CONFIRMED_PRESENT|V1|TOWNSHIP|2025|110262|source-phase1a14-nattalin-rice",
    "Nattalin|SESAME|CONFIRMED_PRESENT|V1|TOWNSHIP|2024|1988|source-phase1a14-nattalin-sesame",
    "Nattalin|SUNFLOWER|CONFIRMED_PRESENT|V1|TOWNSHIP|2024|2814|source-masterpass-nattalin-oilseed",
    "Thanbyuzayat|RUBBER|CONFIRMED_PRESENT|V1|TOWNSHIP|||source-phase1a14-thanbyuzayat-rubber",
  ]);
  const locationRows = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT canonical_name, country_code, state_region_name, district_name, township_name, alternate_names, latitude, longitude, geography_level FROM agri_locations ORDER BY canonical_name;"], { encoding: "utf8" }));
  assert.equal(locationRows.length, 14);
  const townshipLocations = locationRows.filter((row) => row.geography_level === "TOWNSHIP");
  const stateRegionLocations = locationRows.filter((row) => row.geography_level === "STATE_REGION");
  const regionalLocations = locationRows.filter((row) => row.geography_level === "REGIONAL");
  const nationalLocations = locationRows.filter((row) => row.geography_level === "NATIONAL");
  assert.equal(townshipLocations.length, 9);
  assert.ok(townshipLocations.every((row) => row.country_code === "MM" && row.district_name));
  assert.deepEqual(regionalLocations.map((row) => `${row.canonical_name}|${row.country_code}|${row.state_region_name}|${row.geography_level}`), ["Lower Myanmar|MM|Lower Myanmar|REGIONAL"]);
  assert.deepEqual(nationalLocations.map((row) => `${row.canonical_name}|${row.country_code}|${row.geography_level}`), ["Myanmar Union|MM|NATIONAL"]);
  assert.deepEqual(stateRegionLocations.map((row) => `${row.canonical_name}|${row.country_code}|${row.state_region_name}|${row.geography_level}`).sort(), [
    "Bago Region|MM|Bago|STATE_REGION",
    "Kayin State|MM|Kayin|STATE_REGION",
    "Mon State|MM|Mon|STATE_REGION",
  ]);
  const mudonLocation = locationRows.find((row) => row.canonical_name === "Mudon");
  assert.deepEqual({ state_region_name: mudonLocation.state_region_name, district_name: mudonLocation.district_name, township_name: mudonLocation.township_name }, { state_region_name: "Mon", district_name: "Mawlamyine", township_name: "Mudon" });
  const hpaAnLocation = locationRows.find((row) => row.canonical_name === "Hpa-An");
  assert.deepEqual(JSON.parse(hpaAnLocation.alternate_names), ["Hpa An", "Hpa-an", "HPA-AN"]);
  const tharrRaw = locationRows.find((row) => row.canonical_name === "Tharrawaddy");
  assert.deepEqual(JSON.parse(tharrRaw.alternate_names), ["Thayarwady", "Tharyawaddy", "Tharyarwaddy"]);
  assert.equal(townshipLocations.filter((row) => row.latitude === null || row.longitude === null).length, 0);

  const missingProvenance = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_locations WHERE presence_status <> 'UNKNOWN' AND (source_id IS NULL OR confidence_grade = 'UNKNOWN' OR evidence_geography IS NULL);"], { encoding: "utf8" }))[0];
  assert.equal(missingProvenance.count, 0);
  const processingEvidence = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT presence_status, notes FROM agri_crop_locations WHERE location_id = 'MM-MON-THANBYUZAYAT' AND crop_id = 'crop-rubber';"], { encoding: "utf8" }))[0];
  assert.equal(processingEvidence.presence_status, "CONFIRMED_PRESENT");
  assert.match(processingEvidence.notes, /PROCESSING \/ VALUE_CHAIN_EVIDENCE/);
  assert.match(processingEvidence.notes, /Not an acreage survey/);

  const calendarRows = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT l.canonical_name, c.crop_code, cc.stage_code, cc.baseline_start_date, cc.baseline_end_date, cc.calendar_type, cc.verification_level, cc.confidence_score, cc.source_id FROM agri_crop_calendars cc JOIN agri_locations l ON l.location_id = cc.location_id JOIN agri_crops c ON c.crop_id = cc.crop_id WHERE cc.source_geography = 'TOWNSHIP' ORDER BY l.canonical_name, cc.stage_code;"], { encoding: "utf8" }));
  assert.deepEqual(calendarRows.map((row) => `${row.canonical_name}|${row.crop_code}|${row.stage_code}|${row.baseline_start_date ?? ""}|${row.baseline_end_date ?? ""}|${row.verification_level}|${row.confidence_score}|${row.source_id}`), [
    "Mudon|RICE|HARVEST|2024-11|2024-12|V1|25|source-phase1a14-mudon-rice",
    "Nattalin|RICE|SOWING|2025-06||V1|25|source-phase1a14-nattalin-rice",
  ]);
  assert.equal(calendarRows.find((row) => row.canonical_name === "Mudon").calendar_type, "HISTORICAL_OBSERVED");

  const seasonalCalendars = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT l.canonical_name, c.crop_code, s.season_code, cc.stage_code, cc.calendar_type, cc.source_geography, cc.calendar_precision, cc.window_start_month, cc.window_end_month, cc.baseline_start_date, cc.baseline_end_date, cc.valid_from_year, cc.inherited_from_location_id, cc.source_id FROM agri_crop_calendars cc JOIN agri_locations l ON l.location_id = cc.location_id JOIN agri_crops c ON c.crop_id = cc.crop_id LEFT JOIN agri_seasons s ON s.season_id = cc.season_id WHERE cc.source_geography <> 'TOWNSHIP' ORDER BY l.canonical_name, c.crop_code, s.season_code, cc.stage_code;"], { encoding: "utf8" }));
  assert.equal(seasonalCalendars.length, 15);
  assert.equal(seasonalCalendars.filter((row) => row.canonical_name === "Bago Region" && row.crop_code === "RICE" && row.calendar_type === "STATE_REGION_BASELINE").length, 4);
  assert.equal(seasonalCalendars.filter((row) => row.crop_code === "RUBBER" && row.stage_code === "TAPPING").length, 3);
  assert.equal(seasonalCalendars.filter((row) => row.canonical_name === "Lower Myanmar").length, 8);
  assert.deepEqual(Object.fromEntries(["BLACK_GRAM", "GREEN_GRAM", "SESAME"].map((crop) => [crop, seasonalCalendars.filter((row) => row.canonical_name === "Lower Myanmar" && row.crop_code === crop).length])), { BLACK_GRAM: 4, GREEN_GRAM: 2, SESAME: 2 });
  assert.ok(seasonalCalendars.every((row) => row.baseline_start_date === null && row.baseline_end_date === null && ["MONTH", "MONTH_RANGE", "MID_MONTH", "LATE_MONTH", "EARLY_MONTH"].includes(row.calendar_precision) && row.window_start_month >= 1 && row.window_start_month <= 12 && row.window_end_month >= 1 && row.window_end_month <= 12));
  assert.ok(seasonalCalendars.every((row) => row.inherited_from_location_id === null));
  assert.equal(seasonalCalendars.some((row) => row.calendar_type === "CURRENT_OBSERVED"), false);
  const calendarCoverage = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT (SELECT COUNT(DISTINCT cc.location_id) FROM agri_crop_calendars cc JOIN agri_locations l ON l.location_id = cc.location_id WHERE cc.source_geography = 'TOWNSHIP' AND l.geography_level = 'TOWNSHIP') AS township_calendar_locations, (SELECT COUNT(DISTINCT cc.location_id) FROM agri_crop_calendars cc JOIN agri_locations l ON l.location_id = cc.location_id WHERE l.geography_level = 'STATE_REGION' AND cc.calendar_type IN ('STATE_REGION_BASELINE', 'REGIONAL_BASELINE', 'AUTHORITATIVE_BASELINE')) AS state_baseline_locations, (SELECT COUNT(DISTINCT cc.location_id) FROM agri_crop_calendars cc JOIN agri_locations l ON l.location_id = cc.location_id WHERE l.geography_level = 'REGIONAL' AND cc.calendar_type = 'REGIONAL_BASELINE') AS regional_baseline_locations, (SELECT COUNT(DISTINCT cc.location_id) FROM agri_crop_calendars cc JOIN agri_locations l ON l.location_id = cc.location_id WHERE l.geography_level = 'NATIONAL' AND cc.calendar_type IN ('AUTHORITATIVE_BASELINE', 'REGIONAL_BASELINE', 'STATE_REGION_BASELINE')) AS national_baseline_locations, (SELECT COUNT(*) FROM agri_crop_calendars WHERE calendar_type = 'CURRENT_OBSERVED') AS current_observations;"], { encoding: "utf8" }))[0];
  assert.deepEqual(calendarCoverage, { township_calendar_locations: 2, state_baseline_locations: 3, regional_baseline_locations: 1, national_baseline_locations: 0, current_observations: 0 });

  const unknownPilotRows = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_locations cl JOIN agri_locations l ON l.location_id = cl.location_id WHERE l.canonical_name IN ('Hpa-An', 'Kawkareik', 'Myawaddy', 'Tharrawaddy') AND cl.presence_status <> 'UNKNOWN';"], { encoding: "utf8" }))[0];
  assert.equal(unknownPilotRows.count, 0);

  const contextSafety = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT l.canonical_name, c.context_type, c.context_geography, c.context_subject, c.notes FROM agri_location_contexts c JOIN agri_locations l ON l.location_id = c.location_id ORDER BY l.canonical_name, c.context_type, c.context_subject;"], { encoding: "utf8" }));
  assert.equal(contextSafety.length, 10);
  const gyobingaukContext = contextSafety.find((row) => row.context_subject.includes("Gyobingauk"));
  assert.equal(gyobingaukContext.canonical_name, "Tharrawaddy");
  assert.equal(gyobingaukContext.context_type, "NEARBY_TOWNSHIP_REFERENCE");
  assert.equal(gyobingaukContext.context_geography, "DISTRICT");
  assert.match(gyobingaukContext.notes, /not Tharrawaddy Township/);
  const bridgeContext = contextSafety.find((row) => row.context_subject.includes("Kawsue-Kyainsu"));
  assert.equal(bridgeContext.canonical_name, "Kawkareik");
  assert.equal(bridgeContext.context_type, "FARMLAND_CONTEXT");
  assert.match(bridgeContext.notes, /not cultivated crop acreage/);
  const myawaddyTrade = contextSafety.find((row) => row.canonical_name === "Myawaddy" && row.context_type === "TRADE_CONTEXT");
  assert.ok(myawaddyTrade);
  assert.match(myawaddyTrade.notes, /does not change Myawaddy crop presence/);
  const contextSourceLinks = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_locations cl JOIN agri_sources s ON s.source_id = cl.source_id WHERE s.source_id LIKE 'source-gap-%';"], { encoding: "utf8" }))[0];
  assert.equal(contextSourceLinks.count, 0);
  const adminSources = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT source_id, source_type, source_geography, publication_date FROM agri_sources WHERE source_id IN ('source-gap-mimu-thayarwady-2019', 'source-gap-mimu-hpaan-2019', 'source-gap-mimu-kawkareik-2019', 'source-gap-mimu-myawaddy-2019') ORDER BY source_id;"], { encoding: "utf8" }));
  assert.equal(adminSources.length, 4);
  assert.ok(adminSources.every((row) => row.source_type === "HISTORICAL_ADMIN_REFERENCE" && row.source_geography === "TOWNSHIP"));
  assert.ok(adminSources.every((row) => row.publication_date === "2020-08-24"));
  const contextStatistics = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_statistics s JOIN agri_sources src ON src.source_id = s.source_id WHERE src.source_id LIKE 'source-gap-%';"], { encoding: "utf8" }))[0];
  assert.equal(contextStatistics.count, 0);

  const gapRows = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT gap_type, status, COUNT(*) AS count FROM agri_data_gaps GROUP BY gap_type, status ORDER BY gap_type, status;"], { encoding: "utf8" }));
  assert.equal(gapRows.reduce((sum, row) => sum + row.count, 0), 85);
  assert.deepEqual(gapRows.filter((row) => row.gap_type === "COORDINATES"), [{ gap_type: "COORDINATES", status: "RESOLVED", count: 9 }]);
  assert.deepEqual(gapRows.filter((row) => row.gap_type === "WEATHER_MAPPING"), [{ gap_type: "WEATHER_MAPPING", status: "RESOLVED", count: 9 }]);
  assert.equal(gapRows.filter((row) => row.gap_type === "CURRENT_STAGE" && row.status === "OPEN")[0].count, 9);
  const gapKpiSafety = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_statistics s JOIN agri_data_gaps g ON g.location_id = s.location_id AND g.gap_type = 'CULTIVATED_AREA';"], { encoding: "utf8" }))[0];
  assert.equal(gapKpiSafety.count, 7);

  const coverageRows = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT (SELECT COUNT(DISTINCT cl.location_id) FROM agri_crop_locations cl WHERE cl.presence_status IN ('CONFIRMED_PRESENT','PROBABLE') AND cl.evidence_geography = 'TOWNSHIP') AS factual_presence, (SELECT COUNT(DISTINCT s.location_id) FROM agri_crop_statistics s JOIN agri_crop_locations cl ON cl.location_id = s.location_id AND cl.crop_id = s.crop_id WHERE s.record_type = 'ACTUAL' AND s.source_geography = 'TOWNSHIP' AND s.verification_status IN ('V1','V2','V3','V4') AND s.cultivated_area IS NOT NULL AND cl.presence_status IN ('CONFIRMED_PRESENT','PROBABLE') AND cl.evidence_geography = 'TOWNSHIP') AS area_statistics, (SELECT COUNT(DISTINCT cc.location_id) FROM agri_crop_calendars cc WHERE cc.verification_level IN ('V1','V2','V3','V4') AND cc.source_geography = 'TOWNSHIP') AS calendars;"], { encoding: "utf8" }))[0];
  assert.deepEqual(coverageRows, { factual_presence: 4, area_statistics: 2, calendars: 2 });

  const rubberBaseline = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT source_type, source_geography, reference_uri, notes FROM agri_sources WHERE source_id = 'source-phase1a14-rubber-national-regional';"], { encoding: "utf8" }))[0];
  assert.equal(rubberBaseline.source_type, "RESEARCH_BASELINE");
  assert.equal(rubberBaseline.source_geography, "NATIONAL_REGIONAL");
  assert.match(rubberBaseline.notes, /National acreage only/);
  assert.match(rubberBaseline.notes, /current township stage remains UNKNOWN/);
  const rubberCalendars = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_calendars WHERE crop_id = 'crop-rubber';"], { encoding: "utf8" }))[0];
  assert.equal(rubberCalendars.count, 3);

  const cropMaster = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT crop_code, alternate_names FROM agri_crops ORDER BY crop_code;"], { encoding: "utf8" }));
  assert.equal(cropMaster.filter((row) => row.crop_code === "MUNG_BEAN").length, 0);
  const greenGram = cropMaster.find((row) => row.crop_code === "GREEN_GRAM");
  assert.deepEqual(JSON.parse(greenGram.alternate_names), ["Mung bean"]);
  assert.ok(cropMaster.some((row) => row.crop_code === "SUNFLOWER"));

  const statistics = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT l.canonical_name, c.crop_code, s.crop_year, s.cultivated_area, s.record_type, s.value_qualifier, s.source_geography, s.source_id FROM agri_crop_statistics s JOIN agri_locations l ON l.location_id = s.location_id JOIN agri_crops c ON c.crop_id = s.crop_id WHERE s.source_geography = 'TOWNSHIP' ORDER BY l.canonical_name, c.crop_code, s.record_type;"], { encoding: "utf8" }));
  assert.deepEqual(statistics.map((row) => `${row.canonical_name}|${row.crop_code}|${row.crop_year}|${row.cultivated_area}|${row.record_type}|${row.value_qualifier}|${row.source_geography}|${row.source_id}`), [
    "Mudon|RICE|2024|75000|ACTUAL|MORE_THAN|TOWNSHIP|source-phase1a14-mudon-rice",
    "Mudon|RICE|2024|1000|TARGET|EXACT|TOWNSHIP|source-masterpass-mudon-summer-paddy-target",
    "Mudon|SUNFLOWER|2024|1500|TARGET|EXACT|TOWNSHIP|source-masterpass-mudon-sunflower-target",
    "Nattalin|GROUNDNUT|2024|2730|ACTUAL|EXACT|TOWNSHIP|source-phase1a14-nattalin-groundnut",
    "Nattalin|RICE|2025|110262|PLAN|EXACT|TOWNSHIP|source-phase1a14-nattalin-rice",
    "Nattalin|SESAME|2024|1988|ACTUAL|EXACT|TOWNSHIP|source-phase1a14-nattalin-sesame",
    "Nattalin|SUNFLOWER|2024|2814|ACTUAL|EXACT|TOWNSHIP|source-masterpass-nattalin-oilseed",
  ]);
  const stateStatistics = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT l.canonical_name, c.crop_code, s.crop_year, s.sown_area, s.sown_area_unit, s.harvested_area, s.harvested_area_unit, s.production, s.production_unit, s.yield, s.yield_unit, s.source_id, s.source_table, s.source_crop_name, s.source_geography, s.geography_level, s.source_year, s.record_type, s.verification_status, s.confidence_score FROM agri_crop_statistics s JOIN agri_locations l ON l.location_id = s.location_id JOIN agri_crops c ON c.crop_id = s.crop_id WHERE s.source_geography = 'STATE_REGION' AND ((l.canonical_name = 'Bago Region' AND c.crop_code = 'RICE') OR (l.canonical_name = 'Mon State' AND c.crop_code = 'RUBBER') OR (l.canonical_name = 'Kayin State' AND c.crop_code = 'MAIZE')) AND s.crop_year = 2023 ORDER BY l.canonical_name;"], { encoding: "utf8" }));
  assert.deepEqual(stateStatistics, [
    { canonical_name: "Bago Region", crop_code: "RICE", crop_year: 2023, sown_area: 3123616, sown_area_unit: "Acre", harvested_area: 3116760, harvested_area_unit: "Acre", production: 5925421, production_unit: "Ton", yield: null, yield_unit: null, source_id: "source-cso-msyb-2024-agri-9-12", source_table: "9.12", source_crop_name: "Paddy", source_geography: "STATE_REGION", geography_level: "STATE_REGION", source_year: 2024, record_type: "ACTUAL", verification_status: "V4", confidence_score: 100 },
    { canonical_name: "Kayin State", crop_code: "MAIZE", crop_year: 2023, sown_area: 52334, sown_area_unit: "Acre", harvested_area: 52334, harvested_area_unit: "Acre", production: 114074, production_unit: "Ton", yield: null, yield_unit: null, source_id: "source-cso-msyb-2024-agri-9-12", source_table: "9.12", source_crop_name: "Maize", source_geography: "STATE_REGION", geography_level: "STATE_REGION", source_year: 2024, record_type: "ACTUAL", verification_status: "V4", confidence_score: 100 },
    { canonical_name: "Mon State", crop_code: "RUBBER", crop_year: 2023, sown_area: 506444, sown_area_unit: "Acre", harvested_area: 362225, harvested_area_unit: "Acre", production: 120554, production_unit: "Ton", yield: null, yield_unit: null, source_id: "source-cso-msyb-2024-agri-9-12", source_table: "9.12", source_crop_name: "Rubber", source_geography: "STATE_REGION", geography_level: "STATE_REGION", source_year: 2024, record_type: "ACTUAL", verification_status: "V4", confidence_score: 100 },
  ]);
  const stateCoverage = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT l.canonical_name, COUNT(*) AS records, COUNT(DISTINCT c.crop_code) AS crops, MIN(s.crop_year) AS first_year, MAX(s.crop_year) AS last_year, SUM(s.sown_area IS NOT NULL) AS sown_records, SUM(s.harvested_area IS NOT NULL) AS harvested_records, SUM(s.production IS NOT NULL) AS production_records, SUM(s.yield IS NOT NULL) AS yield_records FROM agri_crop_statistics s JOIN agri_locations l ON l.location_id = s.location_id JOIN agri_crops c ON c.crop_id = s.crop_id WHERE s.source_geography = 'STATE_REGION' GROUP BY l.canonical_name ORDER BY l.canonical_name;"], { encoding: "utf8" }));
  assert.deepEqual(stateCoverage, [
    { canonical_name: "Bago Region", records: 60, crops: 12, first_year: 2019, last_year: 2023, sown_records: 60, harvested_records: 60, production_records: 50, yield_records: 0 },
    { canonical_name: "Kayin State", records: 55, crops: 11, first_year: 2019, last_year: 2023, sown_records: 55, harvested_records: 55, production_records: 45, yield_records: 0 },
    { canonical_name: "Mon State", records: 53, crops: 11, first_year: 2019, last_year: 2023, sown_records: 53, harvested_records: 53, production_records: 43, yield_records: 0 },
  ]);
  const duplicateStateKeys = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM (SELECT location_id, crop_id, crop_year, source_geography, COUNT(*) AS records FROM agri_crop_statistics WHERE source_geography = 'STATE_REGION' GROUP BY location_id, crop_id, crop_year, source_geography HAVING records > 1);"], { encoding: "utf8" }))[0];
  assert.equal(duplicateStateKeys.count, 0);
  const stateYieldCount = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_statistics WHERE source_geography = 'STATE_REGION' AND yield IS NOT NULL;"], { encoding: "utf8" }))[0];
  assert.equal(stateYieldCount.count, 0);
  const unionYieldRows = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT s.statistic_id, c.crop_code, s.crop_year, s.season_code, s.yield, s.yield_unit, s.source_table, s.source_crop_name, s.source_geography, s.geography_level, s.record_type, s.verification_status, s.confidence_score FROM agri_crop_statistics s JOIN agri_crops c ON c.crop_id = s.crop_id WHERE s.source_geography = 'NATIONAL' AND s.geography_level = 'NATIONAL' AND s.record_type = 'ACTUAL_OFFICIAL' ORDER BY c.crop_code, s.crop_year, s.season_code;"], { encoding: "utf8" }));
  assert.equal(unionYieldRows.length, 45);
  assert.ok(unionYieldRows.every((row) => row.source_table === "9.15" && row.source_crop_name && row.yield !== null && row.yield_unit && row.verification_status === "V4" && row.confidence_score === 100));
  assert.deepEqual(Object.fromEntries(["BLACK_GRAM", "GREEN_GRAM", "GROUNDNUT", "MAIZE", "RICE", "RUBBER", "SESAME"].map((crop) => [crop, unionYieldRows.filter((row) => row.crop_code === crop).length])), { BLACK_GRAM: 5, GREEN_GRAM: 5, GROUNDNUT: 10, MAIZE: 5, RICE: 5, RUBBER: 5, SESAME: 10 });
  assert.deepEqual(Object.fromEntries(["RAIN", "WINTER", "EARLY", "LATE"].map((subtype) => [subtype, unionYieldRows.filter((row) => row.season_code === subtype).length])), { RAIN: 5, WINTER: 5, EARLY: 5, LATE: 5 });
  assert.deepEqual(new Set(unionYieldRows.map((row) => row.yield_unit)), new Set(["46lb(basket)", "55lb(basket)", "25lb(basket)", "54lb(basket)", "lb", "72lb(basket)"]));
  const duplicateYieldKeys = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM (SELECT location_id, crop_id, crop_year, COALESCE(season_code, '') AS season_code, source_geography, COUNT(*) AS records FROM agri_crop_statistics WHERE yield IS NOT NULL GROUP BY location_id, crop_id, crop_year, COALESCE(season_code, ''), source_geography HAVING records > 1);"], { encoding: "utf8" }))[0];
  assert.equal(duplicateYieldKeys.count, 0);
  const nonOfficialYield = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_statistics WHERE yield IS NOT NULL AND (source_geography <> 'NATIONAL' OR geography_level <> 'NATIONAL' OR record_type <> 'ACTUAL_OFFICIAL');"], { encoding: "utf8" }))[0];
  assert.equal(nonOfficialYield.count, 0);
  const townshipYieldCount = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_statistics WHERE source_geography = 'TOWNSHIP' AND yield IS NOT NULL;"], { encoding: "utf8" }))[0];
  assert.equal(townshipYieldCount.count, 0);
  const stateCultivatedAreaCount = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_statistics WHERE source_geography = 'STATE_REGION' AND cultivated_area IS NOT NULL;"], { encoding: "utf8" }))[0];
  assert.equal(stateCultivatedAreaCount.count, 0);
  const semanticAreaDifference = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_statistics WHERE source_geography = 'STATE_REGION' AND sown_area <> harvested_area;"], { encoding: "utf8" }))[0];
  assert.ok(semanticAreaDifference.count > 0);
  const nonStateSourceForStateRecord = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_statistics s JOIN agri_sources src ON src.source_id = s.source_id WHERE s.geography_level = 'STATE_REGION' AND src.source_geography <> 'STATE_REGION';"], { encoding: "utf8" }))[0];
  assert.equal(nonStateSourceForStateRecord.count, 0);
  const stateInTownshipKpi = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_statistics s JOIN agri_locations l ON l.location_id = s.location_id WHERE s.source_geography = 'STATE_REGION' AND s.record_type = 'ACTUAL' AND s.verification_status IN ('V1','V2','V3','V4') AND l.geography_level = 'TOWNSHIP';"], { encoding: "utf8" }))[0];
  assert.equal(stateInTownshipKpi.count, 0);
  const currentStageCount = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_weather_state;"], { encoding: "utf8" }))[0];
  assert.equal(currentStageCount.count, 0);
  const actualArea = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT l.canonical_name, SUM(s.cultivated_area) AS area, MAX(s.value_qualifier = 'MORE_THAN') AS has_lower_bound FROM agri_crop_statistics s JOIN agri_locations l ON l.location_id = s.location_id JOIN agri_crop_locations cl ON cl.location_id = s.location_id AND cl.crop_id = s.crop_id WHERE s.record_type = 'ACTUAL' AND s.source_geography = 'TOWNSHIP' AND s.verification_status IN ('V1','V2','V3','V4') AND cl.presence_status IN ('CONFIRMED_PRESENT','PROBABLE') AND cl.evidence_geography = 'TOWNSHIP' GROUP BY l.canonical_name ORDER BY l.canonical_name;"], { encoding: "utf8" }));
  assert.deepEqual(actualArea, [
    { canonical_name: "Mudon", area: 75000, has_lower_bound: 1 },
    { canonical_name: "Nattalin", area: 7532, has_lower_bound: 0 },
  ]);
  const targetLeakage = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_statistics WHERE record_type = 'TARGET' AND cultivated_area IN (1000, 1500);"], { encoding: "utf8" }))[0];
  assert.equal(targetLeakage.count, 2);
  const missingProduction = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT COUNT(*) AS count FROM agri_crop_statistics WHERE source_geography = 'TOWNSHIP' AND (production IS NOT NULL OR yield IS NOT NULL);"], { encoding: "utf8" }))[0];
  assert.equal(missingProduction.count, 0);

  const varietyRows = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT v.canonical_name, l.canonical_name AS location_name, lv.verification_status, lv.evidence_year FROM agri_location_crop_varieties lv JOIN agri_crop_varieties v ON v.variety_id = lv.variety_id JOIN agri_locations l ON l.location_id = lv.location_id ORDER BY v.canonical_name;"], { encoding: "utf8" }));
  assert.deepEqual(varietyRows.map((row) => `${row.location_name}|${row.canonical_name}|${row.verification_status}|${row.evidence_year}`), [
    "Nattalin|Hmawbi-3|RESEARCH_BASELINE|2025",
    "Nattalin|Sinthukha|RESEARCH_BASELINE|2025",
    "Nattalin|Thaihnankauk|RESEARCH_BASELINE|2025",
    "Nattalin|Vietnam|RESEARCH_BASELINE|2025",
    "Nattalin|Yadanartoe|RESEARCH_BASELINE|2025",
  ]);
  const hazards = JSON.parse(execFileSync("sqlite3", ["-json", database, "SELECT l.canonical_name, h.hazard_type, h.event_year, h.verification_status FROM agri_historical_hazards h JOIN agri_locations l ON l.location_id = h.location_id ORDER BY l.canonical_name;"], { encoding: "utf8" }));
  assert.deepEqual(hazards, [
    { canonical_name: "Hpa-An", hazard_type: "FLOOD", event_year: 2023, verification_status: "V1" },
    { canonical_name: "Kawkareik", hazard_type: "FLOOD", event_year: 2019, verification_status: "V1" },
  ]);
});

test("KAI Agriculture intents fail closed when local facts are unavailable", { skip: !localOperationsDatabase() }, async () => {
  const runtime = await tsImport("../lib/kai/runtime-query.ts", import.meta.url);
  const database = localOperationsDatabase();
  const context = { companyId: "kmm-company", timeZone: "Asia/Yangon", now: new Date("2026-08-14T00:00:00.000Z"), branches: [] };
  const top = await runtime.executeKaiRuntimeQuery(runtimeDatabase(database), "Top Agriculture opportunities", context);
  assert.equal(top.intent, "AGRI_TOP_OPPORTUNITIES");
  assert.match(top.response.text, /No verified Agriculture opportunity/);
  const harvest = await runtime.executeKaiRuntimeQuery(runtimeDatabase(database), "Nattalin เก็บเกี่ยววันที่เท่าไร", context);
  assert.equal(harvest.intent, "AGRI_CALENDAR");
  assert.match(harvest.response.text, /No verified Agriculture calendar/);
  assert.match(harvest.response.text, /Exact township dates/);
});

test("Agriculture API and UI preserve authorization and no-sample-data boundaries", () => {
  const api = read("app/api/agriculture/[resource]/route.ts");
  assert.ok(api.indexOf("requireCompanyContext") < api.indexOf("getOperationsDb"));
  assert.match(api, /permission: "view"/);
  assert.match(api, /permission: "edit"/);
  assert.match(api, /createAgricultureFieldVerification/);
  assert.match(api, /reviewAgricultureFieldVerification/);
  assert.match(api, /resource !== "verifications"/);
  assert.match(api, /resource === "state"/);
  const route = read("app/weather/page.tsx");
  assert.match(route, /WeatherPage/);
  assert.match(route, /WeatherAgriculturePage/);
  const page = read("src/modules/agriculture/WeatherAgriculturePage.tsx");
  const fieldVerification = read("src/modules/agriculture/AgricultureFieldVerification.tsx");
  const ui = read("src/modules/agriculture/agriculture.ui.ts");
  assert.match(page, /Overview/);
  assert.match(page, /Weather/);
  assert.match(page, /Agriculture/);
  assert.match(page, /Calendar/);
  // Sales Opportunity tab is hidden until the feature is developed (component and routes remain).
  assert.doesNotMatch(page, /Opportunities/);
  assert.match(ui, /currentCropStage/);
  assert.match(ui, /weatherImpact/);
  assert.match(ui, /noTownshipStats/);
  assert.match(ui, /stateRegionBackbone/);
  assert.match(ui, /stateRegionActual/);
  assert.match(ui, /sownAreaTrend/);
  assert.match(ui, /harvestedAreaTrend/);
  assert.match(ui, /productionTrend/);
  assert.match(page, /AgricultureFieldVerification/);
  assert.match(fieldVerification, /quickVerify/);
  assert.match(ui, /V2 submissions are not auto-promoted/);
  assert.match(ui, /currentStageLocalOnly/);
  assert.match(ui, /cropMixByArea/);
  assert.match(ui, /stateRegionComparison/);
  assert.match(ui, /areaVsProduction/);
  assert.match(ui, /yieldTrend/);
  assert.match(ui, /selectedHistoricalTrend/);
  assert.match(page, /agri-year-from-filter/);
  assert.match(page, /agri-trend-metric-filter/);
  assert.match(ui, /stateRegion/);
  assert.match(page, /geographyScope/);
  assert.match(ui, /historicalRegionalContext/);
  assert.match(ui, /openDataGaps/);
  const overview = read("src/modules/agriculture/AgricultureOverview.tsx");
  const calendar = read("src/modules/agriculture/agriculture.calendar.ts");
  const service = read("src/modules/agriculture/agriculture.service.ts");
  assert.match(ui, /cultivatedArea/);
  assert.match(ui, /production/);
  assert.match(ui, /harvestSeason/);
  assert.match(overview, /eligiblePresenceKeys/);
  assert.doesNotMatch(overview, /Machine Opportunities/);
  assert.match(calendar, /Historical \$\{geography\} Baseline/);
  assert.match(calendar, /Harvest Window/);
  assert.match(calendar, /Current estimate: No Data · Needs Verification/);
  assert.match(service, /agricultureLocationId/);
  assert.match(service, /countryName/);
  assert.match(service, /agriCropStatistics/);
  assert.match(service, /isEligibleActualStatistic/);
  assert.match(service, /recordType/);
  assert.match(service, /valueQualifier/);
  assert.match(service, /agriLocationContexts/);
  assert.match(service, /agriDataGaps/);
  assert.match(service, /calculateAgricultureCoverage/);
  assert.match(service, /calculateAgricultureCalendarCoverage/);
  assert.match(service, /calculateStateRegionCoverage/);
  assert.match(service, /buildInheritedCalendarRows/);
  assert.match(service, /listAgricultureHistoricalTrend/);
  assert.match(service, /sourceTable/);
  assert.match(page, /eligiblePresenceKeys/);
  assert.match(ui, /pausedMessage/);
  for (const sample of ["12,842", "2,156", "368", "87%", "Score 92"]) assert.doesNotMatch(`${page}\n${overview}`, new RegExp(sample.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const kaiFallback = read("lib/kai/tools/kmm-business.ts");
  assert.match(kaiFallback, /AGRICULTURE_REQUEST/);
  assert.match(api, /resource === "trends"/);
  assert.match(api, /fromYear/);
  assert.match(api, /HARVESTED_AREA/);
});
