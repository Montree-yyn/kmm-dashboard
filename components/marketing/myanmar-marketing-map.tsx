"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { AlertTriangle } from "lucide-react";
import { normalizeLocation } from "../../lib/marketing/location-mapping";
import { cn } from "../../lib/utils";

type Showroom = { id: string; name: string; stateRegion: string; township: string; coordinates: [number, number] };
type GeoFeature = { geometry?: { coordinates?: unknown }; properties: { TS?: string; TS_PCODE?: string; ST?: string } };
type LabelFeature = { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: { id: string; name: string } };
type LabelCollection = { type: "FeatureCollection"; features: LabelFeature[] };
type TownshipMetric = { township: string; stateRegion: string; population: number; activities: number; salesUnit: number; booking: number | null; density: number | null; fill: string };

type MyanmarMarketingMapProps = {
  visibleShowroomIds?: string[];
  townshipMetrics?: Record<string, TownshipMetric>;
  productLabel?: string;
  mode?: "population" | "activity";
  resetSignal?: number;
  className?: string;
};

const MAP_LIMITS: [[number, number], [number, number]] = [[89.7, 6.4], [104.2, 31.3]];
const FALLBACK_MYANMAR_BOUNDS: [[number, number], [number, number]] = [[90.6, 7.6], [103, 30.1]];
const EMPTY_LABELS: LabelCollection = { type: "FeatureCollection", features: [] };
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
const MAP_STYLE = { version: 8, sources: { states: { type: "geojson", data: "/maps/myanmar-states.geojson" }, townships: { type: "geojson", data: "/maps/myanmar-townships.geojson" }, regionLabels: { type: "geojson", data: EMPTY_LABELS }, townshipLabels: { type: "geojson", data: EMPTY_LABELS } }, layers: [{ id: "kmm-background", type: "background", paint: { "background-color": "#F8FAFC" } }, { id: "myanmar-state-fill", type: "fill", source: "states", paint: { "fill-color": "#FFFFFF", "fill-opacity": 1 } }, { id: "township-heatmap", type: "fill", source: "townships", paint: { "fill-color": "#FFFFFF", "fill-opacity": 0.98 } }, { id: "myanmar-state-line", type: "line", source: "states", paint: { "line-color": "#CBD5E1", "line-width": 1 } }, { id: "myanmar-township-line", type: "line", source: "townships", minzoom: 4, paint: { "line-color": "#E5E7EB", "line-opacity": 0.75, "line-width": 0.45 } }, { id: "myanmar-state-label", type: "symbol", source: "regionLabels", minzoom: 3, layout: { "text-field": ["get", "name"], "text-size": 11, "text-font": ["Open Sans Semibold"], "text-allow-overlap": false, "text-ignore-placement": false, "text-padding": 8 }, paint: { "text-color": "#4B5563", "text-halo-color": "#FFFFFF", "text-halo-width": 1 } }, { id: "myanmar-township-label", type: "symbol", source: "townshipLabels", minzoom: 6.8, layout: { "text-field": ["get", "name"], "text-size": 10, "text-font": ["Open Sans Regular"], "text-allow-overlap": false, "text-ignore-placement": false, "text-padding": 5 }, paint: { "text-color": "#4B5563", "text-halo-color": "#FFFFFF", "text-halo-width": 1 } }] } as const;

