import layers from "../../data/maps/layers.json";
import type { MapLayerConfig } from "./types";
export function getMapLayers() { return layers as MapLayerConfig[]; }
