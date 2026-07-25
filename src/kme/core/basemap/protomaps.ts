import { layers, namedFlavor } from "@protomaps/basemaps";
import type { StyleSpecification } from "maplibre-gl";
import type { KmeBasemapConfig, KmeBasemapStyle } from "./types";

const DEFAULT_BASEMAP_PMTILES_URL = "https://data.source.coop/protomaps/openstreetmap/v4.pmtiles";
const PROTOMAPS_ASSET_BASE = "https://protomaps.github.io/basemaps-assets";

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
    layers: layers(config.sourceId, namedFlavor(config.theme), { lang: "en" }) as StyleSpecification["layers"],
  };
}