function format(value: number) { return Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value); }
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
function boundsFromFeatures(features: GeoFeature[]): [[number, number], [number, number]] {
  const points = features.flatMap((feature) => collectPoints(feature.geometry?.coordinates));
  if (!points.length) return FALLBACK_MYANMAR_BOUNDS;
  const lng = points.map((point) => point[0]);
  const lat = points.map((point) => point[1]);
  return [[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]];
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
function fitMyanmar(map: MapLibreMap, bounds: [[number, number], [number, number]], duration = 0) {
  map.fitBounds(bounds, { duration, padding: 48 });
  const fittedZoom = map.getZoom();
  const minZoom = Math.max(1, fittedZoom - 1);
  map.setMinZoom(minZoom);
  map.setZoom(Math.max(minZoom, fittedZoom - 0.5));
}
function popupHtml(metric: TownshipMetric, productLabel: string) { return `<div class="kmm-map-popup-card"><p class="kmm-map-popup-title">${metric.township}</p><div class="kmm-map-popup-meta">${metric.stateRegion}</div><div class="kmm-map-popup-grid"><div class="kmm-map-popup-kpi"><span>Product</span><strong>${productLabel}</strong></div><div class="kmm-map-popup-kpi"><span>Engine Population</span><strong>${format(metric.population)}</strong></div><div class="kmm-map-popup-kpi"><span>Activities</span><strong>${format(metric.activities)}</strong></div><div class="kmm-map-popup-kpi"><span>Sales Unit</span><strong>${format(metric.salesUnit)}</strong></div><div class="kmm-map-popup-kpi"><span>Booking</span><strong>${metric.booking === null ? "N/A" : format(metric.booking)}</strong></div><div class="kmm-map-popup-kpi"><span>Activity Density</span><strong>${metric.density === null ? "N/A" : format(metric.density)}</strong></div></div></div>`; }

export function MyanmarMarketingMap({ visibleShowroomIds, townshipMetrics = {}, productLabel = "All", mode = "population", resetSignal = 0, className }: MyanmarMarketingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null); const mapRef = useRef<MapLibreMap | null>(null); const townshipsRef = useRef<GeoFeature[]>([]); const boundsRef = useRef<[[number, number], [number, number]]>(FALLBACK_MYANMAR_BOUNDS); const resizeTimerRef = useRef<number | null>(null); const markersRef = useRef(new Map<string, Marker>()); const metricsRef = useRef(townshipMetrics); const productRef = useRef(productLabel); const visibleIdsRef = useRef(visibleShowroomIds); const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const applyMetrics = () => { const map = mapRef.current; if (!map?.loaded()) return; const pairs: unknown[] = ["match", ["get", "TS_PCODE"]]; townshipsRef.current.forEach((feature) => { const key = normalizeLocation(feature.properties.TS); const metric = metricsRef.current[key]; if (feature.properties.TS_PCODE && metric) pairs.push(feature.properties.TS_PCODE, metric.fill); }); pairs.push("#FFFFFF"); map.setPaintProperty("township-heatmap", "fill-color", pairs as never); };
  useEffect(() => { metricsRef.current = townshipMetrics; productRef.current = productLabel; applyMetrics(); }, [townshipMetrics, productLabel, mode]);
  useEffect(() => { visibleIdsRef.current = visibleShowroomIds; markersRef.current.forEach((marker, id) => { marker.getElement().style.display = !visibleShowroomIds?.length || visibleShowroomIds.includes(id) ? "block" : "none"; }); }, [visibleShowroomIds]);
  useEffect(() => { const map = mapRef.current; if (!map?.loaded()) return; map.resize(); fitMyanmar(map, boundsRef.current, 250); }, [resetSignal]);
  useEffect(() => { if (!containerRef.current || mapRef.current) return; let disposed = false; let observer: ResizeObserver | undefined; const markers = markersRef.current; async function init() { try { const [{ default: maplibregl }, showroomResponse, townshipResponse, stateResponse] = await Promise.all([import("maplibre-gl"), fetch("/maps/kmm-showrooms.json", { cache: "no-store" }), fetch("/maps/myanmar-townships.geojson", { cache: "no-store" }), fetch("/maps/myanmar-states.geojson", { cache: "no-store" })]); if (!showroomResponse.ok || !townshipResponse.ok || !stateResponse.ok) throw new Error("Unable to load Myanmar map files."); const showrooms = await showroomResponse.json() as Showroom[]; const townships = await townshipResponse.json() as { features: GeoFeature[] }; const states = await stateResponse.json() as { features: GeoFeature[] }; if (disposed || !containerRef.current) return; townshipsRef.current = townships.features; boundsRef.current = boundsFromFeatures(townships.features); const regionLabels = labelsFromFeatures(states.features, "region"); const townshipLabels = labelsFromFeatures(townships.features, "township"); const map = new maplibregl.Map({ attributionControl: false, container: containerRef.current, maxBounds: MAP_LIMITS, minZoom: 1, maxZoom: 12, renderWorldCopies: false, style: MAP_STYLE, center: [96.2, 19.4], zoom: 2.4 }); mapRef.current = map; map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right"); observer = new ResizeObserver(() => { if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current); resizeTimerRef.current = window.setTimeout(() => { if (disposed) return; map.resize(); fitMyanmar(map, boundsRef.current); }, 120); }); observer.observe(containerRef.current); const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "kmm-map-popup" }); map.on("load", () => { if (disposed) return; setGeoJsonSource(map, "regionLabels", regionLabels); setGeoJsonSource(map, "townshipLabels", townshipLabels); fitMyanmar(map, boundsRef.current); showrooms.forEach((showroom) => { const element = document.createElement("button"); element.type = "button"; element.className = "kmm-showroom-marker"; element.setAttribute("aria-label", `View ${showroom.name}`); element.style.display = !visibleIdsRef.current?.length || visibleIdsRef.current.includes(showroom.id) ? "block" : "none"; element.addEventListener("click", () => map.flyTo({ center: showroom.coordinates, zoom: Math.max(map.getZoom(), 7), duration: 500, essential: true })); markers.set(showroom.id, new maplibregl.Marker({ element, anchor: "center" }).setLngLat(showroom.coordinates).addTo(map)); }); applyMetrics(); map.on("mousemove", "township-heatmap", (event) => { const feature = event.features?.[0] as GeoFeature | undefined; const metric = feature ? metricsRef.current[normalizeLocation(feature.properties.TS)] : undefined; map.getCanvas().style.cursor = metric ? "pointer" : ""; if (metric && event.lngLat) popup.setLngLat(event.lngLat).setHTML(popupHtml(metric, productRef.current)).addTo(map); else popup.remove(); }); map.on("mouseleave", "township-heatmap", () => { map.getCanvas().style.cursor = ""; popup.remove(); }); requestAnimationFrame(() => { map.resize(); fitMyanmar(map, boundsRef.current); }); setStatus("ready"); }); map.on("error", () => !disposed && setStatus("error")); } catch { if (!disposed) setStatus("error"); } } void init(); return () => { disposed = true; observer?.disconnect(); if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current); markers.forEach((marker) => marker.remove()); markers.clear(); mapRef.current?.remove(); mapRef.current = null; }; }, []);
  return <div className={cn("kmm-marketing-map relative h-full w-full overflow-hidden bg-[#F8FAFC]", className)}><div ref={containerRef} className="absolute inset-0 h-full w-full" aria-label="Interactive Myanmar township heatmap" />{status === "loading" && <div className="absolute inset-0 grid place-items-center bg-white/80 text-sm font-semibold text-[#6B7280]">Loading Myanmar map...</div>}{status === "error" && <div className="absolute inset-0 grid place-items-center bg-white p-6 text-center text-sm text-[#DC2626]"><span><AlertTriangle className="mx-auto mb-3" size={22} />Unable to load the Myanmar map files.</span></div>}</div>;
}
