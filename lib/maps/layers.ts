import layers from "../../data/maps/layers.json";
import type { MapLayerConfig } from "./types";

export type MapLayerState = Record<string, boolean>;

export type MapLayerControl = {
  id: string;
  label: string;
  enabled: boolean;
  functional: boolean;
  description: string;
};

export function getMapLayers() { return layers as MapLayerConfig[]; }

export function getLayerControls(): MapLayerControl[] {
  const controls = new Map<string, MapLayerControl>();
  getMapLayers().forEach((layer) => {
    if (!layer.group || !layer.label) return;
    const existing = controls.get(layer.group);
    controls.set(layer.group, {
      id: layer.group,
      label: layer.label,
      enabled: existing?.enabled ?? layer.enabled,
      functional: existing?.functional ?? Boolean(layer.functional),
      description: existing?.description ?? layer.description,
    });
  });
  return [...controls.values()];
}

export function isLayerGroupEnabled(group: string, state?: MapLayerState) {
  const control = getLayerControls().find((item) => item.id === group);
  return state?.[group] ?? control?.enabled ?? false;
}
