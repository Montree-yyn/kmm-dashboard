import { and, desc, eq, sql } from "drizzle-orm";
import { getOperationsDb } from "../../../../db";
import {
  dataColumnMappings,
  dataImportHistory,
  salesTransactions,
  salespersonMaster,
} from "../../../../db/schema";
import {
  assertStatementWithinD1Budget,
  chunkRowsForD1,
  countBoundParameters,
  executeAtomicD1Batch,
} from "../../../../lib/data-hub/d1-batching";
import { AuthError } from "../../../../lib/server/firebase-auth";
import { canonicalModelName } from "../../../../lib/dashboard/model-normalization";
import {
  CompanyAccessError,
  listAuthorizedCompanies,
  requireCompanyContext,
} from "../../../../lib/server/company-context";
import {
  assertImportBranches,
  ImportScopeError,
} from "../../../../lib/server/import-branch-validation";
import {
  APPROVED_SALES_INCREMENTAL_GUARD,
  buildSalesIncrementalPreview,
  type ApprovedSalesIncrementalGuard,
  type SalesIncrementalRow,
} from "../../../../lib/data-hub/sales-incremental";

export const dynamic = "force-dynamic";

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
  commission?: unknown;
  salesperson_code?: unknown;
  salesperson_name?: unknown;
};

