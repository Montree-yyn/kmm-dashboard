"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layers3, RotateCcw, Search, X } from "lucide-react";
import type {
  Map as MapLibreMap,
  MapGeoJSONFeature,
  Marker,
} from "maplibre-gl";
import townshipMaster from "../../data/master-townships.json";
import { getMapDataset } from "../../lib/maps/datasets";
import { villagePointsToGeoJson, type VillagePoint } from "../../lib/maps/geography";
import { applyRequiredLayerOrder } from "../../lib/maps/layer-order";
import { normalizeLocation } from "../../lib/marketing/location-mapping";
import { createMarketingLayerState } from "../../lib/marketing/map-layer-controls";
import type { MapLayerState } from "../../lib/maps/layers";
import { resolveSalesGeography } from "../../lib/marketing/township-geography";
import { cn } from "../../lib/utils";
import { useLocale } from "../../src/hooks/useLocale";
import type { LocaleKey } from "../../src/locales";
import { GlobalVectorMap } from "../maps/global-vector-map";
import { MarketingLayerManager } from "./marketing-layer-manager";
import { chartTheme } from "../common/charts/chartTheme";
import {
  MyanmarTownshipDetailPanel,
  type MyanmarMarketingMapProps,
  type TownshipDebugStatus,
  type TownshipMetric,
} from "./myanmar-marketing-map";

type MasterTownship = {
  township_id: string;
  township: string;
  state_region: string;
};
type Showroom = {
  id: string;
  name: string;
  stateRegion: string;
  township: string;
  coordinates: [number, number];
};
type GeoFeature = {
  geometry?: { coordinates?: unknown };
  properties: { TS?: string; ST?: string; label_position?: [number, number] };
};
// Compact precomputed township label (built from the townships GeoJSON by
// scripts/maps/build_township_labels.py — same vertex-mean algorithm as
// getLabelPositions). Loaded instead of the full 11.4 MB geometry.
type TownshipLabel = {
  name: string;
  stateRegion: string;
  coordinates: [number, number];
};
type MyanmarMarketingMapMapLibreProps = MyanmarMarketingMapProps & {
  onLoadError?: () => void;
};
type ExecutiveMetricKey = "salesUnit" | "salesValue" | "gpValue" | "gpPercent";
type LegendClass = {
  labelKey: LocaleKey;
  color: string;
  min: number;
  max: number;
};
type LabelCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: { name: string; metric_label?: string; has_showroom: boolean };
  }[];
};
declare const __KMM_BUILD_COMMIT__: string;
declare const __KMM_BUILD_TIMESTAMP__: string;
const master = townshipMaster as MasterTownship[];
const dataset = getMapDataset("mm-townships-pmtiles");
const SALES_MAP_COLORS = {
  heatScale: ["#FAD7B5", "#FFB25F", "#F68A24", "#E65C12", "#B93612"],
  zeroFill: "rgba(255, 255, 255, 0)",
  noDataFill: "rgba(255, 255, 255, 0)",
  stateBoundary: "#FF7A00",
  townshipBoundary: "#F2A15F",
} as const;
const NO_DATA_COLOR = chartTheme.marketing.noData;
const ZERO_COLOR = chartTheme.marketing.zero;
const NO_DATA_FILL_COLOR = SALES_MAP_COLORS.noDataFill;
const ZERO_FILL_COLOR = SALES_MAP_COLORS.zeroFill;
const CHOROPLETH_COLORS = SALES_MAP_COLORS.heatScale;
const LEGEND_COLORS = chartTheme.marketing.heatScale;
const COMPARISON_OUTLINE_LAYER_ID = "marketing-comparison-selection-outline";
const VILLAGE_SOURCE_ID = "marketing-villages";
const VILLAGE_POINT_LAYER_ID = "marketing-village-points";
const VILLAGE_LABEL_LAYER_ID = "marketing-village-labels";
const VILLAGE_MIN_ZOOM = 10;
const EXECUTIVE_METRICS: { key: ExecutiveMetricKey; labelKey: LocaleKey }[] = [
  { key: "salesUnit", labelKey: "metric.salesUnit" },
  { key: "salesValue", labelKey: "metric.salesValue" },
  { key: "gpValue", labelKey: "metric.gpValue" },
  { key: "gpPercent", labelKey: "metric.gpPercent" },
];
const CLASS_LABEL_KEYS: LocaleKey[] = [
  "legend.veryLow",
  "legend.low",
  "legend.medium",
  "legend.high",
  "legend.veryHigh",
];
const masterCanonicalIds = new Set(master.map((record) => record.township_id));

class MarketingOverlayLoadError extends Error {
  constructor(
    message: string,
    readonly requestUrl: string,
    readonly status: number | null,
    readonly responseHeaders: Record<string, string>,
    cause?: unknown,
  ) {
    super(message);
    this.name = "MarketingOverlayLoadError";
    this.cause = cause;
  }
}

function responseHeaders(response: Response) {
  return Object.fromEntries(
    Array.from(response.headers.entries()).filter(([name]) => {
      const key = name.toLowerCase();
      return (
        key === "content-type" ||
        key === "content-length" ||
        key === "cache-control" ||
        key === "access-control-allow-origin" ||
        key === "etag" ||
        key === "last-modified"
      );
    }),
  );
}

