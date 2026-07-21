"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";
import { AlertTriangle, X } from "lucide-react";
import { normalizeLocation } from "../../lib/marketing/location-mapping";
import { cn } from "../../lib/utils";

type Showroom = { id: string; name: string; stateRegion: string; township: string; coordinates: [number, number] };
type GeoFeature = { geometry?: { coordinates?: unknown }; properties: { TS?: string; TS_PCODE?: string; ST?: string } };
type LabelFeature = { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: { id: string; name: string } };
type LabelCollection = { type: "FeatureCollection"; features: LabelFeature[] };
type TownshipMetric = { township: string; stateRegion: string; population: number; activities: number; salesUnit: number; booking: number | null; density: number | null; fill: string };
type PopupAnchor = "top" | "bottom" | "left" | "right";
type FitPadding = { top: number; right: number; bottom: number; left: number };

type MyanmarMarketingMapProps = {
  visibleShowroomIds?: string[];
  townshipMetrics?: Record<string, TownshipMetric>;
  productLabel?: string;
  mode?: "population" | "activity";
  resetSignal?: number;
  className?: string;
};

const MYANMAR_BOUNDS: [[number, number], [number, number]] = [
  [92.17210485865233, 9.60588355708055],
  [101.17001505455121, 28.54553886232867],
];
const EMPTY_LABELS: LabelCollection = { type: "FeatureCollection", features: [] };
const MAP_CAMERA_PADDING: FitPadding = { top: 24, right: 44, bottom: 24, left: 44 };
const DESKTOP_POPUP_WIDTH = 280;
const DESKTOP_POPUP_HEIGHT = 260;
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
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

function popupHtml(metric: TownshipMetric) {
  const booking = metric.booking === null ? "N/A" : format(metric.booking);
  return `<div class="kmm-map-popup-card">
    <p class="kmm-map-popup-title">${escapeHtml(metric.township)}</p>
    <div class="kmm-map-popup-meta">${escapeHtml(metric.stateRegion)}</div>
    <dl class="kmm-map-popup-list">
      <div><dt>Engine Population</dt><dd>${format(metric.population)}</dd></div>
      <div><dt>Activities</dt><dd>${format(metric.activities)}</dd></div>
      <div><dt>Sales Unit</dt><dd>${format(metric.salesUnit)}</dd></div>
      <div><dt>Booking</dt><dd>${booking}</dd></div>
    </dl>
    <button type="button" class="kmm-map-popup-details">View Details &rarr;</button>
  </div>`;
}

function choosePopupAnchor(map: MapLibreMap, lngLat: { lng: number; lat: number }): PopupAnchor {
  const point = map.project(lngLat);
  const { width, height } = map.getContainer().getBoundingClientRect();
  const horizontalEdge = point.x < DESKTOP_POPUP_WIDTH + 24 || width - point.x < DESKTOP_POPUP_WIDTH + 24;
  const verticalEdge = point.y < DESKTOP_POPUP_HEIGHT + 24 || height - point.y < DESKTOP_POPUP_HEIGHT + 24;
  if (horizontalEdge && point.x > width / 2) return "right";
  if (horizontalEdge) return "left";
  if (verticalEdge && point.y > height / 2) return "bottom";
  return "top";
}

function shouldUseBottomSheet(container: HTMLDivElement | null) {
  if (window.innerWidth < MOBILE_BREAKPOINT) return true;
  if (!container) return false;
  const bounds = container.getBoundingClientRect();
  return DESKTOP_POPUP_WIDTH * DESKTOP_POPUP_HEIGHT > bounds.width * bounds.height * 0.3;
}

