import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const repoRoot = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");
const fixture = (name) => JSON.parse(read(`artifacts/crop-calendar-preview/public/${name}`));

const modulePath = "../src/modules/agriculture/agriculture.overview-view.ts";

test("ALL scope: summary KPIs derive from real payload", async () => {
  const { buildAgricultureOverviewView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureOverviewView(fixture("fixture-all.json"), null);
  const summary = view.summary;
  assert.equal(summary.cropCount, 5);
  assert.equal(summary.area, 82532);
  assert.equal(summary.areaUnit, "acres");
  assert.equal(summary.areaQualifier, "MORE_THAN");
  assert.equal(summary.areaYear, 2024); // latest ACTUAL (RICE 2025 is PLAN)
  assert.equal(summary.townshipsWithArea, 2);
  assert.equal(summary.townshipTotal, 9);
  assert.equal(summary.confidence, 25);
  assert.equal(summary.confidenceBand, "low");
});

test("township points: canonical bridge resolves to map polygon ids where master exists", async () => {
  const { buildAgricultureOverviewView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureOverviewView(fixture("fixture-all.json"), null);
  assert.equal(view.townships.length, 9);
  const nattalin = view.townships.find((point) => point.locationId === "MM-BGO-NATTALIN");
  assert.ok(nattalin);
  assert.equal(nattalin.canonicalId, "mmr-bago-west-nattalin");
  assert.equal(nattalin.name, "Nattalin");
  // density = ACTUAL only (no PLAN 110,262 rice): 2814 sunflower + 2730 groundnut + 1988 sesame
  assert.equal(nattalin.density, 7532);
  assert.equal(nattalin.densityBand, "medium");
  assert.equal(nattalin.mainCropCode, "RICE"); // presence importance-ranked
  // Tharrawaddy is NOT in the township master → canonicalId null (honest no-data, never invented)
  const tharrawaddy = view.townships.find((point) => point.locationId === "MM-BGO-THARRAWADDY");
  assert.ok(tharrawaddy);
  assert.equal(tharrawaddy.canonicalId, null);
});

test("ranking: ACTUAL township area only, sorted desc, MORE_THAN qualifier preserved", async () => {
  const { buildAgricultureOverviewView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureOverviewView(fixture("fixture-all.json"), null);
  assert.equal(view.ranking.length, 2); // Mudon + Nattalin have ACTUAL area
  const [first, second] = view.ranking;
  assert.equal(first.name, "Mudon");
  assert.equal(first.area, 75000);
  assert.equal(first.areaQualifier, "MORE_THAN");
  assert.equal(second.name, "Nattalin");
  assert.equal(second.area, 7532);
  assert.ok(first.area > second.area);
});

test("crop mix: scope-level ACTUAL mix sums to 100% with honest MORE_THAN flag", async () => {
  const { buildAgricultureOverviewView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureOverviewView(fixture("fixture-all.json"), null);
  assert.ok(view.cropMix);
  const total = view.cropMix.reduce((sum, slice) => sum + slice.area, 0);
  assert.equal(total, 82532);
  const pctSum = view.cropMix.reduce((sum, slice) => sum + slice.percent, 0);
  assert.ok(Math.abs(pctSum - 100) < 1.5, `percent sum ${pctSum}`);
  const rice = view.cropMix.find((slice) => slice.cropCode === "RICE");
  assert.ok(rice);
  assert.equal(rice.moreThan, true);
  assert.equal(rice.percent, 90.9);
});

test("selected township: crop mix is per-location (not scope-level)", async () => {
  const { buildAgricultureOverviewView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureOverviewView(fixture("fixture-all.json"), "MM-BGO-NATTALIN");
  assert.ok(view.selectedPoint);
  assert.equal(view.selectedPoint.locationId, "MM-BGO-NATTALIN");
  const mix = view.selectedPoint.cropMix;
  assert.ok(mix);
  // Nattalin ACTUAL mix: sunflower 2814 + groundnut 2730 + sesame 1988 — NO rice (rice is PLAN)
  assert.deepEqual(mix.map((slice) => slice.cropCode), ["SUNFLOWER", "GROUNDNUT", "SESAME"]);
  const pctSum = mix.reduce((sum, slice) => sum + slice.percent, 0);
  assert.ok(Math.abs(pctSum - 100) < 1.5);
});

test("weather risk & opportunity layers: honest empty when no data exists", async () => {
  const { buildAgricultureOverviewView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureOverviewView(fixture("fixture-all.json"), null);
  assert.equal(view.hasOpportunityData, false); // opportunities=0 in D1
  assert.equal(view.hasWeatherRiskData, false); // weatherState has no riskType
  // historical hazards still surface per township (flood) — as historical, not current
  assert.deepEqual(view.hazardLocations.sort(), ["MM-KYN-HPAAN", "MM-KYN-KAWKAREIK"].sort());
  const hpaAn = view.townships.find((point) => point.locationId === "MM-KYN-HPAAN");
  assert.ok(hpaAn);
  assert.equal(hpaAn.floodRisk, true);
  assert.equal(hpaAn.hazardCount, 1);
});

test("quality: six honest metrics from coverage with tone mapping", async () => {
  const { buildAgricultureOverviewView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureOverviewView(fixture("fixture-all.json"), null);
  assert.equal(view.quality.length, 6);
  const byKey = Object.fromEntries(view.quality.map((metric) => [metric.key, metric]));
  assert.equal(byKey.presence.value, 4);
  assert.equal(byKey.area.value, 2);
  assert.equal(byKey.yield.value, 0);
  assert.equal(byKey.calendar.value, 2);
  assert.equal(byKey.weather.value, 0);
  assert.equal(byKey.verification.value, 0);
  assert.equal(byKey.presence.tone, "partial");
  assert.equal(byKey.yield.tone, "missing");
  assert.equal(view.openGaps, 9);
});

test("scope breadcrumb: country/region/township/season parts", async () => {
  const { buildAgricultureOverviewView } = await tsImport(modulePath, import.meta.url);
  const all = buildAgricultureOverviewView(fixture("fixture-all.json"), null);
  assert.equal(all.scope.country, "Myanmar");
  assert.equal(all.scope.region, null);
  assert.equal(all.scope.township, null);
  assert.equal(all.scope.season, "2025/26");

  const nattalin = buildAgricultureOverviewView(fixture("fixture-nattalin.json"), null);
  assert.equal(nattalin.scope.region, "Bago (West)");
  assert.equal(nattalin.scope.township, "Nattalin");
  assert.equal(nattalin.scope.season, "2025/26");
});

test("state scope (Bago): no township points, honest empty areas", async () => {
  const { buildAgricultureOverviewView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureOverviewView(fixture("fixture-bago.json"), null);
  assert.equal(view.townships.length, 0); // locations hold only state/region level
  assert.equal(view.ranking.length, 0);
  assert.equal(view.cropMix, null);
  assert.equal(view.summary.areaYear, null);
});

test("no fabrication guard: areas come from records only (never defaulted to 0)", async () => {
  const { buildAgricultureOverviewView } = await tsImport(modulePath, import.meta.url);
  const view = buildAgricultureOverviewView(fixture("fixture-all.json"), null);
  for (const point of view.townships) {
    if (point.density === null) {
      assert.equal(point.densityBand, "none");
    } else {
      assert.ok(point.density > 0);
      assert.notEqual(point.densityBand, "none");
    }
  }
  for (const row of view.ranking) {
    assert.ok(row.area > 0);
  }
});
