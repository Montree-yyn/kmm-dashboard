export const STOCK_UNIT_PRODUCTS = ["TT", "CH", "EX", "TP", "MAX"] as const;
export const STOCK_VALUE_PRODUCTS = [...STOCK_UNIT_PRODUCTS, "IM", "IMO", "OT"] as const;

export type StockProduct = (typeof STOCK_VALUE_PRODUCTS)[number] | "Unknown";
export type StockRow = {
  kmm?: unknown;
  productType?: string | null;
  productGroup?: string | null;
  model?: string | null;
  currentStatus?: string | null;
  stockId?: string | null;
  serialNumber?: string | null;
  engineNumber?: string | null;
  chassisNumber?: string | null;
  branch?: string | null;
  msrp?: number | null;
  ageDays?: number | null;
};

const aliases: Record<StockProduct, string[]> = {
  TT: ["TT", "01TT", "TRACTOR", "01TRACTOR"],
  CH: ["CH", "02CH", "COMBINE", "COMBINEHARVESTER", "02COMBINE", "02COMBINEHARVESTER"],
  EX: ["EX", "03EX", "EXCAVATOR", "03EXCAVATOR"],
  TP: ["TP", "04TP", "TRANSPLANTER", "04TRANSPLANTER"],
  MAX: ["MAX", "05MAX"],
  IM: ["IM", "06IM", "IMPLEMENT", "IMPLEMENTS"],
  IMO: ["IMO", "07IMO", "IMPLEMENTOTHER", "IMPLEMENTOTHERS"],
  OT: ["OT", "08OT", "OTHER", "OTHERS"],
  Unknown: [],
};
const clean = (value: unknown) => String(value ?? "").trim().toUpperCase();
const key = (value: unknown) => clean(value).replace(/[^A-Z0-9]/g, "");
const identifierKey = (value: unknown) => clean(value).replace(/[\u200B-\u200D\uFEFF]/g, "");
const numberOrZero = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

const tractorModelPatterns = [/^NSPU[A-Z0-9-]*$/, /^MU[0-9][A-Z0-9-]*$/, /^M[0-9][A-Z0-9-]*$/, /^L[0-9][A-Z0-9-]*$/, /^B[0-9][A-Z0-9-]*$/];

export function normalizeStockModelForFallback(value: unknown) {
  return clean(value)
    .replace(/\s*\((DEMO|SECOND)\)\s*$/g, "")
    .replace(/(?:\+(?:FD|FG))+$/g, "")
    .trim();
}

export function classifyStockModelFallback(value: unknown): StockProduct {
  const model = normalizeStockModelForFallback(value);
  return tractorModelPatterns.some((pattern) => pattern.test(model)) ? "TT" : "Unknown";
}

/** Canonical stock grouping. It never infers a product from the model text. */
export function normalizeProductType(row: Pick<StockRow, "productType" | "productGroup" | "model">): StockProduct {
  const values = [key(row.productGroup), key(row.productType)];
  for (const [product, names] of Object.entries(aliases) as [StockProduct, string[]][]) {
    if (values.some((value) => names.includes(value))) return product;
  }
  return classifyStockModelFallback(row.model);
}

export function normalizeStockStatus(row: Pick<StockRow, "currentStatus">) {
  return clean(row.currentStatus).replace(/\s+/g, " ");
}

export function normalizeKmmValue(row: Pick<StockRow, "kmm">) {
  return clean(row.kmm) === "1" ? 1 : null;
}

export function isKmmFreeStock(row: Pick<StockRow, "kmm" | "currentStatus">) {
  return normalizeKmmValue(row) === 1 && normalizeStockStatus(row) === "FREE STOCK";
}

function duplicateKey(row: StockRow) {
  for (const [label, value] of [["chassis", row.chassisNumber], ["engine", row.engineNumber], ["serial", row.serialNumber], ["stock", row.stockId]]) {
    const normalized = identifierKey(value);
    if (normalized && normalized !== "-") return `${label}:${normalized}`;
  }
  return null;
}

/** Current KMM stock only: KMM = 1 and Status PD = Free Stock, deduplicated by machine ID. */
export function getCurrentStockRows<T extends StockRow>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!isKmmFreeStock(row)) return false;
    const id = duplicateKey(row);
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** @deprecated Use getCurrentStockRows for the explicit KMM Free Stock rule. */
export const getValidStockRows = getCurrentStockRows;

export function getStockUnit<T extends StockRow>(rows: T[]) {
  return getStockUnitRows(rows).length;
}

export function getStockUnitRows<T extends StockRow>(rows: T[]) {
  return getCurrentStockRows(rows).filter((row) => STOCK_UNIT_PRODUCTS.includes(normalizeProductType(row) as typeof STOCK_UNIT_PRODUCTS[number]));
}

export function getStockValue<T extends StockRow>(rows: T[]) {
  return getStockValueRows(rows).reduce((total, row) => total + numberOrZero(row.msrp), 0);
}

export function getStockValueRows<T extends StockRow>(rows: T[]) {
  return getCurrentStockRows(rows).filter((row) => STOCK_VALUE_PRODUCTS.includes(normalizeProductType(row) as typeof STOCK_VALUE_PRODUCTS[number]) && Number.isFinite(Number(row.msrp)));
}

export function getStockByProduct<T extends StockRow>(rows: T[]) {
  const valid = getCurrentStockRows(rows);
  return STOCK_VALUE_PRODUCTS.map((product) => {
    const productRows = valid.filter((row) => normalizeProductType(row) === product);
    return { product, unit: STOCK_UNIT_PRODUCTS.includes(product as typeof STOCK_UNIT_PRODUCTS[number]) ? productRows.length : 0, value: productRows.reduce((total, row) => total + numberOrZero(row.msrp), 0) };
  });
}

export function getStockByBranch<T extends StockRow>(rows: T[]) {
  const valid = getCurrentStockRows(rows);
  return [...new Set(valid.map((row) => row.branch || "Missing"))].sort().map((branch) => {
    const branchRows = valid.filter((row) => (row.branch || "Missing") === branch);
    return { branch, unit: branchRows.filter((row) => STOCK_UNIT_PRODUCTS.includes(normalizeProductType(row) as typeof STOCK_UNIT_PRODUCTS[number])).length, value: branchRows.filter((row) => STOCK_VALUE_PRODUCTS.includes(normalizeProductType(row) as typeof STOCK_VALUE_PRODUCTS[number])).reduce((total, row) => total + numberOrZero(row.msrp), 0) };
  });
}

export function getAverageStockAge<T extends StockRow>(rows: T[]) {
  const ages = getCurrentStockRows(rows).filter((row) => STOCK_UNIT_PRODUCTS.includes(normalizeProductType(row) as typeof STOCK_UNIT_PRODUCTS[number])).map((row) => Number(row.ageDays)).filter((age) => Number.isFinite(age) && age >= 0);
  return ages.length ? ages.reduce((total, age) => total + age, 0) / ages.length : null;
}

export function getAgedStock<T extends StockRow>(rows: T[], minimumAge = 90) {
  return getCurrentStockRows(rows).filter((row) => STOCK_UNIT_PRODUCTS.includes(normalizeProductType(row) as typeof STOCK_UNIT_PRODUCTS[number]) && numberOrZero(row.ageDays) > minimumAge);
}