export function MyanmarMarketingMap({ visibleShowroomIds, townshipMetrics = {}, mode = "population", resetSignal = 0, className }: MyanmarMarketingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<{ remove: () => void } | null>(null);
  const townshipsRef = useRef<GeoFeature[]>([]);
  const resizeTimerRef = useRef<number | null>(null);
  const fitLogRef = useRef(false);
  const markersRef = useRef(new Map<string, Marker>());
  const metricsRef = useRef(townshipMetrics);
  const visibleIdsRef = useRef(visibleShowroomIds);
  const sheetStartYRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [sheetMetric, setSheetMetric] = useState<TownshipMetric | null>(null);

  const closeSelection = () => {
    popupRef.current?.remove();
    setSheetMetric(null);
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
      const metric = metricsRef.current[key];
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
    popupRef.current?.remove();
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
            element.addEventListener("click", () => map.flyTo({ center: showroom.coordinates, zoom: Math.max(map.getZoom(), 7), duration: 500, essential: true }));
            markers.set(showroom.id, new maplibregl.Marker({ element, anchor: "center" }).setLngLat(showroom.coordinates).addTo(map));
          });
          applyMetrics();

          map.on("mousemove", "township-heatmap", (event) => {
            const feature = event.features?.[0] as GeoFeature | undefined;
            const metric = feature ? metricsRef.current[normalizeLocation(feature.properties.TS)] : undefined;
            map.getCanvas().style.cursor = metric ? "pointer" : "";
          });
          map.on("mouseleave", "township-heatmap", () => {
            map.getCanvas().style.cursor = "";
          });
          map.on("click", "township-heatmap", (event) => {
            const feature = event.features?.[0] as GeoFeature | undefined;
            const metric = feature ? metricsRef.current[normalizeLocation(feature.properties.TS)] : undefined;
            closeSelection();
            if (!metric || !event.lngLat) return;
            if (shouldUseBottomSheet(containerRef.current)) {
              setSheetMetric(metric);
              return;
            }
            const popup = new maplibregl.Popup({
              anchor: choosePopupAnchor(map, event.lngLat),
              className: "kmm-map-popup",
              closeButton: true,
              closeOnClick: true,
              closeOnMove: false,
              maxWidth: "320px",
              offset: 14,
            });
            popup.setLngLat(event.lngLat).setHTML(popupHtml(metric)).addTo(map);
            popupRef.current = popup;
          });
          map.on("click", (event) => {
            const features = map.queryRenderedFeatures(event.point, { layers: ["township-heatmap"] });
            if (!features.length) closeSelection();
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
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className={cn("kmm-marketing-map relative h-full w-full overflow-hidden bg-[#F8FAFC]", className)}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" aria-label="Interactive Myanmar township heatmap" />
      {sheetMetric && (
        <div className="kmm-map-sheet-backdrop" onClick={closeSelection}>
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
            <button type="button" className="kmm-map-sheet-close" onClick={closeSelection} aria-label="Close map details">
              <X size={16} />
            </button>
            <div className="kmm-map-popup-card">
              <p className="kmm-map-popup-title">{sheetMetric.township}</p>
              <div className="kmm-map-popup-meta">{sheetMetric.stateRegion}</div>
              <dl className="kmm-map-popup-list">
                <div><dt>Engine Population</dt><dd>{format(sheetMetric.population)}</dd></div>
                <div><dt>Activities</dt><dd>{format(sheetMetric.activities)}</dd></div>
                <div><dt>Sales Unit</dt><dd>{format(sheetMetric.salesUnit)}</dd></div>
                <div><dt>Booking</dt><dd>{sheetMetric.booking === null ? "N/A" : format(sheetMetric.booking)}</dd></div>
              </dl>
              <button type="button" className="kmm-map-popup-details">View Details &rarr;</button>
            </div>
          </div>
        </div>
      )}
      {status === "loading" && <div className="absolute inset-0 grid place-items-center bg-white/80 text-sm font-semibold text-[#6B7280]">Loading Myanmar map...</div>}
      {status === "error" && <div className="absolute inset-0 grid place-items-center bg-white p-6 text-center text-sm text-[#DC2626]"><span><AlertTriangle className="mx-auto mb-3" size={22} />Unable to load the Myanmar map files.</span></div>}
    </div>
  );
}
