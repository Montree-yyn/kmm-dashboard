import { and, eq } from "drizzle-orm";
import { companyUsers } from "../../../db/schema";
import { getDb } from "../../../db";
import { COMPANY_ID, type CompanyRole } from "../../company-management/types";
import type { KaiBusinessAccess } from "../tools/types";

const ALLOWED_ROLES = new Set<KaiBusinessAccess["role"]>([
  "super_admin",
  "company_admin",
  "manager",
]);

/**
 * Phase 3A access policy: an authenticated user must already be an active KMM
 * member with an approved company-wide role. This function is intentionally
 * read-only; unlike Company Management's context resolver it never provisions
 * a company_users record. Branch and salesperson scoping are unavailable in
 * Phase 3A, so every allowed role receives company-wide aggregates only.
 */
export async function resolveKaiBusinessAccess(userId: string): Promise<KaiBusinessAccess | null> {
  const db = await getDb();
  const [membership] = await db
    .select({ role: companyUsers.role, status: companyUsers.status })
    .from(companyUsers)
    .where(and(eq(companyUsers.companyId, COMPANY_ID), eq(companyUsers.userId, userId)))
    .limit(1);

  if (!membership || membership.status !== "active") return null;
  const role = membership.role as CompanyRole;
  if (!ALLOWED_ROLES.has(role as KaiBusinessAccess["role"])) return null;
  return { companyId: COMPANY_ID, role: role as KaiBusinessAccess["role"] };
}
