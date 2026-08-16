import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getOperationsDb } from "../../db";
import { bookingTransactions, stockTransactions } from "../../db/schema";
import type { BookingDashboardFilters } from "./booking-dashboard-summary-service";

export async function listBookingTransactions(companyId: string) {
  const db = await getOperationsDb();
  return db.select().from(bookingTransactions).where(eq(bookingTransactions.companyId, companyId)).orderBy(asc(bookingTransactions.bookingDate));
}

export async function listStockTransactions(companyId: string) {
  const db = await getOperationsDb();
  return db.select().from(stockTransactions).where(eq(stockTransactions.companyId, companyId)).orderBy(asc(stockTransactions.asOfDate));
}

function bookingScope(companyId: string, filters: BookingDashboardFilters) {
  const years = (filters.year ?? []).map(Number).filter(Number.isFinite);
  const months = (filters.month ?? []).map((month) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(month) + 1).filter((month) => month > 0);
  const branch = sql<string>`coalesce(${bookingTransactions.branchName}, ${bookingTransactions.branchCode}, ${bookingTransactions.branch})`;
  const salesperson = sql<string>`coalesce(${bookingTransactions.salespersonName}, ${bookingTransactions.salespersonCode}, '')`;
  return {
    branch,
    salesperson,
    where: and(
      eq(bookingTransactions.companyId, companyId),
      years.length ? inArray(bookingTransactions.bookingYear, years) : undefined,
      months.length ? inArray(bookingTransactions.bookingMonth, months) : undefined,
      filters.branch?.length ? inArray(branch, filters.branch) : undefined,
      filters.salesperson?.length ? inArray(salesperson, filters.salesperson) : undefined,
    ),
  };
}

export async function listBookingDashboardBuckets(companyId: string, filters: BookingDashboardFilters) {
  const db = await getOperationsDb();
  const { branch, salesperson, where } = bookingScope(companyId, filters);
  const productType = sql<string>`coalesce(${bookingTransactions.productType}, ${bookingTransactions.product})`;
  const status = sql<string>`coalesce(${bookingTransactions.bookingStatus}, ${bookingTransactions.status})`;
  return db.select({
    year: bookingTransactions.bookingYear,
    month: bookingTransactions.bookingMonth,
    branch,
    salesperson,
    productType,
    purchaseStatus: bookingTransactions.purchaseStatus,
    status,
    count: sql<number>`count(*)`,
    value: sql<number>`coalesce(sum(cast(${bookingTransactions.bookingPrice} as real)), 0)`,
    deposit: sql<number>`coalesce(sum(cast(${bookingTransactions.depositAmount} as real)), 0)`,
  }).from(bookingTransactions).where(where)
    .groupBy(bookingTransactions.bookingYear, bookingTransactions.bookingMonth, branch, salesperson, productType, bookingTransactions.purchaseStatus, status);
}

export async function listBookingDashboardFilterOptions(companyId: string) {
  const db = await getOperationsDb();
  const branch = sql<string>`coalesce(${bookingTransactions.branchName}, ${bookingTransactions.branchCode}, ${bookingTransactions.branch})`;
  const salesperson = sql<string>`coalesce(${bookingTransactions.salespersonName}, ${bookingTransactions.salespersonCode}, '')`;
  return db.select({ year: bookingTransactions.bookingYear, branch, salesperson })
    .from(bookingTransactions).where(eq(bookingTransactions.companyId, companyId))
    .groupBy(bookingTransactions.bookingYear, branch, salesperson)
    .orderBy(desc(bookingTransactions.bookingYear), asc(branch), asc(salesperson));
}

export async function listRecentBookingDashboardRows(companyId: string, filters: BookingDashboardFilters) {
  const db = await getOperationsDb();
  const { branch, salesperson, where } = bookingScope(companyId, filters);
  const productType = sql<string>`coalesce(${bookingTransactions.productType}, ${bookingTransactions.product})`;
  const status = sql<string>`coalesce(${bookingTransactions.bookingStatus}, ${bookingTransactions.status})`;
  return db.select({ date: bookingTransactions.bookingDate, branch, salesperson, productType, model: bookingTransactions.productModel, status })
    .from(bookingTransactions).where(where).orderBy(desc(bookingTransactions.bookingDate)).limit(6);
}
