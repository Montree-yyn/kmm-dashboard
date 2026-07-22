import type { SourceSpecification } from "maplibre-gl";
import type { MapDatasetConfig } from "./types";

export function createMapSource(dataset: MapDatasetConfig): SourceSpecification {
  if (!dataset.id || !dataset.source_id || !dataset.url) throw new Error("Map dataset requires id, source_id, and url.");
  if (dataset.dataset_type === "geojson") return { type: "geojson", data: dataset.url, generateId: true };
  if (dataset.dataset_type === "pmtiles") {
    if (!dataset.source_layer) throw new Error("PMTiles dataset requires source_layer.");
    return { type: "vector", url: `pmtiles://${dataset.url}` };
  }
  if (dataset.dataset_type === "vector_tiles") return { type: "vector", tiles: [dataset.url] };
  throw new Error(`Unsupported map dataset type: ${String(dataset.dataset_type)}`);
}
