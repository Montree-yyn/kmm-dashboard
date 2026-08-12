import { listBookingTransactions, listStockTransactions } from "../../../lib/operations/repository";
import { adaptBookingRow, adaptStockRow } from "../../../lib/operations/adapters";
import { listSalesTransactions } from "../../../lib/sales/repository";
import { toCanonicalSalesRow } from "../../../lib/sales/compatibility-adapter";
import { buildDailyManagementSnapshot } from "../../../lib/daily-management/business-service";
import { attachApprovedTarget } from "../../../lib/daily-management/business-service";
import { DailyManagementAccessError, requireDailyManagementAccess } from "../../../lib/daily-management/access";
import { dateInTimeZone, isValidIsoDate, normalizeDailyTimeZone } from "../../../lib/daily-management/date";
import { ALL_BRANCHES, canonicalDailyBranch } from "../../../lib/daily-management/branch";
import { companyLocalizations } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { getCompanyMonthlyTarget } from "../../../lib/targets/business-service";
import { AuthError } from "../../../lib/server/firebase-auth";

export const dynamic = "force-dynamic";

class DailyManagementRequestError extends Error {}

export async function GET(request: Request) {
  try {
    const access = await requireDailyManagementAccess(request, "view");
    const url = new URL(request.url);
    const requestedDate = url.searchParams.get("date");
    const requestedBranch = canonicalDailyBranch(url.searchParams.get("branch"));
    if (requestedDate && !isValidIsoDate(requestedDate)) throw new DailyManagementRequestError("The report date is invalid.");
    if (requestedBranch && requestedBranch !== ALL_BRANCHES && !access.branchCodes.includes(requestedBranch)) throw new DailyManagementRequestError("The branch scope is invalid.");
    const [localization] = await access.companyDb
      .select({ timeZone: companyLocalizations.defaultTimeZone })
      .from(companyLocalizations)
      .where(eq(companyLocalizations.companyId, access.id))
      .limit(1);
    const timeZone = normalizeDailyTimeZone(localization?.timeZone);
    const currentDate = dateInTimeZone(new Date(), timeZone);
    const [salesRows, bookingRows, stockRows] = await Promise.all([
      listSalesTransactions(access.id),
      listBookingTransactions(access.id),
      listStockTransactions(access.id),
    ]);
    const baseSnapshot = buildDailyManagementSnapshot({
      sales: salesRows.map(toCanonicalSalesRow),
      booking: bookingRows.map((row) => adaptBookingRow(row as unknown as Record<string, unknown>)),
      stock: stockRows.map((row) => adaptStockRow(row as unknown as Record<string, unknown>)),
    }, {
      asOfDate: requestedDate,
      branch: requestedBranch,
      currentDate,
    });
    const [year, month] = baseSnapshot.asOfDate.split("-").map(Number);
    const approvedTarget = baseSnapshot.scope.branch ? null : await getCompanyMonthlyTarget({
      companyId: access.id,
      year,
      month,
      metric: "SALES_UNITS",
    });
    const snapshot = attachApprovedTarget(baseSnapshot, approvedTarget, currentDate);
    return Response.json({
      source: "d1",
      company: { id: access.id, code: access.code, name: access.name },
      generatedAt: new Date().toISOString(),
      timeZone,
      snapshot,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthError || error instanceof DailyManagementAccessError
      ? error.status
      : error instanceof DailyManagementRequestError
        ? 400
        : 500;
    return Response.json({
      error: error instanceof Error ? error.message : "Unable to load Daily Management Report.",
    }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