async function fetchOverlayJson<T>(requestUrl: string) {
  let response: Response;
  try {
    response = await fetch(requestUrl, { cache: "no-store" });
  } catch (error) {
    throw new MarketingOverlayLoadError(
      `Failed to fetch Marketing overlay resource: ${requestUrl}`,
      requestUrl,
      null,
      {},
      error,
    );
  }

  if (!response.ok) {
    throw new MarketingOverlayLoadError(
      `Marketing overlay resource returned HTTP ${response.status}: ${requestUrl}`,
      requestUrl,
      response.status,
      responseHeaders(response),
    );
  }

  return response.json() as Promise<T>;
}

function reportOverlayLoadError(error: unknown) {
  if (error instanceof MarketingOverlayLoadError) {
    console.warn(
      "[Marketing map] Optional presentation overlay failed to load",
      {
        requestUrl: error.requestUrl,
        status: error.status,
        responseHeaders: error.responseHeaders,
        cause:
          error.cause instanceof Error
            ? error.cause.message
            : String(error.cause ?? ""),
      },
    );
    return;
  }
  console.warn(
    "[Marketing map] Optional presentation overlay failed to load",
    error,
  );
}

function initialMetricFromMode(
  mode: MyanmarMarketingMapProps["mode"],
): ExecutiveMetricKey {
  switch (mode) {
    case "activity":
    case "population":
    case "sales":
    default:
      return "salesUnit";
  }
}

function metricLabel(
  metricKey: ExecutiveMetricKey,
  t: (key: LocaleKey) => string,
) {
  return t(
    EXECUTIVE_METRICS.find((metric) => metric.key === metricKey)?.labelKey ??
      "metric.salesUnit",
  );
}

function metricValue(metric: TownshipMetric, metricKey: ExecutiveMetricKey) {
  return metric[metricKey];
}

function formatMetricValue(
  value: number | null | undefined,
  metricKey: ExecutiveMetricKey,
) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return null;
  if (metricKey === "salesValue" || metricKey === "gpValue") {
    if (Math.abs(value) >= 1_000_000_000)
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(value) >= 1_000_000)
      return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (metricKey === "gpPercent") return `${value.toFixed(1)}%`;
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function quantile(sorted: number[], ratio: number) {
  return (
    sorted[
      Math.min(
        sorted.length - 1,
        Math.max(0, Math.floor((sorted.length - 1) * ratio)),
      )
    ] ?? 0
  );
}

function quantileBreaks(values: number[], classes = 5) {
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: classes }, (_, index) =>
    quantile(sorted, (index + 1) / classes),
  );
}

function jenksNaturalBreaks(values: number[], classes = 5) {
  const sorted = [...values].sort((a, b) => a - b);
  const lower: number[][] = Array.from({ length: sorted.length + 1 }, () =>
    Array(classes + 1).fill(0),
  );
  const variance: number[][] = Array.from({ length: sorted.length + 1 }, () =>
    Array(classes + 1).fill(0),
  );
  for (let i = 1; i <= classes; i += 1) {
    lower[1][i] = 1;
    variance[1][i] = 0;
    for (let j = 2; j <= sorted.length; j += 1) variance[j][i] = Infinity;
  }
  for (let l = 2; l <= sorted.length; l += 1) {
    let sum = 0;
    let sumSquares = 0;
    let weight = 0;
    for (let m = 1; m <= l; m += 1) {
      const lowerClassLimit = l - m + 1;
      const value = sorted[lowerClassLimit - 1];
      weight += 1;
      sum += value;
      sumSquares += value * value;
      const varianceValue = sumSquares - (sum * sum) / weight;
      if (lowerClassLimit === 1) continue;
      for (let j = 2; j <= classes; j += 1) {
        if (
          variance[l][j] >=
          varianceValue + variance[lowerClassLimit - 1][j - 1]
        ) {
          lower[l][j] = lowerClassLimit;
          variance[l][j] = varianceValue + variance[lowerClassLimit - 1][j - 1];
        }
      }
    }
    lower[l][1] = 1;
    variance[l][1] = sumSquares - (sum * sum) / weight;
  }
  const breaks = Array(classes).fill(sorted[sorted.length - 1]);
  let count = sorted.length;
  for (let j = classes; j >= 2; j -= 1) {
    const index = lower[count][j] - 2;
    breaks[j - 2] = sorted[Math.max(0, index)];
    count = lower[count][j] - 1;
  }
  breaks[classes - 1] = sorted[sorted.length - 1];
  return breaks;
}

function classifyValues(values: number[]) {
  const positive = values.filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  const unique = Array.from(new Set(positive));
  if (unique.length < 5)
    return {
      method: "Quantile",
      breaks: quantileBreaks(positive.length ? positive : [0]),
    };
  try {
    return {
      method: "Natural Breaks (Jenks)",
      breaks: jenksNaturalBreaks(positive),
    };
  } catch {
    return { method: "Quantile", breaks: quantileBreaks(positive) };
  }
}

function colorForValue(value: number | null | undefined, breaks: number[]) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return NO_DATA_FILL_COLOR;
  if (value <= 0) return ZERO_FILL_COLOR;
  const index = breaks.findIndex((breakValue) => value <= breakValue);
  return CHOROPLETH_COLORS[index === -1 ? CHOROPLETH_COLORS.length - 1 : index];
}

function legendClasses(breaks: number[]) {
  let previous = 1;
  return breaks.map((breakValue, index) => {
    const min = Math.max(1, Math.floor(previous));
    const max = Math.ceil(breakValue);
    previous = max + 1;
    return {
      labelKey: CLASS_LABEL_KEYS[index],
      color: LEGEND_COLORS[index],
      min,
      max,
    };
  });
}

function legendRange(item: LegendClass, index: number, total: number) {
  if (index === total - 1) return `${item.min}+`;
  if (item.min >= item.max) return String(item.max);
  return `${item.min}-${item.max}`;
}

