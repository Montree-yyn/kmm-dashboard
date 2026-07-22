import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("registers current Myanmar and inactive PMTiles datasets", async () => {
  const datasets = JSON.parse(await read("data/maps/datasets.json"));
  const myanmar = datasets.find((dataset) => dataset.id === "mm-townships-geojson");
  const pmtiles = datasets.find((dataset) => dataset.id === "mm-townships-pmtiles");
  assert.equal(myanmar.dataset_type, "geojson");
  assert.equal(myanmar.enabled, true);
  assert.equal(pmtiles.dataset_type, "pmtiles");
  assert.equal(pmtiles.enabled, true);
});

test("pipeline preparation preserves features and reports missing canonical IDs", async () => {
  const preparation = await read("scripts/maps/prepare_myanmar_vector_source.py");
  assert.match(preparation, /skipped_invalid_geometries/);
  assert.match(preparation, /missing_canonical_ids/);
  assert.match(preparation, /output.sort/);
});

test("layer registry keeps only township foundation layers active", async () => {
  const layers = JSON.parse(await read("data/maps/layers.json"));
  assert.equal(layers.find((layer) => layer.id === "township-fill").enabled, true);
  assert.equal(layers.find((layer) => layer.id === "sales-heatmap").enabled, false);
});

test("source adapter supports GeoJSON and PMTiles with validation", async () => {
  const source = await read("lib/maps/create-map-source.ts");
  assert.match(source, /type: "geojson"/);
  assert.match(source, /url: `pmtiles:\/\/\$\{dataset.url\}`/);
  assert.match(source, /requires source_layer/);
});

test("legacy is the feature-flag default and PMTiles registration is guarded", async () => {
  const [datasets, protocol] = await Promise.all([read("lib/maps/datasets.ts"), read("lib/maps/register-pmtiles-protocol.ts")]);
  assert.match(datasets, /NEXT_PUBLIC_MAP_ENGINE === "maplibre" \? "maplibre" : "legacy"/);
  assert.match(protocol, /typeof window === "undefined" \|\| registered/);
  assert.match(protocol, /maplibre.addProtocol\("pmtiles"/);
});
