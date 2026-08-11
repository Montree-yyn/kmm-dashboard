import { and, eq } from "drizzle-orm";
import { getCompanyDb } from "../../db";
import { companyUsers } from "../../db/schema";
import { isCompanyRole, ROLE_PERMISSIONS } from "../company-management/permissions";
import { COMPANY_ID, type CompanyPermissions } from "../company-management/types";
import { verifyFirebaseRequest } from "../server/firebase-auth";

export class DailyManagementAccessError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function requireDailyManagementAccess(
  request: Request,
  permission: keyof CompanyPermissions,
) {
  const user = await verifyFirebaseRequest(request);
  const companyDb = await getCompanyDb();
  const [membership] = await companyDb
    .select({ role: companyUsers.role })
    .from(companyUsers)
    .where(and(
      eq(companyUsers.companyId, COMPANY_ID),
      eq(companyUsers.userId, user.id),
      eq(companyUsers.status, "active"),
    ))
    .limit(1);

  if (!membership || !isCompanyRole(membership.role)) {
    throw new DailyManagementAccessError("Active company membership is required.", 403);
  }
  if (!ROLE_PERMISSIONS[membership.role][permission]) {
    throw new DailyManagementAccessError("Your role does not have permission for this action.", 403);
  }
  return { user, role: membership.role, companyDb };
}
