import { asc, eq } from "drizzle-orm";
import { getOperationsDb } from "../../db";
import { salesTransactions, salespersonMaster } from "../../db/schema";
import { COMPANY_ID } from "../company-management/types";

export async function listSalesTransactions(companyId = COMPANY_ID) {
  const db = await getOperationsDb();
  return db.select().from(salesTransactions).where(eq(salesTransactions.companyId, companyId)).orderBy(asc(salesTransactions.saleDate));
}

export async function listSalespeople(companyId = COMPANY_ID) {
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
