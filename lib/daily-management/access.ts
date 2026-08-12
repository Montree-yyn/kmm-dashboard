import { and, eq } from "drizzle-orm";
import { branches } from "../../db/schema";
import type { CompanyPermissions } from "../company-management/types";
import { CompanyAccessError, requireCompanyContext } from "../server/company-context";

export class DailyManagementAccessError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function requireDailyManagementAccess(
  request: Request,
  permission: keyof CompanyPermissions,
) {
  try {
    const context = await requireCompanyContext(request, { permission });
    const branchRows = await context.companyDb
      .select({ code: branches.branchCode })
      .from(branches)
      .where(and(
        eq(branches.companyId, context.id),
        eq(branches.status, "active"),
      ));
    return {
      ...context,
      branchCodes: branchRows.map((branch) => branch.code),
    };
  } catch (error) {
    if (error instanceof CompanyAccessError) {
      throw new DailyManagementAccessError(error.message, error.status);
    }
    throw error;
  }
}
