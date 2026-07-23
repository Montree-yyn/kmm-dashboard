"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";
import { AlertTriangle, X } from "lucide-react";
import townshipMaster from "../../data/master-townships.json";
import { normalizeLocation } from "../../lib/marketing/location-mapping";
import { cn } from "../../lib/utils";
import { getMapEngine } from "../../lib/maps/datasets";
import { useLocale } from "../../src/hooks/useLocale";
import { MyanmarMarketingMapMapLibre } from "./myanmar-marketing-map-maplibre";

type Showroom = { id: string; name: string; stateRegion: string; township: string; coordinates: [number, number] };
type GeoFeature = { geometry?: { coordinates?: unknown }; properties: { TS?: string; TS_PCODE?: string; ST?: string } };
type LabelFeature = { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: { id: string; name: string } };
type LabelCollection = { type: "FeatureCollection"; features: LabelFeature[] };
type SalesByProduct = { tractor: number; combineHarvester: number; excavator: number; transplanter: number; drone: number; other: number };
export type TownshipMetric = {
  township: string;
  stateRegion: string;
  installedBase: number;
  population: number;
  installedBaseByProduct: SalesByProduct;
  salesByProduct: SalesByProduct;
  salesUnit: number;
  salesValue: number;
  gpValue: number;
  gpPercent: number | null;
  hasFilteredSalesData?: boolean;
  bookingUnit: number | null;
  bookingValue: number | null;
  activities: number;
  lastActivityDate: string | null;
  activityDensity: number | null;
  topActivityType: string | null;
  lastActivityType?: string | null;
  riskLevel?: string | null;
  installedBaseDensity?: number | null;
  agriculturalArea?: number | null;
  mainCrops?: string[] | null;
  density: number | null;
  fill: string;
  canonicalLocationId?: string;
  responsibleShowroom?: string | null;
  salesTerritory?: string | null;
  topModels?: { model: string; unit: number; metric: "Sales Unit" | "Installed Base" }[];
  topSalesperson?: string | null;
  unresolvedGeographyCount?: number;
  debugCompanySales?: { unit: number; value: number };
  debugCompanyBooking?: { unit: number; value: number };
  debugCompanyInstalledBase?: number;
  debugSalesReconciliation?: unknown;
  periodLabel?: string;
  comparisonLabel?: string;
  comparison?: { salesUnit: number; salesValue: number; gpValue: number; gpPercent: number | null; activities: number };
  debugPeriod?: unknown;
};
type FitPadding = { top: number; right: number; bottom: number; left: number };

export type MyanmarMarketingMapProps = {
  visibleShowroomIds?: string[];
  townshipMetrics?: Record<string, TownshipMetric>;
  productLabel?: string;
  mode?: "sales" | "population" | "activity";
  activeMetric?: "salesUnit" | "salesValue" | "gpValue" | "gpPercent";
  filterContext?: { year: string; month: string; product: string };
  onActiveMetricChange?: (metric: "salesUnit" | "salesValue" | "gpValue" | "gpPercent") => void;
  onSelectedTownshipChange?: (canonicalLocationId: string | null) => void;
  resetSignal?: number;
  className?: string;
};

