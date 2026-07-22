import datasets from "../../data/maps/datasets.json";
import type { MapDatasetConfig } from "./types";

const mapDatasets = datasets as MapDatasetConfig[];

export function getMapDataset(id: string) {
  return mapDatasets.find((dataset) => dataset.id === id) ?? null;
}

export function getCountryMapDatasets(countryCode: string, includeDisabled = false) {
  return mapDatasets.filter((dataset) => dataset.country_code === countryCode && (includeDisabled || dataset.enabled));
}

export function getCurrentCountryMapDataset(countryCode: string) {
  return getCountryMapDatasets(countryCode).at(0) ?? null;
}

export function getMapEngine() {
  return process.env.NEXT_PUBLIC_MAP_ENGINE === "maplibre" ? "maplibre" : "legacy";
}
