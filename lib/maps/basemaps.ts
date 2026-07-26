import basemaps from "../../data/maps/basemaps.json";

export type BasemapConfig = {
  id: string;
  provider: string;
  dataset_type: "pmtiles";
  url: string;
  source_id: string;
  glyphs: string;
  sprite: string;
  attribution: string;
  status: "production";
  requires_token: boolean;
};

export function getBasemap(id: string) {
  return (basemaps as BasemapConfig[]).find((basemap) => basemap.id === id) ?? null;
}
