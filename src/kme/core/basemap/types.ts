import type { StyleSpecification } from "maplibre-gl";

export type KmeBasemapProvider = "protomaps";
export type KmeBasemapTheme = "light";

export type KmeBasemapConfig = {
  id: string;
  provider: KmeBasemapProvider;
  theme: KmeBasemapTheme;
  sourceId: string;
  pmtilesUrl: string;
  glyphsUrl: string;
  spriteUrl: string;
  attribution: string;
};

export type KmeBasemapStyle = StyleSpecification;
