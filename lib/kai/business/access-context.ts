import type { AuthenticatedUser } from "../../server/firebase-auth";
import {
  CompanyAccessError,
  requireCompanyContextForUser,
} from "../../server/company-context";
import type { KaiBusinessAccess } from "../tools/types";

const ALLOWED_ROLES = new Set<KaiBusinessAccess["role"]>([
  "super_admin",
  "company_admin",
  "manager",
]);

/**
 * Business access is read-only and derived from an active membership for the
 * selected company. It never provisions a membership and never grants access
 * from a client-supplied company id alone.
 */
export async function resolveKaiBusinessAccess(
  user: AuthenticatedUser,
  request: Request,
  companyId?: string,
): Promise<KaiBusinessAccess | null> {
  try {
    const context = await requireCompanyContextForUser(user, request, {
      companyId,
      permission: "view",
    });
    if (!ALLOWED_ROLES.has(context.role as KaiBusinessAccess["role"])) return null;
    return {
      companyId: context.id,
      companyCode: context.code,
      companyName: context.name,
      currency: context.currency,
      timeZone: context.timeZone,
      role: context.role as KaiBusinessAccess["role"],
    };
  } catch (error) {
    if (error instanceof CompanyAccessError) return null;
    throw error;
  }
}
