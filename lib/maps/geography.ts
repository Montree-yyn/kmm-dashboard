export type GeographicLevel =
  | "country"
  | "state_region"
  | "district"
  | "township"
  | "village_tract"
  | "village";

export interface CanonicalGeographicIdentity {
  countryCode: string;
  level: GeographicLevel;
  canonicalLocationId: string;
  name: string;
  pcode?: string | null;
  parentPcode?: string | null;
}

export interface VillagePoint extends CanonicalGeographicIdentity {
  level: "village";
  coordinates: [number, number];
  stateRegion?: string | null;
  district?: string | null;
  township?: string | null;
  villageTract?: string | null;
}


export type GeographyProviderId = "internal" | "licensed_pcode" | "open_data";

export interface GeographyProviderMetadata {
  id: GeographyProviderId;
  name: string;
  license: string;
  attribution?: string | null;
  commercialUseAllowed: boolean;
  sourceVersion?: string | null;
}

export interface VillageImportRecord {
  provider: GeographyProviderMetadata;
  externalId: string;
  name: string;
  coordinates?: [number, number] | null;
  pcode?: string | null;
  parentPcode?: string | null;
  stateRegion?: string | null;
  district?: string | null;
  township?: string | null;
  villageTract?: string | null;
}

export interface VillageImportResult {
  accepted: VillagePoint[];
  rejected: Array<{ record: VillageImportRecord; reason: string }>;
}

export function importVillagePoints(records: readonly VillageImportRecord[]): VillageImportResult {
  const accepted: VillagePoint[] = [];
  const rejected: Array<{ record: VillageImportRecord; reason: string }> = [];

  for (const record of records) {
    if (!record.provider.commercialUseAllowed) {
      rejected.push({ record, reason: "PROVIDER_COMMERCIAL_USE_NOT_ALLOWED" });
      continue;
    }
    if (!record.coordinates) {
      rejected.push({ record, reason: "MISSING_COORDINATES" });
      continue;
    }
    const [longitude, latitude] = record.coordinates;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      rejected.push({ record, reason: "INVALID_COORDINATES" });
      continue;
    }

    accepted.push({
      countryCode: "MM",
      level: "village",
      canonicalLocationId: `mm-village-${record.provider.id}-${record.externalId}`,
      name: record.name,
      coordinates: [longitude, latitude],
      pcode: record.pcode ?? null,
      parentPcode: record.parentPcode ?? null,
      stateRegion: record.stateRegion ?? null,
      district: record.district ?? null,
      township: record.township ?? null,
      villageTract: record.villageTract ?? null,
    });
  }

  return { accepted, rejected };
}

export const MYANMAR_GEOGRAPHIC_HIERARCHY: readonly GeographicLevel[] = [
  "country",
  "state_region",
  "district",
  "township",
  "village_tract",
  "village",
] as const;

export function villagePointsToGeoJson(points: readonly VillagePoint[]) {
  return {
    type: "FeatureCollection" as const,
    features: points.map((point) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: point.coordinates },
      properties: {
        canonical_location_id: point.canonicalLocationId,
        country_code: point.countryCode,
        location_level: point.level,
        location_name: point.name,
        pcode: point.pcode ?? null,
        parent_pcode: point.parentPcode ?? null,
        state_region: point.stateRegion ?? null,
        district: point.district ?? null,
        township: point.township ?? null,
        village_tract: point.villageTract ?? null,
      },
    })),
  };
}