export async function GET(request: Request) {
  try {
    const context = await requireCompanyContext(request, {
      permission: "view",
      allowLegacyKmmRead: true,
    });
    const authorized = await listAuthorizedCompanies(request, {
      allowLegacyKmmRead: true,
    });
    const operationsDb = await getOperationsDb();
    const query = new URL(request.url).searchParams;
    const requestedYear = Number(query.get("year"));
    const requestedMonth = Number(query.get("month"));
    const history = await operationsDb.select().from(dataImportHistory)
      .where(and(eq(dataImportHistory.companyId, context.id), eq(dataImportHistory.module, "sales")))
      .orderBy(desc(dataImportHistory.importedAt)).limit(50);
    return json({
      companies: authorized.companies,
      selectedCompanyId: context.id,
      role: context.role,
      history: history.map(toHistory),
      existingRows: Number((await operationsDb.select({ count: sql<number>`count(*)` }).from(salesTransactions).where(and(eq(salesTransactions.companyId, context.id), Number.isInteger(requestedYear) ? eq(salesTransactions.importYear, requestedYear) : undefined, Number.isInteger(requestedMonth) ? eq(salesTransactions.importMonth, requestedMonth) : undefined)))[0]?.count ?? 0),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as {
      action?: "replace" | "append" | "preview" | "save_mapping";
      mode?: "replace" | "append";
      companyId?: string;
      year?: number;
      month?: number;
      filename?: string;
      rows?: SalesRow[];
      mapping?: Record<string, string | null>;
      validation?: { totalRows: number; validRows: number; warningCells: number; invalidRows: number; issues?: unknown[] };
      guard?: ApprovedSalesIncrementalGuard;
    };
    const context = await requireCompanyContext(request, {
      companyId: payload.companyId,
      permission: "edit",
    });
    const db = await getOperationsDb();
    const companyId = context.id;
    const year = Number(payload.year);
    const month = Number(payload.month);
    if (payload.action === "save_mapping") {
      if (!payload.mapping || !Object.keys(payload.mapping).length) return json({ error: "A column mapping is required." }, 400);
      await db.insert(dataColumnMappings).values({
        id: crypto.randomUUID(), tenantId: context.tenantId, companyId, module: "sales",
        mapping: JSON.stringify(payload.mapping), updatedBy: context.user.id,
      }).onConflictDoUpdate({ target: [dataColumnMappings.companyId, dataColumnMappings.module], set: { mapping: JSON.stringify(payload.mapping), updatedAt: new Date().toISOString(), updatedBy: context.user.id } });
      return json({ ok: true });
    }
    const mode = payload.mode ?? "replace";
    if (mode !== "replace" && mode !== "append") return json({ error: "Sales import mode must be replace or append." }, 400);
    if (payload.action === "preview" && mode !== "append") return json({ error: "Only append imports support a pre-commit preview." }, 400);
    if (payload.action === "append" && mode !== "append") return json({ error: "Append action requires mode=append." }, 400);
    if (mode === "append" && payload.action !== "append" && payload.action !== "preview") return json({ error: "Append mode requires action=preview or action=append." }, 400);
    if (mode === "replace" && payload.action !== "replace") return json({ error: "Replace mode requires action=replace." }, 400);
    if (payload.action !== "replace" && payload.action !== "append" && payload.action !== "preview") return json({ error: "Company, year and month are required." }, 400);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return json({ error: "Company, year and month are required." }, 400);
    if (!payload.rows?.length || payload.rows.length > 50_000) return json({ error: "The import must contain between 1 and 50,000 rows." }, 400);
    await assertImportBranches(
      context.companyDb,
      companyId,
      payload.rows.map((row) => row.branch),
    );
    const appendGuardValid = mode === "append" && hasApprovedIncrementalGuard(payload.guard);
    if (mode === "append" && !appendGuardValid) return json({ error: "The approved 11-row incremental safety gate is required." }, 400);
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
      const numberOrNull = (value: unknown, field?: string) => {
        if (value === null || value === undefined || String(value).trim() === "") return null;
        const parsed = Number(String(value).replaceAll(",", ""));
        if (Number.isFinite(parsed)) return String(parsed);
        if (field) throw new Error(`Row ${index + 2}: ${field} must be numeric when provided.`);
        return null;
      };
      const employeeCode = String(row.employee_code ?? "").trim();
      const salespersonCode = String(row.salesperson_code ?? "").trim();
      const salespersonName = String(row.salesperson_name ?? "").trim();
      const master = (employeeCode ? masterByEmployee.get(employeeCode.toUpperCase()) : undefined) || (salespersonCode ? masterByCode.get(salespersonCode.toUpperCase()) : undefined);
      if ((employeeCode || salespersonCode) && !master) unmappedEmployeeRows += 1;
      return { id: crypto.randomUUID(), tenantId: context.tenantId, companyId, importId, importYear: year, importMonth: month, saleDate: String(row.sale_date), invoiceNo: String(row.invoice_no), branch: String(row.branch), modelCode: canonicalModelName(row.model_code), employeeCode, quantity, saleAmount: String(saleAmount), productType: row.product_type ? String(row.product_type) : null, model: row.model ? canonicalModelName(row.model) : null, finalReceived: numberOrNull(row.final_received), netReceived: numberOrNull(row.net_received), gp1: numberOrNull(row.gp1), expense: numberOrNull(row.expense), commission: numberOrNull(row.commission, "Commission"), salespersonCode: master?.salespersonCode ?? (salespersonCode || null), salespersonName: master?.salespersonName ?? (salespersonName || null), createdBy: context.user.id };
    });
    if (mode === "append") {
      const existingRows = await db.select({
        id: salesTransactions.id,
        saleDate: salesTransactions.saleDate,
        invoiceNo: salesTransactions.invoiceNo,
        branch: salesTransactions.branch,
        modelCode: salesTransactions.modelCode,
        productType: salesTransactions.productType,
        employeeCode: salesTransactions.employeeCode,
        salespersonCode: salesTransactions.salespersonCode,
        quantity: salesTransactions.quantity,
        saleAmount: salesTransactions.saleAmount,
        finalReceived: salesTransactions.finalReceived,
        gp1: salesTransactions.gp1,
        commission: salesTransactions.commission,
      }).from(salesTransactions).where(eq(salesTransactions.companyId, companyId));
      const scopeViolations = rows.flatMap((row, index) => {
        const date = String(row.saleDate);
        const branch = String(row.branch).trim().toUpperCase();
        const violations: string[] = [];
        if (date < "2026-08-05" || date > "2026-08-10") violations.push(`row ${index + 2}: sale date must be 2026-08-05 through 2026-08-10`);
        if (!["KMM01", "KMM02", "KMM03"].includes(branch)) violations.push(`row ${index + 2}: branch is outside the approved KMM01/KMM02/KMM03 scope`);
        return violations;
      });
      const preview = buildSalesIncrementalPreview(rows as SalesIncrementalRow[], existingRows as SalesIncrementalRow[], APPROVED_SALES_INCREMENTAL_GUARD, scopeViolations);
      if (payload.action === "preview") return json({ ok: true, mode: "append", preview });
      if (!preview.canCommit) return json({ error: "Incremental Sales import failed its safety gate.", mode: "append", preview }, 409);
      const newRowIndexes = new Set(preview.classifications.filter((item) => item.status === "NEW").map((item) => item.rowIndex));
      const rowsToInsert = rows.filter((_, index) => newRowIndexes.has(index));
      const history = { id: importId, tenantId: context.tenantId, companyId, module: "sales", importYear: year, importMonth: month, filename: payload.filename || "sales-incremental-import.xlsx", status: "success", totalRows: rowsToInsert.length, validRows: rowsToInsert.length, warningRows: (payload.validation?.warningCells ?? 0) + unmappedEmployeeRows, errorRows: 0, durationMs: Math.max(1, Date.now() - startedAt), importedBy: context.user.email || context.user.id, importedAt: new Date().toISOString() };
      const boundParametersPerRow = countBoundParameters(db.insert(salesTransactions).values(rowsToInsert[0]!));
      const { chunks } = chunkRowsForD1(rowsToInsert, boundParametersPerRow);
      const statements: Array<Parameters<typeof db.batch>[0][number]> = [];
      chunks.forEach((chunk) => {
        const insertStatement = db.insert(salesTransactions).values(chunk);
        assertStatementWithinD1Budget(insertStatement);
        statements.push(insertStatement);
      });
      const historyStatement = db.insert(dataImportHistory).values(history);
      assertStatementWithinD1Budget(historyStatement);
      statements.push(historyStatement);
      await executeAtomicD1Batch(statements, (batch) => db.batch(batch));
      return json({ ok: true, mode: "append", importId, importedRows: rowsToInsert.length, dashboardRefresh: true, salesRefresh: true, preview, history: toHistory(history) });
    }
    const history = { id: importId, tenantId: context.tenantId, companyId, module: "sales", importYear: year, importMonth: month, filename: payload.filename || "sales-import.xlsx", status: "success", totalRows: rows.length, validRows: rows.length, warningRows: (payload.validation?.warningCells ?? 0) + unmappedEmployeeRows, errorRows: 0, durationMs: 0, importedBy: context.user.email || context.user.id, importedAt: new Date().toISOString() };
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

function hasApprovedIncrementalGuard(value: ApprovedSalesIncrementalGuard | undefined) {
  if (!value) return false;
  return (Object.keys(APPROVED_SALES_INCREMENTAL_GUARD) as Array<keyof ApprovedSalesIncrementalGuard>).every((key) => value[key] === APPROVED_SALES_INCREMENTAL_GUARD[key]);
}

function toHistory(row: Pick<typeof dataImportHistory.$inferSelect, "id" | "filename" | "importedAt" | "importedBy" | "totalRows" | "validRows" | "warningRows" | "errorRows" | "durationMs" | "status">) {
  return { id: row.id, filename: row.filename, module: "Sales", importedAt: row.importedAt, importedBy: row.importedBy, rows: row.totalRows, success: row.validRows, warning: row.warningRows, error: row.errorRows, status: row.status === "success" ? "success" : "failed", durationMs: row.durationMs, rollbackAvailable: false };
}

function json(value: unknown, status = 200) { return Response.json(value, { status, headers: { "Cache-Control": "no-store" } }); }
function handleError(error: unknown) { const status = error instanceof AuthError || error instanceof CompanyAccessError || error instanceof ImportScopeError ? error.status : error instanceof Error && /valid|required|Row/.test(error.message) ? 400 : 500; return json({ error: error instanceof Error ? error.message : "Unexpected Sales import error." }, status); }
