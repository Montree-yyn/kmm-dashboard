export type OperationalShowroom = {
  code: "KMM01" | "KMM02" | "KMM03";
  name: "Hpa-an" | "Mawlamyine" | "Tharyarwaddy";
  region: "Kayin" | "Mon" | "Bago (West)";
};

export const OPERATIONAL_SHOWROOMS: OperationalShowroom[] = [
  { code: "KMM01", name: "Hpa-an", region: "Kayin" },
  { code: "KMM02", name: "Mawlamyine", region: "Mon" },
  { code: "KMM03", name: "Tharyarwaddy", region: "Bago (West)" },
];

const BRANCH_ALIASES: Record<OperationalShowroom["code"], string[]> = {
  KMM01: ["KMM1", "KMM01", "Hpa-an", "Hpa An", "HpaAn"],
  KMM02: ["KMM2", "KMM02", "Mawlamyine", "Moulmein", "Moke Ta Ma", "Moketama"],
  KMM03: ["KMM3", "KMM03", "Tharyarwaddy", "Thayarwaddy", "Tharrawaddy"],
};

const TOWNSHIP_ALIASES: Record<string, string[]> = {
  "Hpa-An": ["Hpa An", "HpaAn"],
  Mawlamyine: ["Moulmein"],
  Thayarwady: ["Tharyarwaddy", "Thayarwaddy", "Tharrawaddy"],
  Nawnghkio: ["Naung Cho", "Nawngcho", "Naungcho"],
  Nattalin: ["Nat Ta Lin"],
  Myawaddy: ["Myawadi"],
};

export function normalizeLocation(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

const branchIndex = new Map<string, OperationalShowroom["code"]>();
Object.entries(BRANCH_ALIASES).forEach(([code, aliases]) => aliases.forEach((alias) => branchIndex.set(normalizeLocation(alias), code as OperationalShowroom["code"])));

const townshipAliasIndex = new Map<string, string>();
Object.entries(TOWNSHIP_ALIASES).forEach(([canonical, aliases]) => {
  townshipAliasIndex.set(normalizeLocation(canonical), canonical);
  aliases.forEach((alias) => townshipAliasIndex.set(normalizeLocation(alias), canonical));
});

export function operationalShowroomForBranch(value: string | null | undefined) {
  const code = branchIndex.get(normalizeLocation(value));
  return code ? OPERATIONAL_SHOWROOMS.find((showroom) => showroom.code === code) : undefined;
}

export function normalizeTownshipAlias(value: string | null | undefined) {
  return townshipAliasIndex.get(normalizeLocation(value)) ?? null;
}

export function productGroup(value: string | null | undefined) {
  const normalized = String(value ?? "").toUpperCase();
  for (const group of ["TT", "CH", "EX", "TP", "MAX", "IMO", "IM", "OT"]) {
    if (normalized.includes(group)) return group;
  }
  return "Other";
}
