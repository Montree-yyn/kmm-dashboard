export const BOOKING_PRODUCTS = ["TT", "CH", "EX", "TP", "MAX", "IM", "IMO", "OT"] as const;
export type BookingProduct = (typeof BOOKING_PRODUCTS)[number];

export type BookingRow = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  productType: string;
  model?: string;
  price?: number | null;
  deposit?: number | null;
  purchaseStatus?: string;
  status: string;
};

export type BookingFilters = {
  year?: string[];
  month?: string[];
  branch?: string[];
  salesperson?: string[];
  product?: string[];
  status?: string[];
  purchaseStatus?: string[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PRODUCT_ALIASES: Record<BookingProduct, readonly string[]> = {
  TT: ["TT", "01TT", "TRACTOR", "01TRACTOR"],
  CH: ["CH", "02CH", "COMBINE", "COMBINEHARVESTER", "02COMBINE", "02COMBINEHARVESTER"],
  EX: ["EX", "04EX", "EXCAVATOR", "04EXCAVATOR"],
  TP: ["TP", "03TP", "TRANSPLANTER", "03TRANSPLANTER"],
  MAX: ["MAX", "05MAX", "MAXOTHER", "05MAXOTHER"],
  IM: ["IM", "IMPLEMENT", "IMPLEMENTS"],
  IMO: ["IMO", "IMPLEMENTOPTION", "IMPLEMENTOPTIONS"],
  OT: ["OT", "OTHER", "OTHERS"],
};

function numberOrZero(value: number | null | undefined) { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function productKey(value: string) { return value.toUpperCase().trim().replace(/[^A-Z0-9]/g, ""); }
function statusKey(value: string | undefined) { return (value ?? "").trim().toUpperCase().replace(/\s+/g, " "); }
function selectedMonths(values: string[] | undefined) { return (values ?? []).map((month) => MONTHS.indexOf(month) + 1).filter((month) => month > 0); }

export function normalizeBookingProduct(value: string): BookingProduct | null {
  const key = productKey(value);
  return BOOKING_PRODUCTS.find((product) => PRODUCT_ALIASES[product].includes(key)) ?? null;
}

export function isHotBooking(row: BookingRow) { return ["A HOT", "B HOT", "C HOT"].includes(statusKey(row.purchaseStatus)); }

export function bookingMatchesFilters(row: BookingRow, filters: BookingFilters = {}) {
  const years = (filters.year ?? []).map(Number).filter(Number.isFinite);
  const months = selectedMonths(filters.month);
  const product = normalizeBookingProduct(row.productType);
  return (!years.length || (row.year !== null && years.includes(row.year)))
    && (!months.length || (row.month !== null && months.includes(row.month)))
    && (!(filters.branch?.length) || filters.branch.includes(row.branch))
    && (!(filters.salesperson?.length) || filters.salesperson.includes(row.salesperson))
    && (!(filters.product?.length) || (product !== null && filters.product.includes(product)))
    && (!(filters.status?.length) || filters.status.includes(row.status))
    && (!(filters.purchaseStatus?.length) || filters.purchaseStatus.some((status) => statusKey(status) === statusKey(row.purchaseStatus)));
}

export function getBookingRows<T extends BookingRow>(rows: T[], filters: BookingFilters = {}) { return rows.filter((row) => bookingMatchesFilters(row, filters)); }
export function getOpenBookingRows<T extends BookingRow>(rows: T[], filters: BookingFilters = {}) { return getBookingRows(rows, filters).filter(isHotBooking); }
export function getOpenBookingUnitRows<T extends BookingRow>(rows: T[], filters: BookingFilters = {}) { return getOpenBookingRows(rows, filters); }
export function getOpenBookingValueRows<T extends BookingRow>(rows: T[], filters: BookingFilters = {}) { return getOpenBookingRows(rows, filters); }
export function getOpenBookingUnit<T extends BookingRow>(rows: T[], filters: BookingFilters = {}) { return getOpenBookingRows(rows, filters).length; }
export function getBookingValue<T extends BookingRow>(rows: T[], filters: BookingFilters = {}) { return getOpenBookingRows(rows, filters).reduce((total, row) => total + numberOrZero(row.price), 0); }
export function getDepositAmount<T extends BookingRow>(rows: T[], filters: BookingFilters = {}) { return getOpenBookingRows(rows, filters).reduce((total, row) => total + numberOrZero(row.deposit), 0); }
export function bookingAge(row: BookingRow, asOf = new Date("2026-07-11T00:00:00")) { const date = new Date(`${row.date}T00:00:00`); const days = Math.floor((asOf.getTime() - date.getTime()) / 86_400_000); return Number.isFinite(days) ? Math.max(0, days) : 0; }
export function getAverageBookingAge<T extends BookingRow>(rows: T[], filters: BookingFilters = {}) { const openRows = getOpenBookingUnitRows(rows, filters); return openRows.length ? openRows.reduce((total, row) => total + bookingAge(row), 0) / openRows.length : null; }
export function getBookingByProduct<T extends BookingRow>(rows: T[], filters: BookingFilters = {}) { const openRows = getOpenBookingRows(rows, filters); return BOOKING_PRODUCTS.map((product) => { const productRows = openRows.filter((row) => normalizeBookingProduct(row.productType) === product); return { product, unit: productRows.length, value: productRows.reduce((total, row) => total + numberOrZero(row.price), 0), deposit: productRows.reduce((total, row) => total + numberOrZero(row.deposit), 0) }; }); }
export function getBookingByBranch<T extends BookingRow>(rows: T[], filters: BookingFilters = {}) { return ["KMM01", "KMM02", "KMM03"].map((branch) => { const branchRows = getOpenBookingRows(rows, { ...filters, branch: [branch] }); return { branch, unit: branchRows.length, value: branchRows.reduce((total, row) => total + numberOrZero(row.price), 0), deposit: branchRows.reduce((total, row) => total + numberOrZero(row.deposit), 0) }; }); }
export function getBookingConversionRate<T extends BookingRow>(rows: T[], filters: BookingFilters = {}) { const scoped = getBookingRows(rows, filters); return scoped.length ? (scoped.filter((row) => row.status === "Delivered").length / scoped.length) * 100 : null; }
