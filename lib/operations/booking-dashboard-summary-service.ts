import { BOOKING_PRODUCTS, isHotBooking, normalizeBookingProduct } from "../dashboard/booking-selectors";
import { buildMonthlyLifecycle } from "../../components/common/charts/chartData";

export type BookingDashboardBucket = {
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  productType: string;
  purchaseStatus: string;
  status: string;
  count: number;
  value: number;
  deposit: number;
};

export type BookingDashboardFilters = { year?: string[]; month?: string[]; branch?: string[]; salesperson?: string[] };

export type BookingDashboardSummary = {
  filters: { year: string[]; month: string[]; branch: string[]; salesperson: string[] };
  kpis: { unit: number; value: number; deposit: number };
  byProduct: Array<{ product: string; unit: number; value: number; deposit: number }>;
  lifecycle: ReturnType<typeof buildMonthlyLifecycle>;
  recentBookings: Array<{ date: string; branch: string; salesperson: string; productType: string; model: string; status: string }>;
  rowCount: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function selectedMonths(filters: BookingDashboardFilters) {
  return (filters.month ?? []).map((month) => MONTHS.indexOf(month) + 1).filter((month) => month > 0);
}

function matches(bucket: BookingDashboardBucket, filters: BookingDashboardFilters) {
  const years = (filters.year ?? []).map(Number).filter(Number.isFinite);
  const months = selectedMonths(filters);
  return (!years.length || (bucket.year !== null && years.includes(bucket.year)))
    && (!months.length || (bucket.month !== null && months.includes(bucket.month)))
    && (!(filters.branch?.length) || filters.branch.includes(bucket.branch))
    && (!(filters.salesperson?.length) || filters.salesperson.includes(bucket.salesperson));
}

function isHot(bucket: BookingDashboardBucket) {
  return isHotBooking({ purchaseStatus: bucket.purchaseStatus } as Parameters<typeof isHotBooking>[0]);
}

export function getBookingDashboardSummary(
  buckets: BookingDashboardBucket[],
  filters: BookingDashboardFilters,
  availableFilters: BookingDashboardSummary["filters"],
  recentBookings: BookingDashboardSummary["recentBookings"],
): BookingDashboardSummary {
  const scoped = buckets.filter((bucket) => matches(bucket, filters));
  const hot = scoped.filter(isHot);
  const lifecycleBuckets = buckets.filter((bucket) => matches(bucket, { ...filters, year: [], month: [] }));
  const lifecycleRows = lifecycleBuckets.flatMap((bucket) => Array.from({ length: bucket.count }, () => ({ year: bucket.year, month: bucket.month, status: bucket.status })));
  return {
    filters: availableFilters,
    kpis: {
      unit: hot.reduce((total, bucket) => total + bucket.count, 0),
      value: hot.reduce((total, bucket) => total + bucket.value, 0),
      deposit: hot.reduce((total, bucket) => total + bucket.deposit, 0),
    },
    byProduct: BOOKING_PRODUCTS.map((product) => {
      const productBuckets = hot.filter((bucket) => normalizeBookingProduct(bucket.productType) === product);
      return {
        product,
        unit: productBuckets.reduce((total, bucket) => total + bucket.count, 0),
        value: productBuckets.reduce((total, bucket) => total + bucket.value, 0),
        deposit: productBuckets.reduce((total, bucket) => total + bucket.deposit, 0),
      };
    }),
    lifecycle: buildMonthlyLifecycle(lifecycleRows),
    recentBookings,
    rowCount: buckets.reduce((total, bucket) => total + bucket.count, 0),
  };
}
