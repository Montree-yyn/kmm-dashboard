import type { CanonicalSalesRow } from "./types";

function numberOrNull(value: string | null) { if (value === null || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function canonicalModelValue(value: unknown) { const model = String(value ?? "").trim().replace(/\s+/g, " "); return model.toUpperCase().replace(/[^A-Z0-9]/g, "") === "DC70GPRO" ? "DC70G PRO" : model; }

export function toCanonicalSalesRow(row: {
  id: string; saleDate: string; importYear: number; importMonth: number; branch: string; modelCode: string; employeeCode: string; quantity: number; saleAmount: string; productType: string | null; model: string | null; finalReceived: string | null; netReceived: string | null; gp1: string | null; expense: string | null; salespersonCode: string | null; salespersonName: string | null;
}): CanonicalSalesRow {
  const date = row.saleDate.slice(0, 10);
  const dateValue = new Date(`${date}T00:00:00`);
  return { id: row.id, date, year: Number.isNaN(dateValue.getTime()) ? row.importYear : dateValue.getFullYear(), month: Number.isNaN(dateValue.getTime()) ? row.importMonth : dateValue.getMonth() + 1, branch: row.branch, salesperson: row.salespersonName ?? row.salespersonCode ?? "", salespersonCode: row.salespersonCode, employeeCode: row.employeeCode, productType: row.productType ?? "", model: canonicalModelValue(row.model ?? row.modelCode), modelCode: canonicalModelValue(row.modelCode), quantity: row.quantity, saleAmount: numberOrNull(row.saleAmount) ?? 0, finalReceived: numberOrNull(row.finalReceived), netReceived: numberOrNull(row.netReceived), gp1: numberOrNull(row.gp1), expense: numberOrNull(row.expense) };
}

export function toLegacySalesRow(row: CanonicalSalesRow) {
  return {
    date: row.date,
    year: row.year,
    month: row.month,
    branch: row.branch,
    salesperson: row.salesperson,
    salespersonCode: row.salespersonCode,
    salespersonName: row.salesperson,
    employeeCode: row.employeeCode,
    productType: row.productType,
    model: row.model,
    quantity: row.quantity,
    finalReceived: row.finalReceived,
    netReceived: row.netReceived,
    gp1: row.gp1,
    expense: row.expense,
  };
}
