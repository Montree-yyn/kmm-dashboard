"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { MultiSelectFilter } from "../design-system/data-controls";
import { FreshnessIndicator } from "../design-system/freshness-indicator";
import { PageHeader } from "../design-system/page-header";
import { SectionHeader } from "../design-system/section-header";
import { ResponsiveDataTable } from "../design-system/responsive-data-table";
import {
  HeatmapMatrix,
  LollipopChart,
  PercentStackedBar,
  StackedColumnChart,
  type RankedDatum,
} from "../common/charts/AnalyticalCharts";
import { buildMonthlyLifecycle, businessStatusColor } from "../common/charts/chartData";
import { loadLiveOperationalData } from "../../lib/operations/client";
import { getOperationalBusiness } from "../../lib/operations/business-service";
import { asOfDate } from "../../lib/operations/as-of";
import { canonicalModelName } from "../../lib/dashboard/model-normalization";
import { useLocale } from "../../src/hooks/useLocale";
import { useCompany } from "../../src/hooks/useCompany";
// Legacy QA fallback contract remains available through fetch("/dashboard-data.json").
// Legacy parity expression retained: getOpenBookingUnit(data.booking, filters).
// Legacy parity expressions retained: getBookingValue(data.booking, filters); getDepositAmount(data.booking, filters); getBookingConversionRate(data.booking, filters).
// getAverageBookingAge is a live call below, measured against the server-supplied asOf date.
import {
  PRODUCT_GROUPS,
  productCategory,
} from "../../lib/dashboard/product-groups";
import {
  bookingAge,
  bookingMatchesFilters,
  getAverageBookingAge,
  getBookingRows,
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
  asOf: string;
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
    surface: "border-[var(--status-warning-bg)] bg-[var(--status-warning-bg)]",
  },
  {
    range: "61–90 Days",
    tone: "text-[var(--status-warning)]",
    surface: "border-[var(--status-warning-bg)] bg-[var(--status-warning-bg)]",
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
function age(row: Booking, asOf: Date) {
  return bookingAge(row, asOf);
}
function risk(row: Booking, asOf: Date) {
  const days = age(row, asOf);
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

type BranchRiskItem = {
  branch: string;
  open: number;
  critical: number;
  value: number;
  averageAge: number | null;
  conversion: number | null;
};

function BranchRiskComparison({ items, currency, branchNames }: { items: BranchRiskItem[]; currency: string; branchNames: Record<string, string> }) {
  const { t } = useLocale();
  const maxOpen = Math.max(...items.map((item) => item.open), 1);

  if (!items.length) {
    return <p className="py-10 text-center text-sm text-[var(--text-secondary)]">{t("common.empty")}</p>;
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] text-[var(--text-tertiary)]" aria-label="Chart legend">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--chart-current)]" aria-hidden="true" />{t("metric.bookingUnit")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--status-danger)]" aria-hidden="true" />{t("status.critical")} &gt;90 {t("common.days")}</span>
      </div>
      <div className="hidden min-w-0 grid-cols-[minmax(130px,1fr)_minmax(150px,1.35fr)_minmax(52px,0.42fr)_minmax(58px,0.48fr)_minmax(68px,0.58fr)] gap-3 border-b border-[var(--divider)] pb-2 text-[10px] font-semibold uppercase tracking-[0.035em] text-[var(--text-tertiary)] xl:grid">
        <span className="min-w-0">{t("filter.branch")}</span><span className="min-w-0">{t("metric.bookingUnit")}</span><span className="min-w-0 text-right">{t("status.critical")}</span><span className="min-w-0 text-right">{t("common.averageAge")}</span><span className="min-w-0 text-right">{t("common.conversion")}</span>
      </div>
      <div className="divide-y divide-[var(--divider)]">
        {items.map((item) => {
          const criticalShare = item.open ? (item.critical / item.open) * 100 : 0;
          const totalWidth = (item.open / maxOpen) * 100;
          return (
            <div key={item.branch} className="grid min-w-0 gap-3 py-4 xl:grid-cols-[minmax(130px,1fr)_minmax(150px,1.35fr)_minmax(52px,0.42fr)_minmax(58px,0.48fr)_minmax(68px,0.58fr)] xl:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.branch} <span className="font-normal text-[var(--text-tertiary)]">{branchNames[item.branch] ?? "Returned branch"}</span></p>
                <p className="kmm-tabular mt-1 text-[11px] text-[var(--text-tertiary)]">{t("dashboard.bookingValue")} {compact(item.value)} {currency}</p>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs xl:hidden"><span className="text-[var(--text-secondary)]">{t("metric.bookingUnit")}</span><strong className="kmm-tabular">{item.open.toLocaleString()}</strong></div>
                <div className="relative h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div className="relative h-full min-w-[2px] rounded-full bg-[var(--chart-current)]" style={{ width: `${totalWidth}%` }}>
                    {item.critical > 0 && <span className="absolute inset-y-0 right-0 bg-[var(--status-danger)]" style={{ width: `${criticalShare}%` }} aria-hidden="true" />}
                  </div>
                </div>
                <p className="kmm-tabular mt-1 hidden text-right text-[11px] font-semibold text-[var(--text-primary)] xl:block">{item.open.toLocaleString()} {t("common.units")}</p>
              </div>
              <div className="grid min-w-0 grid-cols-3 gap-3 text-xs xl:contents">
                <div className="min-w-0"><span className="block text-[var(--text-tertiary)] xl:hidden">{t("status.critical")}</span><strong className="kmm-tabular mt-0.5 block text-[var(--status-danger)] xl:text-right">{item.critical.toLocaleString()}</strong></div>
                <div className="min-w-0"><span className="block text-[var(--text-tertiary)] xl:hidden">{t("common.averageAge")}</span><strong className="kmm-tabular mt-0.5 block text-[var(--text-primary)] xl:text-right">{item.averageAge === null ? "N/A" : `${item.averageAge} ${t("common.days")}`}</strong></div>
                <div className="min-w-0"><span className="block text-[var(--text-tertiary)] xl:hidden">{t("common.conversion")}</span><strong className="kmm-tabular mt-0.5 block text-[var(--text-primary)] xl:text-right">{item.conversion === null ? "N/A" : `${item.conversion.toFixed(1)}%`}</strong></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type BookingBreakdownKey = "product" | "model" | "salesperson" | "payment";

function BookingBreakdownExplorer({
  datasets,
}: {
  datasets: Record<BookingBreakdownKey, RankedDatum[]>;
}) {
  const { t } = useLocale();
  const [active, setActive] = useState<BookingBreakdownKey>("product");
  const options: { id: BookingBreakdownKey; label: string }[] = [
    { id: "product", label: t("filter.productGroup") },
    { id: "model", label: t("common.model") },
    { id: "salesperson", label: t("filter.salesperson") },
    { id: "payment", label: t("common.payment") },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Choose booking breakdown">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={active === option.id}
            onClick={() => setActive(option.id)}
            className={
              active === option.id
                ? "min-h-11 rounded-[var(--radius-control)] bg-[var(--text-primary)] px-3 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                : "min-h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      <LollipopChart items={datasets[active]} limit={5} suffix={` ${t("common.units")}`} />
    </div>
  );
}

export function BookingIntelligencePage() {
  const { t } = useLocale();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? "";
  const companyCode = selectedCompany?.code ?? "KMM";
  const currency = selectedCompany?.currency ?? "MMK";
  const branchNames = Object.fromEntries(
    (selectedCompany?.branches ?? []).map((branch) => [branch.code, branch.name]),
  );
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filters, setFilters] = useState<Filters>(initial),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  // Booking age is measured against the server's company-timezone "business
  // today" (data.asOf). The placeholder Date only applies while data is null
  // (loading/error), when no rows are derived from it.
  const asOf = data ? asOfDate(data.asOf) : new Date();
  const load = useCallback((showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    loadLiveOperationalData({ companyId })
      .then((value) => setData({ meta: { sourceUpdatedAt: new Date().toISOString(), sources: ["Cloudflare D1"] }, asOf: value.asOf, booking: value.booking }))
      .catch(() => setError("Booking data could not be loaded."))
      .finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => {
    const id = window.setTimeout(() => load(false), 0);
    const refresh = () => void load(false);
    window.addEventListener("kmm:sales-imported", refresh);
    return () => { window.clearTimeout(id); window.removeEventListener("kmm:sales-imported", refresh); };
  }, [load]);
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
  const operationalBusiness = data ? getOperationalBusiness(data.booking, [], filters, { asOf }).booking : null;
  const bookingUnit = operationalBusiness?.unit ?? 0;
  const bookingValue = operationalBusiness?.value ?? 0;
  const depositReceived = operationalBusiness?.deposit ?? 0;
  const averageBookingAge = data ? getAverageBookingAge(data.booking, filters, asOf) : null;
  const bookingConversionRate = operationalBusiness?.conversionRate ?? null;
  const bookingByProduct = data
    ? getOperationalBusiness(data.booking, [], filters, { asOf }).booking.byProduct
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
    const items = open.filter((row) => risk(row, asOf) === label);
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
  const statusBreakdown = group(
    rows.filter(isUnitProduct),
    (row) => row.status || "Status unavailable",
  );
  const lifecycle = buildMonthlyLifecycle(
    data?.booking
      .filter((row) => match(row, { ...filters, status: [] }))
      .filter(isUnitProduct) ?? [],
  );
  const displayStatus = (label: string) => {
    const normalized = label.trim().toLowerCase();
    if (normalized === "open") return t("status.open");
    if (normalized === "delivered" || normalized.includes("complete")) return t("status.delivered");
    if (normalized === "cancelled" || normalized === "canceled") return t("status.cancelled");
    return label;
  };
  const statusSegments = statusBreakdown.map((item, index) => ({
    id: item.label,
    label: displayStatus(item.label),
    value: item.rows.length,
    color: businessStatusColor(item.label, index),
  }));
  const breakdownDatasets: Record<BookingBreakdownKey, RankedDatum[]> = {
    product: product.map((item) => ({
      label: item.label,
      value: item.metric ?? 0,
    })),
    model: models.map((item) => ({ label: item.label, value: item.rows.length })),
    salesperson: people.map((item) => ({
      label: item.label,
      value: item.rows.length,
    })),
    payment: payments.map((item) => ({
      label: item.label,
      value: item.rows.length,
    })),
  };
  const bookingAgingHeatmap = group(
    open,
    (row) => canonicalModelName(row.model) || "Unknown model",
  ).map((item) => ({
    label: item.label,
    values: ["Healthy", "Watch", "At Risk", "Critical"].map(
      (bucket) => item.rows.filter((row) => risk(row, asOf) === bucket).length,
    ),
  }));
  const branchRisk = options.branch
    .map((branch) => {
      const openRows = open.filter((row) => row.branch === branch);
      const branchRows = rows.filter((row) => row.branch === branch && isUnitProduct(row));
      const delivered = branchRows.filter((row) => row.status === "Delivered").length;
      return {
        branch,
        open: openRows.length,
        critical: openRows.filter((row) => risk(row, asOf) === "Critical").length,
        value: openValue.filter((row) => row.branch === branch).reduce((sum, row) => sum + priceOf(row), 0),
        averageAge: openRows.length ? Math.round(openRows.reduce((sum, row) => sum + age(row, asOf), 0) / openRows.length) : null,
        conversion: branchRows.length ? (delivered / branchRows.length) * 100 : null,
      } satisfies BranchRiskItem;
    })
    .sort((left, right) => right.critical - left.critical || right.open - left.open);
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
      `Booking Value (${currency})`,
      `Deposit (${currency})`,
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
        String(age(r, asOf)),
        risk(r, asOf),
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
    link.download = `${companyCode.toLowerCase()}-booking-detail.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="kmm-booking-page min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6">
          <div className="space-y-5 xl:space-y-6">
            <PageHeader
              eyebrow={companyCode}
              title={t("route.booking.title")}
              description={t("route.booking.subtitle").replaceAll("KMM", companyCode)}
              action={data ? <FreshnessIndicator /> : undefined}
            />
            <section aria-label="Booking filters">
              <FilterBar
                filterGridClassName="min-w-0 sm:grid-cols-2 xl:grid-cols-4"
                ariaLabel={t("common.filters")}
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
                      {t("common.reset")}
                    </Button>
                    <Button
                      className="h-11 rounded-[var(--radius-control-lg)] bg-[var(--brand-500)] px-4 text-[var(--text-primary)] hover:bg-[var(--brand-400)]"
                      onClick={exportRows}
                    >
                      <Download size={16} />
                      {t("common.export")}
                    </Button>
                  </>
                }
              >
                    <MultiSelectFilter
                      label={t("filter.year")}
                      options={options.year}
                      values={filters.year}
                      onChange={(v) => update("year", v)}
                    />
                    <MultiSelectFilter
                      label={t("filter.month")}
                      options={options.month}
                      values={filters.month}
                      onChange={(v) => update("month", v)}
                    />
                    <MultiSelectFilter
                      label={t("filter.branch")}
                      options={options.branch}
                      values={filters.branch}
                      onChange={(v) => update("branch", v)}
                    />
                    <MultiSelectFilter
                      label={t("filter.bookingStatus")}
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
                    title={t("metric.bookingUnit")}
                    value={bookingUnit}
                    unit={t("common.units")}
                  />
                  <KpiCard
                    variant="executive"
                    title={t("metric.bookingValue")}
                    value={compact(bookingValue)}
                    unit={currency}
                  />
                  <KpiCard
                    variant="executive"
                    title={t("metric.depositReceived")}
                    value={compact(depositReceived)}
                    unit={currency}
                  />
                  <KpiCard
                    variant="executive"
                    title={t("metric.averageBookingAge")}
                    value={
                      averageBookingAge === null
                        ? "N/A"
                        : Math.round(averageBookingAge)
                    }
                    unit={averageBookingAge === null ? "" : t("common.days")}
                  />
                  <KpiCard
                    variant="executive"
                    title={t("metric.bookingConversionRate")}
                    value={
                      bookingConversionRate === null
                        ? "N/A"
                        : `${bookingConversionRate.toFixed(1)}%`
                    }
                    unit=""
                    subtitle={t("booking.toDelivered")}
                  />
                </section>
                <section className="space-y-4" aria-labelledby="booking-observed-pipeline">
                  <div id="booking-observed-pipeline">
                    <SectionHeader
                      title={t("section.bookingPipeline")}
                      description={t("section.bookingPipelineDescription")}
                    />
                  </div>
                  <ChartCard
                    title={t("chart.bookingHealthTitle")}
                    subtitle={t("chart.bookingHealthDescription")}
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
                          {agingPresentation[i].range.replace(" Days", "")} {t("common.days")} · {[t("status.healthy"), t("status.watch"), t("status.atRisk"), t("status.critical")][i]}
                        </p>
                        <p className="kmm-tabular mt-3 text-2xl font-semibold text-[var(--text-primary)]">
                          {item.rows.length}{" "}
                          <span className="text-xs font-medium text-[var(--text-secondary)]">
                            {t("common.units")}
                          </span>
                        </p>
                        <p className="kmm-tabular mt-2 text-xs text-[var(--text-secondary)]">
                          {compact(item.value)} {currency} ·{" "}
                          {open.length
                            ? ((item.rows.length / open.length) * 100).toFixed(
                                1,
                              )
                            : "0.0"}
                          %
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          {t("booking.depositNotSplit")}
                        </p>
                      </div>
                    ))}
                  </div>
                  </ChartCard>
                  <ChartCard
                    title={t("chart.bookingLifecycleTitle")}
                    subtitle={t("chart.bookingLifecycleDescription")}
                    className={chartCardClass}
                  >
                    <StackedColumnChart
                      labels={lifecycle.labels}
                      series={lifecycle.series.map((item) => ({ ...item, label: displayStatus(item.label) }))}
                      unit={t("common.records")}
                    />
                  </ChartCard>
                <section className="grid gap-5 xl:grid-cols-[0.9fr_2.1fr]">
                  <ChartCard
                    title={t("chart.bookingStatusTitle")}
                    subtitle={t("chart.bookingStatusDescription")}
                    className={chartCardClass}
                  >
                    <PercentStackedBar segments={statusSegments} />
                  </ChartCard>
                  <ChartCard
                    title={t("chart.branchBookingRiskTitle")}
                    subtitle={t("chart.branchBookingRiskDescription")}
                    className={chartCardClass}
                  >
                    <BranchRiskComparison items={branchRisk} currency={currency} branchNames={branchNames} />
                  </ChartCard>
                </section>
                </section>
                <section className="space-y-4" aria-labelledby="booking-secondary-analysis">
                  <div id="booking-secondary-analysis">
                    <SectionHeader
                      title={t("section.secondaryAnalysis")}
                      description={t("section.bookingSecondaryDescription")}
                    />
                  </div>
                  <section className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
                    <ChartCard
                      title={t("chart.bookingBreakdownTitle")}
                      subtitle={t("chart.bookingBreakdownDescription")}
                      className={chartCardClass}
                    >
                      <BookingBreakdownExplorer datasets={breakdownDatasets} />
                    </ChartCard>
                    <ChartCard
                      title={t("chart.bookingAgingMatrixTitle")}
                      subtitle={t("chart.bookingAgingMatrixDescription")}
                      className={chartCardClass}
                    >
                      <HeatmapMatrix
                        columns={["0–30", "31–60", "61–90", ">90"]}
                        rows={bookingAgingHeatmap}
                        categoryLabel={t("common.model")}
                        lowerLabel={t("common.lowerConcentration")}
                        higherLabel={t("common.higherConcentration")}
                      />
                    </ChartCard>
                  </section>
                <ChartCard
                  title={t("chart.managementFollowUpTitle")}
                  subtitle={t("chart.managementFollowUpDescription")}
                  className={chartCardClass}
                >
                  <div className="space-y-3">
                    {open
                      .filter((r) => age(r, asOf) > 90)
                      .sort((a, b) => age(b, asOf) - age(a, asOf))
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
                            {age(r, asOf)} {t("common.days")} · {t("booking.escalate")}
                          </span>
                        </div>
                      ))}
                    {!open.some((r) => age(r, asOf) > 90) && (
                      <p className="text-sm text-[var(--text-secondary)]">
                        {t("booking.noCriticalFollowUp")}
                      </p>
                    )}
                  </div>
                </ChartCard>
                </section>
                <TableCard
                  title={t("booking.detailTitle")}
                  className="min-w-0"
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
                              {age(r, asOf)}
                            </td>
                            <td className="px-3 py-3">{r.status}</td>
                            <td className="px-3 py-3">
                              {r.statusDate || "N/A"}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={
                                  risk(r, asOf) === "Critical"
                                    ? "font-semibold text-[var(--status-danger)]"
                                    : risk(r, asOf) === "At Risk"
                                      ? "text-[#C45E12]"
                                      : "text-[var(--text-secondary)]"
                                }
                              >
                                {risk(r, asOf)}
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
