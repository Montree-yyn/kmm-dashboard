import { asc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { bookingTransactions, stockTransactions } from "../../db/schema";
import { COMPANY_ID } from "../company-management/types";

export async function listBookingTransactions(companyId = COMPANY_ID) {
  const db = await getDb();
  return db.select().from(bookingTransactions).where(eq(bookingTransactions.companyId, companyId)).orderBy(asc(bookingTransactions.bookingDate));
}

export async function listStockTransactions(companyId = COMPANY_ID) {
  const db = await getDb();
  return db.select().from(stockTransactions).where(eq(stockTransactions.companyId, companyId)).orderBy(asc(stockTransactions.asOfDate));
}
