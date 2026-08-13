export type SalesIncrementalRow = {
  id?: string | null;
  saleDate?: unknown;
  invoiceNo?: unknown;
  branch?: unknown;
  modelCode?: unknown;
  productType?: unknown;
  employeeCode?: unknown;
  salespersonCode?: unknown;
  quantity?: unknown;
  saleAmount?: unknown;
  finalReceived?: unknown;
  gp1?: unknown;
  commission?: unknown;
};

export type SalesIncrementalStatus = "NEW" | "ALREADY_EXISTS" | "AMBIGUOUS" | "INVALID";

export type SalesIncrementalClassification = {
  status: SalesIncrementalStatus;
  rowIndex: number;
  transactionKey: string | null;
  transactionId: string | null;
  reason?: string;
  row: SalesIncrementalRow;
};

export type SalesIncrementalPreview = {
  mode: "append";
  currentRows: number;
  proposedRows: number;
  newRows: number;
  alreadyExists: number;
  ambiguous: number;
  invalid: number;
  expectedRowsAfter: number;
  quantityDelta: number;
  salesValueDelta: number;
  gpDelta: number;
  commissionDelta: number;
  deletedRows: number;
  overwrittenRows: number;
  classifications: SalesIncrementalClassification[];
  canCommit: boolean;
  violations: string[];
};

export type ApprovedSalesIncrementalGuard = {
  currentRows: number;
  proposedRows: number;
  newRows: number;
  alreadyExists: number;
  resultingRows: number;
  quantityDelta: number;
  salesValueDelta: number;
  gpDelta: number;
  commissionDelta: number;
};

// The C3.2D operation is intentionally fail-closed. A caller must provide
// the approved 11-row expectation rather than silently turning any append into
// a general-purpose write path.
export const APPROVED_SALES_INCREMENTAL_GUARD: ApprovedSalesIncrementalGuard = Object.freeze({
  currentRows: 3376,
  proposedRows: 11,
  newRows: 11,
  alreadyExists: 0,
  resultingRows: 3387,
  quantityDelta: 9,
  salesValueDelta: 1_490_266_100,
  gpDelta: 115_837_850,
  commissionDelta: 0,
});

