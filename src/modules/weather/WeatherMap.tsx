"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker, StyleSpecification } from "maplibre-gl";
import { ChevronDown, Cloud, CloudRain, LocateFixed, Maximize2, Minimize2, Radar, Thermometer, Wind } from "lucide-react";
import { registerPmtilesProtocol } from "../../../lib/maps/register-pmtiles-protocol";
import { cn } from "../../../lib/utils";
import { getMapDataset } from "../../../lib/maps/datasets";
import { createMarketingBasemapStyle } from "../../../src/kme/apps/kmm-dashboard/marketing/basemap";
import type { WeatherLocation, WeatherRadarPayload } from "./weather.types";

type WeatherMapLayer = "radar" | "cloud" | "rain" | "wind" | "temperature";

const mapLayers: Array<{ value: WeatherMapLayer; label: string; icon: typeof Cloud }> = [
  { value: "radar", label: "Radar", icon: Radar },
  { value: "cloud", label: "Cloud pins", icon: Cloud },
  { value: "rain", label: "Rain pins", icon: CloudRain },
  { value: "wind", label: "Wind pins", icon: Wind },
  { value: "temperature", label: "Temp pins", icon: Thermometer },
];

const MARKETING_BASEMAP_STYLE = createMarketingBasemapStyle();
const MARKETING_MAP_DATASET = getMapDataset("mm-townships-pmtiles");
const WEATHER_MAP_STYLE = {
  ...MARKETING_BASEMAP_STYLE,
  sources: {
    ...MARKETING_BASEMAP_STYLE.sources,
    states: { type: "geojson", data: "/maps/myanmar-states.geojson" },
    townships: { type: "geojson", data: "/maps/myanmar-townships.geojson" },
  },
  layers: [
    ...MARKETING_BASEMAP_STYLE.layers,
    {
      id: "weather-state-line",
      type: "line",
      source: "states",
      paint: { "line-color": "#7fa896", "line-width": 1.2 },
    },
    {
      id: "weather-township-line",
      type: "line",
      source: "townships",
      minzoom: 5,
      paint: { "line-color": "#b8d0c1", "line-opacity": 0.72, "line-width": 0.55 },
    },
  ],
} as StyleSpecification;

const RISK_COLORS = {
  LOW: "#157347",
  MEDIUM: "#a15c00",
  HIGH: "#bd241c",
} as const;

const RISK_LABELS: Record<keyof typeof RISK_COLORS, string> = {
  LOW: "Normal",
  MEDIUM: "Watch",
  HIGH: "Critical",
};

const RISK_GLASS: Record<keyof typeof RISK_COLORS, {
  background: string;
  border: string;
  ring: string;
  text: string;
}> = {
  LOW: {
    background: "rgb(240 253 244 / 78%)",
    border: "rgb(22 101 52 / 48%)",
    ring: "rgb(34 197 94 / 28%)",
    text: "#166534",
  },
  MEDIUM: {
    background: "rgb(255 247 237 / 80%)",
    border: "rgb(194 65 12 / 50%)",
    ring: "rgb(251 146 60 / 30%)",
    text: "#9a3412",
  },
  HIGH: {
    background: "rgb(254 242 242 / 80%)",
    border: "rgb(185 28 28 / 55%)",
    ring: "rgb(248 113 113 / 32%)",
    text: "#b91c1c",
  },
};

const MAP_FIT_PADDING = { top: 24, right: 44, bottom: 24, left: 44 };
const MAP_MIN_ZOOM = MARKETING_MAP_DATASET?.min_zoom ?? 3;
// The global Protomaps OSM v4 basemap supports zoom 15. The township overlay
// dataset has a lower max zoom, but it must not cap the basemap camera.
const MAP_MAX_ZOOM = 15;
// RainViewer's public radar tile pyramid intentionally stops at zoom 7.
const RADAR_TILE_MAX_ZOOM = 7;
const MAP_PIN_FOCUS_ZOOM = 11;
const MAP_OVERVIEW_ZOOM = Math.min(
  Math.max(MARKETING_MAP_DATASET?.default_zoom ?? 4, MAP_MIN_ZOOM),
  MAP_MAX_ZOOM,
);

