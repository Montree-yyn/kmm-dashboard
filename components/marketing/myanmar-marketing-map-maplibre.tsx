"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import townshipMaster from "../../data/master-townships.json";
import { getBasemap } from "../../lib/maps/basemaps";
import { getMapDataset } from "../../lib/maps/datasets";
import { applyRequiredLayerOrder } from "../../lib/maps/layer-order";
import { normalizeLocation } from "../../lib/marketing/location-mapping";
import { cn } from "../../lib/utils";
import { useLocale } from "../../src/hooks/useLocale";
import type { LocaleKey } from "../../src/locales";
import { GlobalVectorMap } from "../maps/global-vector-map";
import { MyanmarTownshipDetailPanel, type MyanmarMarketingMapProps, type TownshipDebugStatus, type TownshipMetric } from "./myanmar-marketing-map";

type MasterTownship = { township_id: string; township: string; state_region: string };
type Showroom = { id: string; name: string; stateRegion: string; township: string; coordinates: [number, number] };
type GeoFeature = { geometry?: { coordinates?: unknown }; properties: { TS?: string; ST?: string } };
type MyanmarMarketingMapMapLibreProps = MyanmarMarketingMapProps & { onLoadError?: () => void };
type ExecutiveMetricKey = "salesUnit" | "salesValue" | "gpValue" | "gpPercent";
type LegendClass = { labelKey: LocaleKey; color: string; min: number; max: number };
type LabelCollection = { type: "FeatureCollection"; features: { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: { name: string; metric_label?: string; has_showroom: boolean } }[] };
const master = townshipMaster as MasterTownship[];
const dataset = getMapDataset("mm-townships-pmtiles");
const developmentBasemap = getBasemap("openfreemap-liberty-development");
const NO_DATA_COLOR = "#F8FAFC";
const ZERO_COLOR = "#F3F4F6";
const CHOROPLETH_COLORS = ["#FFE6C7", "#FFC98B", "#FFA64D", "#F26B00", "#C84A00"];
const EXECUTIVE_METRICS: { key: ExecutiveMetricKey; labelKey: LocaleKey }[] = [
  { key: "salesUnit", labelKey: "metric.salesUnit" },
  { key: "salesValue", labelKey: "metric.salesValue" },
  { key: "gpValue", labelKey: "metric.gpValue" },
  { key: "gpPercent", labelKey: "metric.gpPercent" },
];
const CLASS_LABEL_KEYS: LocaleKey[] = ["legend.veryLow", "legend.low", "legend.medium", "legend.high", "legend.veryHigh"];

function initialMetricFromMode(mode: MyanmarMarketingMapProps["mode"]): ExecutiveMetricKey {
  return "salesUnit";
}

function metricLabel(metricKey: ExecutiveMetricKey, t: (key: LocaleKey) => string) {
  return t(EXECUTIVE_METRICS.find((metric) => metric.key === metricKey)?.labelKey ?? "metric.salesUnit");
}

function metricValue(metric: TownshipMetric, metricKey: ExecutiveMetricKey) {
  return metric[metricKey];
}

function formatMetricValue(value: number | null | undefined, metricKey: ExecutiveMetricKey) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (metricKey === "salesValue" || metricKey === "gpValue") {
    if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (metricKey === "gpPercent") return `${value.toFixed(1)}%`;
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function quantile(sorted: number[], ratio: number) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))] ?? 0;
}

function quantileBreaks(values: number[], classes = 5) {
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: classes }, (_, index) => quantile(sorted, (index + 1) / classes));
}