const MYANMAR_BOUNDS: [[number, number], [number, number]] = [
  [92.17210485865233, 9.60588355708055],
  [101.17001505455121, 28.54553886232867],
];
const EMPTY_LABELS: LabelCollection = { type: "FeatureCollection", features: [] };
const MAP_CAMERA_PADDING: FitPadding = { top: 24, right: 44, bottom: 24, left: 44 };
const masterLocationIds = new Map((townshipMaster as { township_id: string; township: string; state_region: string }[]).map((record) => [`${normalizeLocation(record.township)}|${normalizeLocation(record.state_region)}`, record.township_id]));
const MOBILE_BREAKPOINT = 768;
const REGION_ALIASES: Record<string, string> = {
  ayeyarwady: "ayeyarwady",
  irrawaddy: "ayeyarwady",
  tanintharyi: "tanintharyi",
  tenasserim: "tanintharyi",
  rakhine: "rakhine",
  arakan: "rakhine",
  mon: "mon",
  shan: "shan",
  bago: "bago",
  kayin: "kayin",
  kayah: "kayah",
};
const MAP_STYLE = {
  version: 8,
  sources: {
    states: { type: "geojson", data: "/maps/myanmar-states.geojson" },
    townships: { type: "geojson", data: "/maps/myanmar-townships.geojson" },
    regionLabels: { type: "geojson", data: EMPTY_LABELS },
    townshipLabels: { type: "geojson", data: EMPTY_LABELS },
  },
  layers: [
    { id: "kmm-background", type: "background", paint: { "background-color": "#F8FAFC" } },
    { id: "myanmar-state-fill", type: "fill", source: "states", paint: { "fill-color": "#FFFFFF", "fill-opacity": 1 } },
    { id: "township-heatmap", type: "fill", source: "townships", paint: { "fill-color": "#FFFFFF", "fill-opacity": 0.98 } },
    { id: "myanmar-state-line", type: "line", source: "states", paint: { "line-color": "#CBD5E1", "line-width": 1 } },
    { id: "myanmar-township-line", type: "line", source: "townships", minzoom: 4, paint: { "line-color": "#E5E7EB", "line-opacity": 0.75, "line-width": 0.45 } },
    {
      id: "myanmar-state-label",
      type: "symbol",
      source: "regionLabels",
      minzoom: 3,
      layout: { "text-field": ["get", "name"], "text-size": 11, "text-font": ["Open Sans Semibold"], "text-allow-overlap": false, "text-ignore-placement": false, "text-padding": 8 },
      paint: { "text-color": "#4B5563", "text-halo-color": "#FFFFFF", "text-halo-width": 1 },
    },
    {
      id: "myanmar-township-label",
      type: "symbol",
      source: "townshipLabels",
      minzoom: 6.8,
      layout: { "text-field": ["get", "name"], "text-size": 10, "text-font": ["Open Sans Regular"], "text-allow-overlap": false, "text-ignore-placement": false, "text-padding": 5 },
      paint: { "text-color": "#4B5563", "text-halo-color": "#FFFFFF", "text-halo-width": 1 },
    },
  ],
} as unknown as StyleSpecification;

