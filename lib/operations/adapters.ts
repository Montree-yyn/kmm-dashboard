import type { BookingAdapterRow, StockAdapterRow } from "./types";
import { canonicalModelName } from "../dashboard/model-normalization";

const numberOrNull = (value: unknown) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(number) ? number : null;
};
const stringOrEmpty = (value: unknown) => String(value ?? "").trim();
const ageBucket = (age: number | null) => age === null ? "Unknown" : age <= 30 ? "0–30" : age <= 60 ? "31–60" : age <= 90 ? "61–90" : ">90";

export function adaptBookingRow(row: Record<string, unknown>): BookingAdapterRow {
  const date = stringOrEmpty(row.bookingDate ?? row.booking_date);
  return {
    date,
    year: numberOrNull(row.bookingYear ?? row.booking_year ?? row.importYear),
    month: numberOrNull(row.bookingMonth ?? row.booking_month ?? row.importMonth),
    branch: stringOrEmpty(row.branchName ?? row.branchCode ?? row.branch),
    salesperson: stringOrEmpty(row.salespersonName ?? row.salespersonCode ?? row.salesperson),
    productType: stringOrEmpty(row.productType ?? row.product ?? "Unknown"),
    model: canonicalModelName(row.productModel ?? row.model ?? ""),
    price: numberOrNull(row.bookingPrice ?? row.price),
    bookingNo: stringOrEmpty(row.bookingNumber ?? row.bookingNo ?? row.booking_no),
    customer: stringOrEmpty(row.customerName ?? row.customer ?? ""),
    deposit: numberOrNull(row.depositAmount ?? row.deposit),
    paymentType: stringOrEmpty(row.paymentType),
    financeType: stringOrEmpty(row.financeType),
    purchaseStatus: stringOrEmpty(row.purchaseStatus),
    statusDate: stringOrEmpty(row.statusDate ?? date),
    status: stringOrEmpty(row.bookingStatus ?? row.status),
  };
}

export function adaptStockRow(row: Record<string, unknown>): StockAdapterRow {
  const date = stringOrEmpty(row.stockDate ?? row.asOfDate ?? row.as_of_date);
  const ageDays = numberOrNull(row.stockAgeDays ?? row.ageDays);
  return {
    companyId: stringOrEmpty(row.companyId ?? row.company_id),
    date,
    year: numberOrNull(row.importYear ?? row.year),
    month: numberOrNull(row.importMonth ?? row.month),
    branch: stringOrEmpty(row.branchName ?? row.branchCode ?? row.branch),
    salesperson: stringOrEmpty(row.salespersonName ?? row.salespersonCode ?? row.salesperson),
    kmm: typeof row.kmmFlag === "number" || typeof row.kmmFlag === "string" ? row.kmmFlag : typeof row.kmm === "number" || typeof row.kmm === "string" ? row.kmm : null,
    productType: stringOrEmpty(row.productType ?? row.product ?? "Unknown"),
    productGroup: stringOrEmpty(row.productGroup ?? row.productType ?? row.product ?? "Unknown"),
    model: canonicalModelName(row.productModel ?? row.model ?? ""),
    ageBucket: ageBucket(ageDays),
    ageDays,
    snapshotDate: stringOrEmpty(row.snapshotDate ?? date),
    msrp: numberOrNull(row.msrp),
    stockId: stringOrEmpty(row.stockNumber ?? row.stockId) || null,
    serialNumber: stringOrEmpty(row.serialNumber) || null,
    engineNumber: stringOrEmpty(row.engineNumber) || null,
    chassisNumber: stringOrEmpty(row.chassisNumber) || null,
    currentStatus: stringOrEmpty(row.stockStatus ?? row.currentStatus),
  };
}