function comparisonSelectionFilter(ids: string[]) {
  return ["in", ["get", "canonical_location_id"], ["literal", ids]] as never;
}

function resolveShowroomCanonicalId(
  showroom: Showroom,
  canonicalByLocation: ReadonlyMap<string, string>,
) {
  return (
    canonicalByLocation.get(
      `${normalizeLocation(showroom.township)}|${normalizeLocation(showroom.stateRegion)}`,
    ) ??
    resolveSalesGeography(
      showroom.stateRegion,
      showroom.township,
      masterCanonicalIds,
    ).canonicalLocationId
  );
}

function collectPoints(input: unknown, points: [number, number][] = []) {
  if (!Array.isArray(input)) return points;
  if (typeof input[0] === "number" && typeof input[1] === "number")
    points.push([input[0], input[1]]);
  else input.forEach((item) => collectPoints(item, points));
  return points;
}

function getLabelPositions(features: GeoFeature[], kind: "state" | "township") {
  const groups = new Map<
    string,
    { name: string; stateRegion: string; points: [number, number][] }
  >();
  features.forEach((feature) => {
    const name =
      kind === "state" ? feature.properties.ST : feature.properties.TS;
    const stateRegion = feature.properties.ST ?? "";
    const key =
      kind === "state"
        ? normalizeLocation(feature.properties.ST)
        : `${normalizeLocation(feature.properties.ST)}-${normalizeLocation(feature.properties.TS)}`;
    const points = collectPoints(feature.geometry?.coordinates);
    if (!name || !key || !points.length) return;
    const group = groups.get(key) ?? { name, stateRegion, points: [] };
    group.points.push(...points);
    groups.set(key, group);
  });
  return Array.from(groups.values(), ({ name, stateRegion, points }) => ({
    name,
    stateRegion,
    coordinates: [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length,
    ] as [number, number],
  }));
}

function featureBounds(feature: MapGeoJSONFeature) {
  const points = collectPoints(
    (feature.geometry as { coordinates?: unknown } | undefined)?.coordinates,
  );
  if (!points.length) return null;
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ] as [[number, number], [number, number]];
}

