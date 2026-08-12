import { asc, eq } from "drizzle-orm";
import { getOperationsDb } from "../../db";
import { salesTransactions, salespersonMaster } from "../../db/schema";

export async function listSalesTransactions(companyId: string) {
  const db = await getOperationsDb();
  return db.select().from(salesTransactions).where(eq(salesTransactions.companyId, companyId)).orderBy(asc(salesTransactions.saleDate));
}

export async function listSalespeople(companyId: string) {
  const db = await getOperationsDb();
  return db
    .select({
      employeeCode: salespersonMaster.employeeCode,
      salespersonCode: salespersonMaster.salespersonCode,
      salespersonName: salespersonMaster.salespersonName,
      status: salespersonMaster.status,
    })
    .from(salespersonMaster)
    .where(eq(salespersonMaster.companyId, companyId));
}
