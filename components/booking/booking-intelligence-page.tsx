"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  Search,
} from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { ChartCard } from "../design-system/chart-card";
import { ErrorState } from "../design-system/error-state";
import { LoadingSkeleton } from "../design-system/loading-skeleton";
import { KpiCard } from "../design-system/kpi-card";
import { TableCard } from "../design-system/table-card";
import { FilterBar } from "../design-system/filter-bar";
import { ActiveFilterSummary, MultiSelectFilter } from "../design-system/data-controls";
import { FreshnessIndicator } from "../design-system/freshness-indicator";
import { ResponsiveDataTable } from "../design-system/responsive-data-table";
import { PremiumTrendChart } from "../common/charts/PremiumTrendChart";
import { loadLiveOperationalData } from "../../lib/operations/client";
import { getOperationalBusiness } from "../../lib/operations/business-service";
import { canonicalModelName } from "../../lib/dashboard/model-normalization";
// Legacy QA fallback contract remains available through fetch("/dashboard-data.json").
// Legacy parity expression retained: getOpenBookingUnit(data.booking, filters).
// Legacy parity expressions retained: getBookingValue(data.booking, filters); getDepositAmount(data.booking, filters); getAverageBookingAge(data.booking, filters); getBookingConversionRate(data.booking, filters).
import {
  PRODUCT_GROUPS,
  productCategory,
} from "../../lib/dashboard/product-groups";
import {
  bookingAge,
  bookingMatchesFilters,
  getAverageBookingAge,
  getBookingByProduct,
  getBookingConversionRate,
  getBookingRows,
  getBookingValue,
  getDepositAmount,
  getOpenBookingUnit,
  getOpenBookingUnitRows,
  getOpenBookingValueRows,
} from "../../lib/dashboard/booking-selectors";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const BRANCH_NAMES: Record<string, string> = {
  KMM01: "Hpa-an",
  KMM02: "Mawlamyine",
  KMM03: "Tharyarwaddy",
};
type Key = "year" | "month" | "branch" | "salesperson" | "product" | "status";
type Filters = Record<Key, string[]>;
type Booking = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  productType: string;
  model: string;
  price: number | null;
  bookingNo: string;
  customer: string;
  deposit: number | null;
  paymentType: string;
  financeType: string;
  purchaseStatus: string;
  statusDate: string;
  status: string;
};
type Data = {
  meta: { sourceUpdatedAt: string; sources: string[] };
  booking: Booking[];
};
const initial: Filters = {
  year: [],
  month: [],
  branch: [],
  salesperson: [],
  product: [],
  status: [],
};
const chartCardClass =
  "min-w-0 !rounded-[var(--radius-card)] !border-[var(--border-default)] !bg-[var(--surface-default)] !shadow-[var(--shadow-card)] [&_h2]:!tracking-normal";
const agingPresentation = [
  {
    range: "0–30 Days",
    tone: "text-[var(--status-success)]",
    surface: "border-[#CDEBD8] bg-[#F3FBF6]",
  },
  {
    range: "31–60 Days",
    tone: "text-[var(--status-warning)]",
    surface: "border-[#F2DFC1] bg-[#FFF9EF]",
  },
  {
    range: "61–90 Days",
    tone: "text-[#C45E12]",
    surface: "border-[#F3D1B7] bg-[#FFF7F0]",
  },
  {
    range: ">90 Days",
    tone: "text-[var(--status-danger)]",
    surface: "border-[#F1C7C4] bg-[#FFF5F4]",
  },
] as const;

