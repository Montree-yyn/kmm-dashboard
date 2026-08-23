"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";
import { createMapSource } from "../../lib/maps/create-map-source";
import { registerPmtilesProtocol } from "../../lib/maps/register-pmtiles-protocol";
import { getMapLayers, isLayerGroupEnabled, type MapLayerState } from "../../lib/maps/layers";
import { applyRequiredLayerOrder, getActualManagedLayerOrder, isRequiredLayerOrder, MAP_LAYER_IDS } from "../../lib/maps/layer-order";
import type { MapDatasetConfig } from "../../lib/maps/types";
import { createMarketingBasemapStyle } from "../../src/kme/apps/kmm-dashboard/marketing/basemap";
import { chartTheme } from "../common/charts/chartTheme";

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
  pmtilesSourceLoaded: boolean;
  renderedTownshipFeatureCount: number;
  renderedTownshipUniqueFeatureCount: number;
  renderedChoroplethLayerCount: number;
  viewportBounds: [number, number, number, number] | null;
};

type GlobalVectorMapProps = {
  dataset: MapDatasetConfig;
  ariaLabel?: string;
  className?: string;
  onMapReady?: (map: MapLibreMap) => void;
  onFeatureClick?: (feature: MapGeoJSONFeature) => void;
  onMapBackgroundClick?: () => void;
  onFeatureHover?: (feature: MapGeoJSONFeature | null, point?: { x: number; y: number }) => void;
  onViewportChange?: (bounds: [number, number, number, number]) => void;
  onError?: () => void;
  fillColorsByCanonicalId?: Record<string, string>;
  selectedCanonicalLocationId?: string | null;
  layerState?: MapLayerState;
  viewportPaddingRight?: number;
  fitPadding?: { top: number; right: number; bottom: number; left: number };
  baseStyle?: StyleSpecification | string;
  fillNoDataColor?: string;
  boundaryColor?: string;
  boundaryOpacity?: number;
  boundaryWidth?: number;
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
const interactionLayerId = fillLayerId;
const clickableLayerIds = [fillLayerId, baseFillLayerId];
const townshipMapLayerIds = [fillLayerId, baseFillLayerId, hoverFillLayerId, selectedFillLayerId, outlineLayerId, topTownshipLayerId, selectedLayerId];

function getFillColorExpression(
  fillColorsByCanonicalId: Record<string, string>,
  fillNoDataColor: string = chartTheme.marketing.noData,
) {
  if (!Object.keys(fillColorsByCanonicalId).length) return fillNoDataColor;
  const colorPairs: (string | unknown)[] = ["match", ["get", "canonical_location_id"]];
  Object.entries(fillColorsByCanonicalId).forEach(([id, color]) => colorPairs.push(id, color));
  colorPairs.push(fillNoDataColor);
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

function getMapErrorMessage(event: unknown) {
  if (typeof event !== "object" || !event || !("error" in event)) return "";
  const error = (event as { error?: unknown }).error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message ?? "");
  return String(error ?? "");
}

function isFatalStyleLoadError(message: string) {
  return /not a valid style|unexpected end/i.test(message);
}

export function GlobalVectorMap({ dataset, ariaLabel = "Interactive vector map", className, onMapReady, onFeatureClick, onMapBackgroundClick, onFeatureHover, onViewportChange, onError, fillColorsByCanonicalId = {}, selectedCanonicalLocationId = null, layerState, viewportPaddingRight = 0, fitPadding = { top: 28, right: 28, bottom: 28, left: 28 }, baseStyle, fillNoDataColor = chartTheme.marketing.noData, boundaryColor = chartTheme.grid, boundaryOpacity = 0.5, boundaryWidth = 0.9, overlayFillOpacity = 0.98, overlayHoverOpacity = 0.98, overlaySelectedOpacity = 0.98, activeMetricLayer = "heatmap", topCanonicalLocationIds = [], onMapStatus }: GlobalVectorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const layerStateRef = useRef(layerState);
  const fillColorsRef = useRef(fillColorsByCanonicalId);
  const selectedCanonicalLocationIdRef = useRef(selectedCanonicalLocationId);
  const selectedFeatureIdRef = useRef<string | number | null>(null);
  const hoveredFeatureIdRef = useRef<string | number | null>(null);
  const onFeatureClickRef = useRef(onFeatureClick);
  const onMapBackgroundClickRef = useRef(onMapBackgroundClick);
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
  const baseStyleRef = useRef(baseStyle);
  const boundaryColorRef = useRef(boundaryColor);
  const boundaryOpacityRef = useRef(boundaryOpacity);
  const boundaryWidthRef = useRef(boundaryWidth);
  const fillNoDataColorRef = useRef(fillNoDataColor);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    layerStateRef.current = layerState;
    fillColorsRef.current = fillColorsByCanonicalId;
    selectedCanonicalLocationIdRef.current = selectedCanonicalLocationId;
    onFeatureClickRef.current = onFeatureClick;
    onMapBackgroundClickRef.current = onMapBackgroundClick;
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
    baseStyleRef.current = baseStyle;
    boundaryColorRef.current = boundaryColor;
    boundaryOpacityRef.current = boundaryOpacity;
    boundaryWidthRef.current = boundaryWidth;
    fillNoDataColorRef.current = fillNoDataColor;
  });

  const emitMapStatus = useCallback((map: MapLibreMap) => {
    const visibleLayerIds = townshipMapLayerIds.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none");
    const actualMapLayerOrder = getActualManagedLayerOrder(map);
    const renderedTownshipFeatures = map.getLayer(fillLayerId) ? map.queryRenderedFeatures(undefined, { layers: [fillLayerId] }) : [];
    const renderedTownshipFeatureCount = renderedTownshipFeatures.length;
    const renderedTownshipUniqueFeatureCount = new Set(renderedTownshipFeatures.map((feature) => String(feature.properties.canonical_location_id ?? feature.id ?? ""))).size;
    const renderedChoroplethLayerCount = map.getLayer(fillLayerId) && map.getLayoutProperty(fillLayerId, "visibility") !== "none" ? 1 : 0;
    const bounds = map.getBounds();
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
      pmtilesSourceLoaded: Boolean(map.getSource(dataset.source_id)),
      renderedTownshipFeatureCount,
      renderedTownshipUniqueFeatureCount,
      renderedChoroplethLayerCount,
      viewportBounds: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
    });
  }, [dataset]);

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
  }, [layerState, emitMapStatus]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer(fillLayerId)) map.setPaintProperty(fillLayerId, "fill-color", getFillColorExpression(fillColorsByCanonicalId, fillNoDataColor));
  }, [fillColorsByCanonicalId, fillNoDataColor]);

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
  }, [selectedCanonicalLocationId, emitMapStatus]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded()) emitMapStatus(map);
  }, [activeMetricLayer, emitMapStatus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer(outlineLayerId)) return;
    map.setPaintProperty(outlineLayerId, "line-color", boundaryColor);
    map.setPaintProperty(outlineLayerId, "line-width", boundaryWidth);
    map.setPaintProperty(outlineLayerId, "line-opacity", boundaryOpacity);
  }, [boundaryColor, boundaryOpacity, boundaryWidth]);

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
    let mapInitialized = false;

    const failMap = () => {
      if (disposed) return;
      setStatus("error");
      onErrorRef.current?.();
    };

    async function initialize() {
      try {
        const { default: maplibregl } = await import("maplibre-gl");
        await registerPmtilesProtocol(maplibregl);
        if (disposed || !containerRef.current) return;
        const style = baseStyleRef.current ?? createMarketingBasemapStyle();
        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: dataset.center ?? [0, 0],
          zoom: dataset.default_zoom ?? 2,
          minZoom: dataset.min_zoom,
          maxZoom: dataset.max_zoom,
          attributionControl: dataset.attribution ? {} : false,
          scrollZoom: true,
          dragPan: true,
          doubleClickZoom: true,
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        const fullscreenContainer = document.querySelector<HTMLElement>("[data-marketing-workspace]") ?? map.getContainer();
        map.addControl(new maplibregl.FullscreenControl({ container: fullscreenContainer }), "top-right");
        observer = new ResizeObserver(() => map.resize());
        observer.observe(containerRef.current);

        map.on("load", () => {
          try {
            if (disposed) return;
            if (!map.getSource(dataset.source_id)) map.addSource(dataset.source_id, createMapSource(dataset));
            const sourceLayer = dataset.dataset_type === "geojson" ? undefined : dataset.source_layer ?? undefined;
            const layers = new Set(getMapLayers().filter((layer) => layer.enabled).map((layer) => layer.id));
            const metricVisibility = isLayerGroupEnabled("heatmap", layerStateRef.current) ? "visible" : "none";
            const boundaryVisibility = isLayerGroupEnabled("township-boundary", layerStateRef.current) ? "visible" : "none";
            if (layers.has("township-fill") && !map.getLayer(fillLayerId)) map.addLayer({ id: fillLayerId, type: "fill", source: dataset.source_id, "source-layer": sourceLayer, layout: { visibility: metricVisibility }, paint: { "fill-color": getFillColorExpression(fillColorsRef.current, fillNoDataColorRef.current), "fill-opacity": getFillOpacityExpression(overlayFillOpacityRef.current) } });
            if (!map.getLayer(baseFillLayerId)) map.addLayer({ id: baseFillLayerId, type: "fill", source: dataset.source_id, "source-layer": sourceLayer, paint: { "fill-color": chartTheme.surface, "fill-opacity": 0.001 } });
            if (layers.has("township-hover") && !map.getLayer(hoverFillLayerId)) map.addLayer({ id: hoverFillLayerId, type: "fill", source: dataset.source_id, "source-layer": sourceLayer, paint: { "fill-color": chartTheme.surface, "fill-opacity": getHoverOpacityExpression(selectedCanonicalLocationIdRef.current, overlayHoverOpacityRef.current) } });
            if (layers.has("township-selected") && !map.getLayer(selectedFillLayerId)) map.addLayer({ id: selectedFillLayerId, type: "fill", source: dataset.source_id, "source-layer": sourceLayer, paint: { "fill-color": chartTheme.surface, "fill-opacity": getSelectedOpacityExpression(selectedCanonicalLocationIdRef.current, overlaySelectedOpacityRef.current) } });
            if (layers.has("township-outline") && !map.getLayer(outlineLayerId)) map.addLayer({ id: outlineLayerId, type: "line", source: dataset.source_id, "source-layer": sourceLayer, layout: { visibility: boundaryVisibility, "line-cap": "round", "line-join": "round" }, minzoom: 4, paint: { "line-color": boundaryColorRef.current, "line-width": boundaryWidthRef.current, "line-opacity": boundaryOpacityRef.current, "line-dasharray": [8, 4] } });
            if (!map.getLayer(topTownshipLayerId)) map.addLayer({ id: topTownshipLayerId, type: "line", source: dataset.source_id, "source-layer": sourceLayer, filter: getTopTownshipFilter(topCanonicalLocationIdsRef.current), layout: { visibility: "visible", "line-cap": "round", "line-join": "round" }, paint: { "line-color": chartTheme.current, "line-width": 1.55, "line-opacity": 0.72, "line-blur": 0.6 } });
            if (layers.has("township-selected") && !map.getLayer(selectedLayerId)) map.addLayer({ id: selectedLayerId, type: "line", source: dataset.source_id, "source-layer": sourceLayer, layout: { visibility: "visible", "line-cap": "round", "line-join": "round" }, paint: { "line-color": chartTheme.current, "line-width": 2.5, "line-opacity": getSelectedOpacityExpression(selectedCanonicalLocationIdRef.current), "line-blur": 0.35 } });
            applyRequiredLayerOrder(map);
            if (dataset.bounds) map.fitBounds([[dataset.bounds[0], dataset.bounds[1]], [dataset.bounds[2], dataset.bounds[3]]], { padding: getFitPadding(fitPaddingRef.current, viewportPaddingRightRef.current), duration: 0 });
            map.on("mousemove", interactionLayerId, (event) => {
              const feature = event.features?.[0];
              if (!feature) return;
              map.getCanvas().style.cursor = "pointer";
              if (hoveredId !== undefined) map.setFeatureState({ source: dataset.source_id, sourceLayer, id: hoveredId }, { hover: false });
              hoveredId = feature.id;
              hoveredFeatureIdRef.current = hoveredId ?? null;
              if (hoveredId !== undefined) map.setFeatureState({ source: dataset.source_id, sourceLayer, id: hoveredId }, { hover: true });
              onFeatureHoverRef.current?.(feature, event.point);
            });
            map.on("mouseleave", interactionLayerId, () => {
              map.getCanvas().style.cursor = "";
              if (hoveredId !== undefined) map.setFeatureState({ source: dataset.source_id, sourceLayer, id: hoveredId }, { hover: false });
              hoveredId = undefined;
              hoveredFeatureIdRef.current = null;
              onFeatureHoverRef.current?.(null);
            });
            map.on("click", (event) => {
              const feature = map.queryRenderedFeatures(event.point, { layers: clickableLayerIds }).find(Boolean);
              if (feature) {
                selectedFeatureIdRef.current = feature.id ?? (String(feature.properties.canonical_location_id ?? "") || null);
                onFeatureClickRef.current?.(feature);
              } else {
                selectedFeatureIdRef.current = null;
                onMapBackgroundClickRef.current?.();
              }
            });
            map.on("moveend", () => { const bounds = map.getBounds(); onViewportChangeRef.current?.([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]); applyRequiredLayerOrder(map); emitMapStatus(map); });
            map.on("idle", () => emitMapStatus(map));
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
            mapInitialized = true;
            setStatus("ready");
            emitMapStatus(map);
            onMapReadyRef.current?.(map);
          } catch (error) {
            if (process.env.NODE_ENV !== "production") console.error("MapLibre initialization error", error);
            failMap();
          }
        });
        map.on("error", (event) => {
          if (disposed) return;
          const message = getMapErrorMessage(event);
          if (!mapInitialized && isFatalStyleLoadError(message)) {
            failMap();
            return;
          }
        });
      } catch {
        failMap();
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
  }, [dataset, emitMapStatus]);

  if (!dataset.enabled) return <div className={className} role="status">Dataset is configured but inactive.</div>;
  return <div className={className ?? "relative h-[620px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"}><div ref={containerRef} className="absolute inset-0" aria-label={ariaLabel} />{status === "loading" && <div className="absolute inset-0 grid place-items-center bg-white/80 text-sm text-slate-600">Loading vector map…</div>}{status === "error" && <div className="absolute inset-0 grid place-items-center bg-white p-6 text-center text-sm text-red-700">Unable to load this map dataset.</div>}</div>;
}
