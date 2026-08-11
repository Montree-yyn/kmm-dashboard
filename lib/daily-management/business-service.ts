import {
  getOpenBookingRows,
  type BookingRow,
} from "../dashboard/booking-selectors";
import {
  getCurrentStockRows,
  getStockUnitRows,
  getStockValue,
  normalizeProductType,
  type StockRow,
} from "../dashboard/stock-selectors";
import {
  getEngineUnitSalesRows,
  salesTransactionQuantity,
} from "../sales/business-service";
import type { CanonicalSalesRow } from "../sales/types";
import type { BookingAdapterRow, StockAdapterRow } from "../operations/types";
import type { DailyManagementSnapshot } from "./types";
import { canonicalModelName } from "../dashboard/model-normalization";
import { targetProgress } from "../targets/business-service";
import { canEvaluateFullPeriodTarget } from "../kai/executive-intelligence";
import type { ApprovedTarget } from "../targets/types";
import { ALL_BRANCHES, canonicalDailyBranch } from "./branch";
import { calendarMonth, dateInTimeZone } from "./date";

type DailyManagementInput = {
  sales: CanonicalSalesRow[];
  booking: BookingAdapterRow[];
  stock: StockAdapterRow[];
};

const unavailable = (reason: string) => ({ available: false, reason });
const dateKey = (value: string | null | undefined) => String(value ?? "").slice(0, 10);
export const canonicalDailyModel = canonicalModelName;

function latestDate(values: Array<string | null | undefined>) {
  return values.map(dateKey).filter(Boolean).sort().at(-1) ?? null;
}

function unitsBy<T>(rows: T[], label: (row: T) => string, quantity: (row: T) => number) {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const key = label(row) || "Unassigned";
    totals.set(key, (totals.get(key) ?? 0) + quantity(row));
  });
  return [...totals.entries()]
    .map(([name, units]) => ({ name, units }))
    .sort((left, right) => right.units - left.units || left.name.localeCompare(right.name));
}

function agingLabel(age: number | null) {
  if (age === null || !Number.isFinite(age)) return "Unknown" as const;
  if (age <= 30) return "0–30" as const;
  if (age <= 60) return "31–60" as const;
  if (age <= 90) return "61–90" as const;
  return ">90" as const;
}

