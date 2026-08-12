import { asc, eq } from "drizzle-orm";
import { getOperationsDb } from "../../db";
import { bookingTransactions, stockTransactions } from "../../db/schema";

export async function listBookingTransactions(companyId: string) {
  const db = await getOperationsDb();
  return db.select().from(bookingTransactions).where(eq(bookingTransactions.companyId, companyId)).orderBy(asc(bookingTransactions.bookingDate));
}

export async function listStockTransactions(companyId: string) {
  const db = await getOperationsDb();
  return db.select().from(stockTransactions).where(eq(stockTransactions.companyId, companyId)).orderBy(asc(stockTransactions.asOfDate));
}
