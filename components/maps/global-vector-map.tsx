"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";
import lightStyle from "../../data/maps/styles/kmm-light-style.json";
import { createMapSource } from "../../lib/maps/create-map-source";
import { registerPmtilesProtocol } from "../../lib/maps/register-pmtiles-protocol";
import { getMapLayers, isLayerGroupEnabled, type MapLayerState } from "../../lib/maps/layers";
import { applyRequiredLayerOrder, getActualManagedLayerOrder, isRequiredLayerOrder, MAP_LAYER_IDS } from "../../lib/maps/layer-order";
import type { MapDatasetConfig } from "../../lib/maps/types";

export type MapDebugStatus = {
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

type GlobalVectorMapProps = {
  dataset: MapDatasetConfig;
  ariaLabel?: string;
  className?: string;
  onMapReady?: (map: MapLibreMap) => void;
  onFeatureClick?: (feature: MapGeoJSONFeature) => void;
  onFeatureHover?: (feature: MapGeoJSONFeature | null, point?: { x: number; y: number }) => void;
  onViewportChange?: (bounds: [number, number, number, number]) => void;
  onError?: () => void;
  fillColorsByCanonicalId?: Record<string, string>;
  selectedCanonicalLocationId?: string | null;
  layerState?: MapLayerState;
  viewportPaddingRight?: number;
  fitPadding?: { top: number; right: number; bottom: number; left: number };
  baseStyle?: StyleSpecification | string;
  overlayFillOpacity?: number;
  overlayHoverOpacity?: number;
  overlaySelectedOpacity?: number;
  activeMetricLayer?: string;
  topCanonicalLocationIds?: string[];
  onMapStatus?: (status: MapDebugStatus) => void;
};

const fillLayerId = MAP_LAYER_IDS.metricFill;
const baseFillLayerId = MAP_LAYER_IDS.townshipBaseFill;
const hoverFillLayerId = MAP_LAYER_IDS.townshipHoverFill;
const selectedFillLayerId = MAP_LAYER_IDS.townshipSelectedFill;
const outlineLayerId = MAP_LAYER_IDS.townshipBoundary;
const topTownshipLayerId = MAP_LAYER_IDS.topTownships;
const selectedLayerId = MAP_LAYER_IDS.townshipSelectedOutline;
const townshipMapLayerIds = [fillLayerId, baseFillLayerId, hoverFillLayerId, selectedFillLayerId, outlineLayerId, topTownshipLayerId, selectedLayerId];

function getFillColorExpression(fillColorsByCanonicalId: Record<string, string>) {
  const colorPairs: (string | unknown)[] = ["match", ["get", "canonical_location_id"]];
  Object.entries(fillColorsByCanonicalId).forEach(([id, color]) => colorPairs.push(id, color));
  colorPairs.push("#F8FAFC");
  return colorPairs as never;
}

function getSelectedOpacityExpression(selectedCanonicalLocationId: string | null, opacity = 1) {
  return ["case", ["==", ["get", "canonical_location_id"], selectedCanonicalLocationId ?? ""], opacity, 0] as never;
}

function getFillOpacityExpression(defaultOpacity: number) {
  return defaultOpacity;
}

function getHoverOpacityExpression(selectedCanonicalLocationId: string | null, hoverOpacity: number) {
  return ["case", ["==", ["get", "canonical_location_id"], selectedCanonicalLocationId ?? ""], 0, ["boolean", ["feature-state", "hover"], false], hoverOpacity, 0] as never;
}

function getTopTownshipFilter(topCanonicalLocationIds: string[]) {
  return ["in", ["get", "canonical_location_id"], ["literal", topCanonicalLocationIds]] as never;
}

function getFitPadding(padding: { top: number; right: number; bottom: number; left: number }, viewportPaddingRight: number) {
  return { ...padding, right: padding.right + viewportPaddingRight };
}

export function GlobalVectorMap({ dataset, ariaLabel = "Interactive vector map", className, onMapReady, onFeatureClick, onFeatureHover, onViewportChange, onError, fillColorsByCanonicalId = {}, selectedCanonicalLocationId = null, layerState, viewportPaddingRight = 0, fitPadding = { top: 28, right: 28, bottom: 28, left: 28 }, baseStyle, overlayFillOpacity = 0.98, overlayHoverOpacity = 0.98, overlaySelectedOpacity = 0.98, activeMetricLayer = "heatmap", topCanonicalLocationIds = [], onMapStatus }: GlobalVectorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const layerStateRef = useRef(layerState);
  const fillColorsRef = useRef(fillColorsByCanonicalId);
  const selectedCanonicalLocationIdRef = useRef(selectedCanonicalLocationId);
  const selectedFeatureIdRef = useRef<string | number | null>(null);
  const hoveredFeatureIdRef = useRef<string | number | null>(null);
  const onFeatureClickRef = useRef(onFeatureClick);
  const onFeatureHoverRef = useRef(onFeatureHover);
  const onMapReadyRef = useRef(onMapReady);
  const onViewportChangeRef = useRef(onViewportChange);
  const onErrorRef = useRef(onError);
  const viewportPaddingRightRef = useRef(viewportPaddingRight);
  const fitPaddingRef = useRef(fitPadding);
  const overlayFillOpacityRef = useRef(overlayFillOpacity);
  const overlayHoverOpacityRef = useRef(overlayHoverOpacity);
  const overlaySelectedOpacityRef = useRef(overlaySelectedOpacity);
  const onMapStatusRef = useRef(onMapStatus);
  const activeMetricLayerRef = useRef(activeMetricLayer);
  const topCanonicalLocationIdsRef = useRef(topCanonicalLocationIds);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  layerStateRef.current = layerState;
  fillColorsRef.current = fillColorsByCanonicalId;
  selectedCanonicalLocationIdRef.current = selectedCanonicalLocationId;
  onFeatureClickRef.current = onFeatureClick;
  onFeatureHoverRef.current = onFeatureHover;
  onMapReadyRef.current = onMapReady;
  onViewportChangeRef.current = onViewportChange;
  onErrorRef.current = onError;
  viewportPaddingRightRef.current = viewportPaddingRight;
  fitPaddingRef.current = fitPadding;
  overlayFillOpacityRef.current = overlayFillOpacity;
  overlayHoverOpacityRef.current = overlayHoverOpacity;
  overlaySelectedOpacityRef.current = overlaySelectedOpacity;
  onMapStatusRef.current = onMapStatus;
  activeMetricLayerRef.current = activeMetricLayer;
  topCanonicalLocationIdsRef.current = topCanonicalLocationIds;

  const emitMapStatus = (map: MapLibreMap) => {
    const visibleLayerIds = townshipMapLayerIds.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none");
    const actualMapLayerOrder = getActualManagedLayerOrder(map);
    onMapStatusRef.current?.({
      selectedFeatureId: selectedFeatureIdRef.current ?? selectedCanonicalLocationIdRef.current,
      hoveredFeatureId: hoveredFeatureIdRef.current,
      selectedCanonicalLocationId: selectedCanonicalLocationIdRef.current,
      activeMetricLayer: map.getLayer(fillLayerId) && map.getLayoutProperty(fillLayerId, "visibility") !== "none" ? activeMetricLayerRef.current : null,
      zoom: map.getZoom(),
      visibleLayerIds,
      actualMapLayerOrder,
      selectedFillVisibility: Boolean(map.getLayer(selectedFillLayerId) && map.getLayoutProperty(selectedFillLayerId, "visibility") !== "none"),
      selectedOutlineVisibility: Boolean(map.getLayer(selectedLayerId) && map.getLayoutProperty(selectedLayerId, "visibility") !== "none"),
      hoverFillVisibility: Boolean(map.getLayer(hoverFillLayerId) && map.getLayoutProperty(hoverFillLayerId, "visibility") !== "none"),
      layerOrderWarning: !isRequiredLayerOrder(actualMapLayerOrder),
    });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer(fillLayerId)) map.setLayoutProperty(fillLayerId, "visibility", isLayerGroupEnabled("heatmap", layerState) ? "visible" : "none");
    if (map.getLayer(outlineLayerId)) map.setLayoutProperty(outlineLayerId, "visibility", isLayerGroupEnabled("township-boundary", layerState) ? "visible" : "none");
    [baseFillLayerId, hoverFillLayerId, selectedFillLayerId, selectedLayerId].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
    });
    applyRequiredLayerOrder(map);
    emitMapStatus(map);
  }, [layerState]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer(fillLayerId)) map.setPaintProperty(fillLayerId, "fill-color", getFillColorExpression(fillColorsByCanonicalId));
  }, [fillColorsByCanonicalId]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer(fillLayerId)) map.setPaintProperty(fillLayerId, "fill-opacity", getFillOpacityExpression(overlayFillOpacity));
    if (map?.getLayer(hoverFillLayerId)) map.setPaintProperty(hoverFillLayerId, "fill-opacity", getHoverOpacityExpression(selectedCanonicalLocationId, overlayHoverOpacity));
    if (map?.getLayer(selectedFillLayerId)) map.setPaintProperty(selectedFillLayerId, "fill-opacity", getSelectedOpacityExpression(selectedCanonicalLocationId, overlaySelectedOpacity));
    if (map?.getLayer(selectedLayerId)) map.setPaintProperty(selectedLayerId, "line-opacity", getSelectedOpacityExpression(selectedCanonicalLocationId));
    if (!selectedCanonicalLocationId) selectedFeatureIdRef.current = null;
  }, [selectedCanonicalLocationId, overlayFillOpacity, overlayHoverOpacity, overlaySelectedOpacity]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer(topTownshipLayerId)) map.setFilter(topTownshipLayerId, getTopTownshipFilter(topCanonicalLocationIds));
  }, [topCanonicalLocationIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    applyRequiredLayerOrder(map);
    emitMapStatus(map);
  }, [selectedCanonicalLocationId]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded()) emitMapStatus(map);
  }, [activeMetricLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.resize();
    if (dataset.bounds) map.fitBounds([[dataset.bounds[0], dataset.bounds[1]], [dataset.bounds[2], dataset.bounds[3]]], { padding: getFitPadding(fitPaddingRef.current, viewportPaddingRight), duration: 0 });
  }, [dataset, viewportPaddingRight]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !dataset.enabled) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let hoveredId: string | number | undefined;
    let reordering = false;

    async function initialize() {
      try {
        const { default: maplibregl } = await import("maplibre-gl");
        if (dataset.dataset_type === "pmtiles") await registerPmtilesProtocol(maplibregl);
        if (disposed || !containerRef.current) return;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: baseStyle ?? lightStyle as StyleSpecification,
          center: dataset.center ?? [0, 0],
          zoom: dataset.default_zoom ?? 2,
          minZoom: dataset.min_zoom,
          maxZoom: dataset.max_zoom,
          attributionControl: Boolean(dataset.attribution),
          scrollZoom: true,
          dragPan: true,
          doubleClickZoom: true,
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(new maplibregl.FullscreenControl(), "top-right");
        observer = new ResizeObserver(() => map.resize());
        observer.observe(containerRef.current);

        map.on("load", () => {
          if (disposed) return;
          if (!map.getSource(dataset.source_id)) map.addSource(dataset.source_id, createMapSource(dataset));
          const sourceLayer = dataset.dataset_type === "geojson" ? undefined : dataset.source_layer ?? undefined;
          const layers = new Set(getMapLayers().filter((layer) => layer.enabled).map((layer) => layer.id));
          const metricVisibility = isLayerGroupEnabled("heatmap", layerStateRef.current) ? "visible" : "none";
          const boundaryVisibility = isLayerGroupEnabled("township-boundary", layerStateRef.current) ? "visible" : "none";
          if (layers.has("township-fill") && !map.getLayer(fillLayerId)) map.addLayer({ id: fillLayerId, type: "fill", source: dataset.source_id, "source-layer": sourceLayer, layout: { visibility: metricVisibility }, paint: { "fill-color": getFillColorExpression(fillColorsRef.current), "fill-opacity": getFillOpacityExpression(overlayFillOpacityRef.current) } });
          if (!map.getLayer(baseFillLayerId)) map.addLayer({ id: baseFillLayerId, type: "fill", source: dataset.source_id, "source-layer": sourceLayer, paint: { "fill-color": "#FFFFFF", "fill-opacity": 0.001 } });
          if (layers.has("township-hover") && !map.getLayer(hoverFillLayerId)) map.addLayer({ id: hoverFillLayerId, type: "fill", source: dataset.source_id, "source-layer": sourceLayer, paint: { "fill-color": "#FFFFFF", "fill-opacity": getHoverOpacityExpression(selectedCanonicalLocationIdRef.current, overlayHoverOpacityRef.current) } });
          if (layers.has("township-selected") && !map.getLayer(selectedFillLayerId)) map.addLayer({ id: selectedFillLayerId, type: "fill", source: dataset.source_id, "source-layer": sourceLayer, paint: { "fill-color": "#FFFFFF", "fill-opacity": getSelectedOpacityExpression(selectedCanonicalLocationIdRef.current, overlaySelectedOpacityRef.current) } });
          if (layers.has("township-outline") && !map.getLayer(outlineLayerId)) map.addLayer({ id: outlineLayerId, type: "line", source: dataset.source_id, "source-layer": sourceLayer, layout: { visibility: boundaryVisibility, "line-cap": "round", "line-join": "round" }, minzoom: 4, paint: { "line-color": "#F5F1EC", "line-width": 0.9, "line-opacity": 0.5 } });
          if (!map.getLayer(topTownshipLayerId)) map.addLayer({ id: topTownshipLayerId, type: "line", source: dataset.source_id, "source-layer": sourceLayer, filter: getTopTownshipFilter(topCanonicalLocationIdsRef.current), layout: { visibility: "visible", "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#F26B00", "line-width": 1.55, "line-opacity": 0.72, "line-blur": 0.6 } });
          if (layers.has("township-selected") && !map.getLayer(selectedLayerId)) map.addLayer({ id: selectedLayerId, type: "line", source: dataset.source_id, "source-layer": sourceLayer, layout: { visibility: "visible", "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#F26B00", "line-width": 2.5, "line-opacity": getSelectedOpacityExpression(selectedCanonicalLocationIdRef.current), "line-blur": 0.35 } });
          applyRequiredLayerOrder(map);
          if (dataset.bounds) map.fitBounds([[dataset.bounds[0], dataset.bounds[1]], [dataset.bounds[2], dataset.bounds[3]]], { padding: getFitPadding(fitPaddingRef.current, viewportPaddingRightRef.current), duration: 0 });
          map.on("mousemove", baseFillLayerId, (event) => {
            const feature = event.features?.[0];
            if (!feature) return;
            map.getCanvas().style.cursor = "pointer";
            if (hoveredId !== undefined) map.setFeatureState({ source: dataset.source_id, sourceLayer, id: hoveredId }, { hover: false });
            hoveredId = feature.id;
            hoveredFeatureIdRef.current = hoveredId ?? null;
            if (hoveredId !== undefined) map.setFeatureState({ source: dataset.source_id, sourceLayer, id: hoveredId }, { hover: true });
            onFeatureHoverRef.current?.(feature, event.point);
            emitMapStatus(map);
          });
          map.on("mouseleave", baseFillLayerId, () => {
            map.getCanvas().style.cursor = "";
            if (hoveredId !== undefined) map.setFeatureState({ source: dataset.source_id, sourceLayer, id: hoveredId }, { hover: false });
            hoveredId = undefined;
            hoveredFeatureIdRef.current = null;
            onFeatureHoverRef.current?.(null);
            emitMapStatus(map);
          });
          map.on("click", baseFillLayerId, (event) => { const feature = event.features?.[0]; if (feature) { selectedFeatureIdRef.current = feature.id ?? (String(feature.properties.canonical_location_id ?? "") || null); onFeatureClickRef.current?.(feature); } });
          map.on("moveend", () => { const bounds = map.getBounds(); onViewportChangeRef.current?.([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]); applyRequiredLayerOrder(map); emitMapStatus(map); });
          map.on("styledata", () => {
            if (disposed || reordering || !map.isStyleLoaded()) return;
            const actual = getActualManagedLayerOrder(map);
            if (!isRequiredLayerOrder(actual)) {
              reordering = true;
              applyRequiredLayerOrder(map);
              reordering = false;
            }
            emitMapStatus(map);
          });
          setStatus("ready");
          emitMapStatus(map);
          onMapReadyRef.current?.(map);
        });
        map.on("error", () => {
          if (disposed) return;
          setStatus("error");
          onErrorRef.current?.();
        });
      } catch {
        if (!disposed) {
          setStatus("error");
          onErrorRef.current?.();
        }
      }
    }
    void initialize();
    return () => {
      disposed = true;
      observer?.disconnect();
      const map = mapRef.current;
      if (map && hoveredId !== undefined && map.getSource(dataset.source_id)) map.setFeatureState({ source: dataset.source_id, sourceLayer: dataset.dataset_type === "geojson" ? undefined : dataset.source_layer ?? undefined, id: hoveredId }, { hover: false });
      hoveredFeatureIdRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, [dataset]);

  if (!dataset.enabled) return <div className={className} role="status">Dataset is configured but inactive.</div>;
  return <div className={className ?? "relative h-[620px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"}><div ref={containerRef} className="absolute inset-0" aria-label={ariaLabel} />{status === "loading" && <div className="absolute inset-0 grid place-items-center bg-white/80 text-sm text-slate-600">Loading vector map…</div>}{status === "error" && <div className="absolute inset-0 grid place-items-center bg-white p-6 text-center text-sm text-red-700">Unable to load this map dataset.</div>}</div>;
}
