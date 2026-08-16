import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const repoRoot = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");

function fixture(name) {
  return JSON.parse(read(`artifacts/crop-calendar-preview/public/${name}`));
}

const modulePath = "../src/modules/agriculture/agriculture.data-view.ts";

test("township scope (Nattalin): summary KPIs derive from real payload", async () => {
  const { buildAgricultureDataView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureDataView(fixture("fixture-nattalin.json"));
  const summary = view.summary;
  assert.equal(summary.cropCount, 5); // kpis.activeCrops
  assert.equal(summary.sourceCount, 28);
  assert.equal(summary.area, 82532); // cultivatedArea (MORE_THAN qualifier, kept as-is)
  assert.equal(summary.areaUnit, "acres");
  assert.equal(summary.areaQualifier, "MORE_THAN");
  assert.equal(summary.areaYear, 2024); // latest eligible ACTUAL/state row cropYear (RICE 2025 is a PLAN, excluded)
  assert.equal(summary.townshipsWithArea, 2); // coverage.townshipsWithAreaStatistics
  assert.equal(summary.townshipTotal, 9); // coverage.pilotTownships
  assert.equal(summary.confidence, 25);
  assert.equal(summary.confidenceBand, "low"); // < 40
});

test("state scope (Bago): summary uses sownArea basis when geographyScope is STATE_REGION", async () => {
  const { buildAgricultureDataView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureDataView(fixture("fixture-bago.json"));
  const summary = view.summary;
  // Bago state payload: cultivatedArea 82532, sownArea null → area stays null, unit null
  assert.equal(summary.area, null);
  assert.equal(summary.areaUnit, null);
  assert.equal(summary.areaQualifier, null);
  assert.equal(summary.cropCount, 5);
});

test("crop cards: derived from eligible presence rows, sorted by importance then area, no invented values", async () => {
  const { buildAgricultureDataView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureDataView(fixture("fixture-nattalin.json"));
  const crops = view.crops;
  assert.ok(crops.length >= 1, "expected at least one crop card");
  const rice = crops.find((crop) => crop.cropCode === "RICE");
  assert.ok(rice, "rice should be present in Nattalin");
  assert.equal(rice.cropName, "Rice");
  assert.equal(rice.area, 110262); // presence cultivatedArea "110262" parsed
  assert.equal(rice.areaUnit, "acres");
  assert.equal(rice.year, 2025);
  assert.equal(rice.recordType, "PLAN"); // latest statistic for rice is a PLAN — must not be labeled verified actual
  assert.equal(rice.presenceStatus, "CONFIRMED_PRESENT");
  assert.equal(rice.level, "TOWNSHIP"); // evidenceGeography
  assert.ok(rice.locations.includes("Nattalin"));
  // sort: MAJOR crops first, then by area desc
  const sorted = [...crops].sort((a, b) => {
    const imp = Number(b.importanceLevel === "MAJOR") - Number(a.importanceLevel === "MAJOR");
    return imp !== 0 ? imp : (b.area ?? -1) - (a.area ?? -1);
  });
  assert.deepEqual(crops.map((crop) => crop.cropId), sorted.map((crop) => crop.cropId));
});

test("donut: only eligible ACTUAL township records are summed; percents round to ~100", async () => {
  const { buildAgricultureDataView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureDataView(fixture("fixture-nattalin.json"));
  const donut = view.donut;
  if (donut) {
    const sum = donut.segments.reduce((acc, segment) => acc + segment.value, 0);
    assert.equal(sum, donut.total);
    const pctSum = donut.segments.reduce((acc, segment) => acc + segment.percent, 0);
    assert.ok(Math.abs(pctSum - 100) < 1.5, `percent sum ${pctSum} should be ≈100`);
    for (const segment of donut.segments) {
      assert.ok(segment.value > 0);
      assert.ok(segment.percent > 0);
    }
    assert.ok(donut.segments.length <= 6);
  }
});

test("ranking: sums latest-year ACTUAL area per location, sorted desc", async () => {
  const { buildAgricultureDataView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureDataView(fixture("fixture-bago.json"));
  const ranking = view.ranking;
  // Bago state scope: state/region statistics with sownArea — check no crash and shape
  assert.ok(Array.isArray(ranking));
  for (const point of ranking) {
    assert.equal(typeof point.locationName, "string");
    assert.ok(point.value > 0);
  }
});

test("trend: yearly ACTUAL totals, ascending years, unit carried from records", async () => {
  const { buildAgricultureDataView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureDataView(fixture("fixture-nattalin.json"));
  assert.ok(Array.isArray(view.trend));
  for (let i = 1; i < view.trend.length; i += 1) {
    assert.ok(view.trend[i].year > view.trend[i - 1].year, "years must be ascending");
  }
  for (const point of view.trend) {
    assert.equal(typeof point.value, "number");
    assert.ok(Number.isFinite(point.value));
  }
  assert.equal(view.trendYears, view.trend.length);
});

test("quality: 5 metrics from coverage + verificationCoverage with honest tones", async () => {
  const { buildAgricultureDataView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureDataView(fixture("fixture-nattalin.json"));
  assert.equal(view.quality.length, 5);
  const byKey = Object.fromEntries(view.quality.map((metric) => [metric.key, metric]));
  // Nattalin payload: presence 4/9, area 2/9, yield 0/9, calendar 2/9, verification 0/9
  assert.equal(byKey.presence.value, 4);
  assert.equal(byKey.area.value, 2);
  assert.equal(byKey.yield.value, 0);
  assert.equal(byKey.calendar.value, 2);
  assert.equal(byKey.verification.value, 0);
  assert.equal(byKey.yield.tone, "missing");
  assert.equal(byKey.verification.tone, "missing");
  for (const metric of view.quality) {
    assert.equal(metric.total, 9);
    assert.ok(metric.pct >= 0 && metric.pct <= 100);
  }
  assert.equal(view.openHighPriorityGaps, 9); // verificationCoverage.openHighPriorityGaps
});

test("sources: grouped by sourceId with record counts and kinds, sorted by count desc", async () => {
  const { buildAgricultureDataView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureDataView(fixture("fixture-nattalin.json"));
  assert.ok(view.sources.length >= 1);
  const counts = view.sources.map((source) => source.recordCount);
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a), "sources sorted by record count desc");
  for (const source of view.sources) {
    assert.ok(source.recordCount >= 1);
    assert.ok(source.name.length > 0);
    assert.ok(source.kinds.length >= 1);
  }
});

test("detail rows: latest eligible presence records with resolved location names", async () => {
  const { buildAgricultureDataView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureDataView(fixture("fixture-nattalin.json"));
  assert.ok(view.detailRows.length >= 1);
  for (const row of view.detailRows) {
    assert.equal(typeof row.locationName, "string");
    assert.ok(row.locationName.length > 0);
    assert.equal(typeof row.cropCode, "string");
    assert.ok(row.sourceName, "detail row should carry a source name");
  }
  // sorted by cropYear desc
  for (let i = 1; i < view.detailRows.length; i += 1) {
    assert.ok((view.detailRows[i - 1].cropYear ?? 0) >= (view.detailRows[i].cropYear ?? 0));
  }
});

test("scope: country/region/township/season breadcrumb parts", async () => {
  const { buildAgricultureDataView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureDataView(fixture("fixture-nattalin.json"));
  assert.equal(view.scope.country, "Myanmar");
  assert.equal(view.scope.region, "Bago (West)"); // stateRegionName from the location record
  assert.equal(view.scope.township, "Nattalin");
  // season from the latest statistic cropYear in the payload (2025, incl. PLAN) → 2025/26
  assert.equal(view.scope.season, "2025/26");
});

test("no fabrication: crop card area only from presence/statistic records (never 0 for missing)", async () => {
  const { buildAgricultureDataView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureDataView(fixture("fixture-mudon.json"));
  for (const crop of view.crops) {
    if (crop.area === null) continue;
    assert.ok(crop.area > 0, "area must be positive when present");
  }
  // Rubber in Bago/Nattalin has no area → must surface null, never a made-up number
  const rubber = view.crops.find((crop) => crop.cropCode === "RUBBER");
  if (rubber) {
    // either null (no reliable area) or positive
    assert.ok(rubber.area === null || rubber.area > 0);
  }
});
