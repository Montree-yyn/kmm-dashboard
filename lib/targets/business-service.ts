import { findApprovedTarget, listApprovedCompanyTargets } from "./repository";
import type {
  ApprovedTarget,
  CompanyMonthlyTargetPlan,
  TargetMetric,
  TargetProductGroup,
} from "./types";

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Retrieves one exact company-level monthly target. It deliberately never
 * widens a query to branch, salesperson, product, or another source version.
 */
export async function getCompanyMonthlyTarget(input: {
  companyId: string;
  year: number;
  month: number;
  metric: TargetMetric;
  productGroup?: TargetProductGroup;
}): Promise<ApprovedTarget | null> {
  const row = await findApprovedTarget(input);
  if (!row) return null;
  const target = numberValue(row.targetValue);
  if (target === null) return null;
  return {
    year: row.targetYear,
    month: row.targetMonth,
    metric: row.metric as TargetMetric,
    target,
    productGroup: row.productGroup as TargetProductGroup,
    source: row.source,
    sourceVersion: row.sourceVersion,
    effectiveFrom: row.effectiveFrom,
  };
}

export async function getLatestCompanyMonthlyTargetPlan(input: {
  companyId: string;
  metric: TargetMetric;
  productGroup?: TargetProductGroup;
}): Promise<CompanyMonthlyTargetPlan | null> {
  const rows = await listApprovedCompanyTargets(input);
  return buildLatestCompanyMonthlyTargetPlan(rows, input.metric);
}

type ApprovedTargetRow = Awaited<
  ReturnType<typeof listApprovedCompanyTargets>
>[number];

export function buildLatestCompanyMonthlyTargetPlan(
  rows: readonly ApprovedTargetRow[],
  metric: TargetMetric,
): CompanyMonthlyTargetPlan | null {
  if (!rows.length) return null;
  const year = Math.max(...rows.map((row) => row.targetYear));
  const latestByMonth = new Map<number, ApprovedTargetRow>();
  for (const row of rows) {
    if (row.targetYear !== year || row.targetMonth < 1 || row.targetMonth > 12)
      continue;
    const current = latestByMonth.get(row.targetMonth);
    const revision = `${row.effectiveFrom}\u0000${row.updatedAt}\u0000${row.sourceVersion}`;
    const currentRevision = current
      ? `${current.effectiveFrom}\u0000${current.updatedAt}\u0000${current.sourceVersion}`
      : "";
    if (!current || revision.localeCompare(currentRevision) > 0)
      latestByMonth.set(row.targetMonth, row);
  }

  const monthlyTargets: Array<ApprovedTarget | null> = Array.from(
    { length: 12 },
    () => null,
  );
  for (const row of latestByMonth.values()) {
    const index = row.targetMonth - 1;
    const target = numberValue(row.targetValue);
    if (target === null) continue;
    monthlyTargets[index] = {
      year: row.targetYear,
      month: row.targetMonth,
      metric: row.metric as TargetMetric,
      target,
      productGroup: row.productGroup as TargetProductGroup,
      source: row.source,
      sourceVersion: row.sourceVersion,
      effectiveFrom: row.effectiveFrom,
    };
  }

  return { year, metric, monthlyTargets };
}

export function targetProgress(actual: number, target: number) {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return null;
  return { achievementPercent: (actual / target) * 100, gap: target - actual };
}
