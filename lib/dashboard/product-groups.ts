export const PRODUCT_GROUPS = {
  UNIT_PRODUCTS: ["TT", "CH", "EX", "TP", "MAX"],
  VALUE_PRODUCTS: ["TT", "CH", "EX", "TP", "MAX", "IM", "IMO", "OT"],
} as const;

export type ProductGroup = (typeof PRODUCT_GROUPS)[keyof typeof PRODUCT_GROUPS][number] | "Other";

type ProductRow = {
  productType: string;
  model?: string;
};

export function productCategory(row: ProductRow): ProductGroup {
  const value = `${row.productType} ${row.model ?? ""}`.toUpperCase();
  if (value.includes("TT")) return "TT";
  if (value.includes("CH")) return "CH";
  if (value.includes("EX")) return "EX";
  if (value.includes("TP")) return "TP";
  if (value.includes("MAX")) return "MAX";
  if (value.includes("IMO")) return "IMO";
  if (value.includes("IM")) return "IM";
  if (value.includes("OT")) return "OT";
  return "Other";
}

export function isProductGroup(row: ProductRow, groups: readonly string[]) {
  return groups.includes(productCategory(row));
}

export function filterByProductGroups<T extends ProductRow>(rows: T[], groups: readonly string[]) {
  return rows.filter((row) => isProductGroup(row, groups));
}
