import { and, desc, eq } from "drizzle-orm";
import { getOperationsDb } from "../../db";
import { businessTargets } from "../../db/schema";
import type { TargetMetric, TargetProductGroup } from "./types";

/** Read-only access to approved targets. Runtime code never writes target rows. */
export async function findApprovedTarget(input: {
  companyId: string;
  year: number;
  month: number;
  metric: TargetMetric;
  productGroup?: TargetProductGroup;
}) {
  const db = await getOperationsDb();
  const [row] = await db
    .select({
      targetYear: businessTargets.targetYear,
      targetMonth: businessTargets.targetMonth,
      metric: businessTargets.metric,
      targetValue: businessTargets.targetValue,
      productGroup: businessTargets.productGroup,
      source: businessTargets.source,
      sourceVersion: businessTargets.sourceVersion,
      effectiveFrom: businessTargets.effectiveFrom,
    })
    .from(businessTargets)
    .where(and(
      eq(businessTargets.companyId, input.companyId),
      eq(businessTargets.targetYear, input.year),
      eq(businessTargets.targetMonth, input.month),
      eq(businessTargets.metric, input.metric),
      eq(businessTargets.productGroup, input.productGroup ?? ""),
      eq(businessTargets.branchId, ""),
      eq(businessTargets.salespersonId, ""),
      eq(businessTargets.approvalStatus, "approved"),
    ))
    // A future approved revision can coexist. The newest effective approved
    // record wins, without rewriting the historical source version.
    .orderBy(desc(businessTargets.effectiveFrom), desc(businessTargets.updatedAt), desc(businessTargets.sourceVersion))
    .limit(1);
  return row ?? null;
}
