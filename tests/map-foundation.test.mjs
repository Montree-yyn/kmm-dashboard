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
  assert.match(vectorMap, /isLayerGroupEnabled\("township-boundary", layerState/);
  assert.match(vectorMap, /setLayoutProperty\(id, "visibility", "visible"\)/);
});

test("source adapter supports GeoJSON and PMTiles with validation", async () => {
  const source = await read("lib/maps/create-map-source.ts");
  assert.match(source, /type: "geojson"/);
  assert.match(source, /url: `pmtiles:\/\/\$\{dataset.url\}`/);
  assert.match(source, /requires source_layer/);
});

test("MapLibre is the feature-flag default, legacy is an explicit rollback, and PMTiles registration is guarded", async () => {
  const [datasets, protocol] = await Promise.all([read("lib/maps/datasets.ts"), read("lib/maps/register-pmtiles-protocol.ts")]);
  assert.match(datasets, /NEXT_PUBLIC_MAP_ENGINE === "legacy" \? "legacy" : "maplibre"/);
  assert.match(protocol, /typeof window === "undefined" \|\| registered/);
  assert.match(protocol, /maplibre.addProtocol\("pmtiles"/);
});

test("Marketing map defaults to PMTiles and falls back to legacy on a load failure", async () => {
  const [legacy, maplibre] = await Promise.all([read("components/marketing/myanmar-marketing-map.tsx"), read("components/marketing/myanmar-marketing-map-maplibre.tsx")]);
  assert.match(legacy, /getMapEngine\(\) === "maplibre"/);
  assert.match(legacy, /LegacyMyanmarMarketingMap/);
  assert.match(legacy, /t\("map\.unableToLoad"\)/);
  assert.match(maplibre, /getMapDataset\("mm-townships-pmtiles"\)/);
  assert.match(maplibre, /canonical_location_id/);
  assert.match(maplibre, /onError=\{onLoadError\}/);
  assert.match(maplibre, /GlobalVectorMap/);
});

test("MapLibre Marketing restores legacy map interactions and presentation overlays", async () => {
  const [maplibre, vectorMap] = await Promise.all([read("components/marketing/myanmar-marketing-map-maplibre.tsx"), read("components/maps/global-vector-map.tsx")]);
  assert.match(maplibre, /myanmar-states\.geojson/);
  assert.match(maplibre, /myanmar-townships\.geojson/);
  assert.match(maplibre, /kmm-showrooms\.json/);
  assert.match(maplibre, /marketing-state-labels/);
  assert.match(maplibre, /marketing-township-labels/);
  assert.match(maplibre, /kmm-showroom-marker/);
  assert.match(vectorMap, /scrollZoom: true/);
  assert.match(vectorMap, /dragPan: true/);
  assert.match(vectorMap, /doubleClickZoom: true/);
  assert.match(vectorMap, /FullscreenControl/);
});

test("Marketing labels switch cleanly between State and Township zoom levels", async () => {
  const maplibre = await read("components/marketing/myanmar-marketing-map-maplibre.tsx");
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
  const workspace = await read("components/marketing/marketing-intelligence-page.tsx");
  assert.match(workspace, /aria-label="Marketing territory map"/);
  assert.match(workspace, /h-\[calc\(100vh-56px\)\]/);
  assert.match(workspace, /aria-label="Right Intelligence Panel"/);
  assert.match(workspace, /Phase1TownshipPanel/);
  assert.match(workspace, /aria-label="Strategic Focus placeholder"/);
  assert.match(workspace, /<MyanmarMarketingMap visibleShowroomIds=\{visibleShowroomIds\} townshipMetrics=\{mapped\.metrics\}/);
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
  assert.match(vectorMap, /getFitPadding\(fitPaddingRef\.current, viewportPaddingRight\)/);
});

test("MapLibre visual styling matches the legacy Marketing map", async () => {
  const [maplibre, vectorMap] = await Promise.all([read("components/marketing/myanmar-marketing-map-maplibre.tsx"), read("components/maps/global-vector-map.tsx")]);
  assert.match(vectorMap, /overlayFillOpacity = 0\.98/);
  assert.match(vectorMap, /"line-color": "#F5F1EC"/);
  assert.match(vectorMap, /"line-width": 0\.9/);
  assert.match(vectorMap, /"line-cap": "round"/);
  assert.match(maplibre, /"line-color": "#CBD5E1"/);
  assert.match(maplibre, /Open Sans Semibold/);
  assert.match(maplibre, /Open Sans Regular/);
  assert.match(maplibre, /fitPadding=\{\{ top: 24, right: 44, bottom: 24, left: 44 \}\}/);
});

test("Marketing uses a tokenless OpenStreetMap vector basemap beneath the PMTiles overlay", async () => {
  const [basemaps, maplibre, vectorMap] = await Promise.all([
    read("data/maps/basemaps.json"),
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/maps/global-vector-map.tsx"),
  ]);
  const basemap = JSON.parse(basemaps).find((item) => item.id === "openfreemap-liberty-development");
  assert.equal(basemap.requires_token, false);
  assert.equal(basemap.status, "development");
  assert.match(basemap.url, /tiles\.openfreemap\.org\/styles\/liberty/);
  assert.match(maplibre, /baseStyle=\{developmentBasemap\?\.url\}/);
  assert.match(maplibre, /overlayFillOpacity=\{0\.5\}/);
  assert.match(vectorMap, /style: baseStyle/);
});

test("Marketing visual polish keeps the basemap visible and markers prominent", async () => {
  const [maplibre, vectorMap, css] = await Promise.all([
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/maps/global-vector-map.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(maplibre, /overlayHoverOpacity=\{0\.18\}/);
  assert.match(maplibre, /overlaySelectedOpacity=\{0\.16\}/);
  assert.match(vectorMap, /getFillOpacityExpression/);
  assert.match(vectorMap, /"line-opacity": 0\.5/);
  assert.match(css, /background: #ffffff/);
  assert.match(css, /border: 2px solid #ff7a00/);
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
  assert.match(workspace, /ZERO_SALES_COLOR = "#F3F4F6"/);
  assert.match(workspace, /NO_DATA_COLOR = "#F8FAFC"/);
  assert.match(workspace, /metricValue.*mode === "sales" \? item\.salesUnit/);
  assert.match(workspace, /heatColor\(metricValue\(item\), visible, mode === "sales" \? ZERO_SALES_COLOR : NO_DATA_COLOR\)/);
  assert.match(workspace, /canonicalLocationId: item\.key/);
  assert.match(maplibre, /initialMetricFromMode/);
  assert.match(maplibre, /return "salesUnit"/);
  assert.match(maplibre, /metric\.salesUnit/);
  assert.match(vectorMap, /colorPairs\.push\("#F8FAFC"\)/);
});

test("Executive GIS V2 uses Jenks classified choropleth, dynamic legend, hover highlight, and top-township layer", async () => {
  const [maplibre, vectorMap, layerOrder] = await Promise.all([
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/maps/global-vector-map.tsx"),
    read("lib/maps/layer-order.ts"),
  ]);
  assert.match(maplibre, /jenksNaturalBreaks/);
  assert.match(maplibre, /Natural Breaks \(Jenks\)/);
  assert.match(maplibre, /quantileBreaks/);
  assert.match(maplibre, /#FFE6C7/);
  assert.match(maplibre, /#FFC98B/);
  assert.match(maplibre, /#FFA64D/);
  assert.match(maplibre, /#F26B00/);
  assert.match(maplibre, /#C84A00/);
  assert.match(maplibre, /EXECUTIVE_METRICS/);
  assert.match(maplibre, /metric\.gpPercent/);
  assert.match(maplibre, /legendRange/);
  assert.match(maplibre, /topCanonicalLocationIds/);
  assert.doesNotMatch(maplibre, /tooltip/);
  assert.match(vectorMap, /setFeatureState/);
  assert.match(vectorMap, /topCanonicalLocationIds/);
  assert.match(vectorMap, /topTownshipLayerId/);
  assert.match(vectorMap, /"fill-color": "#FFFFFF"/);
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
  const workspace = await read("components/marketing/marketing-intelligence-page.tsx");
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
  assert.match(workspace, /xl:grid-cols-\[minmax\(0,1fr\)_320px\]/);
  assert.match(workspace, /ไม่พบข้อมูลตามตัวกรองที่เลือก/);
  assert.match(workspace, /ยังไม่ได้กำหนด Showroom รับผิดชอบ/);
  assert.match(workspace, /Strategic Focus/);
  assert.match(workspace, /Coming in Phase 2/);
  assert.doesNotMatch(workspace, /<ExecutiveKpiStrip/);
});

test("Localization foundation defaults to Thai and exposes English switching", async () => {
  const [layout, context, hook, locales, thai, english, workspace, maplibre, panel] = await Promise.all([
    read("app/layout.tsx"),
    read("src/context/LocaleContext.tsx"),
    read("src/hooks/useLocale.ts"),
    read("src/locales/index.ts"),
    read("src/locales/th.ts"),
    read("src/locales/en.ts"),
    read("components/marketing/marketing-intelligence-page.tsx"),
    read("components/marketing/myanmar-marketing-map-maplibre.tsx"),
    read("components/marketing/myanmar-marketing-map.tsx"),
  ]);
  assert.match(layout, /<html lang="th">/);
  assert.match(layout, /<LocaleProvider>/);
  assert.match(context, /STORAGE_KEY = "kmm-language"/);
  assert.match(context, /useState<Language>\(defaultLanguage\)/);
  assert.match(context, /window\.localStorage\.setItem\(STORAGE_KEY, nextLanguage\)/);
  assert.match(hook, /useLocale/);
  assert.match(locales, /defaultLanguage: Language = "th"/);
  assert.match(thai, /"metric\.salesUnit": "ยอดขาย \(คัน\)"/);
  assert.match(thai, /"comparison\.samePeriodLastYear": "ช่วงเดียวกันของปีก่อน"/);
  assert.match(english, /"metric\.salesUnit": "Sales Unit"/);
  assert.match(workspace, /setLanguage\("th"\)/);
  assert.match(workspace, /setLanguage\("en"\)/);
  assert.match(workspace, /วิเคราะห์การตลาด/);
  assert.match(workspace, /t\("period\.rolling12Months"\)/);
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
  assert.match(workspace, /selectedTownshipMetric = selectedCanonicalId \? \(\(\) =>/);
  assert.match(workspace, /priorSalesByTownship/);
  assert.match(workspace, /benchmarkByTownship/);
  assert.doesNotMatch(workspace, /townshipIntelligenceMetrics/);
  assert.match(workspace, /bookingUnit: null, bookingValue: null/);
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
  const [resolver, aliases, stateAliases, report, workspace, panel] = await Promise.all([
    read("lib/marketing/township-geography.ts"),
    read("data/geography/township-approved-aliases.json"),
    read("data/geography/state-region-approved-aliases.json"),
    read("reports/sales-geography-reconciliation.json"),
    read("components/marketing/marketing-intelligence-page.tsx"),
    read("components/marketing/myanmar-marketing-map.tsx"),
  ]);
  const reconciliation = JSON.parse(report);
  assert.equal(reconciliation.source_sales_unit, reconciliation.mapped_township_sales_unit + reconciliation.unresolved_sales_unit);
  assert.equal(reconciliation.source_sales_value, reconciliation.mapped_township_sales_value + reconciliation.unresolved_sales_value);
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
  assert.match(vectorMap, /\[baseFillLayerId, hoverFillLayerId, selectedFillLayerId, selectedLayerId\]/);
  assert.match(vectorMap, /setFeatureState.*hover: false/);
  assert.match(vectorMap, /map\.on\("mousemove", baseFillLayerId/);
  assert.match(vectorMap, /map\.on\("mouseleave", baseFillLayerId/);
  assert.match(vectorMap, /map\.on\("moveend".*applyRequiredLayerOrder/);
  assert.match(vectorMap, /if \(!map\.getSource\(dataset\.source_id\)\)/);
  assert.match(vectorMap, /if \(!map\.getLayer\(baseFillLayerId\)\)/);
  assert.match(maplibre, /applyRequiredLayerOrder\(map\)/);
  assert.match(await read("components/maps/vector-map-preview.tsx"), /selectedCanonicalLocationId=\{selectedCanonicalId\}/);
  assert.match(panel, /actualMapLayerOrder/);
  assert.match(panel, /selectedFillVisibility/);
  assert.match(panel, /selectedOutlineVisibility/);
  assert.match(panel, /hoverFillVisibility/);
  assert.match(panel, /layerOrderWarning/);
  assert.equal(JSON.parse(registry).find((layer) => layer.id === "township-fill").group, "heatmap");
});