function text(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function stable(value: unknown) {
  return text(value).toUpperCase();
}

function modelKey(value: unknown) {
  return stable(value).replace(/[^A-Z0-9]/g, "");
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || text(value) === "") return null;
  const parsed = Number(text(value).replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function numberText(value: unknown) {
  const parsed = numberValue(value);
  return parsed === null ? "" : String(parsed);
}

function identityCode(row: SalesIncrementalRow) {
  // Employee/salesperson codes are canonical identity evidence. Display names
  // deliberately never participate in transaction identity or deduplication.
  return stable(row.employeeCode) || stable(row.salespersonCode);
}

export function salesTransactionIdentity(row: SalesIncrementalRow) {
  return [
    stable(row.invoiceNo),
    stable(row.saleDate),
    stable(row.branch),
    modelKey(row.modelCode),
    identityCode(row),
    numberText(row.finalReceived),
    numberText(row.gp1),
  ].join("|");
}

function invalidReason(row: SalesIncrementalRow) {
  if (!text(row.invoiceNo) || !text(row.saleDate) || !text(row.branch) || !text(row.modelCode)) {
    return "invoice, date, branch and model are required";
  }
  if (numberValue(row.quantity) === null || numberValue(row.saleAmount) === null) {
    return "quantity and sale amount must be numeric";
  }
  if (row.finalReceived !== null && row.finalReceived !== undefined && text(row.finalReceived) && numberValue(row.finalReceived) === null) {
    return "final received must be numeric when provided";
  }
  if (row.gp1 !== null && row.gp1 !== undefined && text(row.gp1) && numberValue(row.gp1) === null) {
    return "gross profit must be numeric when provided";
  }
  if (row.commission !== null && row.commission !== undefined && text(row.commission) && numberValue(row.commission) === null) {
    return "commission must be numeric when provided";
  }
  return null;
}

function mapGroups(rows: SalesIncrementalRow[]) {
  const groups = new Map<string, SalesIncrementalRow[]>();
  rows.forEach((row) => {
    const key = salesTransactionIdentity(row);
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  });
  return groups;
}

function impact(rows: SalesIncrementalRow[]) {
  return {
    quantityDelta: rows.reduce((sum, row) => {
      const productType = stable(row.productType);
      return sum + (["01-TT", "02-CH", "03-TP", "04-EX"].includes(productType) ? (numberValue(row.quantity) ?? 0) : 0);
    }, 0),
    salesValueDelta: rows.reduce((sum, row) => sum + (numberValue(row.saleAmount) ?? 0), 0),
    gpDelta: rows.reduce((sum, row) => sum + (numberValue(row.gp1) ?? 0), 0),
    commissionDelta: rows.reduce((sum, row) => sum + (numberValue(row.commission) ?? 0), 0),
  };
}

export function buildSalesIncrementalPreview(
  incomingRows: SalesIncrementalRow[],
  existingRows: SalesIncrementalRow[],
  guard: ApprovedSalesIncrementalGuard = APPROVED_SALES_INCREMENTAL_GUARD,
  scopeViolations: string[] = [],
): SalesIncrementalPreview {
  const incomingGroups = mapGroups(incomingRows);
  const existingGroups = mapGroups(existingRows);
  const classifications = incomingRows.map((row, rowIndex) => {
    const reason = invalidReason(row);
    const key = salesTransactionIdentity(row);
    if (reason) return { status: "INVALID" as const, rowIndex, transactionKey: null, transactionId: null, reason, row };
    const incomingMatches = incomingGroups.get(key) ?? [];
    const existingMatches = existingGroups.get(key) ?? [];
    if (incomingMatches.length > 1) return { status: "AMBIGUOUS" as const, rowIndex, transactionKey: key, transactionId: null, reason: "multiple incoming rows share the canonical transaction identity", row };
    if (existingMatches.length > 1) return { status: "AMBIGUOUS" as const, rowIndex, transactionKey: key, transactionId: null, reason: "multiple existing rows share the canonical transaction identity", row };
    if (existingMatches.length === 1) return { status: "ALREADY_EXISTS" as const, rowIndex, transactionKey: key, transactionId: existingMatches[0].id ? String(existingMatches[0].id) : null, row };
    return { status: "NEW" as const, rowIndex, transactionKey: key, transactionId: null, row };
  });
  const newRows = classifications.filter((item) => item.status === "NEW").map((item) => item.row);
  const alreadyExists = classifications.filter((item) => item.status === "ALREADY_EXISTS").length;
  const ambiguous = classifications.filter((item) => item.status === "AMBIGUOUS").length;
  const invalid = classifications.filter((item) => item.status === "INVALID").length;
  const deltas = impact(newRows);
  const violations: string[] = [...scopeViolations];
  const expectedRowsAfter = existingRows.length + newRows.length;
  const exact = (label: string, actual: number, expected: number) => { if (actual !== expected) violations.push(`${label} must be ${expected}, received ${actual}`); };
  exact("current Sales rows", existingRows.length, guard.currentRows);
  exact("proposed rows", incomingRows.length, guard.proposedRows);
  exact("NEW rows", newRows.length, guard.newRows);
  exact("ALREADY_EXISTS rows", alreadyExists, guard.alreadyExists);
  exact("resulting Sales rows", expectedRowsAfter, guard.resultingRows);
  exact("Sales Unit impact", deltas.quantityDelta, guard.quantityDelta);
  exact("Sales Value impact", deltas.salesValueDelta, guard.salesValueDelta);
  exact("GP impact", deltas.gpDelta, guard.gpDelta);
  exact("Commission impact", deltas.commissionDelta, guard.commissionDelta);
  if (ambiguous > 0) violations.push(`ambiguous rows must be 0, received ${ambiguous}`);
  if (invalid > 0) violations.push(`invalid rows must be 0, received ${invalid}`);
  return {
    mode: "append",
    currentRows: existingRows.length,
    proposedRows: incomingRows.length,
    newRows: newRows.length,
    alreadyExists,
    ambiguous,
    invalid,
    expectedRowsAfter,
    ...deltas,
    deletedRows: 0,
    overwrittenRows: 0,
    classifications,
    canCommit: violations.length === 0,
    violations,
  };
}