function format(value: number) {
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatMoney(value: number) {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return format(value);
}

function normalizeRegionName(name = "") {
  const base = normalizeLocation(name.replace(/\b(state|region|division)\b/gi, ""));
  return REGION_ALIASES[base] ?? base;
}

function collectPoints(input: unknown, points: [number, number][] = []) {
  if (!Array.isArray(input)) return points;
  if (typeof input[0] === "number" && typeof input[1] === "number") points.push([input[0], input[1]]);
  else input.forEach((item) => collectPoints(item, points));
  return points;
}

function labelsFromFeatures(features: GeoFeature[], labelType: "region" | "township"): LabelCollection {
  const groups = new Map<string, { name: string; points: [number, number][] }>();
  features.forEach((feature) => {
    const name = labelType === "region" ? feature.properties.ST : feature.properties.TS;
    const regionKey = normalizeRegionName(feature.properties.ST);
    const key = labelType === "region" ? regionKey : `${regionKey}-${normalizeLocation(feature.properties.TS)}`;
    const points = collectPoints(feature.geometry?.coordinates);
    if (!name || !key || !points.length) return;
    const group = groups.get(key) ?? { name, points: [] };
    group.points.push(...points);
    groups.set(key, group);
  });
  return {
    type: "FeatureCollection",
    features: Array.from(groups, ([id, group]) => {
      const coordinates: [number, number] = [
        group.points.reduce((total, point) => total + point[0], 0) / group.points.length,
        group.points.reduce((total, point) => total + point[1], 0) / group.points.length,
      ];
      return { type: "Feature", geometry: { type: "Point", coordinates }, properties: { id, name: group.name } };
    }),
  };
}

function setGeoJsonSource(map: MapLibreMap, id: string, data: LabelCollection) {
  const source = map.getSource(id) as { setData?: (nextData: LabelCollection) => void } | undefined;
  source?.setData?.(data);
}

function fitMyanmar(map: MapLibreMap) {
  const container = map.getContainer();
  if (container.clientWidth === 0 || container.clientHeight === 0) return null;

  const camera = map.cameraForBounds(MYANMAR_BOUNDS, { padding: MAP_CAMERA_PADDING });
  if (!camera?.center || typeof camera.zoom !== "number") return null;

  const appliedZoom = camera.zoom;
  map.jumpTo({ center: camera.center, zoom: appliedZoom, bearing: 0, pitch: 0 });
  if (process.env.NODE_ENV === "development") {
    requestAnimationFrame(() => {
      const container = map.getContainer();
      const visibleBounds = map.getBounds().toArray();

      console.log("[Myanmar Map Runtime Debug]", {
        containerClientWidth: container.clientWidth,
        containerClientHeight: container.clientHeight,
        transformWidth: map.transform.width,
        transformHeight: map.transform.height,
        calculatedCamera: camera,
        appliedZoom: map.getZoom(),
        appliedCenter: map.getCenter(),
        visibleBounds,
        requiredBounds: MYANMAR_BOUNDS,
        containsWest:
          visibleBounds[0][0] <= MYANMAR_BOUNDS[0][0],
        containsSouth:
          visibleBounds[0][1] <= MYANMAR_BOUNDS[0][1],
        containsEast:
          visibleBounds[1][0] >= MYANMAR_BOUNDS[1][0],
        containsNorth:
          visibleBounds[1][1] >= MYANMAR_BOUNDS[1][1],
      });
    });
  }
  return { calculatedZoom: camera.zoom, appliedZoom, center: camera.center };
}

function shouldUseBottomSheet() {
  if (window.innerWidth < MOBILE_BREAKPOINT) return true;
  return false;
}

function metricForLegacyFeature(metrics: Record<string, TownshipMetric>, feature: GeoFeature) {
  const canonicalId = masterLocationIds.get(`${normalizeLocation(feature.properties.TS)}|${normalizeLocation(feature.properties.ST)}`);
  return (canonicalId ? metrics[canonicalId] : undefined) ?? metrics[normalizeLocation(feature.properties.TS)];
}

const PRODUCT_ROWS: { key: keyof SalesByProduct; label: string }[] = [
  { key: "tractor", label: "Tractor" },
  { key: "combineHarvester", label: "Combine Harvester" },
  { key: "excavator", label: "Excavator" },
  { key: "transplanter", label: "Transplanter" },
  { key: "drone", label: "MAX" },
  { key: "other", label: "Other Engine Products" },
];

export type TownshipDebugStatus = {
  selectedFeatureId: string | number | null;
  hoveredFeatureId: string | number | null;
  selectedCanonicalLocationId: string | null;
  activeMetricLayer: string | null;
  zoom: number | null;
  visibleLayerIds: string[];
  actualMapLayerOrder: string[];
  selectedFillVisibility: boolean;
  selectedOutlineVisibility: boolean;
  hoverFillVisibility: boolean;
  layerOrderWarning: boolean;
};

function TownshipDebugPanel({ metric, mapStatus }: { metric: TownshipMetric; mapStatus: TownshipDebugStatus | null }) {
  const { t } = useLocale();
  const enabled = process.env.NODE_ENV !== "production" && (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEBUG_PANEL === "true");
  if (!enabled) return null;
  const joinStatus = metric.unresolvedGeographyCount ? "Partial" : "OK";
  const debug = {
    selectedTownship: metric.township,
    selectedStateRegion: metric.stateRegion,
    canonical_location_id: metric.canonicalLocationId ?? null,
    resolvedAlias: null,
    joinStatus,
    datasets: {
      sales: metric.debugSalesReconciliation ?? { matchedRows: metric.salesUnit, matchedValue: metric.salesValue, missingRows: 0, ignoredRows: metric.unresolvedGeographyCount ?? 0 },
      booking: { matchedRows: null, matchedValue: null, missingRows: null, ignoredRows: null, note: "Township geography unavailable in verified booking data" },
      installedBase: { matchedRows: metric.installedBase, matchedValue: metric.installedBase, missingRows: 0, ignoredRows: 0 },
      marketing: { matchedRows: metric.activities, matchedValue: metric.activities, missingRows: 0, ignoredRows: metric.unresolvedGeographyCount ?? 0 },
    },
    joinDetails: { key: metric.canonicalLocationId ?? null, matchedBy: "canonical_location_id" },
    businessTotalCheck: {
      companySales: metric.debugCompanySales ?? null,
      companyBooking: metric.debugCompanyBooking ?? null,
      companyInstalledBase: metric.debugCompanyInstalledBase ?? null,
      selectedTownshipSales: { unit: metric.salesUnit, value: metric.salesValue },
      selectedTownshipBooking: metric.bookingUnit === null ? "Unavailable: verified booking data has no township geography" : { unit: metric.bookingUnit, value: metric.bookingValue },
      selectedTownshipInstalledBase: metric.installedBase,
      difference: { salesUnit: metric.debugCompanySales ? metric.debugCompanySales.unit - metric.salesUnit : null, installedBase: metric.debugCompanyInstalledBase === undefined ? null : metric.debugCompanyInstalledBase - metric.installedBase },
    },
    mapStatus: {
      selectedFeatureId: mapStatus?.selectedFeatureId ?? metric.canonicalLocationId ?? null,
      hoveredFeatureId: mapStatus?.hoveredFeatureId ?? null,
      selectedCanonicalLocationId: mapStatus?.selectedCanonicalLocationId ?? metric.canonicalLocationId ?? null,
      activeMetricLayer: mapStatus?.activeMetricLayer ?? null,
      currentZoom: mapStatus?.zoom ?? null,
      visibleLayerIds: mapStatus?.visibleLayerIds ?? [],
      actualMapLayerOrder: mapStatus?.actualMapLayerOrder ?? [],
      selectedFillVisibility: mapStatus?.selectedFillVisibility ?? false,
      selectedOutlineVisibility: mapStatus?.selectedOutlineVisibility ?? false,
      hoverFillVisibility: mapStatus?.hoverFillVisibility ?? false,
      layerOrderWarning: mapStatus?.layerOrderWarning ?? false,
      layers: { heatmap: true, boundary: true, labels: true, showrooms: true, installedBase: false, sales: false, booking: false, marketing: false },
    },
    dataQuality: { resolved: !metric.unresolvedGeographyCount, pendingAliases: "Not available in panel scope", duplicateCanonicalIds: "Not available in panel scope", unknownTownshipCount: metric.unresolvedGeographyCount ?? 0, unknownStateCount: metric.unresolvedGeographyCount ?? 0 },
    timeFilter: metric.debugPeriod ?? null,
  };
  const json = JSON.stringify(debug, null, 2);
  const copy = () => { void navigator.clipboard?.writeText(json); };
  const exportJson = () => { const url = URL.createObjectURL(new Blob([json], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "sales-geography-reconciliation.json"; link.click(); URL.revokeObjectURL(url); };
  return <details className="kmm-township-detail-section kmm-township-debug"><summary>{t("debug.title")}</summary><div className="mt-3 flex gap-2"><button type="button" onClick={copy}>{t("common.copy")}</button><button type="button" onClick={exportJson}>{t("common.exportDebugJson")}</button></div><pre>{json}</pre></details>;
}

export function MyanmarTownshipDetailPanel({ metric, onClose, mobile = false, mapStatus = null }: { metric: TownshipMetric; onClose: () => void; mobile?: boolean; mapStatus?: TownshipDebugStatus | null }) {
  const { t } = useLocale();

  return (
    <aside className={cn("kmm-township-detail-panel", mobile && "kmm-township-detail-panel-mobile")}>
      <div className="kmm-township-detail-header">
        <div>
          <h3>{metric.township}</h3>
          <p>{metric.stateRegion}</p>
          {metric.responsibleShowroom && <p>{t("metric.showroom")} · {metric.responsibleShowroom}</p>}
          {metric.salesTerritory && <p>{t("panel.territory")} · {metric.salesTerritory}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label={t("common.clearTownshipSelection")}>
          <X size={16} />
        </button>
      </div>

      <section className="kmm-township-detail-section">
        <h4>Area</h4>
        <dl className="kmm-township-metric-list">
          <div><dt>Township</dt><dd>{metric.township}</dd></div>
          <div><dt>State / Region</dt><dd>{metric.stateRegion}</dd></div>
        </dl>
      </section>

      <section className="kmm-township-detail-section">
        <h4>{t("panel.salesPerformance")}</h4>
        <dl className="kmm-township-metric-list">
          <div><dt>{t("metric.salesUnit")}</dt><dd>{format(metric.salesUnit)}</dd></div>
          <div><dt>{t("metric.salesValue")}</dt><dd>{formatMoney(metric.salesValue)} MMK</dd></div>
          <div><dt>{t("metric.gpValue")}</dt><dd>{formatMoney(metric.gpValue)} MMK</dd></div>
          <div><dt>{t("metric.gpPercent")}</dt><dd>{metric.gpPercent === null ? t("common.notAvailable") : `${metric.gpPercent.toFixed(1)}%`}</dd></div>
        </dl>
        {metric.comparison && <p className="mt-3 text-xs text-[#6B7280]">{t("comparison.title")} · {metric.comparisonLabel}: {t("metric.salesUnit")} {format(metric.comparison.salesUnit)} · {t("metric.salesValue")} {formatMoney(metric.comparison.salesValue)} MMK</p>}
      </section>

    </aside>
  );
}

function LegacyMyanmarMarketingMap({ visibleShowroomIds, townshipMetrics = {}, mode = "population", resetSignal = 0, className, fallbackNotice = false }: MyanmarMarketingMapProps & { fallbackNotice?: boolean }) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const townshipsRef = useRef<GeoFeature[]>([]);
  const resizeTimerRef = useRef<number | null>(null);
  const fitLogRef = useRef(false);
  const markersRef = useRef(new Map<string, Marker>());
  const metricsRef = useRef(townshipMetrics);
  const visibleIdsRef = useRef(visibleShowroomIds);
  const sheetStartYRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedMetric, setSelectedMetric] = useState<TownshipMetric | null>(null);

  const closeSelection = () => {
    setSelectedMetric(null);
  };

  const logFitOnce = (map: MapLibreMap, camera: NonNullable<ReturnType<typeof fitMyanmar>>) => {
    if (process.env.NODE_ENV !== "development" || fitLogRef.current) return;
    const container = map.getContainer();
    const visibleBounds = map.getBounds().toArray();
    console.log({
      containerWidth: container.clientWidth,
      containerHeight: container.clientHeight,
      calculatedZoom: camera.calculatedZoom,
      appliedZoom: camera.appliedZoom,
      center: camera.center,
      visibleBounds,
      requiredBounds: MYANMAR_BOUNDS,
      containsMyanmar: visibleBounds[0][0] <= MYANMAR_BOUNDS[0][0]
        && visibleBounds[0][1] <= MYANMAR_BOUNDS[0][1]
        && visibleBounds[1][0] >= MYANMAR_BOUNDS[1][0]
        && visibleBounds[1][1] >= MYANMAR_BOUNDS[1][1],
    });
    fitLogRef.current = true;
  };

  const runResizeThenFit = (map: MapLibreMap) => {
    requestAnimationFrame(() => {
      map.resize();

      requestAnimationFrame(() => {
        const camera = fitMyanmar(map);
        if (camera) logFitOnce(map, camera);
      });
    });
  };

  const scheduleResizeThenFit = (map: MapLibreMap, debounce = true) => {
    if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
    if (!debounce) {
      runResizeThenFit(map);
      return;
    }
    resizeTimerRef.current = window.setTimeout(() => runResizeThenFit(map), 120);
  };

  const applyMetrics = () => {
    const map = mapRef.current;
    if (!map?.loaded()) return;
    const pairs: unknown[] = ["match", ["get", "TS_PCODE"]];
    townshipsRef.current.forEach((feature) => {
      const key = normalizeLocation(feature.properties.TS);
      const metric = metricForLegacyFeature(metricsRef.current, feature);
      if (feature.properties.TS_PCODE && metric) pairs.push(feature.properties.TS_PCODE, metric.fill);
    });
    pairs.push("#FFFFFF");
    map.setPaintProperty("township-heatmap", "fill-color", pairs as never);
  };

  useEffect(() => {
    metricsRef.current = townshipMetrics;
    applyMetrics();
  }, [townshipMetrics, mode]);

  useEffect(() => {
    visibleIdsRef.current = visibleShowroomIds;
    markersRef.current.forEach((marker, id) => {
      marker.getElement().style.display = !visibleShowroomIds?.length || visibleShowroomIds.includes(id) ? "block" : "none";
    });
  }, [visibleShowroomIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.loaded()) return;
    scheduleResizeThenFit(map, false);
  }, [resetSignal]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let visibilityObserver: IntersectionObserver | undefined;
    let handleViewportChange: (() => void) | undefined;
    let handleVisibilityChange: (() => void) | undefined;
    const markers = markersRef.current;

    async function init() {
      try {
        const [{ default: maplibregl }, showroomResponse, townshipResponse, stateResponse] = await Promise.all([
          import("maplibre-gl"),
          fetch("/maps/kmm-showrooms.json", { cache: "no-store" }),
          fetch("/maps/myanmar-townships.geojson", { cache: "no-store" }),
          fetch("/maps/myanmar-states.geojson", { cache: "no-store" }),
        ]);
        if (!showroomResponse.ok || !townshipResponse.ok || !stateResponse.ok) throw new Error("Unable to load Myanmar map files.");
        const showrooms = await showroomResponse.json() as Showroom[];
        const townships = await townshipResponse.json() as { features: GeoFeature[] };
        const states = await stateResponse.json() as { features: GeoFeature[] };
        if (disposed || !containerRef.current) return;

        townshipsRef.current = townships.features;
        const regionLabels = labelsFromFeatures(states.features, "region");
        const townshipLabels = labelsFromFeatures(townships.features, "township");
        const map = new maplibregl.Map({
          attributionControl: false,
          container: containerRef.current,
          minZoom: 0,
          maxZoom: 12,
          renderWorldCopies: false,
          style: MAP_STYLE,
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        observer = new ResizeObserver(() => {
          if (disposed) return;
          scheduleResizeThenFit(map);
          closeSelection();
        });
        observer.observe(containerRef.current);
        visibilityObserver = new IntersectionObserver((entries) => {
          if (disposed || !entries.some((entry) => entry.isIntersecting)) return;
          scheduleResizeThenFit(map);
        }, { threshold: 0.01 });
        visibilityObserver.observe(containerRef.current);
        handleViewportChange = () => {
          if (disposed) return;
          scheduleResizeThenFit(map);
          closeSelection();
        };
        handleVisibilityChange = () => {
          if (disposed || document.visibilityState !== "visible") return;
          scheduleResizeThenFit(map);
        };
        window.addEventListener("resize", handleViewportChange);
        document.addEventListener("fullscreenchange", handleViewportChange);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        map.on("load", () => {
          if (disposed) return;
          setGeoJsonSource(map, "regionLabels", regionLabels);
          setGeoJsonSource(map, "townshipLabels", townshipLabels);
          runResizeThenFit(map);
          showrooms.forEach((showroom) => {
            const element = document.createElement("button");
            element.type = "button";
            element.className = "kmm-showroom-marker";
            element.setAttribute("aria-label", `View ${showroom.name}`);
            element.style.display = !visibleIdsRef.current?.length || visibleIdsRef.current.includes(showroom.id) ? "block" : "none";
            element.addEventListener("click", (event) => {
              event.stopPropagation();
              const metric = metricsRef.current[normalizeLocation(showroom.township)];
              if (metric) setSelectedMetric(metric);
              map.flyTo({ center: showroom.coordinates, zoom: Math.max(map.getZoom(), 7), duration: 500, essential: true });
            });
            markers.set(showroom.id, new maplibregl.Marker({ element, anchor: "center" }).setLngLat(showroom.coordinates).addTo(map));
          });
          applyMetrics();

          map.on("mousemove", "township-heatmap", (event) => {
            const feature = event.features?.[0] as GeoFeature | undefined;
            const metric = feature ? metricForLegacyFeature(metricsRef.current, feature) : undefined;
            map.getCanvas().style.cursor = metric ? "pointer" : "";
          });
          map.on("mouseleave", "township-heatmap", () => {
            map.getCanvas().style.cursor = "";
          });
          map.on("click", "township-heatmap", (event) => {
            const feature = event.features?.[0] as GeoFeature | undefined;
            const metric = feature ? metricForLegacyFeature(metricsRef.current, feature) : undefined;
            if (!metric) return;
            setSelectedMetric(metric);
          });
          map.on("click", (event) => {
            const features = map.queryRenderedFeatures(event.point, { layers: ["township-heatmap"] });
            if (!features.length && shouldUseBottomSheet()) closeSelection();
          });
          setStatus("ready");
        });
        map.on("error", () => !disposed && setStatus("error"));
      } catch {
        if (!disposed) setStatus("error");
      }
    }

    void init();
    return () => {
      disposed = true;
      observer?.disconnect();
      visibilityObserver?.disconnect();
      if (handleViewportChange) {
        window.removeEventListener("resize", handleViewportChange);
        document.removeEventListener("fullscreenchange", handleViewportChange);
      }
      if (handleVisibilityChange) document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
      markers.forEach((marker) => marker.remove());
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className={cn("kmm-marketing-map relative h-full w-full min-w-0 overflow-hidden bg-[#F8FAFC]", className)}>
      {fallbackNotice && <div role="alert" className="absolute left-3 right-3 top-3 z-20 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 shadow-sm">{t("map.unableToLoad")}</div>}
      <div className="relative h-full min-h-0 min-w-0 overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 h-full w-full" aria-label="Interactive Myanmar township heatmap" />
      </div>
      {selectedMetric && (
        <div className="kmm-township-detail-overlay absolute inset-y-0 right-0 z-10 hidden w-[420px] max-w-[calc(100%-24px)] border-l border-[#EEF0F3] bg-white shadow-[-12px_0_30px_rgba(31,41,55,0.12)] md:block">
          <MyanmarTownshipDetailPanel metric={selectedMetric} onClose={closeSelection} />
        </div>
      )}
      {selectedMetric && (
        <div className="kmm-map-sheet-backdrop md:hidden" onClick={closeSelection}>
          <div
            className="kmm-map-sheet"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => { sheetStartYRef.current = event.clientY; }}
            onPointerUp={(event) => {
              if (sheetStartYRef.current !== null && event.clientY - sheetStartYRef.current > 48) closeSelection();
              sheetStartYRef.current = null;
            }}
          >
            <div className="kmm-map-sheet-handle" />
            <MyanmarTownshipDetailPanel metric={selectedMetric} onClose={closeSelection} mobile />
          </div>
        </div>
      )}
      {status === "loading" && <div className="absolute inset-0 grid place-items-center bg-white/80 text-sm font-semibold text-[#6B7280]">{t("common.loading")}</div>}
      {status === "error" && <div className="absolute inset-0 grid place-items-center bg-white p-6 text-center text-sm text-[#DC2626]"><span><AlertTriangle className="mx-auto mb-3" size={22} />{t("map.unableToLoad")}</span></div>}
    </div>
  );
}

export function MyanmarMarketingMap(props: MyanmarMarketingMapProps) {
  const [pmtilesFailed, setPmtilesFailed] = useState(false);
  if (getMapEngine() === "maplibre" && !pmtilesFailed) return <MyanmarMarketingMapMapLibre {...props} onLoadError={() => setPmtilesFailed(true)} />;
  return <LegacyMyanmarMarketingMap {...props} fallbackNotice={pmtilesFailed} />;
}
