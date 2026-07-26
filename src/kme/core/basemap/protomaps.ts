import { layers, namedFlavor, type Flavor } from "@protomaps/basemaps";
import type { StyleSpecification } from "maplibre-gl";
import type { KmeBasemapConfig, KmeBasemapStyle } from "./types";

const DEFAULT_BASEMAP_PMTILES_URL = "/maps/vector/protomaps-osm-v4.pmtiles";
const PROTOMAPS_ASSET_BASE = "https://protomaps.github.io/basemaps-assets";
type KmeLayer = StyleSpecification["layers"][number] & { layout?: Record<string, unknown>; paint?: Record<string, unknown>; minzoom?: number };

export const KME_PROTOMAPS_LIGHT_BASEMAP: KmeBasemapConfig = {
  id: "kme-protomaps-osm-light",
  provider: "protomaps",
  theme: "light",
  sourceId: "kme-global-basemap",
  pmtilesUrl: process.env.NEXT_PUBLIC_KME_BASEMAP_PMTILES_URL || DEFAULT_BASEMAP_PMTILES_URL,
  glyphsUrl: `${PROTOMAPS_ASSET_BASE}/fonts/{fontstack}/{range}.pbf`,
  spriteUrl: `${PROTOMAPS_ASSET_BASE}/sprites/v4/light`,
  attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
};

export function createProtomapsLightStyle(config: KmeBasemapConfig = KME_PROTOMAPS_LIGHT_BASEMAP): KmeBasemapStyle {
  const flavor: Flavor = {
    ...namedFlavor(config.theme),
    background: "#f7faf7",
    earth: "#edf5ea",
    water: "#9fdce8",
    boundaries: "#a6b2bd",
    major: "#f3f0e8",
    major_casing_early: "#d6c2a4",
    major_casing_late: "#d6c2a4",
    minor_a: "#ffffff",
    minor_b: "#f7f2e8",
    roads_label_major: "#5f6670",
    roads_label_major_halo: "#ffffff",
    city_label: "#4a5568",
    city_label_halo: "#ffffff",
    subplace_label: "#5b6470",
    subplace_label_halo: "#ffffff",
  };
  const basemapLayers = tuneMarketingBasemapLayers(layers(config.sourceId, flavor, { lang: "en" }) as KmeLayer[]);

  return {
    version: 8,
    name: "Kubota Map Engine Protomaps OSM Light",
    glyphs: config.glyphsUrl,
    sprite: config.spriteUrl,
    sources: {
      [config.sourceId]: {
        type: "vector",
        url: `pmtiles://${config.pmtilesUrl}`,
        attribution: config.attribution,
      },
    },
    layers: basemapLayers as StyleSpecification["layers"],
  };
}

function tuneMarketingBasemapLayers(basemapLayers: KmeLayer[]) {
  return basemapLayers.map((layer) => {
    const next: KmeLayer = { ...layer };
    if (layer.layout) next.layout = { ...layer.layout };
    if (layer.paint) next.paint = { ...layer.paint };

    switch (next.id) {
      case "water":
        next.paint = { ...next.paint, "fill-color": "#9fdce8" };
        break;
      case "water_river":
        next.minzoom = 6;
        next.paint = { ...next.paint, "line-color": "#6fbfd5", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.35, 8, 1, 12, 2.1] };
        break;
      case "water_stream":
        next.minzoom = 9;
        next.paint = { ...next.paint, "line-color": "#7bc8db", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.3, 12, 0.9, 15, 1.6] };
        break;
      case "water_waterway_label":
        next.minzoom = 10;
        next.paint = { ...next.paint, "text-color": "#2f8ca3", "text-halo-color": "#eefcff", "text-halo-width": 1.25 };
        break;
      case "water_label_lakes":
      case "water_label_ocean":
        next.paint = { ...next.paint, "text-color": "#2f8ca3", "text-halo-color": "#eefcff", "text-halo-width": 1.2 };
        break;
      case "roads_highway":
        next.paint = { ...next.paint, "line-color": "#e7b05f", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.45, 7, 1.2, 10, 2.2, 14, 4] };
        break;
      case "roads_major":
        next.paint = { ...next.paint, "line-color": "#f6f1e7", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.35, 8, 0.9, 11, 1.8, 14, 3.1] };
        break;
      case "roads_minor":
      case "roads_other":
        next.paint = { ...next.paint, "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.18, 10, 0.55, 13, 1.2, 16, 2.1] };
        break;
      case "roads_labels_major":
        next.minzoom = 8.5;
        next.paint = { ...next.paint, "text-color": "#5f6670", "text-halo-color": "#ffffff", "text-halo-width": 1.25 };
        next.layout = { ...next.layout, "text-size": ["interpolate", ["linear"], ["zoom"], 8, 9, 12, 11, 15, 14] };
        break;
      case "roads_labels_minor":
        next.minzoom = 12;
        next.paint = { ...next.paint, "text-color": "#747b84", "text-halo-color": "#ffffff", "text-halo-width": 1.1 };
        break;
      case "places_region":
      case "places_locality":
        next.paint = { ...next.paint, "text-color": "#435266", "text-halo-color": "#ffffff", "text-halo-width": 1.35 };
        break;
      case "places_subplace":
        next.minzoom = 8;
        next.paint = { ...next.paint, "text-color": "#5b6470", "text-halo-color": "#ffffff", "text-halo-width": 1.25 };
        next.layout = { ...next.layout, "text-transform": "none", "text-size": ["interpolate", ["linear"], ["zoom"], 8, 8.5, 11, 10.5, 14, 13] };
        break;
    }

    return next;
  });
}
