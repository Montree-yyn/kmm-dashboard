import type { Map as MapLibreMap } from "maplibre-gl";

export const MAP_LAYER_IDS = {
  metricFill: "business-boundary-fill",
  townshipBaseFill: "township-base-fill",
  townshipHoverFill: "township-hover-fill",
  townshipSelectedFill: "township-selected-fill",
  townshipBoundary: "business-boundary-outline",
  topTownships: "township-top-five-outline",
  stateBoundary: "marketing-state-boundaries",
  townshipSelectedOutline: "township-selected",
  stateLabels: "marketing-state-labels",
  townshipLabels: "marketing-township-labels",
} as const;

/** Bottom-to-top order for every MapLibre layer owned by the Marketing map. */
export const REQUIRED_MAP_LAYER_ORDER = [
  MAP_LAYER_IDS.metricFill,
  MAP_LAYER_IDS.townshipBaseFill,
  MAP_LAYER_IDS.townshipHoverFill,
  MAP_LAYER_IDS.townshipSelectedFill,
  MAP_LAYER_IDS.townshipBoundary,
  MAP_LAYER_IDS.topTownships,
  MAP_LAYER_IDS.stateBoundary,
  MAP_LAYER_IDS.townshipSelectedOutline,
  MAP_LAYER_IDS.stateLabels,
  MAP_LAYER_IDS.townshipLabels,
] as const;

export const REQUIRED_VISUAL_LAYER_ORDER = [
  "basemap",
  MAP_LAYER_IDS.metricFill,
  MAP_LAYER_IDS.townshipBaseFill,
  MAP_LAYER_IDS.townshipHoverFill,
  MAP_LAYER_IDS.townshipSelectedFill,
  MAP_LAYER_IDS.townshipBoundary,
  MAP_LAYER_IDS.topTownships,
  MAP_LAYER_IDS.stateBoundary,
  MAP_LAYER_IDS.townshipSelectedOutline,
  MAP_LAYER_IDS.stateLabels,
  MAP_LAYER_IDS.townshipLabels,
  "showroom-glow-dom",
  "showroom-marker-dom",
  "showroom-interactive-overlay-dom",
] as const;

export function getActualManagedLayerOrder(map: MapLibreMap) {
  const managed = new Set<string>(REQUIRED_MAP_LAYER_ORDER);
  return (map.getStyle().layers ?? []).map((layer) => layer.id).filter((id) => managed.has(id));
}

export function isRequiredLayerOrder(actual: readonly string[]) {
  const expected = REQUIRED_MAP_LAYER_ORDER.filter((id) => actual.includes(id));
  return expected.length === actual.length && expected.every((id, index) => actual[index] === id);
}

export function applyRequiredLayerOrder(map: MapLibreMap) {
  REQUIRED_MAP_LAYER_ORDER.forEach((id) => {
    if (map.getLayer(id)) map.moveLayer(id);
  });
  return getActualManagedLayerOrder(map);
}
