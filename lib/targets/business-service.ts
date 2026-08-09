import { findApprovedTarget } from "./repository";
import type { ApprovedTarget, TargetMetric, TargetProductGroup } from "./types";

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

export function targetProgress(actual: number, target: number) {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return null;
  return { achievementPercent: (actual / target) * 100, gap: target - actual };
}