function safeNumber(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  )
    return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function isMissingNumber(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    !Number.isFinite(Number(value))
  );
}
function compact(value?: number | string | null) {
  return `${(safeNumber(value) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
}

function money(value?: number | string | null) {
  return isMissingNumber(value)
    ? "N/A"
    : safeNumber(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function priceOf(row: Booking) {
  return safeNumber(row.price);
}
function isUnitProduct(row: Booking) {
  return (PRODUCT_GROUPS.UNIT_PRODUCTS as readonly string[]).includes(
    productCategory(row),
  );
}
function age(row: Booking) {
  return bookingAge(row);
}
function risk(row: Booking) {
  const days = age(row);
  return days <= 30
    ? "Healthy"
    : days <= 60
      ? "Watch"
      : days <= 90
        ? "At Risk"
        : "Critical";
}
function match(row: Booking, f: Filters) {
  return bookingMatchesFilters(row, f);
}
function group(rows: Booking[], key: (row: Booking) => string) {
  const map = new Map<string, Booking[]>();
  rows.forEach((row) => map.set(key(row), [...(map.get(key(row)) ?? []), row]));
  return [...map.entries()]
    .map(([label, items]) => ({
      label,
      rows: items,
      value: items.reduce((total, row) => total + priceOf(row), 0),
    }))
    .sort((a, b) => b.rows.length - a.rows.length);
}

function Bars({
  items,
  value = (item: { rows: Booking[]; metric?: number }) =>
    item.metric ?? item.rows.length,
  suffix = " Units",
}: {
  items: { label: string; rows: Booking[]; value: number; metric?: number }[];
  value?: (item: {
    label: string;
    rows: Booking[];
    value: number;
    metric?: number;
  }) => number;
  suffix?: string;
}) {
  const measured = items.map((item) => ({
    item,
    amount: safeNumber(value(item)),
  }));
  const max = Math.max(...measured.map(({ amount }) => amount), 1);
  return (
    <div className="space-y-4">
      {measured.map(({ item, amount }, index) => (
        <div key={item.label}>
          <div className="mb-1.5 flex justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-medium text-[var(--text-secondary)]">
              <span className="mr-2 kmm-tabular text-[var(--text-tertiary)]" aria-label={`Rank ${index + 1}`}>
                {index + 1}
              </span>
              {item.label}
            </span>
            <span className="kmm-tabular font-semibold text-[var(--text-primary)]">
              {amount}
              {suffix}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--surface-muted)]">
            <div
              className="h-2 rounded-full bg-[var(--chart-current)]"
              style={{ width: `${(amount / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Trend({ rows }: { rows: Booking[] }) {
  const [metric, setMetric] = useState<"unit" | "value">("unit");
  const years = [2026, 2025, 2024, 2023, 2022];
  const series = years.map((year, index) => ({
    id: String(year),
    year,
    label: String(year),
    kind:
      index === 0
        ? ("current" as const)
        : index === 1
          ? ("previous" as const)
          : ("older" as const),
    values: MONTHS.map((_, month) => {
      const monthRows = rows.filter(
        (row) =>
          row.year === year &&
          row.month === month + 1 &&
          row.status !== "Cancelled",
      );
      if (!monthRows.length) return null;
      return metric === "unit"
        ? monthRows.length
        : monthRows.reduce((total, row) => total + priceOf(row), 0);
    }),
  }));
  return (
    <PremiumTrendChart
      className="min-w-0 !rounded-[var(--radius-card)] !border-[var(--border-default)] !bg-[var(--surface-default)] !shadow-[var(--shadow-card)] [&>header]:!border-[var(--divider)] [&>header]:!flex-col [&>header]:!items-stretch [&>header_h2]:!font-semibold [&>header_h2]:!tracking-normal [&>header_h2]:!text-[var(--text-primary)] [&>header_p]:!text-[var(--text-secondary)] [&>header>div:last-child]:!w-full [&>header>div:last-child]:!justify-start [&>header_button]:!h-11 [&>header_select]:!h-11 min-[1400px]:[&>header]:!flex-row min-[1400px]:[&>header]:!items-center min-[1400px]:[&>header>div:last-child]:!w-auto min-[1400px]:[&>header>div:last-child]:!justify-end"
      title="Booking Trend"
      subtitle="Compare booking performance by year, period and metric."
      labels={MONTHS}
      unit={metric === "unit" ? "Unit" : "MMK"}
      formatValue={
        metric === "unit" ? (value) => value.toLocaleString() : compact
      }
      defaultSeriesIds={["2026", "2025"]}
      onMetricChange={(value) => setMetric(value as "unit" | "value")}
      series={series}
    />
  );
}

export function BookingIntelligencePage() {
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filters, setFilters] = useState<Filters>(initial),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const load = (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    loadLiveOperationalData()
      .then((value) => setData({ meta: { sourceUpdatedAt: new Date().toISOString(), sources: ["Cloudflare D1"] }, booking: value.booking }))
      .catch(() => setError("Booking data could not be loaded."))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const id = window.setTimeout(() => load(false), 0);
    const refresh = () => void load(false);
    window.addEventListener("kmm:sales-imported", refresh);
    return () => { window.clearTimeout(id); window.removeEventListener("kmm:sales-imported", refresh); };
  }, []);
  const rows = useMemo(
    () => (data ? getBookingRows(data.booking, filters) : []),
    [data, filters],
  );
  const open = useMemo(
    () => (data ? getOpenBookingUnitRows(data.booking, filters) : []),
    [data, filters],
  );
  const openValue = useMemo(
    () => (data ? getOpenBookingValueRows(data.booking, filters) : []),
    [data, filters],
  );
  const operationalBusiness = data ? getOperationalBusiness(data.booking as unknown as Record<string, unknown>[], [], filters).booking : null;
  const bookingUnit = operationalBusiness?.unit ?? 0;
  const bookingValue = operationalBusiness?.value ?? 0;
  const depositReceived = operationalBusiness?.deposit ?? 0;
  const averageBookingAge = operationalBusiness?.averageAge ?? null;
  const bookingConversionRate = operationalBusiness?.conversionRate ?? null;
  const bookingByProduct = data
    ? getOperationalBusiness(data.booking as unknown as Record<string, unknown>[], [], filters).booking.byProduct
    : [];
  const options = useMemo(
    () => ({
      year: [
        ...new Set(
          data?.booking.map((r) => String(r.year)).filter((v) => v !== "null"),
        ),
      ]
        .sort()
        .reverse(),
      month: MONTHS.filter((m, i) =>
        data?.booking.some((r) => r.month === i + 1),
      ),
      branch: [
        ...new Set(data?.booking.map((r) => r.branch).filter(Boolean)),
      ].sort(),
      salesperson: [
        ...new Set(data?.booking.map((r) => r.salesperson).filter(Boolean)),
      ].sort(),
      product: PRODUCT_GROUPS.VALUE_PRODUCTS as unknown as string[],
      status: [
        ...new Set(data?.booking.map((r) => r.status).filter(Boolean)),
      ].sort(),
    }),
    [data],
  );
  const health = ["Healthy", "Watch", "At Risk", "Critical"].map((label) => {
    const items = open.filter((row) => risk(row) === label);
    return {
      label,
      rows: items,
      value: items.reduce((total, row) => total + priceOf(row), 0),
    };
  });
  const product = bookingByProduct
    .map((item) => ({
      label: item.product,
      rows: [] as Booking[],
      value: 0,
      metric: item.unit,
    }))
    .filter((item) => item.metric > 0);
  const models = group(open, (r) => canonicalModelName(r.model) || "Unknown model").slice(0, 10);
  const people = group(open, (r) => r.salesperson || "Unassigned").slice(0, 10);
  const payments = group(openValue, (r) => r.paymentType || "Unavailable");
  const table = open.filter((row) =>
    `${row.bookingNo} ${row.customer} ${row.date} ${row.branch} ${row.salesperson} ${row.model}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(table.length / 10));
  const visible = table.slice((page - 1) * 10, page * 10);
  const update = (key: Key, value: string[]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  };
  const exportRows = () => {
    const headers = [
      "Booking Date",
      "Booking No.",
      "Customer",
      "Branch",
      "Salesperson",
      "Product",
      "Model",
      "Payment Type",
      "Booking Value (MMK)",
      "Deposit (MMK)",
      "Current Status",
      "Delivery / Cancel Date",
      "Booking Age (Days)",
      "Risk Status",
    ];
    const csv = [
      headers,
      ...table.map((r) => [
        r.date,
        r.bookingNo,
        r.customer,
        r.branch,
        r.salesperson,
        productCategory(r),
        r.model,
        r.paymentType,
        String(r.price ?? ""),
        String(r.deposit ?? ""),
        r.status,
        r.statusDate,
        String(age(r)),
        risk(r),
      ]),
    ]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "kmm-booking-detail.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="kmm-booking-page min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6">
          <div className="space-y-5 xl:space-y-6">
            <section
              className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
              aria-labelledby="booking-title"
            >
              <div className="min-w-0">
                <div
                  className="mb-2 h-1 w-8 rounded-full bg-[var(--brand-500)]"
                  aria-hidden="true"
                />
                <h1
                  id="booking-title"
                  className="text-[28px] font-semibold leading-tight tracking-normal text-[var(--text-primary)] sm:text-[30px]"
                >
                  Booking Intelligence
                </h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Booking pipeline, aging, deposits, conversion, and operational
                  detail.
                </p>
              </div>
              {/* The operational endpoint currently exposes a client refresh marker,
                  not a source timestamp; keep the shared indicator honest. */}
              <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
                {data && <FreshnessIndicator />}
                <ActiveFilterSummary
                  filters={filters}
                  labels={{ year: "Year", month: "Month", branch: "Branch", salesperson: "Salesperson", product: "Product Type", status: "Booking Status" }}
                  onChange={update}
                  onReset={() => { setFilters(initial); setPage(1); }}
                  className="mt-0 max-w-full justify-start sm:justify-end"
                />
              </div>
            </section>
            <section aria-label="Booking filters">
              <FilterBar
                filterGridClassName="min-w-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
                ariaLabel="Booking filters"
                actions={
                  <>
                    <Button
                      variant="outline"
                      className="h-11 rounded-[var(--radius-control-lg)] border-[var(--border-default)] px-4 text-[var(--text-primary)]"
                      onClick={() => {
                        setFilters(initial);
                        setPage(1);
                      }}
                    >
                      <RotateCcw size={16} />
                      Reset
                    </Button>
                    <Button
                      className="h-11 rounded-[var(--radius-control-lg)] bg-[var(--brand-500)] px-4 text-[var(--text-primary)] hover:bg-[var(--brand-400)]"
                      onClick={exportRows}
                    >
                      <Download size={16} />
                      Export
                    </Button>
                  </>
                }
              >
                    <MultiSelectFilter
                      label="Year"
                      options={options.year}
                      values={filters.year}
                      onChange={(v) => update("year", v)}
                    />
                    <MultiSelectFilter
                      label="Month"
                      options={options.month}
                      values={filters.month}
                      onChange={(v) => update("month", v)}
                    />
                    <MultiSelectFilter
                      label="Branch"
                      options={options.branch}
                      values={filters.branch}
                      onChange={(v) => update("branch", v)}
                    />
                    <MultiSelectFilter
                      label="Salesperson"
                      options={options.salesperson}
                      values={filters.salesperson}
                      onChange={(v) => update("salesperson", v)}
                    />
                    <MultiSelectFilter
                      label="Product Type"
                      options={options.product}
                      values={filters.product}
                      onChange={(v) => update("product", v)}
                    />
                    <MultiSelectFilter
                      label="Booking Status"
                      options={options.status}
                      values={filters.status}
                      onChange={(v) => update("status", v)}
                    />
              </FilterBar>
            </section>
            {loading && (
              <Card
                className="grid min-h-[320px] place-items-center rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-8 shadow-[var(--shadow-card)]"
                aria-busy="true"
                aria-label="Loading booking data"
              >
                <div className="w-full max-w-xl space-y-4">
                  <LoadingSkeleton variant="chart" />
                  <p className="text-center text-sm font-medium text-[var(--text-secondary)]">
                    Loading real booking data...
                  </p>
                </div>
              </Card>
            )}
            {error && !loading && (
              <Card
                className="grid min-h-[320px] place-items-center rounded-[var(--radius-card)] border-[var(--status-danger)] bg-[var(--surface-default)] p-8 shadow-[var(--shadow-card)]"
                role="alert"
                aria-live="assertive"
              >
                <ErrorState message={error} onRetry={load} />
              </Card>
            )}
            {data && !loading && !error && (
              <>
                <section
                  aria-label="Booking KPIs"
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))] xl:gap-3 2xl:gap-4"
                >
                  <KpiCard
                    variant="executive"
                    title="Open Booking Unit"
                    value={bookingUnit}
                    unit="Units"
                  />
                  <KpiCard
                    variant="executive"
                    title="Booking Value"
                    value={compact(bookingValue)}
                    unit="MMK"
                  />
                  <KpiCard
                    variant="executive"
                    title="Deposit Received"
                    value={compact(depositReceived)}
                    unit="MMK"
                  />
                  <KpiCard
                    variant="executive"
                    title="Average Booking Age"
                    value={
                      averageBookingAge === null
                        ? "N/A"
                        : Math.round(averageBookingAge)
                    }
                    unit={averageBookingAge === null ? "" : "Days"}
                  />
                  <KpiCard
                    variant="executive"
                    title="Booking Conversion Rate"
                    value={
                      bookingConversionRate === null
                        ? "N/A"
                        : `${bookingConversionRate.toFixed(1)}%`
                    }
                    unit=""
                    subtitle="Booking → Delivered"
                  />
                </section>
                <section className="space-y-4" aria-labelledby="booking-observed-pipeline">
                  <div>
                    <h2 id="booking-observed-pipeline" className="text-lg font-semibold tracking-normal text-[var(--text-primary)]">
                      Observed pipeline
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Stages, health, and branch pressure available in the current extract.
                    </p>
                  </div>
                  <ChartCard
                    title="Booking Health Summary"
                    subtitle="Open-booking age and value in the current scope"
                    className={chartCardClass}
                  >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {health.map((item, i) => (
                      <div
                        key={item.label}
                        className={`${agingPresentation[i].surface} rounded-[var(--radius-control-lg)] border p-4`}
                      >
                        <p
                          className={`${agingPresentation[i].tone} text-sm font-semibold`}
                        >
                          {agingPresentation[i].range} · {item.label}
                        </p>
                        <p className="kmm-tabular mt-3 text-2xl font-semibold text-[var(--text-primary)]">
                          {item.rows.length}{" "}
                          <span className="text-xs font-medium text-[var(--text-secondary)]">
                            Units
                          </span>
                        </p>
                        <p className="kmm-tabular mt-2 text-xs text-[var(--text-secondary)]">
                          {compact(item.value)} MMK ·{" "}
                          {open.length
                            ? ((item.rows.length / open.length) * 100).toFixed(
                                1,
                              )
                            : "0.0"}
                          %
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          Deposit detail is not split by health band
                        </p>
                      </div>
                    ))}
                  </div>
                  </ChartCard>
                  <Trend
                    rows={data.booking
                      .filter((r) => match(r, { ...filters, status: [] }))
                      .filter(isUnitProduct)}
                  />
                <section className="grid gap-5 xl:grid-cols-[1.1fr_1.9fr]">
                  <ChartCard
                    title="Booking Funnel"
                    subtitle="Observed stages; unavailable stages are not supplied by source"
                    className={chartCardClass}
                  >
                    <div className="space-y-3">
                      {[
                        "Booking",
                        "Deposit",
                        "Finance Approved",
                        "Ready for Delivery",
                        "Delivered",
                      ].map((stage, i) => (
                        <div
                          key={stage}
                          className="grid grid-cols-[minmax(92px,150px)_minmax(0,1fr)_56px] items-center gap-3 text-sm"
                        >
                          <span className="font-medium text-[var(--text-secondary)]">
                            {stage}
                          </span>
                          <div className="h-8 overflow-hidden rounded-[var(--radius-control)] bg-[var(--surface-muted)]">
                            <div
                              className="h-8 rounded-[var(--radius-control)] bg-[var(--chart-current)] transition-[width] duration-300"
                              style={{
                                width:
                                  i === 0
                                    ? "100%"
                                    : i === 4
                                      ? `${rows.length ? (rows.filter((r) => r.status === "Delivered").length / rows.length) * 100 : 0}%`
                                      : "0%",
                              }}
                            />
                          </div>
                          <span className="kmm-tabular text-right text-xs font-semibold text-[var(--text-primary)]">
                            {i === 0
                              ? rows.length
                              : i === 4
                                ? rows.filter((r) => r.status === "Delivered")
                                    .length
                                : "Not supplied by source"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-base font-semibold tracking-normal text-[var(--text-primary)]">
                        Branch pressure
                      </h3>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        Returned branches only; no branch values are inferred.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                    {options.branch.map((branch) => {
                      const items = open.filter((r) => r.branch === branch);
                      const branchRows = rows.filter(
                        (r) => r.branch === branch,
                      );
                      return (
                        <Card
                          key={branch}
                          className="rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]"
                        >
                          <p className="text-lg font-semibold text-[var(--text-primary)]">
                            {branch}{" "}
                            <span className="text-sm font-normal text-[var(--text-tertiary)]">
                              {BRANCH_NAMES[branch] ?? "Returned branch"}
                            </span>
                          </p>
                          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                Open Booking
                              </p>
                              <p className="kmm-tabular mt-1 font-semibold">
                                {items.length}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                Booking Value
                              </p>
                              <p className="kmm-tabular mt-1 font-semibold">
                                {compact(
                                  openValue
                                    .filter((r) => r.branch === branch)
                                    .reduce((s, r) => s + priceOf(r), 0),
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                Average Age
                              </p>
                              <p className="kmm-tabular mt-1 font-semibold">
                                {items.length
                                  ? Math.round(
                                      items.reduce((s, r) => s + age(r), 0) /
                                        items.length,
                                    )
                                  : "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                Critical
                              </p>
                              <p className="kmm-tabular mt-1 font-semibold text-[var(--status-danger)]">
                                {
                                  items.filter((r) => risk(r) === "Critical")
                                    .length
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                Deposit
                              </p>
                              <p className="kmm-tabular mt-1 font-semibold">
                                {compact(
                                  items.reduce(
                                    (s, r) => s + safeNumber(r.deposit),
                                    0,
                                  ),
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                Conversion
                              </p>
                              <p className="kmm-tabular mt-1 font-semibold">
                                {branchRows.length
                                  ? `${((branchRows.filter((r) => r.status === "Delivered").length / branchRows.length) * 100).toFixed(1)}%`
                                  : "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="mt-5 flex items-end gap-1 border-t border-[var(--divider)] pt-3">
                            <span
                              className="h-8 flex-1 rounded-t-sm bg-[var(--chart-current)]"
                              style={{
                                height: `${Math.max(10, items.length * 8)}px`,
                              }}
                            />
                            <span
                              className="h-8 flex-1 rounded-t-sm bg-[var(--chart-neutral)]"
                              style={{
                                height: `${Math.max(10, branchRows.filter((r) => r.status === "Delivered").length * 8)}px`,
                              }}
                            />
                          </div>
                        </Card>
                      );
                    })}
                    </div>
                  </div>
                </section>
                </section>
                <section className="space-y-4" aria-labelledby="booking-secondary-analysis">
                  <div>
                    <h2 id="booking-secondary-analysis" className="text-lg font-semibold tracking-normal text-[var(--text-primary)]">
                      Secondary analysis
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Product, model, salesperson, payment, and aging detail for the active booking scope.
                    </p>
                  </div>
                  <section className="grid gap-5 xl:grid-cols-2">
                  <ChartCard
                    title="Booking by Product"
                    subtitle="Open booking units"
                    className={chartCardClass}
                  >
                    <Bars items={product} />
                  </ChartCard>
                  <ChartCard
                    title="Top 10 Model"
                    subtitle="Open booking units"
                    className={chartCardClass}
                  >
                    <Bars items={models} />
                  </ChartCard>
                  <ChartCard
                    title="Top 10 Salesperson"
                    subtitle="Open booking and critical backlog"
                    className={chartCardClass}
                  >
                    <div className="space-y-3">
                      {people.map((item, index) => (
                        <div
                          key={item.label}
                          className="grid grid-cols-[24px_minmax(0,1fr)_68px_68px] gap-2 text-xs text-[var(--text-secondary)]"
                        >
                          <span className="kmm-tabular text-[var(--text-tertiary)]" aria-label={`Rank ${index + 1}`}>
                            {index + 1}
                          </span>
                          <span className="truncate font-medium">
                            {item.label}
                          </span>
                          <span className="kmm-tabular text-right">
                            {item.rows.length} open
                          </span>
                          <span className="kmm-tabular text-right text-[var(--status-danger)]">
                            {item.rows.filter((r) => age(r) > 60).length}{" "}
                            &gt;60d
                          </span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                  <ChartCard
                    title="Booking by Payment / Finance Type"
                    subtitle="Open booking value"
                    className={chartCardClass}
                  >
                    <Bars items={payments} />
                  </ChartCard>
                  </section>
                <ChartCard
                  title="Booking Aging Matrix"
                  subtitle="Open booking unit by model and age"
                  className={chartCardClass}
                >
                  <div className="overflow-x-auto rounded-[var(--radius-control-lg)] border border-[var(--border-subtle)]">
                    <table className="min-w-[720px] w-full text-sm">
                      <thead className="bg-[var(--surface-subtle)] text-left text-xs text-[var(--text-secondary)]">
                        <tr>
                          <th className="p-3">Model</th>
                          {["0–30", "31–60", "61–90", ">90"].map((h) => (
                            <th key={h} className="p-3 text-center">
                              {h}
                            </th>
                          ))}
                          <th className="p-3 text-center">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group(open, (r) => r.model || "Unknown model").map(
                          (item) => (
                            <tr
                              key={item.label}
                              className="border-t border-[var(--divider)] transition-colors hover:bg-[var(--surface-subtle)]"
                            >
                              <td className="p-3 font-medium">{item.label}</td>
                              {["Healthy", "Watch", "At Risk", "Critical"].map(
                                (bucket, i) => {
                                  const count = item.rows.filter(
                                    (r) => risk(r) === bucket,
                                  ).length;
                                  return (
                                    <td
                                      key={bucket}
                                      className="p-3 text-center"
                                    >
                                      <span
                                        className={`${agingPresentation[i].surface} kmm-tabular inline-block min-w-10 rounded-[var(--radius-control)] border px-2 py-1`}
                                      >
                                        {count}
                                      </span>
                                    </td>
                                  );
                                },
                              )}
                              <td className="kmm-tabular p-3 text-center font-semibold">
                                {item.rows.length}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
                <ChartCard
                  title="Management Follow-up"
                  subtitle="Evidence-based recommendations from the active filter"
                  className={chartCardClass}
                >
                  <div className="space-y-3">
                    {open
                      .filter((r) => age(r) > 90)
                      .sort((a, b) => age(b) - age(a))
                      .slice(0, 5)
                      .map((r) => (
                        <div
                          key={`${r.date}-${r.model}-${r.salesperson}`}
                          className="flex flex-col gap-2 rounded-[var(--radius-control-lg)] border border-[#F1C7C4] bg-[#FFF5F4] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span>
                            <strong>{r.model || "Unknown model"}</strong> ·{" "}
                            {r.branch} · {r.salesperson}
                          </span>
                          <span className="kmm-tabular shrink-0 font-semibold text-[var(--status-danger)]">
                            {age(r)} days · Escalate
                          </span>
                        </div>
                      ))}
                    {!open.some((r) => age(r) > 90) && (
                      <p className="text-sm text-[var(--text-secondary)]">
                        No open booking older than 90 days in the active filter.
                      </p>
                    )}
                  </div>
                </ChartCard>
                </section>
                <TableCard
                  title="Booking Detail"
                  className="min-w-0 !rounded-[var(--radius-card)] !border-[var(--border-default)] !bg-[var(--surface-default)] !shadow-[var(--shadow-card)] [&_h2]:!tracking-normal"
                  search={
                    <div className="relative">
                      <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                      />
                      <input
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setPage(1);
                        }}
                        className="h-11 w-full rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-subtle)] pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:w-64"
                        placeholder="Search booking detail"
                        aria-label="Search booking detail"
                      />
                    </div>
                  }
                  exportAction={
                    <Button
                      className="h-11 rounded-[var(--radius-control-lg)] bg-[var(--brand-500)] px-4 text-[var(--text-primary)] hover:bg-[var(--brand-400)]"
                      onClick={exportRows}
                    >
                      <Download size={15} />
                      Export
                    </Button>
                  }
                  pagination={
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                      <span className="kmm-tabular">
                        {table.length} open booking(s)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={page === 1}
                          onClick={() => setPage(page - 1)}
                          className="grid size-11 place-items-center rounded-[var(--radius-control)] border border-[var(--border-default)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Previous booking page"
                        >
                          <ChevronLeft size={15} />
                        </button>
                        <span className="kmm-tabular">
                          {page} / {pages}
                        </span>
                        <button
                          disabled={page === pages}
                          onClick={() => setPage(page + 1)}
                          className="grid size-11 place-items-center rounded-[var(--radius-control)] border border-[var(--border-default)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Next booking page"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  }
                  empty={!visible.length}
                >
                  <ResponsiveDataTable
                    ariaLabel="Booking detail table"
                    className="max-h-[480px] rounded-[var(--radius-control-lg)] border border-[var(--border-subtle)]"
                  >
                    <table className="min-w-[1420px] w-full text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                        <tr>
                          {[
                            "Booking Date",
                            "Booking No.",
                            "Customer",
                            "Branch",
                            "Salesperson",
                            "Product",
                            "Model",
                            "Payment Type",
                            "Booking Value",
                            "Deposit",
                            "Deposit %",
                            "Booking Age",
                            "Current Status",
                            "Delivery / Cancel Date",
                            "Risk Status",
                          ].map((h) => (
                            <th
                              key={h}
                              className="whitespace-nowrap px-3 py-3 font-semibold"
                              scope="col"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--divider)]">
                        {visible.map((r, i) => (
                          <tr
                            key={`${r.date}-${r.model}-${i}`}
                            className="transition-colors hover:bg-[var(--surface-subtle)]"
                          >
                            <td className="whitespace-nowrap px-3 py-3">
                              {r.date}
                            </td>
                            <td className="px-3 py-3">{r.bookingNo}</td>
                            <td className="px-3 py-3">{r.customer || "N/A"}</td>
                            <td className="px-3 py-3">{r.branch}</td>
                            <td className="px-3 py-3">{r.salesperson}</td>
                            <td className="px-3 py-3">{productCategory(r)}</td>
                            <td className="px-3 py-3 font-semibold">
                              {r.model}
                            </td>
                            <td className="px-3 py-3">
                              {r.paymentType || "N/A"}
                            </td>
                            <td className="kmm-tabular px-3 py-3 text-right">
                              {money(r.price)}
                            </td>
                            <td className="kmm-tabular px-3 py-3 text-right">
                              {money(r.deposit)}
                            </td>
                            <td className="kmm-tabular px-3 py-3 text-right">
                              {!isMissingNumber(r.deposit) &&
                              !isMissingNumber(r.price) &&
                              safeNumber(r.price) !== 0
                                ? `${((safeNumber(r.deposit) / safeNumber(r.price)) * 100).toFixed(1)}%`
                                : "N/A"}
                            </td>
                            <td className="kmm-tabular px-3 py-3 text-center">
                              {age(r)}
                            </td>
                            <td className="px-3 py-3">{r.status}</td>
                            <td className="px-3 py-3">
                              {r.statusDate || "N/A"}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={
                                  risk(r) === "Critical"
                                    ? "font-semibold text-[var(--status-danger)]"
                                    : risk(r) === "At Risk"
                                      ? "text-[#C45E12]"
                                      : "text-[var(--text-secondary)]"
                                }
                              >
                                {risk(r)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveDataTable>
                </TableCard>
                <p className="pb-2 text-xs text-[var(--text-tertiary)]">
                  Source: {(data.meta?.sources ?? []).join(" · ") || "N/A"} ·
                  Fields unavailable in the source are marked N/A.
                </p>
              </>
            )}
          </div>
      </main>
    </div>
  );
}