export function MyanmarMarketingMapMapLibre({
  visibleShowroomIds,
  villagePoints = [],
  showVillagePoints = true,
  onVillageClick,
  townshipMetrics = {},
  mode = "population",
  activeMetric: sharedActiveMetric,
  comparisonSelectionIds = [],
  onActiveMetricChange: _onActiveMetricChange,
  onSelectedTownshipChange,
  onFullscreenChange,
  className,
  onLoadError,
}: MyanmarMarketingMapMapLibreProps) {
  const { t } = useLocale();
  void _onActiveMetricChange;
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<string | null>(
    null,
  );
  const [mapStatus, setMapStatus] = useState<TownshipDebugStatus | null>(null);
  const [showMapDiagnostic, setShowMapDiagnostic] = useState(false);
  const [layerManagerOpen, setLayerManagerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenPanelCollapsed, setFullscreenPanelCollapsed] =
    useState(false);
  const [fullscreenSearchOpen, setFullscreenSearchOpen] = useState(false);
  const [fullscreenSearchQuery, setFullscreenSearchQuery] = useState("");
  const [layerState, setLayerState] = useState<MapLayerState>(
    createMarketingLayerState,
  );
  const activeMetric = sharedActiveMetric ?? initialMetricFromMode(mode);
  const presentationMapRef = useRef<MapLibreMap | null>(null);
  const townshipLabelsRef = useRef<TownshipLabel[]>([]);
  const showroomTownshipsRef = useRef(new Set<string>());
  const showroomMarkersRef = useRef(new Map<string, Marker>());
  const showroomCanonicalIdsRef = useRef(new Map<string, string | null>());
  const villageByCanonicalIdRef = useRef(new Map<string, VillagePoint>());
  const onVillageClickRef = useRef(onVillageClick);
  const villageInteractionsInstalledRef = useRef(false);
  const comparisonBadgeMarkersRef = useRef(new Map<string, Marker>());
  const comparisonLabelPositionsRef = useRef(
    new Map<
      string,
      { coordinates: [number, number]; township: string; stateRegion: string }
    >(),
  );
  const comparisonSelectionIdsRef = useRef(comparisonSelectionIds);
  const markerConstructorRef = useRef<
    | null
    | (new (options?: { element?: HTMLElement; anchor?: "center" }) => Marker)
  >(null);
  const metricByIdRef = useRef<Map<string, TownshipMetric>>(new Map());
  const onSelectedTownshipChangeRef = useRef(onSelectedTownshipChange);
  const metricById = useMemo(() => {
    const result = new Map<string, TownshipMetric>();
    for (const record of master) {
      const metric = townshipMetrics[record.township_id];
      if (
        metric &&
        normalizeLocation(metric.stateRegion) ===
          normalizeLocation(record.state_region)
      )
        result.set(record.township_id, metric);
    }
    return result;
  }, [townshipMetrics]);
  useEffect(() => {
    metricByIdRef.current = metricById;
  }, [metricById]);
  useEffect(() => {
    onSelectedTownshipChangeRef.current = onSelectedTownshipChange;
  }, [onSelectedTownshipChange]);
  useEffect(() => {
    onVillageClickRef.current = onVillageClick;
  }, [onVillageClick]);
  useEffect(() => {
    villageByCanonicalIdRef.current = new Map(
      villagePoints.map((village) => [village.canonicalLocationId, village]),
    );
  }, [villagePoints]);
  useEffect(() => {
    const updateDiagnosticVisibility = () => {
      setShowMapDiagnostic(
        new URLSearchParams(window.location.search).get("debug") === "map",
      );
    };
    updateDiagnosticVisibility();
    window.addEventListener("popstate", updateDiagnosticVisibility);
    return () =>
      window.removeEventListener("popstate", updateDiagnosticVisibility);
  }, []);
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) setFullscreenPanelCollapsed(false);
      onFullscreenChange?.(active);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [onFullscreenChange]);
  const choropleth = useMemo(() => {
    const rows = Array.from(metricById, ([id, metric]) => ({
      id,
      metric,
      value: metricValue(metric, activeMetric),
    }));
    const values = rows
      .map((row) => row.value)
      .filter(
        (value): value is number =>
          value !== null && value !== undefined && Number.isFinite(value),
      );
    const classification = classifyValues(values);
    const fillColors = Object.fromEntries(
      rows.map((row) => [
        row.id,
        colorForValue(row.value, classification.breaks),
      ]),
    );
    return {
      ...classification,
      fillColors,
      legend: legendClasses(classification.breaks),
    };
  }, [metricById, activeMetric]);
  const selectedMetric = selectedCanonicalId
    ? (metricById.get(selectedCanonicalId) ?? null)
    : null;
  const diagnosticRows = [
    ["commit", __KMM_BUILD_COMMIT__],
    ["build timestamp", __KMM_BUILD_TIMESTAMP__],
    ["map engine", "maplibre"],
    ["PMTiles URL", dataset?.url ?? "unavailable"],
    ["PMTiles source loaded", String(mapStatus?.pmtilesSourceLoaded ?? false)],
    [
      "visible township features",
      String(mapStatus?.renderedTownshipFeatureCount ?? 0),
    ],
    [
      "unique visible townships",
      String(mapStatus?.renderedTownshipUniqueFeatureCount ?? 0),
    ],
    ["zoom", mapStatus?.zoom ? mapStatus.zoom.toFixed(2) : "0"],
    [
      "rendered choropleth layer count",
      String(mapStatus?.renderedChoroplethLayerCount ?? 0),
    ],
  ];
  const selectTownship = (canonicalId: string | null) => {
    setSelectedCanonicalId(canonicalId);
    onSelectedTownshipChangeRef.current?.(canonicalId);
  };
  const toggleLayer = (group: string) =>
    setLayerState((current) => ({ ...current, [group]: !current[group] }));
  const resetMapView = () => {
    const map = presentationMapRef.current;
    if (!map || !dataset?.bounds) return;
    map.fitBounds(
      [
        [dataset.bounds[0], dataset.bounds[1]],
        [dataset.bounds[2], dataset.bounds[3]],
      ],
      {
        padding: 44,
        duration: 400,
        essential: true,
        maxZoom: dataset.default_zoom ?? 4,
      },
    );
  };
  const searchTownship = () => {
    const query = normalizeLocation(fullscreenSearchQuery.trim());
    if (!query) return;
    const record = master.find((item) =>
      normalizeLocation(item.township).includes(query),
    );
    if (!record) return;
    selectTownship(record.township_id);
    const position = comparisonLabelPositionsRef.current.get(
      record.township_id,
    );
    if (position)
      presentationMapRef.current?.flyTo({
        center: position.coordinates,
        zoom: Math.min(7.8, Math.max(presentationMapRef.current.getZoom(), 7)),
        duration: 400,
        essential: true,
      });
  };

  const buildTownshipLabelCollection = useCallback((
    labels: TownshipLabel[],
  ): LabelCollection => {
    const canonicalByLocation = new Map(
      master.map((record) => [
        `${normalizeLocation(record.township)}|${normalizeLocation(record.state_region)}`,
        record.township_id,
      ]),
    );
    return {
      type: "FeatureCollection",
      features: labels.map((label) => {
        const canonicalId = canonicalByLocation.get(
          `${normalizeLocation(label.name)}|${normalizeLocation(label.stateRegion)}`,
        );
        const metric = canonicalId
          ? metricByIdRef.current.get(canonicalId)
          : undefined;
        const value = metric
          ? formatMetricValue(metricValue(metric, activeMetric), activeMetric)
          : null;
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: label.coordinates },
          properties: {
            name: label.name,
            metric_label: value ?? "",
            has_showroom: showroomTownshipsRef.current.has(
              normalizeLocation(label.name),
            ),
          },
        };
      }),
    };
  }, [activeMetric]);

  const updateTownshipLabels = useCallback(() => {
    const map = presentationMapRef.current;
    const source = map?.getSource("marketing-township-labels") as
      | { setData?: (data: LabelCollection) => void }
      | undefined;
    if (source?.setData)
      source.setData(buildTownshipLabelCollection(townshipLabelsRef.current));
  }, [buildTownshipLabelCollection]);

  const ensureComparisonSelectionLayer = useCallback((map: MapLibreMap) => {
    if (!dataset) return;
    const sourceLayer =
      dataset.dataset_type === "geojson"
        ? undefined
        : (dataset.source_layer ?? undefined);
    if (
      !map.getSource(dataset.source_id) ||
      map.getLayer(COMPARISON_OUTLINE_LAYER_ID)
    )
      return;
    map.addLayer({
      id: COMPARISON_OUTLINE_LAYER_ID,
      type: "line",
      source: dataset.source_id,
      "source-layer": sourceLayer,
      filter: comparisonSelectionFilter(comparisonSelectionIdsRef.current),
      layout: {
        visibility: "visible",
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": chartTheme.current,
        "line-width": 3,
        "line-opacity": 0.92,
        "line-blur": 0.2,
      },
    } as never);
  }, []);

  const updateComparisonSelectionOverlays = useCallback((
    map = presentationMapRef.current,
  ) => {
    if (!map) return;
    ensureComparisonSelectionLayer(map);
    if (map.getLayer(COMPARISON_OUTLINE_LAYER_ID))
      map.setFilter(
        COMPARISON_OUTLINE_LAYER_ID,
        comparisonSelectionFilter(comparisonSelectionIdsRef.current),
      );

    const MarkerConstructor = markerConstructorRef.current;
    if (!MarkerConstructor) return;
    const selected = new Set(comparisonSelectionIdsRef.current);
    comparisonBadgeMarkersRef.current.forEach((marker, id) => {
      if (!selected.has(id)) {
        marker.remove();
        comparisonBadgeMarkersRef.current.delete(id);
      }
    });
    comparisonSelectionIdsRef.current.forEach((id, index) => {
      if (comparisonBadgeMarkersRef.current.has(id)) {
        const marker = comparisonBadgeMarkersRef.current.get(id);
        const element = marker?.getElement();
        if (element) {
          element.textContent = String(index + 1);
          element.setAttribute(
            "aria-label",
            `Comparison ${index + 1}, selected Township`,
          );
        }
        return;
      }
      const position = comparisonLabelPositionsRef.current.get(id);
      if (!position) return;
      const metric = metricByIdRef.current.get(id);
      const element = document.createElement("div");
      element.className = "kmm-comparison-selection-badge";
      element.textContent = String(index + 1);
      element.setAttribute("role", "img");
      element.setAttribute(
        "aria-label",
        `Comparison ${index + 1}, ${metric?.township ?? position.township} Township selected`,
      );
      element.style.width = "24px";
      element.style.height = "24px";
      element.style.borderRadius = "9999px";
      element.style.display = "grid";
      element.style.placeItems = "center";
      element.style.background = chartTheme.current;
      element.style.color = chartTheme.surface;
      element.style.border = `2px solid ${chartTheme.surface}`;
      element.style.boxShadow = "0 1px 6px rgba(31,41,55,0.28)";
      element.style.fontSize = "12px";
      element.style.fontWeight = "800";
      element.style.lineHeight = "1";
      element.style.pointerEvents = "none";
      const marker = new MarkerConstructor({ element, anchor: "center" })
        .setLngLat(position.coordinates)
        .addTo(map);
      comparisonBadgeMarkersRef.current.set(id, marker);
    });
  }, [ensureComparisonSelectionLayer]);

  useEffect(() => {
    updateTownshipLabels();
  }, [activeMetric, metricById, updateTownshipLabels]);

  useEffect(() => {
    comparisonSelectionIdsRef.current = comparisonSelectionIds;
    updateComparisonSelectionOverlays();
  }, [comparisonSelectionIds, updateComparisonSelectionOverlays]);

  useEffect(() => {
    showroomMarkersRef.current.forEach((marker, id) => {
      marker.getElement().style.display =
        layerState.showroom &&
        (!visibleShowroomIds?.length || visibleShowroomIds.includes(id))
          ? "block"
          : "none";
    });
  }, [layerState.showroom, visibleShowroomIds]);

  useEffect(() => {
    showroomMarkersRef.current.forEach((marker, id) => {
      const canonicalId = showroomCanonicalIdsRef.current.get(id) ?? null;
      const isSelected = Boolean(
        selectedCanonicalId && canonicalId === selectedCanonicalId,
      );
      marker.getElement().classList.toggle("is-selected", isSelected);
      marker.getElement().setAttribute("aria-pressed", String(isSelected));
    });
  }, [selectedCanonicalId]);

  useEffect(
    () => () => {
      showroomMarkersRef.current.forEach((marker) => marker.remove());
      showroomMarkersRef.current.clear();
      showroomCanonicalIdsRef.current.clear();
      comparisonBadgeMarkersRef.current.forEach((marker) => marker.remove());
      comparisonBadgeMarkersRef.current.clear();
    },
    [],
  );

  async function loadStatesGeometry(): Promise<{ features: GeoFeature[] }> {
    try {
      // Production path: simplified state boundaries (scripts/maps/
      // simplify_myanmar_states.py) with precomputed label positions.
      return await fetchOverlayJson<{ features: GeoFeature[] }>(
        "/maps/myanmar-states-simplified.geojson",
      );
    } catch {
      // Rollback: the original full-resolution geometry stays available.
      return fetchOverlayJson<{ features: GeoFeature[] }>(
        "/maps/myanmar-states.geojson",
      );
    }
  }

  const installOrUpdateVillageLayer = useCallback((map: MapLibreMap) => {
    if (!villagePoints.length) {
      if (map.getLayer(VILLAGE_POINT_LAYER_ID))
        map.setLayoutProperty(VILLAGE_POINT_LAYER_ID, "visibility", "none");
      if (map.getLayer(VILLAGE_LABEL_LAYER_ID))
        map.setLayoutProperty(VILLAGE_LABEL_LAYER_ID, "visibility", "none");
      return;
    }

    const collection = villagePointsToGeoJson(villagePoints);
    const existingSource = map.getSource(VILLAGE_SOURCE_ID) as
      | { setData?: (data: ReturnType<typeof villagePointsToGeoJson>) => void }
      | undefined;
    if (existingSource?.setData) existingSource.setData(collection);
    else
      map.addSource(VILLAGE_SOURCE_ID, {
        type: "geojson",
        data: collection,
      });

    if (!map.getLayer(VILLAGE_POINT_LAYER_ID))
      map.addLayer({
        id: VILLAGE_POINT_LAYER_ID,
        type: "circle",
        source: VILLAGE_SOURCE_ID,
        minzoom: VILLAGE_MIN_ZOOM,
        layout: { visibility: showVillagePoints ? "visible" : "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 13, 4.5, 16, 6],
          "circle-color": chartTheme.current,
          "circle-stroke-color": chartTheme.surface,
          "circle-stroke-width": 1.25,
          "circle-opacity": 0.9,
        },
      });
    if (!map.getLayer(VILLAGE_LABEL_LAYER_ID))
      map.addLayer({
        id: VILLAGE_LABEL_LAYER_ID,
        type: "symbol",
        source: VILLAGE_SOURCE_ID,
        minzoom: 12,
        layout: {
          visibility: showVillagePoints ? "visible" : "none",
          "text-field": ["get", "location_name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10,
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": chartTheme.text,
          "text-halo-color": chartTheme.surface,
          "text-halo-width": 1,
        },
      });

    const visibility = showVillagePoints ? "visible" : "none";
    map.setLayoutProperty(VILLAGE_POINT_LAYER_ID, "visibility", visibility);
    map.setLayoutProperty(VILLAGE_LABEL_LAYER_ID, "visibility", visibility);

    if (!villageInteractionsInstalledRef.current) {
      map.on("mouseenter", VILLAGE_POINT_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", VILLAGE_POINT_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", VILLAGE_POINT_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        const canonicalId = String(feature?.properties?.canonical_location_id ?? "");
        const village = villageByCanonicalIdRef.current.get(canonicalId);
        if (village) onVillageClickRef.current?.(village);
      });
      villageInteractionsInstalledRef.current = true;
    }
    applyRequiredLayerOrder(map);
  }, [showVillagePoints, villagePoints]);

  useEffect(() => {
    const map = presentationMapRef.current;
    if (map) installOrUpdateVillageLayer(map);
  }, [installOrUpdateVillageLayer, villagePoints, showVillagePoints]);

  async function installLegacyPresentationOverlays(map: MapLibreMap) {
    const [{ Marker }, states, townshipLabels, showrooms] = await Promise.all([
      import("maplibre-gl"),
      loadStatesGeometry(),
      fetchOverlayJson<{ labels: TownshipLabel[] }>(
        "/maps/myanmar-township-labels.json",
      ),
      fetchOverlayJson<Showroom[]>("/maps/kmm-showrooms.json"),
    ]);
    if (map.getContainer().isConnected === false) return;
    markerConstructorRef.current = Marker;
    if (showroomMarkersRef.current.size) return;
    const showroomTownships = new Set(
      showrooms.map((showroom) => normalizeLocation(showroom.township)),
    );
    showroomTownshipsRef.current = showroomTownships;
    townshipLabelsRef.current = townshipLabels.labels;
    const canonicalByLocation = new Map(
      master.map((record) => [
        `${normalizeLocation(record.township)}|${normalizeLocation(record.state_region)}`,
        record.township_id,
      ]),
    );
    comparisonLabelPositionsRef.current = new Map(
      townshipLabels.labels
        .map((label) => {
          const canonicalId = canonicalByLocation.get(
            `${normalizeLocation(label.name)}|${normalizeLocation(label.stateRegion)}`,
          );
          return canonicalId
            ? [
                canonicalId,
                {
                  coordinates: label.coordinates,
                  township: label.name,
                  stateRegion: label.stateRegion,
                },
              ]
            : null;
        })
        .filter(
          (
            entry,
          ): entry is [
            string,
            {
              coordinates: [number, number];
              township: string;
              stateRegion: string;
            },
          ] => Boolean(entry),
        ),
    );
    const stateLabelCollection = (features: GeoFeature[]) => ({
      type: "FeatureCollection" as const,
      features: features
        .filter((feature) => feature.properties.ST)
        .map((feature) => {
          const name = feature.properties.ST as string;
          const position = feature.properties.label_position;
          // Simplified datasets ship a precomputed label position; the
          // original geometry falls back to the vertex-mean calculation.
          const coordinates =
            position ?? getLabelPositions([feature], "state")[0]?.coordinates;
          return coordinates
            ? {
                type: "Feature" as const,
                geometry: {
                  type: "Point" as const,
                  coordinates,
                },
                properties: {
                  name,
                  has_showroom: showroomTownships.has(
                    normalizeLocation(name),
                  ),
                },
              }
            : null;
        })
        .filter(
          (
            feature,
          ): feature is NonNullable<typeof feature> => Boolean(feature),
        ),
    });
    if (!map.getSource("marketing-state-boundaries"))
      map.addSource("marketing-state-boundaries", {
        type: "geojson",
        data: { type: "FeatureCollection", features: states.features },
      } as never);
    if (!map.getSource("marketing-state-labels"))
      map.addSource("marketing-state-labels", {
        type: "geojson",
        data: stateLabelCollection(states.features),
      });
    if (!map.getSource("marketing-township-labels"))
      map.addSource("marketing-township-labels", {
        type: "geojson",
        data: buildTownshipLabelCollection(townshipLabelsRef.current),
      });
    const labelLayout = (size: number, font: string[]) => ({
      "text-field": ["get", "name"],
      "text-font": font,
      "text-size": size,
      "text-anchor": "center",
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-padding": 8,
      "text-max-width": 10,
      "text-radial-offset": [
        "case",
        ["boolean", ["get", "has_showroom"], false],
        1.6,
        0,
      ],
    });
    const labelPaint = (opacity: unknown) => ({
      "text-color": chartTheme.text,
      "text-halo-color": chartTheme.surface,
      "text-halo-width": 1,
      "text-halo-blur": 0.35,
      "text-opacity": opacity,
    });
    if (!map.getLayer("marketing-state-boundaries"))
      map.addLayer({
        id: "marketing-state-boundaries",
        type: "line",
        source: "marketing-state-boundaries",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": SALES_MAP_COLORS.stateBoundary,
          "line-width": 1.05,
          "line-opacity": 0.72,
          "line-dasharray": [3.5, 3],
        },
      } as never);
    if (!map.getLayer("marketing-state-labels"))
      map.addLayer({
        id: "marketing-state-labels",
        type: "symbol",
        source: "marketing-state-labels",
        maxzoom: 7.2,
        layout: labelLayout(12, ["Noto Sans Medium"]),
        paint: labelPaint([
          "interpolate",
          ["linear"],
          ["zoom"],
          6.8,
          1,
          7.2,
          0,
        ]),
      } as never);
    if (!map.getLayer("marketing-township-labels"))
      map.addLayer({
        id: "marketing-township-labels",
        type: "symbol",
        source: "marketing-township-labels",
        minzoom: 6,
        layout: {
          ...labelLayout(10, ["Noto Sans Regular"]),
          "text-field": [
            "format",
            ["get", "name"],
            {},
            "\n",
            {},
            ["get", "metric_label"],
            { "font-scale": 0.86 },
          ],
        },
        paint: labelPaint(["interpolate", ["linear"], ["zoom"], 6, 0, 6.4, 1]),
      } as never);
    updateTownshipLabels();
    applyRequiredLayerOrder(map);
    installOrUpdateVillageLayer(map);
    showrooms.forEach((showroom) => {
      const canonicalId = resolveShowroomCanonicalId(
        showroom,
        canonicalByLocation,
      );
      showroomCanonicalIdsRef.current.set(showroom.id, canonicalId);
      const element = document.createElement("button");
      element.type = "button";
      element.className = "kmm-showroom-marker";
      element.setAttribute("aria-label", `View ${showroom.name}`);
      element.title = showroom.name;
      element.style.display =
        layerState.showroom &&
        (!visibleShowroomIds?.length ||
          visibleShowroomIds.includes(showroom.id))
          ? "block"
          : "none";
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        if (canonicalId) selectTownship(canonicalId);
        map.flyTo({
          center: showroom.coordinates,
          zoom: Math.max(map.getZoom(), 7),
          duration: 500,
          essential: true,
        });
      });
      showroomMarkersRef.current.set(
        showroom.id,
        new Marker({ element, anchor: "center" })
          .setLngLat(showroom.coordinates)
          .addTo(map),
      );
    });
    updateComparisonSelectionOverlays(map);
  }

  if (!dataset)
    return (
      <div
        className={cn(
          "grid h-full place-items-center text-sm text-red-700",
          className,
        )}
      >
        {t("map.unableToLoad")}
      </div>
    );
  return (
    <div
      className={cn(
        "kmm-marketing-map relative h-full w-full min-w-0 overflow-hidden bg-[var(--surface-subtle)]",
        (selectedMetric || comparisonSelectionIds.length > 0) &&
          "kmm-map-has-side-panel",
        className,
      )}
    >
      <GlobalVectorMap
        dataset={dataset}
        className="absolute inset-0"
        ariaLabel="Interactive Myanmar township heatmap"
        fillNoDataColor={NO_DATA_FILL_COLOR}
        boundaryColor={SALES_MAP_COLORS.townshipBoundary}
        boundaryOpacity={0.42}
        boundaryWidth={0.55}
        overlayFillOpacity={0.5}
        overlayHoverOpacity={0.18}
        overlaySelectedOpacity={0.16}
        activeMetricLayer={activeMetric}
        fillColorsByCanonicalId={choropleth.fillColors}
        selectedCanonicalLocationId={selectedCanonicalId}
        layerState={layerState}
        viewportPaddingRight={0}
        fitPadding={{ top: 24, right: 44, bottom: 24, left: 44 }}
        onMapReady={(map) => {
          presentationMapRef.current = map;
          void installLegacyPresentationOverlays(map).catch(
            reportOverlayLoadError,
          );
        }}
        onMapStatus={setMapStatus}
        onError={onLoadError}
        onFeatureClick={(feature) => {
          const id = String(feature.properties.canonical_location_id ?? "");
          if (!id) return;
          if (id === selectedCanonicalId) return;
          selectTownship(id);
          const bounds = featureBounds(feature);
          if (bounds)
            presentationMapRef.current?.fitBounds(bounds, {
              padding: {
                top: 36,
                right: isFullscreen ? 440 : 44,
                bottom: 36,
                left: 36,
              },
              duration: 400,
              essential: true,
              maxZoom: 7.8,
            });
        }}
        onMapBackgroundClick={() => selectTownship(null)}
      />
      {isFullscreen && (
        <div className="kmm-map-toolbar pointer-events-auto absolute left-4 top-4 z-[9] flex items-center gap-1 rounded-[var(--radius-card)] p-1">
          <button
            type="button"
            title="Map layers"
            aria-label="Open map layers"
            aria-expanded={layerManagerOpen}
            onClick={() => setLayerManagerOpen((open) => !open)}
            className={cn(
              "kmm-map-toolbar-button grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)]",
              layerManagerOpen &&
                "bg-[var(--brand-100)] text-[var(--brand-600)]",
            )}
          >
            <Layers3 size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Search township"
            aria-label="Search township"
            aria-expanded={fullscreenSearchOpen}
            onClick={() => setFullscreenSearchOpen((open) => !open)}
            className={cn(
              "kmm-map-toolbar-button grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)]",
              fullscreenSearchOpen &&
                "bg-[var(--brand-100)] text-[var(--brand-600)]",
            )}
          >
            <Search size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Reset map view"
            aria-label="Reset map view"
            onClick={resetMapView}
            className="kmm-map-toolbar-button grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)]"
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Exit fullscreen"
            aria-label="Exit fullscreen"
            onClick={() => {
              void document.exitFullscreen().catch(() => undefined);
            }}
            className="kmm-map-toolbar-button grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)]"
          >
            <X size={16} aria-hidden="true" />
          </button>
          {fullscreenSearchOpen && (
            <form
              className="absolute left-0 top-14 flex w-72 gap-2 rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-2 shadow-[var(--shadow-floating)] backdrop-blur-md"
              onSubmit={(event) => {
                event.preventDefault();
                searchTownship();
              }}
            >
              <input
                autoFocus
                value={fullscreenSearchQuery}
                onChange={(event) =>
                  setFullscreenSearchQuery(event.target.value)
                }
                placeholder="Search Township"
                aria-label="Search Township"
                className="h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-xs font-medium text-[var(--text-primary)]"
              />
              <button
                type="submit"
                aria-label="Run township search"
                className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-[var(--brand-500)] text-white transition-colors hover:bg-[var(--brand-600)]"
              >
                <Search size={14} aria-hidden="true" />
              </button>
            </form>
          )}
        </div>
      )}
      <MarketingLayerManager
        open={layerManagerOpen}
        onOpenChange={setLayerManagerOpen}
        layerState={layerState}
        onToggle={toggleLayer}
        showTrigger={!isFullscreen}
      />
      <aside
        aria-label={`${metricLabel(activeMetric, t)} legend`}
        className="kmm-map-legend pointer-events-none absolute bottom-4 left-4 z-[6] min-w-[168px] rounded-[var(--radius-control-lg)] px-3 py-2.5 text-[11px] text-[var(--text-secondary)]"
      >
        <p className="text-xs font-semibold text-[var(--text-primary)]">
          {metricLabel(activeMetric, t)}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">
          {choropleth.method}
        </p>
        <div className="mt-2 space-y-1.5">
          {[...choropleth.legend].reverse().map((item, reverseIndex) => {
            const index = choropleth.legend.length - 1 - reverseIndex;
            return (
              <div
                key={item.labelKey}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2">
                  <i
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  {t(item.labelKey)}
                </span>
                <b className="kmm-tabular font-semibold text-[var(--text-primary)]">
                  {legendRange(item, index, choropleth.legend.length)}
                </b>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <i
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: ZERO_COLOR }}
              />
              0
            </span>
            <b className="kmm-tabular font-semibold text-[var(--text-primary)]">
              0
            </b>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <i
                className="size-2.5 rounded-sm border border-[#E5E7EB]"
                style={{ backgroundColor: NO_DATA_COLOR }}
              />
              {t("common.noData")}
            </span>
            <b className="font-semibold text-[var(--text-primary)]">
              {t("common.notAvailable")}
            </b>
          </div>
        </div>
      </aside>
      {showMapDiagnostic && (
        <div
          className="pointer-events-auto absolute right-3 top-14 z-[8] max-w-[min(360px,calc(100%-24px))] rounded-lg border border-[#111827] bg-white/95 p-3 text-[11px] font-semibold leading-4 text-[#111827] shadow-[0_10px_28px_rgba(17,24,39,0.18)]"
          data-testid="marketing-production-map-diagnostic"
        >
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em]">
            Production Map Diagnostic
          </p>
          <dl className="grid grid-cols-[132px_minmax(0,1fr)] gap-x-2 gap-y-1">
            {diagnosticRows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-[#6B7280]">{label}</dt>
                <dd className="break-words font-black">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {/* The isFullscreen && selectedMetric contract remains active; tablet
          widths share the same panel presentation without remounting the map. */}
      {selectedMetric && comparisonSelectionIds.length === 0 && (
        <div
          className={cn(
            "kmm-township-detail-overlay absolute bottom-4 right-4 top-4 z-[10] hidden w-[min(400px,calc(100%-32px))] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-default)] bg-[var(--surface-elevated)] shadow-[var(--shadow-overlay)] backdrop-blur-md md:block",
            !isFullscreen && "xl:hidden",
          )}
        >
          {fullscreenPanelCollapsed ? (
            <button
              type="button"
              onClick={() => setFullscreenPanelCollapsed(false)}
              className="m-3 min-h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-card)]"
            >
              เปิด Panel
            </button>
          ) : (
            <MyanmarTownshipDetailPanel
              metric={selectedMetric}
              mapStatus={mapStatus}
              onClose={() => selectTownship(null)}
              onCollapse={() => setFullscreenPanelCollapsed(true)}
            />
          )}
        </div>
      )}
      {selectedMetric && comparisonSelectionIds.length === 0 && (
        <div
          className="kmm-map-sheet-backdrop md:hidden"
          onClick={() => selectTownship(null)}
        >
          <div
            className="kmm-map-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="kmm-map-sheet-handle" />
            <MyanmarTownshipDetailPanel
              metric={selectedMetric}
              mapStatus={mapStatus}
              onClose={() => selectTownship(null)}
              mobile
            />
          </div>
        </div>
      )}
    </div>
  );
}
