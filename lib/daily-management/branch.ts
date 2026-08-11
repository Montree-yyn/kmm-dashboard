import { operationalShowroomForBranch } from "../marketing/location-mapping";

export const ALL_BRANCHES = "All Branches";

export const DAILY_MANAGEMENT_BRANCHES = [
  { code: "KMM01", name: "Hpa-an" },
  { code: "KMM02", name: "Mawlamyine" },
  { code: "KMM03", name: "Tharyarwaddy" },
] as const;

export function canonicalDailyBranch(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === ALL_BRANCHES) return raw;
  const direct = operationalShowroomForBranch(raw);
  const prefix = operationalShowroomForBranch(raw.split(/[·|]/, 1)[0]?.trim());
  return direct?.code ?? prefix?.code ?? raw;
}

export function isDailyManagementBranch(value: string) {
  return value === ALL_BRANCHES
    || DAILY_MANAGEMENT_BRANCHES.some((branch) => branch.code === value);
}