function jenksNaturalBreaks(values: number[], classes = 5) {
  const sorted = [...values].sort((a, b) => a - b);
  const lower: number[][] = Array.from({ length: sorted.length + 1 }, () => Array(classes + 1).fill(0));
  const variance: number[][] = Array.from({ length: sorted.length + 1 }, () => Array(classes + 1).fill(0));
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
        if (variance[l][j] >= varianceValue + variance[lowerClassLimit - 1][j - 1]) {
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
  const positive = values.filter((value) => Number.isFinite(value) && value > 0);
  const unique = Array.from(new Set(positive));
  if (unique.length < 5) return { method: "Quantile", breaks: quantileBreaks(positive.length ? positive : [0]) };
  try {
    return { method: "Natural Breaks (Jenks)", breaks: jenksNaturalBreaks(positive) };
  } catch {
    return { method: "Quantile", breaks: quantileBreaks(positive) };
  }
}

function colorForValue(value: number | null | undefined, breaks: number[]) {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA_COLOR;
  if (value <= 0) return ZERO_COLOR;
  const index = breaks.findIndex((breakValue) => value <= breakValue);
  return CHOROPLETH_COLORS[index === -1 ? CHOROPLETH_COLORS.length - 1 : index];
}

function legendClasses(breaks: number[]) {
  let previous = 1;
  return breaks.map((breakValue, index) => {
    const min = Math.max(1, Math.floor(previous));
    const max = Math.ceil(breakValue);
    previous = max + 1;
    return { labelKey: CLASS_LABEL_KEYS[index], color: CHOROPLETH_COLORS[index], min, max };
  });
}

function legendRange(item: LegendClass, index: number, total: number) {
  if (index === total - 1) return `${item.min}+`;
  if (item.min >= item.max) return String(item.max);
  return `${item.min}-${item.max}`;
}

function collectPoints(input: unknown, points: [number, number][] = []) {
  if (!Array.isArray(input)) return points;
  if (typeof input[0] === "number" && typeof input[1] === "number") points.push([input[0], input[1]]);
  else input.forEach((item) => collectPoints(item, points));
  return points;
}

function getLabelPositions(features: GeoFeature[], kind: "state" | "township") {
  const groups = new Map<string, { name: string; stateRegion: string; points: [number, number][] }>();
  features.forEach((feature) => {
    const name = kind === "state" ? feature.properties.ST : feature.properties.TS;
    const stateRegion = feature.properties.ST ?? "";
    const key = kind === "state" ? normalizeLocation(feature.properties.ST) : `${normalizeLocation(feature.properties.ST)}-${normalizeLocation(feature.properties.TS)}`;
    const points = collectPoints(feature.geometry?.coordinates);
    if (!name || !key || !points.length) return;
    const group = groups.get(key) ?? { name, stateRegion, points: [] };
    group.points.push(...points);
    groups.set(key, group);
  });
  return Array.from(groups.values(), ({ name, stateRegion, points }) => ({ name, stateRegion, coordinates: [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length] as [number, number] }));
}

export function MyanmarMarketingMapMapLibre({ visibleShowroomIds, townshipMetrics = {}, mode = "population", activeMetric: sharedActiveMetric, onActiveMetricChange, onSelectedTownshipChange, className, onLoadError }: MyanmarMarketingMapMapLibreProps) {
  const { t } = useLocale();
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<TownshipDebugStatus | null>(null);
  const [activeMetric, setActiveMetric] = useState<ExecutiveMetricKey>(() => sharedActiveMetric ?? initialMetricFromMode(mode));
  const presentationMapRef = useRef<MapLibreMap | null>(null);
  const townshipLabelFeaturesRef = useRef<GeoFeature[]>([]);
  const showroomTownshipsRef = useRef(new Set<string>());
  const showroomMarkersRef = useRef(new Map<string, Marker>());
  const metricByIdRef = useRef<Map<string, TownshipMetric>>(new Map());
  const metricById = useMemo(() => {
    const result = new Map<string, TownshipMetric>();
    for (const record of master) {
      const metric = townshipMetrics[record.township_id];
      if (metric && normalizeLocation(metric.stateRegion) === normalizeLocation(record.state_region)) result.set(record.township_id, metric);
    }
    return result;
  }, [townshipMetrics]);
  metricByIdRef.current = metricById;
  const choropleth = useMemo(() => {
    const rows = Array.from(metricById, ([id, metric]) => ({ id, metric, value: metricValue(metric, activeMetric) }));
    const values = rows.map((row) => row.value).filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
    const classification = classifyValues(values);
    const fillColors = Object.fromEntries(rows.map((row) => [row.id, colorForValue(row.value, classification.breaks)]));
    const topCanonicalLocationIds = rows.filter((row) => row.value !== null && row.value !== undefined && row.value > 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 5).map((row) => row.id);
    return { ...classification, fillColors, topCanonicalLocationIds, legend: legendClasses(classification.breaks) };
  }, [metricById, activeMetric]);
  const selectedMetric = selectedCanonicalId ? metricById.get(selectedCanonicalId) ?? null : null;
  const selectTownship = (canonicalId: string | null) => {
    setSelectedCanonicalId(canonicalId);
    onSelectedTownshipChange?.(canonicalId);
  };

  const buildTownshipLabelCollection = (features: GeoFeature[]): LabelCollection => {
    const canonicalByLocation = new Map(master.map((record) => [`${normalizeLocation(record.township)}|${normalizeLocation(record.state_region)}`, record.township_id]));
    return {
      type: "FeatureCollection",
      features: getLabelPositions(features, "township").map((label) => {
        const canonicalId = canonicalByLocation.get(`${normalizeLocation(label.name)}|${normalizeLocation(label.stateRegion)}`);
        const metric = canonicalId ? metricByIdRef.current.get(canonicalId) : undefined;
        const value = metric ? formatMetricValue(metricValue(metric, activeMetric), activeMetric) : null;
        return { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: label.coordinates }, properties: { name: label.name, metric_label: value ?? "", has_showroom: showroomTownshipsRef.current.has(normalizeLocation(label.name)) } };
      }),
    };
  };

  const updateTownshipLabels = () => {
    const map = presentationMapRef.current;
    const source = map?.getSource("marketing-township-labels") as { setData?: (data: LabelCollection) => void } | undefined;
    if (source?.setData) source.setData(buildTownshipLabelCollection(townshipLabelFeaturesRef.current));
  };

  useEffect(() => {
    updateTownshipLabels();
  }, [activeMetric, metricById]);

  useEffect(() => {
    setActiveMetric(sharedActiveMetric ?? initialMetricFromMode(mode));
  }, [mode, sharedActiveMetric]);

  useEffect(() => {
    showroomMarkersRef.current.forEach((marker, id) => {
      marker.getElement().style.display = !visibleShowroomIds?.length || visibleShowroomIds.includes(id) ? "block" : "none";
    });
  }, [visibleShowroomIds]);

  useEffect(() => () => {
    showroomMarkersRef.current.forEach((marker) => marker.remove());
    showroomMarkersRef.current.clear();
  }, []);

  async function installLegacyPresentationOverlays(map: MapLibreMap) {
    const [{ Marker }, stateResponse, townshipResponse, showroomResponse] = await Promise.all([
      import("maplibre-gl"),
      fetch("/maps/myanmar-states.geojson", { cache: "no-store" }),
      fetch("/maps/myanmar-townships.geojson", { cache: "no-store" }),
      fetch("/maps/kmm-showrooms.json", { cache: "no-store" }),
    ]);
    if (!stateResponse.ok || !townshipResponse.ok || !showroomResponse.ok || map.getContainer().isConnected === false) return;
    const [states, townships, showrooms] = await Promise.all([
      stateResponse.json() as Promise<{ features: GeoFeature[] }>,
      townshipResponse.json() as Promise<{ features: GeoFeature[] }>,
      showroomResponse.json() as Promise<Showroom[]>,
    ]);
    if (showroomMarkersRef.current.size) return;
    const showroomTownships = new Set(showrooms.map((showroom) => normalizeLocation(showroom.township)));
    showroomTownshipsRef.current = showroomTownships;
    townshipLabelFeaturesRef.current = townships.features;
    const labelCollection = (labels: ReturnType<typeof getLabelPositions>) => ({ type: "FeatureCollection" as const, features: labels.map((label) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: label.coordinates }, properties: { name: label.name, has_showroom: showroomTownships.has(normalizeLocation(label.name)) } })) });
    if (!map.getSource("marketing-state-boundaries")) map.addSource("marketing-state-boundaries", { type: "geojson", data: { type: "FeatureCollection", features: states.features } } as never);
    if (!map.getSource("marketing-state-labels")) map.addSource("marketing-state-labels", { type: "geojson", data: labelCollection(getLabelPositions(states.features, "state")) });
    if (!map.getSource("marketing-township-labels")) map.addSource("marketing-township-labels", { type: "geojson", data: buildTownshipLabelCollection(townships.features) });
    const labelLayout = (size: number, font: string[]) => ({ "text-field": ["get", "name"], "text-font": font, "text-size": size, "text-anchor": "center", "text-allow-overlap": false, "text-ignore-placement": false, "text-padding": 8, "text-max-width": 10, "text-radial-offset": ["case", ["boolean", ["get", "has_showroom"], false], 1.6, 0] });
    const labelPaint = (opacity: unknown) => ({ "text-color": "#4B5563", "text-halo-color": "#FFFFFF", "text-halo-width": 1, "text-halo-blur": 0.35, "text-opacity": opacity });
    if (!map.getLayer("marketing-state-boundaries")) map.addLayer({ id: "marketing-state-boundaries", type: "line", source: "marketing-state-boundaries", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#CBD5E1", "line-width": 1 } } as never);
    if (!map.getLayer("marketing-state-labels")) map.addLayer({ id: "marketing-state-labels", type: "symbol", source: "marketing-state-labels", maxzoom: 7.2, layout: labelLayout(11, ["Open Sans Semibold"]), paint: labelPaint(["interpolate", ["linear"], ["zoom"], 6.8, 1, 7.2, 0]) } as never);
    if (!map.getLayer("marketing-township-labels")) map.addLayer({ id: "marketing-township-labels", type: "symbol", source: "marketing-township-labels", minzoom: 6, layout: { ...labelLayout(10, ["Open Sans Regular"]), "text-field": ["format", ["get", "name"], {}, "\n", {}, ["get", "metric_label"], { "font-scale": 0.86 }] }, paint: labelPaint(["interpolate", ["linear"], ["zoom"], 6, 0, 6.4, 1]) } as never);
    updateTownshipLabels();
    applyRequiredLayerOrder(map);
    const canonicalByLocation = new Map(master.map((record) => [`${normalizeLocation(record.township)}|${normalizeLocation(record.state_region)}`, record.township_id]));
    showrooms.forEach((showroom) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "kmm-showroom-marker";
      element.setAttribute("aria-label", `View ${showroom.name}`);
      element.title = showroom.name;
      element.style.display = !visibleShowroomIds?.length || visibleShowroomIds.includes(showroom.id) ? "block" : "none";
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        const canonicalId = canonicalByLocation.get(`${normalizeLocation(showroom.township)}|${normalizeLocation(showroom.stateRegion)}`);
        if (canonicalId && metricByIdRef.current.has(canonicalId)) selectTownship(canonicalId);
        map.flyTo({ center: showroom.coordinates, zoom: Math.max(map.getZoom(), 7), duration: 500, essential: true });
      });
      showroomMarkersRef.current.set(showroom.id, new Marker({ element, anchor: "center" }).setLngLat(showroom.coordinates).addTo(map));
    });
  }

  if (!dataset) return <div className={cn("grid h-full place-items-center text-sm text-red-700", className)}>{t("map.unableToLoad")}</div>;
  return (
    <div className={cn("kmm-marketing-map relative h-full w-full min-w-0 overflow-hidden bg-[#F8FAFC]", className)}>
      <GlobalVectorMap
        dataset={dataset}
        className="absolute inset-0"
        ariaLabel="Interactive Myanmar township heatmap"
        baseStyle={developmentBasemap?.url}
        overlayFillOpacity={0.5}
        overlayHoverOpacity={0.18}
        overlaySelectedOpacity={0.16}
        activeMetricLayer={activeMetric}
        fillColorsByCanonicalId={choropleth.fillColors}
        topCanonicalLocationIds={choropleth.topCanonicalLocationIds}
        selectedCanonicalLocationId={selectedCanonicalId}
        viewportPaddingRight={0}
        fitPadding={{ top: 24, right: 44, bottom: 24, left: 44 }}
        onMapReady={(map) => {
          presentationMapRef.current = map;
          void installLegacyPresentationOverlays(map);
        }}
        onMapStatus={setMapStatus}
        onError={onLoadError}
        onFeatureClick={(feature) => {
          const id = String(feature.properties.canonical_location_id ?? "");
          if (id && metricById.has(id)) selectTownship(id);
        }}
      />
      <div className="pointer-events-none absolute bottom-4 left-4 z-[6] min-w-[168px] rounded-xl border border-[#E5E7EB] bg-white/95 px-3 py-2 text-xs text-[#4B5563] shadow-[0_8px_24px_rgba(31,41,55,0.08)]">
        <p className="font-semibold text-[#1F2937]">{metricLabel(activeMetric, t)}</p>
        <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{choropleth.method}</p>
        <div className="mt-2 space-y-1.5">
          {[...choropleth.legend].reverse().map((item, reverseIndex) => {
            const index = choropleth.legend.length - 1 - reverseIndex;
            return <div key={item.labelKey} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />{t(item.labelKey)}</span><b>{legendRange(item, index, choropleth.legend.length)}</b></div>;
          })}
          <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm" style={{ backgroundColor: ZERO_COLOR }} />0</span><b>0</b></div>
          <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm border border-[#E5E7EB]" style={{ backgroundColor: NO_DATA_COLOR }} />{t("common.noData")}</span><b>{t("common.notAvailable")}</b></div>
        </div>
      </div>
      {selectedMetric && <div className="kmm-map-sheet-backdrop md:hidden" onClick={() => selectTownship(null)}><div className="kmm-map-sheet" onClick={(event) => event.stopPropagation()}><div className="kmm-map-sheet-handle" /><MyanmarTownshipDetailPanel metric={selectedMetric} mapStatus={mapStatus} onClose={() => selectTownship(null)} mobile /></div></div>}
    </div>
  );
}
