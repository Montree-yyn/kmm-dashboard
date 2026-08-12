"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker, StyleSpecification } from "maplibre-gl";
import { Cloud, CloudRain, MapPinned, Thermometer, Wind } from "lucide-react";
import { registerPmtilesProtocol } from "../../../lib/maps/register-pmtiles-protocol";
import { cn } from "../../../lib/utils";
import { getMapDataset } from "../../../lib/maps/datasets";
import { createMarketingBasemapStyle } from "../../../src/kme/apps/kmm-dashboard/marketing/basemap";
import type { WeatherLocation } from "./weather.types";

type WeatherMapLayer = "cloud" | "rain" | "wind" | "temperature";

const mapLayers: Array<{ value: WeatherMapLayer; label: string; icon: typeof Cloud }> = [
  { value: "cloud", label: "Cloud", icon: Cloud },
  { value: "rain", label: "Rain", icon: CloudRain },
  { value: "wind", label: "Wind", icon: Wind },
  { value: "temperature", label: "Temperature", icon: Thermometer },
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

const MAP_FIT_PADDING = { top: 24, right: 44, bottom: 24, left: 44 };

export function WeatherMap({
  locations,
  selectedId,
  onSelect,
}: {
  locations: WeatherLocation[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const markerConstructorRef = useRef<typeof MapLibreMarker | null>(null);
  const mapLoadedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [activeLayer, setActiveLayer] = useState<WeatherMapLayer>("rain");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

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
          zoom: MARKETING_MAP_DATASET?.default_zoom ?? 4,
          minZoom: MARKETING_MAP_DATASET?.min_zoom,
          maxZoom: MARKETING_MAP_DATASET?.max_zoom,
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
                { padding: MAP_FIT_PADDING, duration: 0 },
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

  useEffect(() => {
    const map = mapRef.current;
    const MarkerConstructor = markerConstructorRef.current;
    if (!map || !mapReady || !MarkerConstructor) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = locations.map((location) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "weather-map-marker";
      element.setAttribute("aria-label", `${location.name}, ${getLayerValue(location, activeLayer)}`);
      element.title = `${location.name} · ${getLayerValue(location, activeLayer)}`;
      const selected = location.id === selectedId;
      const color = RISK_COLORS[location.riskLevel];
      Object.assign(element.style, {
        alignItems: "center",
        background: color,
        border: selected ? "3px solid #ffffff" : "2px solid #ffffff",
        borderRadius: "999px",
        boxShadow: selected ? `0 0 0 4px rgb(255 122 0 / 35%), 0 2px 8px rgb(0 0 0 / 20%)` : "0 2px 8px rgb(0 0 0 / 22%)",
        color: "#ffffff",
        cursor: "pointer",
        display: "flex",
        fontFamily: "inherit",
        fontSize: "10px",
        fontWeight: "700",
        height: selected ? "38px" : "32px",
        justifyContent: "center",
        padding: "0",
        transition: "transform 140ms ease, box-shadow 140ms ease",
        width: selected ? "38px" : "32px",
      });
      element.addEventListener("mouseenter", () => { element.style.transform = "scale(1.12)"; });
      element.addEventListener("mouseleave", () => { element.style.transform = "scale(1)"; });
      element.addEventListener("click", () => onSelectRef.current(location.id));

      const label = document.createElement("span");
      label.textContent = location.name;
      Object.assign(label.style, {
        background: "rgb(255 255 255 / 94%)",
        border: "1px solid rgb(203 213 225 / 85%)",
        borderRadius: "6px",
        color: "#334155",
        display: selected ? "block" : "none",
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

  return (
    <section className="flex h-[520px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)] md:h-[620px] xl:h-[680px]" aria-labelledby="weather-map-title">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--divider)] px-5 py-5 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-600)]"><MapPinned size={16} aria-hidden="true" /></span>
            <h2 id="weather-map-title" className="text-[19px] font-semibold">Operating Area Map</h2>
          </div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Myanmar and the five Tak districts.</p>
        </div>
        <span className="rounded-full border border-[var(--status-success-bg)] bg-[var(--status-success-bg)] px-2.5 py-1 text-[10px] font-semibold uppercase text-[var(--status-success)]">MapLibre live map</span>
      </div>
      <div className="relative mt-4 min-h-0 flex-1 p-4 sm:mt-6 sm:p-6">
        <div className="relative h-full min-h-0 overflow-hidden rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[#f7faf7]">
          <div className="absolute inset-0">
            <div ref={containerRef} className="size-full" style={{ width: "100%", height: "100%" }} aria-label="Interactive weather map of Myanmar and Tak, Thailand" />
          </div>
          <div className="absolute left-3 top-3 z-10 max-w-[calc(100%-5rem)] rounded-xl border border-white/80 bg-white/92 p-2 shadow-sm backdrop-blur-sm">
            <p className="px-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Live pin metric</p>
            <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Weather map layer">
              {mapLayers.map((layer) => {
                const Icon = layer.icon;
                const selected = activeLayer === layer.value;
                return (
                  <button
                    key={layer.value}
                    type="button"
                    onClick={() => setActiveLayer(layer.value)}
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex min-h-8 items-center gap-1 rounded-lg border px-2 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                      selected
                        ? "border-[var(--brand-500)] bg-[var(--brand-100)] text-[var(--brand-600)]"
                        : "border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]",
                    )}
                  >
                    <Icon size={12} aria-hidden="true" />
                    {layer.label}
                  </button>
                );
              })}
            </div>
          </div>
          {!mapReady && !mapError && <div className="absolute inset-0 z-[1] grid place-items-center bg-[#edf4f1]/80 text-xs font-semibold text-[var(--text-secondary)]" role="status">Loading interactive map…</div>}
          {mapError && <div className="absolute inset-x-3 bottom-3 z-10 rounded-lg border border-[var(--status-warning-bg)] bg-white/95 px-3 py-2 text-[10px] font-semibold text-[var(--status-warning)]" role="status">{mapError}</div>}
          <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-white/80 bg-white/90 px-3 py-2 text-[10px] font-semibold text-[#4c625e] shadow-sm">Drag · scroll to zoom · click a live pin</div>
        </div>
      </div>
    </section>
  );
}

function getLayerValue(location: WeatherLocation, layer: WeatherMapLayer) {
  if (layer === "cloud") return location.condition;
  if (layer === "rain") return `${location.rainRisk}% rain`;
  if (layer === "wind") return `${location.windSpeed} km/h`;
  return `${location.temperature}°C`;
}
