import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("registers current Myanmar and inactive PMTiles datasets", async () => {
  const datasets = JSON.parse(await read("data/maps/datasets.json"));
  const myanmar = datasets.find(
    (dataset) => dataset.id === "mm-townships-geojson",
  );
  const pmtiles = datasets.find(
    (dataset) => dataset.id === "mm-townships-pmtiles",
  );
  assert.equal(myanmar.dataset_type, "geojson");
  assert.equal(myanmar.enabled, true);
  assert.equal(pmtiles.dataset_type, "pmtiles");
  assert.equal(pmtiles.enabled, true);
});

test("pipeline preparation preserves features and reports missing canonical IDs", async () => {
  const preparation = await read(
    "scripts/maps/prepare_myanmar_vector_source.py",
  );
  assert.match(preparation, /skipped_invalid_geometries/);
  assert.match(preparation, /missing_canonical_ids/);
  assert.match(preparation, /output.sort/);
});

test("layer registry keeps only township foundation layers active", async () => {
  const layers = JSON.parse(await read("data/maps/layers.json"));
  assert.equal(
    layers.find((layer) => layer.id === "township-fill").enabled,
    true,
  );
  assert.equal(
    layers.find((layer) => layer.id === "sales-heatmap").enabled,
    false,
  );
});

test("layer manager exposes independent metric and boundary controls", async () => {
  const [registry, manager, preview, vectorMap] = await Promise.all([
    read("data/maps/layers.json"),
    read("lib/maps/layer-manager.ts"),
    read("components/maps/vector-map-preview.tsx"),
    read("components/maps/global-vector-map.tsx"),
  ]);
  assert.match(registry, /township-boundary/);
  assert.match(manager, /useMapLayerManager/);
  assert.match(preview, /layerManager\.toggle/);
  assert.match(vectorMap, /isLayerGroupEnabled\("heatmap", layerState\)/);
  assert.match(
    vectorMap,
    /isLayerGroupEnabled\("township-boundary", layerState/,
  );
  assert.match(vectorMap, /setLayoutProperty\(id, "visibility", "visible"\)/);
});

test("source adapter supports GeoJSON and PMTiles with validation", async () => {
  const source = await read("lib/maps/create-map-source.ts");
  assert.match(source, /type: "geojson"/);
  assert.match(source, /url: `pmtiles:\/\/\$\{dataset.url\}`/);
  assert.match(source, /requires source_layer/);
});

test("MapLibre is the feature-flag default, legacy is an explicit rollback, and PMTiles registration is guarded", async () => {
  const [datasets, protocol] = await Promise.all([
    read("lib/maps/datasets.ts"),
    read("lib/maps/register-pmtiles-protocol.ts"),
  ]);
  assert.match(
    datasets,
    /NEXT_PUBLIC_MAP_ENGINE === "legacy" \? "legacy" : "maplibre"/,
  );
  assert.match(protocol, /typeof window === "undefined" \|\| registered/);
  assert.match(protocol, /maplibre.addProtocol\("pmtiles"/);
});

test("Marketing map defaults to PMTiles and falls back to legacy on a load failure", async () => {
  const [legacy, maplibre] = await Promise.all([
    read("components/marketing/myanmar-marketing-map.tsx"),
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
  ]);
  assert.match(legacy, /getMapEngine\(\) === "maplibre"/);
  assert.match(legacy, /LegacyMyanmarMarketingMap/);
  assert.match(legacy, /t\("map\.unableToLoad"\)/);
  assert.match(maplibre, /getMapDataset\("mm-townships-pmtiles"\)/);
  assert.match(maplibre, /canonical_location_id/);
  assert.match(maplibre, /onError=\{onLoadError\}/);
  assert.match(maplibre, /GlobalVectorMap/);
});

test("MapLibre Marketing restores legacy map interactions and presentation overlays", async () => {
  const [maplibre, vectorMap] = await Promise.all([
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/maps/global-vector-map.tsx"),
  ]);
  // Production path uses the simplified states dataset; the original full
  // resolution geometry remains only as the rollback fallback.
  assert.match(maplibre, /myanmar-states-simplified\.geojson/);
  assert.match(maplibre, /myanmar-states\.geojson/);
  assert.match(maplibre, /myanmar-township-labels\.json/);
  assert.match(maplibre, /kmm-showrooms\.json/);
  assert.match(maplibre, /marketing-state-labels/);
  assert.match(maplibre, /marketing-township-labels/);
  assert.match(maplibre, /kmm-showroom-marker/);
  assert.match(vectorMap, /scrollZoom: true/);
  assert.match(vectorMap, /dragPan: true/);
  assert.match(vectorMap, /doubleClickZoom: true/);
  assert.match(vectorMap, /FullscreenControl/);
  assert.match(vectorMap, /data-marketing-workspace/);
});

test("township labels dataset is compact and matches the vertex-mean label algorithm", async () => {
  const labels = JSON.parse(await read("public/maps/myanmar-township-labels.json"));
  const geo = JSON.parse(await read("public/maps/myanmar-townships.geojson"));
  assert.equal(labels.count, 330);
  assert.equal(labels.labels.length, 330);
  // File must stay tiny versus the 11.4 MB geometry it replaces.
  const raw = await read("public/maps/myanmar-township-labels.json");
  assert.ok(raw.length < 200_000, "township labels file must stay compact");

  const collectPoints = (input, points = []) => {
    if (!Array.isArray(input)) return points;
    if (typeof input[0] === "number" && typeof input[1] === "number")
      points.push([input[0], input[1]]);
    else input.forEach((item) => collectPoints(item, points));
    return points;
  };
  const norm = (value) => String(value).trim().toLowerCase();
  const byKey = new Map(
    labels.labels.map((label) => [
      `${norm(label.stateRegion)}-${norm(label.name)}`,
      label.coordinates,
    ]),
  );
  let checked = 0;
  for (const feature of geo.features) {
    const name = feature.properties.TS;
    const stateRegion = feature.properties.ST ?? "";
    if (!name) continue;
    const points = collectPoints(feature.geometry?.coordinates);
    if (!points.length) continue;
    checked += 1;
    const mean = [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length,
    ];
    const expected = byKey.get(
      `${norm(stateRegion)}-${norm(name)}`,
    );
    assert.ok(expected, `label missing for ${name} (${stateRegion})`);
    assert.ok(
      Math.abs(expected[0] - mean[0]) < 1e-9 &&
        Math.abs(expected[1] - mean[1]) < 1e-9,
      `label coordinate mismatch for ${name}`,
    );
  }
  assert.equal(checked, 330);
});

test("simplified states dataset keeps every state and shrinks geometry", async () => {
  const original = JSON.parse(await read("public/maps/myanmar-states.geojson"));
  const simplified = JSON.parse(
    await read("public/maps/myanmar-states-simplified.geojson"),
  );
  // Same feature count and identical state IDs (ST | ST_PCODE).
  assert.equal(simplified.features.length, original.features.length);
  assert.equal(simplified.features.length, 15);
  const ids = (features) =>
    features
      .map((feature) => `${feature.properties.ST}|${feature.properties.ST_PCODE}`)
      .sort();
  assert.deepEqual(ids(simplified.features), ids(original.features));

  // Geometry size threshold: simplified must stay well under 1 MB.
  const raw = await read("public/maps/myanmar-states-simplified.geojson");
  assert.ok(raw.length < 1_000_000, "simplified states file must stay under 1 MB");

  // Coordinate reduction: at most 25% of the original vertices.
  const countPairs = (geometry) => {
    const collect = (input, points = []) => {
      if (!Array.isArray(input)) return points;
      if (typeof input[0] === "number" && typeof input[1] === "number")
        points.push([input[0], input[1]]);
      else input.forEach((item) => collect(item, points));
      return points;
    };
    return collect(geometry.coordinates).length;
  };
  const originalPairs = original.features.reduce(
    (total, feature) => total + countPairs(feature.geometry),
    0,
  );
  const simplifiedPairs = simplified.features.reduce(
    (total, feature) => total + countPairs(feature.geometry),
    0,
  );
  assert.ok(
    simplifiedPairs <= Math.ceil(originalPairs * 0.25),
    `coordinates must drop to <=25% (${simplifiedPairs} of ${originalPairs})`,
  );

  // Label positions are precomputed from the ORIGINAL geometry (vertex mean),
  // so state labels do not move after simplification.
  const collectPoints = (input, points = []) => {
    if (!Array.isArray(input)) return points;
    if (typeof input[0] === "number" && typeof input[1] === "number")
      points.push([input[0], input[1]]);
    else input.forEach((item) => collectPoints(item, points));
    return points;
  };
  for (let index = 0; index < original.features.length; index += 1) {
    const points = collectPoints(original.features[index].geometry.coordinates);
    const mean = [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length,
    ];
    const position = simplified.features[index].properties.label_position;
    assert.ok(position, `label_position missing for ${original.features[index].properties.ST}`);
    assert.ok(
      Math.abs(position[0] - mean[0]) < 1e-9 &&
        Math.abs(position[1] - mean[1]) < 1e-9,
      `label_position mismatch for ${original.features[index].properties.ST}`,
    );
  }
});

test("Marketing labels switch cleanly between State and Township zoom levels", async () => {
  const maplibre = await read(
    "components/marketing/myanmar-marketing-map-maplibre.tsx",
  );
  assert.match(maplibre, /maxzoom: 7\.2/);
  assert.match(maplibre, /minzoom: 6/);
  assert.match(maplibre, /metric_label/);
  assert.match(maplibre, /"text-opacity": opacity/);
  assert.match(maplibre, /text-allow-overlap": false/);
  assert.match(maplibre, /text-ignore-placement": false/);
  assert.match(maplibre, /text-radial-offset/);
  assert.match(maplibre, /text-halo-width": 1/);
  assert.match(maplibre, /showroomMarkersRef/);
});

test("Marketing route renders the map-first territory workspace", async () => {
  const workspace = await read(
    "components/marketing/marketing-intelligence-page.tsx",
  );
  assert.match(workspace, /aria-label="Marketing territory map"/);
  assert.match(workspace, /h-\[calc\(100vh-72px\)\]/);
  assert.match(workspace, /aria-label="Right Intelligence Panel"/);
  assert.match(workspace, /Phase1TownshipPanel/);
  assert.doesNotMatch(workspace, /aria-label="Strategic Focus placeholder"/);
  assert.match(
    workspace,
    /<MyanmarMarketingMap[\s\S]*?visibleShowroomIds=\{visibleShowroomIds\}[\s\S]*?townshipMetrics=\{mapped\.metrics\}/,
  );
});

test("Marketing markers and the detail panel preserve a correct navigable viewport", async () => {
  const [showrooms, maplibre, vectorMap] = await Promise.all([
    read("public/maps/kmm-showrooms.json"),
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/maps/global-vector-map.tsx"),
  ]);
  assert.equal(JSON.parse(showrooms).length, 6);
  assert.match(maplibre, /element\.title = showroom\.name/);
  assert.match(maplibre, /showroomMarkersRef\.current\.size/);
  assert.match(maplibre, /viewportPaddingRight=\{0\}/);
  assert.match(maplibre, /onSelectedTownshipChange/);
  assert.match(vectorMap, /map\.resize\(\)/);
  assert.match(
    vectorMap,
    /getFitPadding\(fitPaddingRef\.current, viewportPaddingRight\)/,
  );
});

test("MapLibre visual styling keeps the sales territory map legible", async () => {
  const [maplibre, vectorMap] = await Promise.all([
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/maps/global-vector-map.tsx"),
  ]);
  assert.match(vectorMap, /overlayFillOpacity = 0\.98/);
  assert.match(vectorMap, /boundaryColor = chartTheme\.grid/);
  assert.match(vectorMap, /"line-color": boundaryColor/);
  assert.match(vectorMap, /"line-width": boundaryWidth/);
  assert.match(vectorMap, /"line-opacity": boundaryOpacity/);
  assert.match(vectorMap, /"line-cap": "round"/);
  assert.match(maplibre, /SALES_MAP_COLORS/);
  assert.match(maplibre, /stateBoundary: "#FF7A00"/);
  assert.match(maplibre, /townshipBoundary: "#F2A15F"/);
  assert.match(maplibre, /"line-color": SALES_MAP_COLORS\.stateBoundary/);
  assert.match(maplibre, /"line-dasharray": \[3\.5, 3\]/);
  assert.match(maplibre, /boundaryColor=\{SALES_MAP_COLORS\.townshipBoundary\}/);
  assert.match(maplibre, /boundaryOpacity=\{0\.42\}/);
  assert.match(maplibre, /boundaryWidth=\{0\.55\}/);
  assert.match(maplibre, /Noto Sans Medium/);
  assert.match(maplibre, /Noto Sans Regular/);
  assert.match(
    maplibre,
    /fitPadding=\{\{ top: 24, right: 44, bottom: 24, left: 44 \}\}/,
  );
});

test("Marketing uses the KME Protomaps basemap beneath the PMTiles overlay", async () => {
  const [basemaps, kmeBasemap, maplibre, vectorMap, worker] = await Promise.all(
    [
      read("data/maps/basemaps.json"),
      read("src/kme/core/basemap/protomaps.ts"),
      read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
      read("components/maps/global-vector-map.tsx"),
      read("worker/index.ts"),
    ],
  );
  assert.equal(JSON.parse(basemaps)[0].id, "kme-protomaps-osm-light");
  assert.match(kmeBasemap, /@protomaps\/basemaps/);
  assert.match(kmeBasemap, /protomaps\.github\.io\/basemaps-assets/);
  assert.match(kmeBasemap, /\/fonts\/\{fontstack\}\/\{range\}\.pbf/);
  assert.match(kmeBasemap, /\/maps\/vector\/protomaps-osm-v4\.pmtiles/);
  assert.match(
    worker,
    /data\.source\.coop\/protomaps\/openstreetmap\/v4\.pmtiles/,
  );
  assert.match(kmeBasemap, /tuneMarketingBasemapLayers/);
  assert.match(kmeBasemap, /roads_labels_major/);
  assert.match(kmeBasemap, /water_river/);
  assert.doesNotMatch(maplibre, /createSalesTerritoryBasemapStyle|SALES_TERRITORY_BASE_STYLE/);
  assert.match(maplibre, /overlayFillOpacity=\{0\.5\}/);
  assert.match(vectorMap, /createMarketingBasemapStyle/);
  assert.match(
    vectorMap,
    /if \(!Object\.keys\(fillColorsByCanonicalId\)\.length\) return fillNoDataColor/,
  );
  assert.doesNotMatch(vectorMap, /MapLibre recoverable resource error/);
  assert.match(vectorMap, /failMap/);
});

test("Marketing visual polish keeps the basemap visible and markers prominent", async () => {
  const [maplibre, vectorMap, css] = await Promise.all([
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/maps/global-vector-map.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(maplibre, /overlayHoverOpacity=\{0\.18\}/);
  assert.match(maplibre, /overlaySelectedOpacity=\{0\.16\}/);
  assert.match(maplibre, /unique visible townships/);
  assert.match(
    maplibre,
    /new URLSearchParams\(window\.location\.search\)\.get\("debug"\) === "map"/,
  );
  assert.match(maplibre, /showMapDiagnostic &&/);
  assert.match(maplibre, /fetchOverlayJson/);
  assert.match(
    maplibre,
    /installLegacyPresentationOverlays\(map\)\.catch\(\s*reportOverlayLoadError/,
  );
  assert.doesNotMatch(vectorMap, /return \/failed to fetch\|networkerror/);
  assert.doesNotMatch(vectorMap, /MapLibre recoverable resource error/);
  assert.match(vectorMap, /getFillOpacityExpression/);
  assert.match(vectorMap, /viewportBounds/);
  assert.match(vectorMap, /boundaryOpacity = 0\.5/);
  assert.match(css, /width: 13px/);
  assert.match(css, /border: 2px solid #ffffff/);
  assert.match(css, /background: var\(--brand-500\)/);
  assert.match(css, /animation: kmm-marker-pulse 2\.8s ease-out infinite/);
  assert.match(css, /z-index: 5/);
});

test("Marketing restores graduated Sales Unit choropleth styling", async () => {
  const [workspace, maplibre, vectorMap] = await Promise.all([
    read("components/marketing/marketing-intelligence-page.tsx"),
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/maps/global-vector-map.tsx"),
  ]);
  assert.match(workspace, /type Mode = "sales" \| "population" \| "activity"/);
  assert.match(workspace, /useState<Mode>\("sales"\)/);
  assert.match(workspace, /ZERO_SALES_COLOR = chartTheme\.marketing\.zero/);
  assert.match(workspace, /NO_DATA_COLOR = chartTheme\.marketing\.noData/);
  assert.match(
    workspace,
    /metricValue[\s\S]*?mode === "sales"\s*\?\s*item\.salesUnit/,
  );
  assert.match(
    workspace,
    /heatColor\([\s\S]*?metricValue\(item\)[\s\S]*?mode === "sales"\s*\?\s*ZERO_SALES_COLOR\s*:\s*NO_DATA_COLOR/,
  );
  assert.match(workspace, /canonicalLocationId: item\.key/);
  assert.match(maplibre, /initialMetricFromMode/);
  assert.match(maplibre, /return "salesUnit"/);
  assert.match(maplibre, /metric\.salesUnit/);
  assert.match(maplibre, /#FAD7B5/);
  assert.match(maplibre, /#FFB25F/);
  assert.match(maplibre, /#F68A24/);
  assert.match(maplibre, /#E65C12/);
  assert.match(maplibre, /#B93612/);
  assert.match(vectorMap, /colorPairs\.push\(fillNoDataColor\)/);
});

test("Executive GIS V2 uses Jenks classified choropleth, dynamic legend, and hover highlight without a Top-Township outline", async () => {
  const [maplibre, vectorMap, layerOrder] = await Promise.all([
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/maps/global-vector-map.tsx"),
    read("lib/maps/layer-order.ts"),
  ]);
  assert.match(maplibre, /jenksNaturalBreaks/);
  assert.match(maplibre, /Natural Breaks \(Jenks\)/);
  assert.match(maplibre, /quantileBreaks/);
  assert.match(maplibre, /const CHOROPLETH_COLORS = SALES_MAP_COLORS\.heatScale/);
  assert.match(maplibre, /EXECUTIVE_METRICS/);
  assert.match(maplibre, /metric\.gpPercent/);
  assert.match(maplibre, /legendRange/);
  assert.doesNotMatch(maplibre, /topCanonicalLocationIds/);
  assert.doesNotMatch(maplibre, /tooltip/);
  assert.match(vectorMap, /setFeatureState/);
  assert.match(vectorMap, /topCanonicalLocationIds/);
  assert.match(vectorMap, /topTownshipLayerId/);
  assert.match(vectorMap, /"fill-color": chartTheme\.surface/);
  assert.match(vectorMap, /"line-width": 2\.5/);
  assert.match(layerOrder, /township-top-five-outline/);
});

test("Executive GIS V2.1 centralizes time filters, comparisons, decision toolbar, and panel debug fields", async () => {
  const [workspace, panel, maplibre, timeFilters] = await Promise.all([
    read("components/marketing/marketing-intelligence-page.tsx"),
    read("components/marketing/myanmar-marketing-map.tsx"),
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("lib/marketing/time-filters.ts"),
  ]);
  assert.match(timeFilters, /PeriodMode/);
  assert.match(timeFilters, /ComparisonMode/);
  assert.match(timeFilters, /PROJECT_TIMEZONE = "Asia\/Bangkok"/);
  assert.match(timeFilters, /selectedYears: \["2026"\]/);
  assert.match(timeFilters, /selectedMonths: \["1", "2", "3"/);
  assert.match(timeFilters, /resolvePeriod/);
  assert.match(timeFilters, /resolveComparison/);
  assert.match(timeFilters, /rolling-12-months/);
  assert.match(timeFilters, /rowInDateRange/);
  assert.match(timeFilters, /rowInYearMonthSelection/);
  assert.match(timeFilters, /comparison === 0 \? null/);
  assert.match(workspace, /useState<ExecutiveGisFilters>/);
  assert.match(workspace, /DecisionToolbar/);
  assert.doesNotMatch(workspace, /<ExecutiveKpiStrip/);
  assert.match(workspace, /rowInYearMonthSelection\(row, gisFilters\)/);
  assert.match(workspace, /comparisonSales/);
  assert.match(workspace, /activeMetric=\{gisFilters\.activeMetric\}/);
  assert.match(workspace, /rangeFromYearMonthSelections/);
  assert.match(workspace, /selectedYears/);
  assert.match(panel, /panel\.salesPerformance/);
  assert.match(panel, /timeFilter: metric\.debugPeriod/);
  assert.match(maplibre, /onActiveMetricChange/);
});

test("Marketing Sprint 1 removes KPI strip and reserves decision workspace shell", async () => {
  const workspace = await read(
    "components/marketing/marketing-intelligence-page.tsx",
  );
  assert.match(workspace, /aria-label="Decision Toolbar"/);
  assert.match(workspace, /ปี/);
  assert.match(workspace, /เดือน/);
  assert.match(workspace, /สินค้า/);
  assert.match(workspace, /ตัวชี้วัด/);
  assert.match(workspace, /ApplyMultiSelect/);
  assert.match(workspace, /เลือกทั้งหมด/);
  assert.match(workspace, /นำไปใช้/);
  assert.match(workspace, /กรุณาเลือกอย่างน้อย 1 รายการ/);
  assert.match(workspace, /Unit/);
  assert.match(workspace, /GP%/);
  assert.doesNotMatch(workspace, /value=\{filters\.selectedYear\}/);
  assert.doesNotMatch(workspace, /value=\{filters\.selectedMonth\}/);
  assert.doesNotMatch(workspace, /onProductChange/);
  assert.doesNotMatch(workspace, /เทียบช่วงเดียวกันปีก่อน/);
  assert.doesNotMatch(workspace, /onGeographyChange/);
  assert.match(workspace, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.match(workspace, /ไม่พบข้อมูลตามตัวกรองที่เลือก/);
  assert.match(workspace, /metric\.responsibleShowroom \?\? waiting/);
  assert.doesNotMatch(workspace, /Strategic Focus/);
  assert.doesNotMatch(workspace, /Coming in Phase 2/);
  assert.doesNotMatch(workspace, /<ExecutiveKpiStrip/);
});

test("Area Comparison Phase A adds compare mode store, toggle, temporary panel, and click routing only", async () => {
  const workspace = await read(
    "components/marketing/marketing-intelligence-page.tsx",
  );
  assert.match(workspace, /MAX_COMPARISON_TOWNSHIPS = 4/);
  assert.match(workspace, /useState\(false\)/);
  assert.match(workspace, /useState<CanonicalTownshipId\[\]>\(\[\]\)/);
  assert.match(workspace, /ComparisonToolbarControl/);
  assert.match(workspace, /aria-pressed=\{compareMode\}/);
  assert.match(workspace, /เปรียบเทียบพื้นที่/);
  assert.match(workspace, /enterCompareMode/);
  assert.match(
    workspace,
    /isValidComparisonTownshipId\(selectedCanonicalId\)\s*\?\s*\[selectedCanonicalId\]\s*:\s*\[\]/,
  );
  assert.match(workspace, /exitCompareMode/);
  assert.match(
    workspace,
    /const firstSelectedTownshipId = selectedComparisonTownshipIds\[0\] \?\? null/,
  );
  assert.match(workspace, /setSelectedCanonicalId\(firstSelectedTownshipId\)/);
  assert.match(workspace, /addComparisonTownship/);
  assert.match(workspace, /current\.includes\(id\)/);
  assert.match(workspace, /current\.length >= MAX_COMPARISON_TOWNSHIPS/);
  assert.match(workspace, /เลือกได้สูงสุด 4 Township/);
  assert.match(workspace, /removeComparisonTownship/);
  assert.match(workspace, /current\.filter\(\(item\) => item !== id\)/);
  assert.match(workspace, /clearComparisonTownships/);
  assert.match(workspace, /handleSelectedTownshipChange/);
  assert.match(workspace, /compareModeRef\.current/);
  assert.match(workspace, /addComparisonTownshipRef\.current\(canonicalId\)/);
  assert.match(
    workspace,
    /onSelectedTownshipChange=\{handleSelectedTownshipChange\}/,
  );
  assert.match(workspace, /compareMode\s*\?[\s\S]*?<ComparisonPanel/);
  assert.match(workspace, /เลือกอย่างน้อย 2 Township เพื่อเริ่มเปรียบเทียบ/);
  assert.doesNotMatch(workspace, /selectComparisonInsights/);
});

test("Area Comparison Phase B renders map selection badges and approved panel structure", async () => {
  const [workspace, mapProps, maplibre] = await Promise.all([
    read("components/marketing/marketing-intelligence-page.tsx"),
    read("components/marketing/myanmar-marketing-map.tsx"),
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
  ]);
  assert.match(mapProps, /comparisonSelectionIds\?: string\[\]/);
  assert.match(
    workspace,
    /comparisonSelectionIds=\{\s*compareMode\s*\?\s*selectedComparisonTownshipIds\s*:\s*\[\]\s*\}/,
  );
  assert.match(
    workspace,
    /<ComparisonPanel[\s\S]*?selectedTownships=\{selectedComparisonTownships\}/,
  );
  assert.match(workspace, /เลือกอย่างน้อย 2 Township เพื่อเริ่มเปรียบเทียบ/);
  assert.match(workspace, /เลือกอีก 1 Township เพื่อเริ่มเปรียบเทียบ/);
  assert.match(
    workspace,
    /<ComparisonMatrix\s+selectedTownships=\{selectedTownships\}/,
  );
  assert.match(workspace, /ข้อมูลเชิงวิเคราะห์จะถูกเพิ่มใน Phase C3/);
  assert.match(workspace, /selectedTownships\.map\(\(township, index\)/);
  assert.match(
    workspace,
    /aria-label=\{`Remove \$\{township\.township\} from comparison`\}/,
  );
  assert.match(
    maplibre,
    /COMPARISON_OUTLINE_LAYER_ID = "marketing-comparison-selection-outline"/,
  );
  assert.match(maplibre, /comparisonSelectionFilter/);
  assert.match(maplibre, /comparisonBadgeMarkersRef/);
  assert.match(maplibre, /comparisonLabelPositionsRef/);
  assert.match(maplibre, /kmm-comparison-selection-badge/);
  assert.match(maplibre, /Comparison \$\{index \+ 1\}/);
  assert.match(maplibre, /element\.style\.background = chartTheme\.current/);
  assert.match(
    maplibre,
    /map\.setFilter\(\s*COMPARISON_OUTLINE_LAYER_ID,\s*comparisonSelectionFilter\(comparisonSelectionIdsRef\.current\)/,
  );
  assert.doesNotMatch(maplibre, /source\.setData\(.*comparison/i);
  assert.doesNotMatch(workspace, /Best/);
  assert.doesNotMatch(workspace, /Worst/);
});

test("Area Comparison Phase C1 renders executive metric matrix from shared Township aggregates", async () => {
  const workspace = await read(
    "components/marketing/marketing-intelligence-page.tsx",
  );
  assert.match(workspace, /function ComparisonMatrix/);
  assert.match(workspace, /aria-label="Comparison Matrix"/);
  assert.match(workspace, /<table\s+className(?:=|=\{cn\()/);
  assert.match(
    workspace,
    /<caption className="sr-only">\s*Executive metric comparison for selected Townships\s*<\/caption>/,
  );
  assert.match(workspace, /scope="col"/);
  assert.match(workspace, /scope="row"/);
  assert.match(workspace, /scope="rowgroup"/);
  assert.match(workspace, /Performance/);
  assert.match(workspace, /Growth/);
  assert.match(workspace, /Unit/);
  assert.match(workspace, /Value/);
  assert.match(workspace, /GP%/);
  assert.match(workspace, /YoY Unit/);
  assert.match(workspace, /YoY Value/);
  assert.match(workspace, /YoY GP%/);
  assert.match(workspace, /formatComparisonValue/);
  assert.match(workspace, /formatComparisonGrowth/);
  assert.match(workspace, /compact\(value\)} MMK/);
  assert.match(workspace, /value\.toFixed\(1\)/);
  assert.match(workspace, /changeArrow\(delta\)/);
  assert.match(workspace, /Math\.abs\(delta\)\.toFixed\(1\)} pp/);
  assert.match(workspace, /priorSalesByTownship\.get\(id\) \?\? null/);
  assert.match(workspace, /metric\?\.hasFilteredSalesData\s*\?/);
  assert.match(workspace, /value === null\s*\?\s*"—"/);
  assert.doesNotMatch(workspace, /Product Share/);
  assert.doesNotMatch(workspace, /Lowest/);
});

test("Localization foundation defaults to Thai and exposes English and Myanmar switching", async () => {
  const [
    layout,
    context,
    hook,
    locales,
    thai,
    english,
    header,
    maplibre,
    panel,
  ] = await Promise.all([
    read("app/layout.tsx"),
    read("src/context/LocaleContext.tsx"),
    read("src/hooks/useLocale.ts"),
    read("src/locales/index.ts"),
    read("src/locales/th.ts"),
    read("src/locales/en.ts"),
    read("components/layout/global-header.tsx"),
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/marketing/myanmar-marketing-map.tsx"),
  ]);
  assert.match(layout, /<html lang="th">/);
  assert.match(layout, /<LocaleProvider>/);
  assert.match(context, /STORAGE_KEY = "kmm-language"/);
  assert.match(context, /useState<Language>\(defaultLanguage\)/);
  assert.match(
    context,
    /window\.localStorage\.setItem\(STORAGE_KEY, nextLanguage\)/,
  );
  assert.match(hook, /useLocale/);
  assert.match(locales, /defaultLanguage: Language = "th"/);
  assert.match(thai, /"metric\.salesUnit": "ยอดขาย \(คัน\)"/);
  assert.match(
    thai,
    /"comparison\.samePeriodLastYear": "ช่วงเดียวกันของปีก่อน"/,
  );
  assert.match(english, /"metric\.salesUnit": "Sales Unit"/);
  assert.match(header, /value="th"/);
  assert.match(header, /value="en"/);
  assert.match(header, /value="my"/);
  assert.match(header, /route\.marketing\.title/);
  assert.match(english, /"period\.rolling12Months": "Rolling 12 Months"/);
  assert.match(thai, /"period\.rolling12Months": "ย้อนหลัง 12 เดือน"/);
  assert.match(maplibre, /metricLabel\(activeMetric, t\)/);
  assert.match(panel, /t\("panel\.salesPerformance"\)/);
});

test("Township Intelligence uses canonical IDs and explicit no-data safeguards", async () => {
  const [panel, maplibre, workspace, legacy] = await Promise.all([
    read("components/marketing/myanmar-marketing-map.tsx"),
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/marketing/marketing-intelligence-page.tsx"),
    read("components/marketing/myanmar-marketing-map.tsx"),
  ]);
  assert.match(maplibre, /townshipMetrics\[record\.township_id\]/);
  assert.match(
    workspace,
    /selectedTownshipMetric = selectedCanonicalId\s*\?\s*\(\(\) =>/,
  );
  assert.match(workspace, /priorSalesByTownship/);
  assert.match(workspace, /benchmarkByTownship/);
  assert.doesNotMatch(workspace, /townshipIntelligenceMetrics/);
  assert.match(workspace, /bookingUnit:\s*null,\s*bookingValue:\s*null/);
  assert.match(panel, /metric\.gpPercent/);
  assert.match(workspace, /canonicalLocationId: item\.key/);
  assert.match(legacy, /metricForLegacyFeature/);
});

test("Developer Debug Panel is production-hidden and exports canonical map diagnostics", async () => {
  const [panel, maplibre, vectorMap, css] = await Promise.all([
    read("components/marketing/myanmar-marketing-map.tsx"),
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/maps/global-vector-map.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(panel, /process\.env\.NODE_ENV !== "production"/);
  assert.match(panel, /NEXT_PUBLIC_DEBUG_PANEL === "true"/);
  assert.match(panel, /debug\.title/);
  assert.match(panel, /canonical_location_id/);
  assert.match(panel, /matchedBy: "canonical_location_id"/);
  assert.match(panel, /navigator\.clipboard/);
  assert.match(panel, /common\.exportDebugJson/);
  assert.match(maplibre, /onMapStatus=\{setMapStatus\}/);
  assert.match(vectorMap, /onMapStatus/);
  assert.match(css, /\.kmm-township-debug pre/);
});

test("Sales geography reconciliation is state-aware, canonical, and lossless", async () => {
  const [resolver, aliases, stateAliases, report, workspace, panel] =
    await Promise.all([
      read("lib/marketing/township-geography.ts"),
      read("data/geography/township-approved-aliases.json"),
      read("data/geography/state-region-approved-aliases.json"),
      read("reports/sales-geography-reconciliation.json"),
      read("components/marketing/marketing-intelligence-page.tsx"),
      read("components/marketing/myanmar-marketing-map.tsx"),
    ]);
  const reconciliation = JSON.parse(report);
  assert.equal(
    reconciliation.source_sales_unit,
    reconciliation.mapped_township_sales_unit +
      reconciliation.unresolved_sales_unit,
  );
  assert.equal(
    reconciliation.source_sales_value,
    reconciliation.mapped_township_sales_value +
      reconciliation.unresolved_sales_value,
  );
  assert.equal(reconciliation.sales_unit_difference, 0);
  assert.equal(reconciliation.sales_value_difference, 0);
  assert.equal(reconciliation.unmapped_canonical_rows, 0);
  assert.match(resolver, /normalizeLocation/);
  assert.match(resolver, /state\|region/);
  assert.match(resolver, /canonicalLocationId/);
  assert.match(resolver, /AMBIGUOUS_TOWNSHIP/);
  assert.match(resolver, /PENDING_ALIAS/);
  assert.match(resolver, /MISSING_STATE/);
  assert.match(resolver, /CANONICAL_ID_NOT_IN_BOUNDARY/);
  assert.match(resolver, /states\.includes\(record\.state_region\)/);
  assert.match(aliases, /Taung Gyi/);
  assert.match(stateAliases, /AYEYARWADDY/);
  assert.match(workspace, /resolveTownship\(row\.township, row\.stateRegion\)/);
  assert.match(workspace, /resolveTownship\(row\.township, row\.stateRegion\)/);
  assert.match(panel, /sales-geography-reconciliation\.json/);
});

test("Township selected and hover layers retain priority and stable order", async () => {
  const [vectorMap, layerOrder, maplibre, panel, registry] = await Promise.all([
    read("components/maps/global-vector-map.tsx"),
    read("lib/maps/layer-order.ts"),
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/marketing/myanmar-marketing-map.tsx"),
    read("data/maps/layers.json"),
  ]);
  const required = [
    "business-boundary-fill",
    "township-base-fill",
    "township-hover-fill",
    "township-selected-fill",
    "business-boundary-outline",
    "township-top-five-outline",
    "marketing-state-boundaries",
    "township-selected",
    "marketing-state-labels",
    "marketing-township-labels",
  ];
  let previous = -1;
  for (const id of required) {
    const index = layerOrder.indexOf(`\"${id}\"`);
    assert.ok(index > previous, `${id} must follow the previous managed layer`);
    previous = index;
  }
  assert.match(layerOrder, /applyRequiredLayerOrder/);
  assert.match(layerOrder, /map\.moveLayer\(id\)/);
  assert.match(layerOrder, /showroom-glow-dom/);
  assert.match(vectorMap, /townshipSelectedFill/);
  assert.match(vectorMap, /getHoverOpacityExpression/);
  assert.match(vectorMap, /selectedCanonicalLocationId.*0/);
  assert.match(
    vectorMap,
    /\[baseFillLayerId, hoverFillLayerId, selectedFillLayerId, selectedLayerId\]/,
  );
  assert.match(vectorMap, /setFeatureState.*hover: false/);
  assert.match(vectorMap, /interactionLayerId = fillLayerId/);
  assert.match(
    vectorMap,
    /clickableLayerIds = \[fillLayerId, baseFillLayerId\]/,
  );
  assert.match(vectorMap, /map\.on\("mousemove", interactionLayerId/);
  assert.match(vectorMap, /map\.on\("mouseleave", interactionLayerId/);
  assert.match(
    vectorMap,
    /queryRenderedFeatures\(event\.point, \{ layers: clickableLayerIds \}\)/,
  );
  assert.match(vectorMap, /map\.on\("moveend".*applyRequiredLayerOrder/);
  assert.match(vectorMap, /if \(!map\.getSource\(dataset\.source_id\)\)/);
  assert.match(vectorMap, /if \(!map\.getLayer\(baseFillLayerId\)\)/);
  assert.match(maplibre, /applyRequiredLayerOrder\(map\)/);
  assert.match(
    await read("components/maps/vector-map-preview.tsx"),
    /selectedCanonicalLocationId=\{selectedCanonicalId\}/,
  );
  assert.match(panel, /actualMapLayerOrder/);
  assert.match(panel, /selectedFillVisibility/);
  assert.match(panel, /selectedOutlineVisibility/);
  assert.match(panel, /hoverFillVisibility/);
  assert.match(panel, /layerOrderWarning/);
  assert.equal(
    JSON.parse(registry).find((layer) => layer.id === "township-fill").group,
    "heatmap",
  );
});

test("Marketing Smart Click and Layer Manager reuse the live MapLibre business layers", async () => {
  const [vectorMap, maplibre, panel, controls] = await Promise.all([
    read("components/maps/global-vector-map.tsx"),
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/marketing/myanmar-marketing-map.tsx"),
    read("lib/marketing/map-layer-controls.ts"),
  ]);
  assert.match(vectorMap, /onMapBackgroundClick/);
  assert.match(vectorMap, /onMapBackgroundClickRef\.current\?\.\(\)/);
  assert.match(maplibre, /MarketingLayerManager/);
  assert.match(maplibre, /layerState=\{layerState\}/);
  assert.match(maplibre, /presentationMapRef\.current\?\.fitBounds/);
  assert.match(maplibre, /if \(id === selectedCanonicalId\) return/);
  assert.match(maplibre, /duration: 400/);
  assert.match(maplibre, /maxZoom: 7\.8/);
  assert.match(maplibre, /layerState\.showroom/);
  assert.match(maplibre, /kmm-township-detail-overlay/);
  assert.match(panel, /Smart Click details/);
  assert.match(panel, /รอข้อมูล/);
  assert.match(controls, /Sales Heatmap/);
  assert.match(controls, /Booking Heatmap/);
  assert.match(controls, /available: false/);
  assert.match(controls, /mapLayerGroup: "heatmap"/);
});

test("Marketing keeps one desktop detail panel and preserves a fullscreen/mobile panel path", async () => {
  const [maplibre, workspace, panel] = await Promise.all([
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/marketing/marketing-intelligence-page.tsx"),
    read("components/marketing/myanmar-marketing-map.tsx"),
  ]);
  assert.doesNotMatch(maplibre, /!isFullscreen && selectedMetric/);
  assert.match(maplibre, /isFullscreen\s*&&\s*selectedMetric/);
  assert.match(maplibre, /fullscreenPanelCollapsed/);
  assert.match(maplibre, /fullscreenSearchOpen/);
  assert.match(maplibre, /Search Township/);
  assert.match(maplibre, /Reset map view/);
  assert.match(maplibre, /Exit fullscreen/);
  assert.match(maplibre, /kmm-map-sheet-backdrop md:hidden/);
  assert.match(workspace, /!mapFullscreen\s*&&[\s\S]*?\(compareMode\s*\?/);
  assert.match(workspace, /onFullscreenChange=\{setMapFullscreen\}/);
  assert.match(workspace, /data-marketing-workspace/);
  assert.match(workspace, /Salesman/);
  assert.match(panel, /onCollapse\?:/);
  assert.match(workspace, /Last Visit/);
});


test("Map Architecture V2 is PCode-ready while village rendering stays optional", async () => {
  const [geography, maplibre, sharedMap] = await Promise.all([
    read("lib/maps/geography.ts"),
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/marketing/myanmar-marketing-map.tsx"),
  ]);
  assert.match(geography, /"state_region"/);
  assert.match(geography, /"district"/);
  assert.match(geography, /"township"/);
  assert.match(geography, /"village_tract"/);
  assert.match(geography, /"village"/);
  assert.match(geography, /pcode\?: string \| null/);
  assert.match(geography, /parentPcode\?: string \| null/);
  assert.match(sharedMap, /villagePoints\?: readonly VillagePoint\[\]/);
  assert.match(maplibre, /villagePoints = \[\]/);
  assert.match(maplibre, /if \(!villagePoints\.length\)/);
  assert.match(maplibre, /VILLAGE_MIN_ZOOM = 10/);
  assert.match(maplibre, /minzoom: 12/);
});

test("Map Architecture V2 preserves showroom coordinates and township sales geography sources", async () => {
  const [showroomsRaw, intelligence, geography] = await Promise.all([
    read("public/maps/kmm-showrooms.json"),
    read("components/marketing/marketing-intelligence-page.tsx"),
    read("lib/marketing/township-geography.ts"),
  ]);
  const showrooms = JSON.parse(showroomsRaw);
  const byId = Object.fromEntries(showrooms.map((row) => [row.id, row.coordinates]));
  assert.deepEqual(byId["KMM-MAWLAMYINE"], [97.58796586144803, 16.551014829832265]);
  assert.deepEqual(byId["KMM-MYAWADDY"], [98.40899139590378, 16.697570801389162]);
  assert.deepEqual(byId["KMM-HPAAN"], [97.67833921863583, 16.850519686471458]);
  assert.deepEqual(byId["KMM-THARYARWADDY"], [95.7850121824317, 17.637161998340396]);
  assert.deepEqual(byId["KMM-NATTALIN"], [95.54490214925025, 18.4418173872767]);
  assert.deepEqual(byId["KMM-NAWNGHKIO"], [96.80052978171858, 22.331490123697]);
  assert.match(intelligence, /resolveTownship\(row\.township, row\.stateRegion\)/);
  assert.match(intelligence, /salesUnits\.set\(resolved\.key/);
  assert.match(geography, /const canonicalLocationId = candidates\[0\]\.township_id/);
});


test("Village importer rejects non-commercial providers and invalid geometry without touching township data", async () => {
  const geography = await read("lib/maps/geography.ts");
  assert.match(geography, /commercialUseAllowed/);
  assert.match(geography, /PROVIDER_COMMERCIAL_USE_NOT_ALLOWED/);
  assert.match(geography, /MISSING_COORDINATES/);
  assert.match(geography, /INVALID_COORDINATES/);
  assert.match(geography, /mm-village-/);
});