export function WeatherMap({
  locations,
  selectedId,
  onSelect,
  radar,
  radarError,
}: {
  locations: WeatherLocation[];
  selectedId: string;
  onSelect: (id: string) => void;
  radar: WeatherRadarPayload | null;
  radarError?: string;
}) {
  const fullscreenRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const markerConstructorRef = useRef<typeof MapLibreMarker | null>(null);
  const mapLoadedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [activeLayer, setActiveLayer] = useState<WeatherMapLayer>("radar");
  const [radarFrameTime, setRadarFrameTime] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen || document.fullscreenElement) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    if (!mapRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => mapRef.current?.resize());
    return () => window.cancelAnimationFrame(frame);
  }, [isFullscreen]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;
    let map: MapLibreMap | null = null;
    let resizeObserver: ResizeObserver | undefined;

    async function initializeMap() {
      try {
        const { default: maplibregl } = await import("maplibre-gl");
        await registerPmtilesProtocol(maplibregl);
        if (disposed || !containerRef.current) return;
        markerConstructorRef.current = maplibregl.Marker;

        map = new maplibregl.Map({
          container: containerRef.current,
          style: WEATHER_MAP_STYLE,
          center: MARKETING_MAP_DATASET?.center ?? [96, 19],
          zoom: MAP_OVERVIEW_ZOOM,
          minZoom: MAP_MIN_ZOOM,
          maxZoom: MAP_MAX_ZOOM,
          renderWorldCopies: false,
          attributionControl: false,
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => {
          if (!disposed) {
            mapLoadedRef.current = true;
            map?.resize();
            if (MARKETING_MAP_DATASET?.bounds) {
              map?.fitBounds(
                [[MARKETING_MAP_DATASET.bounds[0], MARKETING_MAP_DATASET.bounds[1]], [MARKETING_MAP_DATASET.bounds[2], MARKETING_MAP_DATASET.bounds[3]]],
                { padding: MAP_FIT_PADDING, duration: 0, maxZoom: MAP_OVERVIEW_ZOOM },
              );
            }
            setMapReady(true);
          }
        });
        map.on("error", (event) => {
          if (disposed || mapLoadedRef.current) return;
          const message = typeof event === "object" && event && "error" in event
            ? String((event as { error?: { message?: string } }).error?.message ?? "")
            : "";
          if (/not a valid style|unexpected end|failed to load style/i.test(message)) {
            setMapError("Map data could not be loaded. The live weather cards remain available.");
          }
        });
        resizeObserver = new ResizeObserver(() => map?.resize());
        resizeObserver.observe(containerRef.current);
      } catch {
        if (!disposed) setMapError("MapLibre could not start in this browser.");
      }
    }

    void initializeMap();
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map?.remove();
      mapRef.current = null;
      markerConstructorRef.current = null;
      mapLoadedRef.current = false;
    };
  }, []);

  const resetMapView = () => {
    const map = mapRef.current;
    if (!map || !MARKETING_MAP_DATASET?.bounds) return;
    map.fitBounds(
      [[MARKETING_MAP_DATASET.bounds[0], MARKETING_MAP_DATASET.bounds[1]], [MARKETING_MAP_DATASET.bounds[2], MARKETING_MAP_DATASET.bounds[3]]],
      { padding: MAP_FIT_PADDING, duration: 350, essential: true, maxZoom: MAP_OVERVIEW_ZOOM },
    );
  };

  useEffect(() => {
    const map = mapRef.current;
    const MarkerConstructor = markerConstructorRef.current;
    if (!map || !mapReady || !MarkerConstructor) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = locations.map((location) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "weather-map-marker";
      const layerValue = getLayerValue(location, activeLayer);
      element.setAttribute("aria-label", `Weather at ${location.name}: ${layerValue}`);
      element.title = `${location.name} · ${layerValue}`;
      const selected = location.id === selectedId;
      const isRadarDataPin = activeLayer === "radar";
      const risk = RISK_GLASS[location.riskLevel];
      const showLabel = selected || location.id === "MM-THA";
      Object.assign(element.style, {
        alignItems: "center",
        background: "transparent",
        border: "0",
        boxShadow: "none",
        cursor: "pointer",
        display: "flex",
        fontFamily: "inherit",
        height: isRadarDataPin ? "54px" : "44px",
        justifyContent: "center",
        padding: "0",
        position: "relative",
        width: isRadarDataPin ? "72px" : "44px",
        zIndex: selected ? "4" : showLabel ? "3" : "1",
      });
      element.addEventListener("click", () => {
        onSelectRef.current(location.id);
        map.flyTo({
          center: [location.longitude, location.latitude],
          zoom: Math.min(MAP_MAX_ZOOM, Math.max(map.getZoom(), MAP_PIN_FOCUS_ZOOM)),
          duration: 450,
          essential: true,
        });
      });

      const pin = document.createElement("span");
      Object.assign(pin.style, {
        alignItems: "center",
        backdropFilter: "blur(8px) saturate(1.08)",
        background: risk.background,
        border: `${selected ? "2px" : "1px"} solid ${risk.border}`,
        borderRadius: isRadarDataPin ? "10px" : "999px",
        boxShadow: selected ? `0 0 0 3px ${risk.ring}, 0 4px 12px rgb(15 23 42 / 18%)` : "0 2px 10px rgb(15 23 42 / 16%)",
        color: risk.text,
        display: "flex",
        flexDirection: isRadarDataPin ? "column" : "row",
        gap: isRadarDataPin ? "1px" : "0",
        justifyContent: "center",
        height: isRadarDataPin ? (selected ? "44px" : "38px") : (selected ? "34px" : "28px"),
        minWidth: isRadarDataPin ? (selected ? "66px" : "60px") : undefined,
        padding: isRadarDataPin ? "3px 5px" : "0",
        transition: "transform 140ms ease",
        width: isRadarDataPin ? "auto" : (selected ? "34px" : "28px"),
        whiteSpace: "nowrap",
      });
      if (isRadarDataPin) {
        const temperature = document.createElement("span");
        temperature.textContent = `${location.temperature}°`;
        temperature.style.fontSize = "14px";
        temperature.style.fontWeight = "800";
        temperature.style.lineHeight = "1";
        const rain = document.createElement("span");
        rain.textContent = `${location.rainRisk}% rain`;
        rain.style.fontSize = "9px";
        rain.style.fontWeight = "700";
        rain.style.lineHeight = "1";
        pin.append(temperature, rain);
      } else {
        pin.innerHTML = getWeatherPinIcon(activeLayer);
      }
      element.append(pin);
      const setHovered = (hovered: boolean) => {
        // MapLibre owns the outer marker transform; scale only the visual pin.
        pin.style.transform = hovered ? "scale(1.12)" : "scale(1)";
      };
      element.addEventListener("mouseenter", () => setHovered(true));
      element.addEventListener("mouseleave", () => setHovered(false));

      const label = document.createElement("span");
      label.textContent = location.name;
      Object.assign(label.style, {
        backdropFilter: "blur(8px) saturate(1.08)",
        background: "rgb(255 255 255 / 72%)",
        border: `1px solid ${risk.border}`,
        borderRadius: "6px",
        boxShadow: "0 2px 8px rgb(15 23 42 / 12%)",
        color: risk.text,
        display: showLabel ? "block" : "none",
        fontSize: "10px",
        fontWeight: "700",
        left: "50%",
        padding: "4px 6px",
        pointerEvents: "none",
        position: "absolute",
        top: "calc(100% + 5px)",
        transform: "translateX(-50%)",
        whiteSpace: "nowrap",
      });
      element.append(label);

      return new MarkerConstructor({ element, anchor: "center" })
        .setLngLat([location.longitude, location.latitude])
        .addTo(map);
    });

  }, [activeLayer, locations, mapReady, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const sourceId = "weather-radar";
    const layerId = "weather-radar-layer";
    const removeRadarLayer = () => {
      try {
        if (!map.isStyleLoaded()) return;
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // MapLibre can replace its style while React is cleaning up an old effect.
      }
    };
    const frame = radar?.frames.find((candidate) => candidate.time === radarFrameTime) ?? radar?.frames.at(-1);
    if (activeLayer !== "radar" || !radar || !frame) {
      removeRadarLayer();
      return;
    }
    removeRadarLayer();
    try {
      if (map.getSource(sourceId)) return;
    } catch {
      return;
    }
    const tileUrl = `${radar.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
    try {
      map.addSource(sourceId, {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        maxzoom: RADAR_TILE_MAX_ZOOM,
        attribution: "Weather data by RainViewer",
      });
      map.addLayer(
        {
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: {
            "raster-opacity": 0.58,
            "raster-fade-duration": 0,
          },
        },
        "weather-state-line",
      );
    } catch {
      removeRadarLayer();
    }
    return () => {
      removeRadarLayer();
    };
  }, [activeLayer, mapReady, radar, radarFrameTime]);

  const latestRadarFrame = radar?.frames.at(-1);
  const selectedRadarFrame = radar?.frames.find((frame) => frame.time === radarFrameTime) ?? latestRadarFrame;

  const toggleFullscreen = () => {
    const element = fullscreenRef.current;
    if (!element) return;
    if (isFullscreen) {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => setIsFullscreen(false));
      } else {
        setIsFullscreen(false);
      }
      return;
    }
    if (element.requestFullscreen) {
      void element.requestFullscreen().catch(() => setIsFullscreen(true));
    } else {
      setIsFullscreen(true);
    }
  };

  return (
    <section
      ref={fullscreenRef}
      className={cn(
        "flex h-auto flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)]",
        isFullscreen && "fixed inset-0 z-[120] h-[100dvh] w-screen max-w-none rounded-none border-0 bg-[var(--surface-canvas)] shadow-2xl",
      )}
      aria-labelledby="weather-map-title"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--divider)] px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-[#e7f4fb] text-[#0875a8]"><Radar size={16} aria-hidden="true" /></span>
            <h2 id="weather-map-title" className="truncate text-[19px] font-semibold">Live Weather Radar</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">Observed precipitation over Myanmar and the five Tak districts.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            title={isFullscreen ? "Exit weather map fullscreen" : "Open weather map fullscreen"}
            aria-label={isFullscreen ? "Exit weather map fullscreen" : "Open weather map fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</span>
          </button>
          <span className={cn(
            "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase",
            radar ? "border-[var(--status-success-bg)] bg-[var(--status-success-bg)] text-[var(--status-success)]" : "border-[var(--status-warning-bg)] bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
          )}>{radar ? "Radar available" : "Radar unavailable"}</span>
        </div>
      </div>
      <div className={cn(
        "relative mt-4 min-h-0 p-4 sm:mt-6 sm:p-6",
        isFullscreen && "flex min-h-0 flex-1 flex-col overflow-y-auto",
      )}>
        <div className={cn(
          "relative min-h-0 overflow-hidden rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[#f7faf7]",
          isFullscreen ? "min-h-[260px] flex-1" : "h-[360px] sm:h-[420px] md:h-[520px] xl:h-[620px]",
        )}>
          <div className="absolute inset-0">
            <div ref={containerRef} className="size-full" style={{ width: "100%", height: "100%" }} aria-label="Interactive weather map of Myanmar and Tak, Thailand" />
          </div>
          {!mapReady && !mapError && <div className="absolute inset-0 z-[1] grid place-items-center bg-[#edf4f1]/80 text-xs font-semibold text-[var(--text-secondary)]" role="status">Loading interactive map…</div>}
          {mapError && <div className="absolute inset-x-3 bottom-3 z-10 rounded-lg border border-[var(--status-warning-bg)] bg-white/95 px-3 py-2 text-[10px] font-semibold text-[var(--status-warning)]" role="status">{mapError}</div>}
        </div>
        <div className="mt-2 flex flex-col gap-1 px-1 text-[10px] leading-4 text-[#4c625e] sm:flex-row sm:items-center sm:justify-between">
          <span>Drag · pinch or scroll to zoom · tap a pin to focus the area · radar shows observed rain</span>
          <span>Radar: <a className="font-semibold underline" href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">RainViewer</a> · Forecast: <a className="font-semibold underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></span>
        </div>
        <details className="group mt-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-2 shadow-sm [&::-webkit-details-marker]:hidden">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e7f4fb] text-[#0875a8]"><Radar size={15} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-[var(--text-primary)]">Map controls</span>
              <span className="block truncate text-[10px] text-[var(--text-secondary)]">{mapLayers.find((layer) => layer.value === activeLayer)?.label ?? "Radar"} · {selectedRadarFrame ? formatRadarTime(selectedRadarFrame.time) : "Loading"}</span>
            </span>
            <ChevronDown size={17} className="shrink-0 text-[var(--text-secondary)] transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="mt-2" aria-label="Weather map controls">
            <WeatherMapControls
              activeLayer={activeLayer}
              latestRadarFrame={latestRadarFrame}
              mobile
              onResetView={resetMapView}
              onFrameChange={setRadarFrameTime}
              onLayerChange={setActiveLayer}
              radar={radar}
              radarError={radarError}
              selectedRadarFrame={selectedRadarFrame}
            />
          </div>
        </details>
      </div>
    </section>
  );
}

function WeatherMapControls({
  activeLayer,
  latestRadarFrame,
  mobile = false,
  onResetView,
  onFrameChange,
  onLayerChange,
  radar,
  radarError,
  selectedRadarFrame,
}: {
  activeLayer: WeatherMapLayer;
  latestRadarFrame: WeatherRadarPayload["frames"][number] | undefined;
  mobile?: boolean;
  onResetView: () => void;
  onFrameChange: (time: number) => void;
  onLayerChange: (layer: WeatherMapLayer) => void;
  radar: WeatherRadarPayload | null;
  radarError?: string;
  selectedRadarFrame: WeatherRadarPayload["frames"][number] | undefined;
}) {
  return (
    <div className={cn(
      "rounded-xl border border-white/80 bg-white/95 shadow-sm",
      mobile ? "p-3" : "max-w-[calc(100vw-5rem)] p-2 backdrop-blur-sm",
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("px-1 font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]", mobile ? "text-[10px]" : "text-[9px]")}>Weather layers</p>
        <button
          type="button"
          onClick={onResetView}
          className={cn(
            "inline-flex min-h-11 items-center gap-1 rounded-lg border border-[var(--border-default)] bg-white px-2 font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
            mobile ? "text-[10px]" : "text-[9px]",
          )}
          aria-label="Reset map to Myanmar overview"
        >
          <LocateFixed size={mobile ? 14 : 12} aria-hidden="true" />
          Overview
        </button>
      </div>
      <div className={cn("mt-1 gap-1", mobile ? "grid grid-cols-2 sm:grid-cols-3" : "flex flex-wrap")} role="group" aria-label="Weather radar and pin metric">
        {mapLayers.map((layer) => {
          const Icon = layer.icon;
          const selected = activeLayer === layer.value;
          const disabled = layer.value === "radar" && !radar;
          return (
            <button
              key={layer.value}
              type="button"
              onClick={() => onLayerChange(layer.value)}
              disabled={disabled}
              aria-pressed={selected}
              className={cn(
                "inline-flex min-h-11 min-w-0 items-center gap-1 rounded-lg border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45",
                mobile ? "w-full justify-start px-3 text-xs" : "px-2 text-[10px]",
                mobile && layer.value === "temperature" && "col-span-2 sm:col-span-1",
                selected
                  ? "border-[var(--brand-500)] bg-[var(--brand-100)] text-[var(--brand-600)]"
                  : "border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]",
              )}
            >
              <Icon size={mobile ? 14 : 12} aria-hidden="true" />
              {layer.label}
            </button>
          );
        })}
      </div>
      {activeLayer === "radar" && radar && (
        <div className={cn("border-t border-[var(--divider)]", mobile ? "mt-3 pt-3" : "mt-2 pt-2")}>
          <div className={cn("flex items-center justify-between gap-2 px-1 text-[var(--text-tertiary)]", mobile ? "text-[10px]" : "text-[9px]")}>
            <span>Radar timeline · past 2 hours</span>
            <span className="font-semibold text-[#0875a8]">{selectedRadarFrame ? formatRadarTime(selectedRadarFrame.time) : "Loading"}</span>
          </div>
          <div className="mt-1 flex gap-1 overflow-x-auto pb-0.5" role="group" aria-label="Radar timeline">
            {radar.frames.slice(-6).map((frame) => {
              const selectedFrame = frame.time === selectedRadarFrame?.time;
              return (
                <button
                  key={frame.time}
                  type="button"
                  onClick={() => onFrameChange(frame.time)}
                  aria-pressed={selectedFrame}
                  className={cn(
                    "min-h-11 shrink-0 rounded-md border font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                    mobile ? "px-3 text-[10px]" : "px-2 text-[9px]",
                    selectedFrame ? "border-[#0875a8] bg-[#e7f4fb] text-[#0875a8]" : "border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]",
                  )}
                >
                  {frame.time === latestRadarFrame?.time ? "Last scan" : formatRadarRelativeTime(frame.time, latestRadarFrame?.time)}
                </button>
              );
            })}
          </div>
          <div className={cn("flex items-center gap-2 px-1 text-[var(--text-tertiary)]", mobile ? "mt-3 text-[10px]" : "mt-2 text-[9px]")} aria-label="Radar intensity legend">
            <span>Light</span><span className="size-2 rounded-full bg-[#5cc8ff]" aria-hidden="true" /><span className="size-2 rounded-full bg-[#55c66a]" aria-hidden="true" /><span className="size-2 rounded-full bg-[#ffd34e]" aria-hidden="true" /><span className="size-2 rounded-full bg-[#e54b3f]" aria-hidden="true" /><span>Heavy</span>
          </div>
        </div>
      )}
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[var(--text-tertiary)]", mobile ? "mt-3 text-[10px]" : "mt-2 text-[9px]")} aria-label="Weather pin risk legend">
        <span className="font-semibold">Weather status</span>
        {Object.entries(RISK_COLORS).map(([riskLevel, color]) => {
          const riskKey = riskLevel as keyof typeof RISK_COLORS;
          return (
            <span key={riskLevel} className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              {RISK_LABELS[riskKey]}
            </span>
          );
        })}
      </div>
      {activeLayer === "radar" && !radar && <p className={cn("px-1 leading-4 text-[var(--status-warning)]", mobile ? "mt-3 text-[10px]" : "mt-2 text-[9px]")}>{radarError ?? "Radar is loading; live forecast pins remain available."}</p>}
    </div>
  );
}

function getLayerValue(location: WeatherLocation, layer: WeatherMapLayer) {
  if (layer === "radar") return `${location.rainRisk}% rain risk`;
  if (layer === "cloud") return location.condition;
  if (layer === "rain") return `${location.rainRisk}% rain`;
  if (layer === "wind") return `${location.windSpeed} km/h`;
  return `${location.temperature}°C`;
}

function getWeatherPinIcon(layer: WeatherMapLayer) {
  const icon = {
    radar: '<path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    rain: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
    wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
    temperature: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 1 1 4 0Z"/>',
  }[layer];
  return `<svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8">${icon}</svg>`;
}

function formatRadarTime(seconds: number) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(seconds * 1000));
}

function formatRadarRelativeTime(seconds: number, latestSeconds: number | undefined) {
  if (!latestSeconds) return formatRadarTime(seconds);
  const minutes = Math.max(0, Math.round((latestSeconds - seconds) / 60));
  return minutes ? `−${minutes}m` : "Last scan";
}
