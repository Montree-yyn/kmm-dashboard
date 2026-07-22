import approvedAliases from "../../data/geography/township-approved-aliases.json";
import approvedStateAliases from "../../data/geography/state-region-approved-aliases.json";
import townshipMaster from "../../data/master-townships.json";
import { normalizeLocation } from "./location-mapping";

type MasterTownship = { township_id: string; township: string; state_region: string; aliases?: string[] };
type ApprovedAlias = { raw_state_region: string; raw_township: string; canonical_state_region: string; canonical_township: string };
type ApprovedStateAlias = { raw_state_region: string; canonical_state_region: string };
export type GeographyFailure = "UNKNOWN_STATE" | "UNKNOWN_TOWNSHIP" | "PENDING_ALIAS" | "AMBIGUOUS_TOWNSHIP" | "MISSING_STATE" | "MISSING_TOWNSHIP" | "CANONICAL_ID_NOT_IN_BOUNDARY" | "DUPLICATE_CANONICAL_ID" | "OTHER";
export type SalesGeographyResolution = {
  canonicalLocationId: string | null;
  normalizedStateRegion: string;
  normalizedTownship: string;
  aliasStatus: "DIRECT" | "APPROVED_ALIAS" | "PENDING_ALIAS" | "NONE";
  reason: GeographyFailure | null;
};

const master = townshipMaster as MasterTownship[];
const aliases = approvedAliases as ApprovedAlias[];
const stateAliases = approvedStateAliases as ApprovedStateAlias[];
const canonicalByPair = new Map(master.map((record) => [`${normalizeLocation(record.state_region)}|${normalizeLocation(record.township)}`, record]));
const stateIndex = new Map<string, string[]>();
const townshipIndex = new Map<string, MasterTownship[]>();

function addIndex<T>(index: Map<string, T[]>, key: string, value: T) {
  const values = index.get(key) ?? [];
  if (!values.includes(value)) values.push(value);
  index.set(key, values);
}

master.forEach((record) => {
  addIndex(stateIndex, normalizeLocation(record.state_region), record.state_region);
  addIndex(stateIndex, normalizeLocation(record.state_region.replace(/\s+(state|region)$/i, "")), record.state_region);
  addIndex(stateIndex, normalizeLocation(record.state_region.replace(/\s*\([^)]*\)/g, "")), record.state_region);
  addIndex(townshipIndex, normalizeLocation(record.township), record);
  (record.aliases ?? []).forEach((alias) => addIndex(townshipIndex, normalizeLocation(alias), record));
});

function candidatesForState(rawState: string) {
  const normalized = normalizeLocation(rawState);
  const alias = stateAliases.find((item) => normalizeLocation(item.raw_state_region) === normalized);
  const keys = [
    alias ? normalizeLocation(alias.canonical_state_region) : normalized,
    normalizeLocation(rawState.replace(/\s+(state|region)$/i, "")),
  ];
  return Array.from(new Set(keys.flatMap((key) => stateIndex.get(key) ?? [])));
}

export function resolveSalesGeography(rawStateRegion: string | null | undefined, rawTownship: string | null | undefined, boundaryCanonicalIds: ReadonlySet<string>): SalesGeographyResolution {
  const normalizedStateRegion = normalizeLocation(rawStateRegion);
  const normalizedTownship = normalizeLocation(rawTownship);
  if (!normalizedTownship) return { canonicalLocationId: null, normalizedStateRegion, normalizedTownship, aliasStatus: "NONE", reason: "MISSING_TOWNSHIP" };
  if (!normalizedStateRegion) return { canonicalLocationId: null, normalizedStateRegion, normalizedTownship, aliasStatus: "NONE", reason: "MISSING_STATE" };
  const states = candidatesForState(String(rawStateRegion));
  if (!states.length) return { canonicalLocationId: null, normalizedStateRegion, normalizedTownship, aliasStatus: "NONE", reason: "UNKNOWN_STATE" };
  const direct = (townshipIndex.get(normalizedTownship) ?? []).filter((record) => states.includes(record.state_region));
  const alias = aliases.find((item) => (normalizeLocation(item.raw_state_region) === normalizedStateRegion || states.includes(item.canonical_state_region)) && normalizeLocation(item.raw_township) === normalizedTownship);
  const aliasRecord = alias ? canonicalByPair.get(`${normalizeLocation(alias.canonical_state_region)}|${normalizeLocation(alias.canonical_township)}`) : undefined;
  const candidates = direct.length ? direct : aliasRecord && states.includes(aliasRecord.state_region) ? [aliasRecord] : [];
  if (!candidates.length) return { canonicalLocationId: null, normalizedStateRegion, normalizedTownship, aliasStatus: "NONE", reason: "UNKNOWN_TOWNSHIP" };
  if (candidates.length !== 1) return { canonicalLocationId: null, normalizedStateRegion, normalizedTownship, aliasStatus: "NONE", reason: "AMBIGUOUS_TOWNSHIP" };
  const canonicalLocationId = candidates[0].township_id;
  if (!boundaryCanonicalIds.has(canonicalLocationId)) return { canonicalLocationId: null, normalizedStateRegion, normalizedTownship, aliasStatus: direct.length ? "DIRECT" : "APPROVED_ALIAS", reason: "CANONICAL_ID_NOT_IN_BOUNDARY" };
  return { canonicalLocationId, normalizedStateRegion, normalizedTownship, aliasStatus: direct.length ? "DIRECT" : "APPROVED_ALIAS", reason: null };
}

export function canonicalBoundaryIds(boundaryPairs: readonly { stateRegion: string; township: string }[]) {
  const ids = new Set<string>();
  const duplicates = new Set<string>();
  boundaryPairs.forEach((feature) => {
    const record = canonicalByPair.get(`${normalizeLocation(feature.stateRegion)}|${normalizeLocation(feature.township)}`);
    if (!record) return;
    if (ids.has(record.township_id)) duplicates.add(record.township_id);
    ids.add(record.township_id);
  });
  return { ids, duplicates };
}
