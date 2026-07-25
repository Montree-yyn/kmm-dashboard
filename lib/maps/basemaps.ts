import basemaps from "../../data/maps/basemaps.json";

export type BasemapConfig = {
  id: string;
  name: string;
  provider: string;
  dataset_type: "vector_style";
  styleUrl: string;
  attribution: string;
  status: "development" | "production" | "fallback" | "future";
  active: boolean;
  requiresNetwork: boolean;
  requiresToken: boolean;
  coverage: "global" | "myanmar-business-overlay";
  glyphsUrl: string;
  spriteUrl: string | null;
  futureSelfHostedSourceId: string | null;
  externalHostnames: string[];
  riskNotes?: string;
  migrationNotes?: string;
  labelStrategy?: {
    languageFallbackOrder: string[];
    fontStack: string[];
    futureSwitcher: string;
  };
  labelHierarchy?: Record<string, { fontWeight: string; zoomTextSize: number[]; haloWidth: number }>;
};

export function getBasemap(id: string) {
  return (basemaps as BasemapConfig[]).find((basemap) => basemap.id === id) ?? null;
}

export function getActiveBasemap() {
  return (basemaps as BasemapConfig[]).find((basemap) => basemap.active) ?? getBasemap("kmm-local-boundaries");
}

export function getFallbackBasemap() {
  return getBasemap("kmm-local-boundaries");
}
