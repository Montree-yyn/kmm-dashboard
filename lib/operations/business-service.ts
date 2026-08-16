import { getAverageBookingAge, getBookingByProduct, getBookingConversionRate, getBookingValue, getDepositAmount, getOpenBookingUnit, type BookingRow } from "../dashboard/booking-selectors";
import { getAgedStock, getAverageStockAge, getCurrentStockRows, getStockByProduct, getStockUnit, getStockValue, normalizeProductType, type StockRow } from "../dashboard/stock-selectors";
import type { OperationalBusiness, OperationalFilters } from "./types";

/**
 * Operational UI/API boundary: callers pass rows that have already crossed
 * the raw DB row -> adapter boundary. Re-adapting them drops Booking's
 * `year`/`month` fields because those canonical fields intentionally differ
 * from the raw `booking_year`/`booking_month` column names.
 */
export type OperationalBusinessOptions = {
  /**
   * "Business today" used to measure booking age. The API supplies this from
   * the company timezone; the Dashboard, Booking and Stock pages pass the
   * payload asOf into filtered recomputes so every surface measures age
   * against the same business date. The evaluation-time date is only a
   * fallback when no asOf is supplied (never a frozen value).
   */
  asOf?: Date;
};

export function getOperationalBusiness(bookingRows: BookingRow[], stockRows: StockRow[], filters: OperationalFilters = {}, options: OperationalBusinessOptions = {}): OperationalBusiness {
  const booking = bookingRows;
  const stock = filterStockRows(stockRows, filters);
  const asOf = options.asOf ?? new Date();
  return {
    booking: { unit: getOpenBookingUnit(booking, filters), value: getBookingValue(booking, filters), deposit: getDepositAmount(booking, filters), averageAge: getAverageBookingAge(booking, filters, asOf), conversionRate: getBookingConversionRate(booking, filters), byProduct: getBookingByProduct(booking, filters) },
    stock: { unit: getStockUnit(stock), value: getStockValue(stock), averageAge: getAverageStockAge(stock), agedUnit: getAgedStock(stock).length, byProduct: getStockByProduct(stock) },
  };
}

/** Shared exact stock scope for aggregate Dashboard views. */
export function getFilteredCurrentStockRows<T extends StockRow>(rows: T[], filters: OperationalFilters = {}) {
  return getCurrentStockRows(filterStockRows(rows, filters));
}

function filterStockRows(rows: StockRow[], filters: OperationalFilters) {
  const years = (filters.year ?? []).map(Number).filter(Number.isFinite);
  const months = (filters.month ?? []).map((value) => typeof value === "number" ? value : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(value) + 1).filter((value) => value > 0);
  return rows.filter((row) => (!years.length || row.year === undefined || years.includes(row.year ?? 0))
    && (!months.length || row.month === undefined || months.includes(row.month ?? 0))
    && (!filters.branch?.length || filters.branch.includes(row.branch ?? ""))
    && (!filters.salesperson?.length || filters.salesperson.includes(row.salesperson ?? ""))
    && (!filters.product?.length || filters.product.includes(normalizeProductType(row))));
}
