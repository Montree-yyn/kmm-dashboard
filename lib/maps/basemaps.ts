import basemaps from "../../data/maps/basemaps.json";

export type BasemapConfig = {
  id: string;
  provider: string;
  dataset_type: "vector_style";
  url: string;
  attribution: string;
  status: "development";
  requires_token: boolean;
};

export function getBasemap(id: string) {
  return (basemaps as BasemapConfig[]).find((basemap) => basemap.id === id) ?? null;
}
