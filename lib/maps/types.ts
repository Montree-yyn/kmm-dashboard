export type MapDatasetType = "geojson" | "vector_tiles" | "pmtiles";
export type MapViewLevel = "world" | "country" | "admin_level_1" | "admin_level_2" | "admin_level_3";

export interface MapDatasetConfig {
  id: string;
  country_code: string | null;
  dataset_type: MapDatasetType;
  url: string;
  source_id: string;
  source_layer?: string | null;
  min_zoom?: number;
  max_zoom?: number;
  attribution?: string;
  bounds?: [number, number, number, number];
  center?: [number, number];
  default_zoom?: number;
  enabled: boolean;
}

export interface BusinessMapFeatureProperties {
  canonical_location_id: string | null;
  country_code: string;
  location_name: string;
  state_region?: string | null;
  value?: number | null;
  unit?: number | null;
  category?: string | null;
}

export interface MapLayerConfig { id: string; type: string; enabled: boolean; description: string; }