export function buildDailyManagementSnapshot(
  input: DailyManagementInput,
  options: { asOfDate?: string | null; branch?: string | null; currentDate?: string | null } = {},
): DailyManagementSnapshot {
  const latestSalesDate = latestDate(input.sales.map((row) => row.date));
  const latestBookingDate = latestDate(input.booking.map((row) => row.date));
  const latestStockDate = latestDate(
    input.stock.map((row) => row.snapshotDate || row.date),
  );
  const asOfDate = dateKey(options.asOfDate)
    || latestDate([latestSalesDate, latestBookingDate, latestStockDate])
    || dateKey(options.currentDate)
    || dateInTimeZone(new Date());
  const branchValue = canonicalDailyBranch(options.branch);
  const branch = !branchValue || branchValue === ALL_BRANCHES ? null : branchValue;
  const [year, month] = asOfDate.split("-").map(Number);
  const branchMatches = (value: string) => !branch || canonicalDailyBranch(value) === branch;

  const eligibleSales = input.sales.filter((row) => dateKey(row.date) <= asOfDate);
  const eligibleBooking = input.booking.filter((row) => dateKey(row.date) <= asOfDate);
  const eligibleStock = input.stock.filter((row) => dateKey(row.snapshotDate || row.date) <= asOfDate);
  const salesLatestDate = latestDate(eligibleSales.map((row) => row.date));
  const bookingLatestDate = latestDate(eligibleBooking.map((row) => row.date));
  const stockLatestDate = latestDate(eligibleStock.map((row) => row.snapshotDate || row.date));

  const availableBranches = [...new Set([
    ...input.sales.map((row) => canonicalDailyBranch(row.branch)),
    ...input.booking.map((row) => canonicalDailyBranch(row.branch)),
    ...input.stock.map((row) => canonicalDailyBranch(row.branch)),
  ].filter(Boolean))].sort();

  const scopedSales = getEngineUnitSalesRows(eligibleSales).filter((row) => branchMatches(row.branch));
  const todaySales = scopedSales.filter((row) => dateKey(row.date) === asOfDate);
  const mtdSales = scopedSales.filter((row) =>
    row.year === year
    && row.month === month
    && dateKey(row.date) <= asOfDate,
  );
  const branchSales = unitsBy(mtdSales, (row) => canonicalDailyBranch(row.branch), salesTransactionQuantity);
  const salespersonSales = unitsBy(mtdSales, (row) => row.salesperson, salesTransactionQuantity);

  const scopedBooking = eligibleBooking.filter((row) => branchMatches(row.branch));
  const todayBooking = scopedBooking.filter((row) => dateKey(row.date) === asOfDate);
  const activeBooking = getOpenBookingRows(scopedBooking as BookingRow[]);
  const purchaseStatus = (value: string) => value.trim().toUpperCase().replace(/\s+/g, " ");

  const scopedStock = eligibleStock.filter((row) => branchMatches(row.branch));
  const currentStock = getCurrentStockRows(scopedStock as StockRow[]);
  const engineStock = getStockUnitRows(scopedStock as StockRow[]);
  const stockValueRows = currentStock.filter((row) => Number.isFinite(Number(row.msrp)));
  const branchStock = unitsBy(engineStock, (row) => canonicalDailyBranch(row.branch) || "Unassigned", () => 1);
  const agingOrder = ["0–30", "31–60", "61–90", ">90", "Unknown"] as const;
  const aging = agingOrder.map((label) => ({
    label,
    units: engineStock.filter((row) => agingLabel(row.ageDays ?? null) === label).length,
  }));

  const bookingByModel = unitsBy(
    activeBooking,
    (row) => canonicalDailyModel(row.model) || row.productType || "Unknown model",
    () => 1,
  );
  const stockByModel = unitsBy(
    engineStock,
    (row) => canonicalDailyModel(row.model) || normalizeProductType(row),
    () => 1,
  );
  const modelNames = [...new Set([
    ...bookingByModel.map((item) => item.name),
    ...stockByModel.map((item) => item.name),
  ])];
  const bookingStock = modelNames.map((model) => {
    const activeBookingUnits = bookingByModel.find((item) => item.name === model)?.units ?? 0;
    const stockUnits = stockByModel.find((item) => item.name === model)?.units ?? 0;
    const coverageMonths = activeBookingUnits > 0 ? stockUnits / activeBookingUnits : null;
    const signal = activeBookingUnits === 0
      ? "unknown" as const
      : coverageMonths !== null && coverageMonths < 1
        ? "shortage" as const
        : coverageMonths !== null && coverageMonths > 3
          ? "high" as const
          : "balanced" as const;
    return { model, activeBooking: activeBookingUnits, stock: stockUnits, coverageMonths, signal };
  }).sort((left, right) =>
    Math.max(right.activeBooking, right.stock) - Math.max(left.activeBooking, left.stock)
    || left.model.localeCompare(right.model),
  );

  return {
    asOfDate,
    scope: { branch },
    sourceDates: { sales: salesLatestDate, booking: bookingLatestDate, stock: stockLatestDate },
    availableBranches,
    sales: {
      todayUnits: todaySales.reduce((total, row) => total + salesTransactionQuantity(row), 0),
      mtdUnits: mtdSales.reduce((total, row) => total + salesTransactionQuantity(row), 0),
      today: todaySales.map((row) => ({
        date: row.date,
        branch: canonicalDailyBranch(row.branch),
        salesperson: row.salesperson || "Unassigned",
        model: canonicalDailyModel(row.model || row.modelCode),
        quantity: salesTransactionQuantity(row),
      })),
      byBranch: branchSales.map(({ name, units }) => ({ branch: name, units })),
      bySalesperson: salespersonSales.map(({ name, units }) => ({ salesperson: name, units })),
      topSalespeople: salespersonSales.slice(0, 5).map(({ name, units }) => ({ salesperson: name, units })),
    },
    target: null,
    booking: {
      newToday: todayBooking.length,
      activeUnits: activeBooking.length,
      aHot: activeBooking.filter((row) => purchaseStatus(row.purchaseStatus ?? "") === "A HOT").length,
      bHot: activeBooking.filter((row) => purchaseStatus(row.purchaseStatus ?? "") === "B HOT").length,
      cHot: activeBooking.filter((row) => purchaseStatus(row.purchaseStatus ?? "") === "C HOT").length,
      today: todayBooking.map((row) => ({
        date: row.date,
        branch: canonicalDailyBranch(row.branch),
        salesperson: row.salesperson || "Unassigned",
        model: canonicalDailyModel(row.model || row.productType),
        purchaseStatus: purchaseStatus(row.purchaseStatus ?? "") || "Unclassified",
      })),
    },
    stock: {
      engineUnits: engineStock.length,
      value: stockValueRows.length ? getStockValue(scopedStock as StockRow[]) : null,
      byBranch: branchStock.map(({ name, units }) => ({ branch: name, units })),
      aging,
    },
    bookingStock: bookingStock.slice(0, 8),
    availability: {
      target: unavailable("Branch and salesperson targets are not persisted in D1."),
      bookingLifecycle: unavailable("Approval and delivery workflow stages are not persisted as canonical lifecycle events."),
      cancelReason: unavailable("Booking remark and cancellation reason are not persisted in D1."),
      stockLocation: unavailable("The source Location column is not persisted in stock_transactions."),
      actions: unavailable("Action owner, assignment and completion state are not implemented in Phase 1."),
      notes: unavailable("Daily management notes do not yet have a governed persistence model."),
    },
  };
}

export function attachApprovedTarget(
  snapshot: DailyManagementSnapshot,
  target: ApprovedTarget | null,
  currentDate: string,
): DailyManagementSnapshot {
  if (!target || snapshot.scope.branch) {
    return {
      ...snapshot,
      availability: {
        ...snapshot.availability,
        target: unavailable(snapshot.scope.branch
          ? "Approved branch targets are not available."
          : "No approved company monthly target is available for this period."),
      },
    };
  }
  const period = calendarMonth(snapshot.asOfDate);
  const evaluationEligible = snapshot.asOfDate === period.end
    && canEvaluateFullPeriodTarget(period, currentDate);
  const progress = evaluationEligible
    ? targetProgress(snapshot.sales.mtdUnits, target.target)
    : null;
  return {
    ...snapshot,
    target: {
      monthlyUnits: target.target,
      source: target.source,
      sourceVersion: target.sourceVersion,
      effectiveFrom: target.effectiveFrom,
      evaluationEligible,
      achievementPercent: progress?.achievementPercent ?? null,
      gap: progress?.gap ?? null,
    },
    availability: {
      ...snapshot.availability,
      target: { available: true, reason: null },
    },
  };
}
