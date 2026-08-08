import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  companies,
  companyUsers,
  dataColumnMappings,
  dataImportHistory,
  salesTransactions,
  salespersonMaster,
} from "../../../../db/schema";
import { COMPANY_ID, TENANT_ID, type CompanyRole } from "../../../../lib/company-management/types";
import { isCompanyRole } from "../../../../lib/company-management/permissions";
import {
  assertStatementWithinD1Budget,
  chunkRowsForD1,
  countBoundParameters,
  executeAtomicD1Batch,
} from "../../../../lib/data-hub/d1-batching";
import { AuthError, verifyFirebaseRequest } from "../../../../lib/server/firebase-auth";

export const dynamic = "force-dynamic";
const WRITE_ROLES = new Set<CompanyRole>(["super_admin", "company_admin", "manager"]);

type SalesRow = {
  sale_date?: unknown;
  invoice_no?: unknown;
  branch?: unknown;
  model_code?: unknown;
  employee_code?: unknown;
  quantity?: unknown;
  sale_amount?: unknown;
  product_type?: unknown;
  model?: unknown;
  final_received?: unknown;
  net_received?: unknown;
  gp1?: unknown;
  expense?: unknown;
  salesperson_code?: unknown;
  salesperson_name?: unknown;
};

export async function GET(request: Request) {
  try {
    const context = await getContext(request);
    const db = context.db;
    const query = new URL(request.url).searchParams;
    const requestedCompany = query.get("companyId") || COMPANY_ID;
    const requestedYear = Number(query.get("year"));
    const requestedMonth = Number(query.get("month"));
    const [companyRows, history] = await Promise.all([
      db.select({ id: companies.companyId, code: companies.companyCode, name: companies.companyName })
        .from(companies)
        .where(eq(companies.status, "active")),
      db.select().from(dataImportHistory)
        .where(and(eq(dataImportHistory.companyId, COMPANY_ID), eq(dataImportHistory.module, "sales")))
        .orderBy(desc(dataImportHistory.importedAt)).limit(50),
    ]);
    return json({
      companies: companyRows.length ? companyRows : [{ id: COMPANY_ID, code: "KMM", name: "KMM Company" }],
      role: context.role,
      history: history.map(toHistory),
      existingRows: Number((await db.select({ count: sql<number>`count(*)` }).from(salesTransactions).where(and(eq(salesTransactions.companyId, requestedCompany), Number.isInteger(requestedYear) ? eq(salesTransactions.importYear, requestedYear) : undefined, Number.isInteger(requestedMonth) ? eq(salesTransactions.importMonth, requestedMonth) : undefined)))[0]?.count ?? 0),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getContext(request);
    if (!WRITE_ROLES.has(context.role)) return json({ error: "Your role is read-only for Sales imports." }, 403);
    const db = context.db;
    const payload = await request.json() as {
      action?: "replace" | "save_mapping";
      companyId?: string;
      year?: number;
      month?: number;
      filename?: string;
      rows?: SalesRow[];
      mapping?: Record<string, string | null>;
      validation?: { totalRows: number; validRows: number; warningCells: number; invalidRows: number; issues?: unknown[] };
    };
    const companyId = payload.companyId || COMPANY_ID;
    const year = Number(payload.year);
    const month = Number(payload.month);
    if (payload.action === "save_mapping") {
      if (!payload.mapping || !Object.keys(payload.mapping).length) return json({ error: "A column mapping is required." }, 400);
      await db.insert(dataColumnMappings).values({
        id: crypto.randomUUID(), tenantId: TENANT_ID, companyId, module: "sales",
        mapping: JSON.stringify(payload.mapping), updatedBy: context.user.id,
      }).onConflictDoUpdate({ target: [dataColumnMappings.companyId, dataColumnMappings.module], set: { mapping: JSON.stringify(payload.mapping), updatedAt: new Date().toISOString(), updatedBy: context.user.id } });
      return json({ ok: true });
    }
    if (payload.action !== "replace" || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return json({ error: "Company, year and month are required." }, 400);
    if (!payload.rows?.length || payload.rows.length > 50_000) return json({ error: "The import must contain between 1 and 50,000 rows." }, 400);
    const importId = crypto.randomUUID();
    const startedAt = Date.now();
    const masterRows = await db.select().from(salespersonMaster).where(and(eq(salespersonMaster.companyId, companyId), eq(salespersonMaster.status, "active")));
    const masterByEmployee = new Map(masterRows.map((row) => [row.employeeCode.trim().toUpperCase(), row]));
    const masterByCode = new Map(masterRows.map((row) => [row.salespersonCode.trim().toUpperCase(), row]));
    let unmappedEmployeeRows = 0;
    const rows = payload.rows.map((row, index) => {
      const quantity = Number(String(row.quantity ?? "").replaceAll(",", ""));
      const saleAmount = Number(String(row.sale_amount ?? "").replaceAll(",", ""));
      if (!row.sale_date || !row.invoice_no || !row.branch || !row.model_code || !Number.isFinite(quantity) || !Number.isFinite(saleAmount)) throw new Error(`Row ${index + 2} is not valid for import.`);
      const numberOrNull = (value: unknown) => {
        if (value === null || value === undefined || String(value).trim() === "") return null;
        const parsed = Number(String(value).replaceAll(",", ""));
        return Number.isFinite(parsed) ? String(parsed) : null;
      };
      const employeeCode = String(row.employee_code ?? "").trim();
      const salespersonCode = String(row.salesperson_code ?? "").trim();
      const salespersonName = String(row.salesperson_name ?? "").trim();
      const master = (employeeCode ? masterByEmployee.get(employeeCode.toUpperCase()) : undefined) || (salespersonCode ? masterByCode.get(salespersonCode.toUpperCase()) : undefined);
      if ((employeeCode || salespersonCode) && !master) unmappedEmployeeRows += 1;
      return { id: crypto.randomUUID(), tenantId: TENANT_ID, companyId, importId, importYear: year, importMonth: month, saleDate: String(row.sale_date), invoiceNo: String(row.invoice_no), branch: String(row.branch), modelCode: String(row.model_code), employeeCode, quantity, saleAmount: String(saleAmount), productType: row.product_type ? String(row.product_type) : null, model: row.model ? String(row.model) : null, finalReceived: numberOrNull(row.final_received), netReceived: numberOrNull(row.net_received), gp1: numberOrNull(row.gp1), expense: numberOrNull(row.expense), salespersonCode: master?.salespersonCode ?? (salespersonCode || null), salespersonName: master?.salespersonName ?? (salespersonName || null), createdBy: context.user.id };
    });
    const history = { id: importId, tenantId: TENANT_ID, companyId, module: "sales", importYear: year, importMonth: month, filename: payload.filename || "sales-import.xlsx", status: "success", totalRows: rows.length, validRows: rows.length, warningRows: (payload.validation?.warningCells ?? 0) + unmappedEmployeeRows, errorRows: 0, durationMs: 0, importedBy: context.user.email || context.user.id, importedAt: new Date().toISOString() };
    // Sales CPI is a full current-state dataset. Each approved import replaces
    // every current Sales transaction for its company; import history remains
    // append-only and is never read by the Sales KPI/query path.
    const deleteStatement = db.delete(salesTransactions).where(eq(salesTransactions.companyId, companyId));
    const boundParametersPerRow = countBoundParameters(db.insert(salesTransactions).values(rows[0]));
    const { chunks } = chunkRowsForD1(rows, boundParametersPerRow);
    const statements: Array<Parameters<typeof db.batch>[0][number]> = [];
    assertStatementWithinD1Budget(deleteStatement);
    statements.push(deleteStatement);
    chunks.forEach((chunk) => {
      const insertStatement = db.insert(salesTransactions).values(chunk);
      assertStatementWithinD1Budget(insertStatement);
      statements.push(insertStatement);
    });
    history.durationMs = Math.max(1, Date.now() - startedAt);
    const historyStatement = db.insert(dataImportHistory).values(history);
    assertStatementWithinD1Budget(historyStatement);
    statements.push(historyStatement);
    await executeAtomicD1Batch(statements, (batch) => db.batch(batch));
    return json({ ok: true, importId, importedRows: rows.length, dashboardRefresh: true, salesRefresh: true, history: toHistory(history) });
  } catch (error) {
    return handleError(error);
  }
}

async function getContext(request: Request) {
  const user = await verifyFirebaseRequest(request);
  const db = await getDb();
  const [existing] = await db.select({ role: companyUsers.role }).from(companyUsers).where(and(eq(companyUsers.companyId, COMPANY_ID), eq(companyUsers.userId, user.id), eq(companyUsers.status, "active"))).limit(1);
  const role = existing && isCompanyRole(existing.role) ? existing.role : "viewer";
  return { db, user, role };
}

function toHistory(row: Pick<typeof dataImportHistory.$inferSelect, "id" | "filename" | "importedAt" | "importedBy" | "totalRows" | "validRows" | "warningRows" | "errorRows" | "durationMs" | "status">) {
  return { id: row.id, filename: row.filename, module: "Sales", importedAt: row.importedAt, importedBy: row.importedBy, rows: row.totalRows, success: row.validRows, warning: row.warningRows, error: row.errorRows, status: row.status === "success" ? "success" : "failed", durationMs: row.durationMs, rollbackAvailable: false };
}

function json(value: unknown, status = 200) { return Response.json(value, { status, headers: { "Cache-Control": "no-store" } }); }
function handleError(error: unknown) { const status = error instanceof AuthError ? error.status : error instanceof Error && /valid|required|Row/.test(error.message) ? 400 : 500; return json({ error: error instanceof Error ? error.message : "Unexpected Sales import error." }, status); }
