"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";
import lightStyle from "../../data/maps/styles/kmm-light-style.json";
import { createMapSource } from "../../lib/maps/create-map-source";
import { registerPmtilesProtocol } from "../../lib/maps/register-pmtiles-protocol";
import type { MapDatasetConfig } from "../../lib/maps/types";

type GlobalVectorMapProps = {
  dataset: MapDatasetConfig;
  ariaLabel?: string;
  className?: string;
  onMapReady?: (map: MapLibreMap) => void;
  onFeatureClick?: (feature: MapGeoJSONFeature) => void;
  onViewportChange?: (bounds: [number, number, number, number]) => void;
};

const fillLayerId = "business-boundary-fill";
const outlineLayerId = "business-boundary-outline";

export function GlobalVectorMap({ dataset, ariaLabel = "Interactive vector map", className, onMapReady, onFeatureClick, onViewportChange }: GlobalVectorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !dataset.enabled) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;

    async function initialize() {
      try {
        const { default: maplibregl } = await import("maplibre-gl");
        if (dataset.dataset_type === "pmtiles") await registerPmtilesProtocol(maplibregl);
        if (disposed || !containerRef.current) return;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: lightStyle as StyleSpecification,
          center: dataset.center ?? [0, 0],
          zoom: dataset.default_zoom ?? 2,
          minZoom: dataset.min_zoom,
          maxZoom: dataset.max_zoom,
          attributionControl: Boolean(dataset.attribution),
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(new maplibregl.FullscreenControl(), "top-right");
        observer = new ResizeObserver(() => map.resize());
        observer.observe(containerRef.current);

        map.on("load", () => {
          if (disposed) return;
          map.addSource(dataset.source_id, createMapSource(dataset));
          const sourceLayer = dataset.dataset_type === "geojson" ? undefined : dataset.source_layer ?? undefined;
          map.addLayer({ id: fillLayerId, type: "fill", source: dataset.source_id, "source-layer": sourceLayer, paint: { "fill-color": "#fed7aa", "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.82, 0.5] } });
          map.addLayer({ id: outlineLayerId, type: "line", source: dataset.source_id, "source-layer": sourceLayer, paint: { "line-color": "#ea580c", "line-width": 0.8, "line-opacity": 0.75 } });
          if (dataset.bounds) map.fitBounds([[dataset.bounds[0], dataset.bounds[1]], [dataset.bounds[2], dataset.bounds[3]]], { padding: 28, duration: 0 });
          let hoveredId: string | number | undefined;
          map.on("mousemove", fillLayerId, (event) => {
            const feature = event.features?.[0];
            if (!feature) return;
            map.getCanvas().style.cursor = "pointer";
            if (hoveredId !== undefined) map.setFeatureState({ source: dataset.source_id, sourceLayer, id: hoveredId }, { hover: false });
            hoveredId = feature.id;
            if (hoveredId !== undefined) map.setFeatureState({ source: dataset.source_id, sourceLayer, id: hoveredId }, { hover: true });
          });
          map.on("mouseleave", fillLayerId, () => {
            map.getCanvas().style.cursor = "";
            if (hoveredId !== undefined) map.setFeatureState({ source: dataset.source_id, sourceLayer, id: hoveredId }, { hover: false });
            hoveredId = undefined;
          });
          map.on("click", fillLayerId, (event) => { const feature = event.features?.[0]; if (feature) onFeatureClick?.(feature); });
          map.on("moveend", () => { const bounds = map.getBounds(); onViewportChange?.([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]); });
          setStatus("ready");
          onMapReady?.(map);
        });
        map.on("error", () => !disposed && setStatus("error"));
      } catch {
        if (!disposed) setStatus("error");
      }
    }
    void initialize();
    return () => { disposed = true; observer?.disconnect(); mapRef.current?.remove(); mapRef.current = null; };
  }, [dataset, onFeatureClick, onMapReady, onViewportChange]);

  if (!dataset.enabled) return <div className={className} role="status">Dataset is configured but inactive.</div>;
  return <div className={className ?? "relative h-[620px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"}><div ref={containerRef} className="absolute inset-0" aria-label={ariaLabel} />{status === "loading" && <div className="absolute inset-0 grid place-items-center bg-white/80 text-sm text-slate-600">Loading vector map…</div>}{status === "error" && <div className="absolute inset-0 grid place-items-center bg-white p-6 text-center text-sm text-red-700">Unable to load this map dataset.</div>}</div>;
}
