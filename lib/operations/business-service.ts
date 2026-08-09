import { getAverageBookingAge, getBookingByProduct, getBookingConversionRate, getBookingValue, getDepositAmount, getOpenBookingUnit, type BookingRow } from "../dashboard/booking-selectors";
import { getAgedStock, getAverageStockAge, getStockByProduct, getStockUnit, getStockValue, normalizeProductType, type StockRow } from "../dashboard/stock-selectors";
import type { OperationalBusiness, OperationalFilters } from "./types";

/**
 * Operational UI/API boundary: callers pass rows that have already crossed
 * the raw DB row -> adapter boundary. Re-adapting them drops Booking's
 * `year`/`month` fields because those canonical fields intentionally differ
 * from the raw `booking_year`/`booking_month` column names.
 */
export function getOperationalBusiness(bookingRows: BookingRow[], stockRows: StockRow[], filters: OperationalFilters = {}): OperationalBusiness {
  const booking = bookingRows;
  const stock = filterStockRows(stockRows, filters);
  return {
    booking: { unit: getOpenBookingUnit(booking, filters), value: getBookingValue(booking, filters), deposit: getDepositAmount(booking, filters), averageAge: getAverageBookingAge(booking, filters), conversionRate: getBookingConversionRate(booking, filters), byProduct: getBookingByProduct(booking, filters) },
    stock: { unit: getStockUnit(stock), value: getStockValue(stock), averageAge: getAverageStockAge(stock), agedUnit: getAgedStock(stock).length, byProduct: getStockByProduct(stock) },
  };
}

function filterStockRows(rows: StockRow[], filters: OperationalFilters) {
  const years = (filters.year ?? []).map(Number).filter(Number.isFinite);
  const months = (filters.month ?? []).map((value) => typeof value === "number" ? value : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(value) + 1).filter((value) => value > 0);
  return rows.filter((row) => (!years.length || (row as StockRow & { year?: number | null }).year === undefined || years.includes((row as StockRow & { year?: number | null }).year ?? 0)) && (!months.length || (row as StockRow & { month?: number | null }).month === undefined || months.includes((row as StockRow & { month?: number | null }).month ?? 0)) && (!filters.branch?.length || filters.branch.includes(row.branch ?? "")) && (!filters.product?.length || filters.product.includes(normalizeProductType(row))));
}
