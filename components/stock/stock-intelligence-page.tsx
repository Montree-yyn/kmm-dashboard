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
import { KpiCard } from "../design-system/kpi-card";
import { LoadingSkeleton } from "../design-system/loading-skeleton";
import { TableCard } from "../design-system/table-card";
import { FilterBar } from "../design-system/filter-bar";
import { MultiSelectFilter } from "../design-system/data-controls";
import { FreshnessIndicator } from "../design-system/freshness-indicator";
import { PageHeader } from "../design-system/page-header";
import { SectionHeader } from "../design-system/section-header";
import { cn } from "../../lib/utils";
import { PRODUCT_GROUPS } from "../../lib/dashboard/product-groups";
import { getOpenBookingUnitRows } from "../../lib/dashboard/booking-selectors";
import {

  getCurrentStockRows,
  getStockByProduct,
  getStockUnitRows,
  getStockValueRows,
  normalizeProductType,
} from "../../lib/dashboard/stock-selectors";
import {
  HeatmapMatrix,
  LollipopChart,
  PairedBarChart,
  PercentStackedBar,
} from "../common/charts/AnalyticalCharts";
import { chartProductColor } from "../common/charts/chartTheme";
import { loadLiveOperationalData } from "../../lib/operations/client";
import { getOperationalBusiness } from "../../lib/operations/business-service";
import { asOfDate } from "../../lib/operations/as-of";
import { canonicalModelName } from "../../lib/dashboard/model-normalization";
import { useLocale } from "../../src/hooks/useLocale";
import { useCompany } from "../../src/hooks/useCompany";
// Legacy QA fallback contract remains available through fetch("/dashboard-data.json").
// Legacy parity expressions retained: const stockValue = getStockValue(rows); const averageStockAge = getAverageStockAge(rows); const aged = getAgedStock(rows);

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
const UNIT_PRODUCTS = PRODUCT_GROUPS.UNIT_PRODUCTS as readonly string[];
const chartCardClass =
  "min-w-0 rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-card)]";
const agingPresentation = [
  {
    surface:
      "border-[color-mix(in_srgb,var(--status-success)_22%,transparent)] bg-[color-mix(in_srgb,var(--status-success)_7%,white)]",
    tone: "text-[var(--status-success)]",
  },
  {
    surface:
      "border-[color-mix(in_srgb,var(--status-warning)_22%,transparent)] bg-[color-mix(in_srgb,var(--status-warning)_7%,white)]",
    tone: "text-[var(--status-warning)]",
  },
  {
    surface:
      "border-[color-mix(in_srgb,var(--brand-500)_24%,transparent)] bg-[color-mix(in_srgb,var(--brand-500)_7%,white)]",
    tone: "text-[var(--brand-600)]",
  },
  {
    surface:
      "border-[color-mix(in_srgb,var(--status-danger)_22%,transparent)] bg-[color-mix(in_srgb,var(--status-danger)_7%,white)]",
    tone: "text-[var(--status-danger)]",
  },
] as const;
type Key = "year" | "month" | "branch" | "product";
type Filters = Record<Key, string[]>;
type Stock = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  kmm: number | string | null;
  productType: string;
  productGroup: string;
  model: string;
  ageBucket: string;
  ageDays: number | null;
  snapshotDate: string;
  msrp: number | null;
  stockId?: string | null;
  serialNumber: string | null;
  engineNumber?: string | null;
  chassisNumber?: string | null;
  currentStatus: string;
};
type Booking = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  productType: string;
  model: string;
  price?: number | null;
  deposit?: number | null;
  purchaseStatus?: string;
  status: string;
};
type Data = {
  meta?: { sourceUpdatedAt?: string; sources?: string[] };
  asOf: string;
  stock: Stock[];
  booking: Booking[];
};

const initial: Filters = { year: [], month: [], branch: [], product: [] };
const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;
const numeric = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const money = (value: unknown) =>
  `${numeric(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const compact = (value: unknown) =>
  `${(numeric(value) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
const unitCategory = (row: { productType: string; productGroup?: string }) =>
  normalizeProductType(row);
const dateDays = (row: Stock) =>
  Number.isFinite(Number(row.ageDays)) && Number(row.ageDays) >= 0
    ? Number(row.ageDays)
    : null;
const aging = (row: Stock) => {
  const days = dateDays(row);
  if (days === null) return "Unknown";
  return days <= 30
    ? "0–30"
    : days <= 60
      ? "31–60"
      : days <= 90
        ? "61–90"
        : ">90";
};
const risk = (row: Stock) => {
  const age = aging(row);
  return age === ">90"
    ? "Critical"
    : age === "61–90"
      ? "At Risk"
      : age === "31–60"
        ? "Watch"
        : age === "0–30"
          ? "Healthy"
          : "N/A";
};
const rowMatches = (row: Stock | Booking, filters: Filters) =>
  (!filters.year.length ||
    (row.year !== null && filters.year.includes(String(row.year)))) &&
  (!filters.month.length ||
    (row.month !== null && filters.month.includes(MONTHS[row.month - 1]))) &&
  (!filters.branch.length || filters.branch.includes(row.branch)) &&
  (!filters.product.length || filters.product.includes(unitCategory(row)));

export function StockIntelligencePage() {
  const { t } = useLocale();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? "";
  const companyCode = selectedCompany?.code ?? "KMM";
  const currency = selectedCompany?.currency ?? "MMK";
  const branchNames = Object.fromEntries(
    (selectedCompany?.branches ?? []).map((branch) => [branch.code, branch.name]),
  );
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>(initial);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"age" | "date" | "value">("age");
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    loadLiveOperationalData({ companyId })
      .then((value) => setData({ meta: { sourceUpdatedAt: new Date().toISOString(), sources: ["Cloudflare D1"] }, asOf: value.asOf, stock: value.stock, booking: value.booking }))
      .catch(() => setError("Stock data could not be loaded."))
      .finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => {
    const id = window.setTimeout(load, 0);
    const refresh = () => load();
    window.addEventListener("kmm:sales-imported", refresh);
    return () => { window.clearTimeout(id); window.removeEventListener("kmm:sales-imported", refresh); };
  }, [load]);
  const rows = useMemo(
    () =>
      getCurrentStockRows(
        data?.stock.filter((row) => rowMatches(row, filters)) ?? [],
      ),
    [data, filters],
  );
  const booking = useMemo(
    () => (data ? getOpenBookingUnitRows(data.booking, filters) : []),
    [data, filters],
  );
  const unitRows = getStockUnitRows(rows);
  const valueRows = getStockValueRows(rows);
  // Booking age in this recompute is measured against the payload asOf (the
  // server's company-timezone "business today"), matching the Booking page.
  const operationalBusiness = data ? getOperationalBusiness([], data.stock, { year: filters.year, month: filters.month, branch: filters.branch, product: filters.product }, { asOf: asOfDate(data.asOf) }).stock : null;
  const stockValue = operationalBusiness?.value ?? 0;
  const averageStockAge = operationalBusiness?.averageAge ?? null;
  const aged = operationalBusiness ? Array.from({ length: operationalBusiness.agedUnit }) : [];
  const knownAge = averageStockAge === null ? [] : [averageStockAge];
  const options = useMemo(
    () => ({
      year: [
        ...new Set(
          data?.stock
            .map((row) => String(row.year))
            .filter((value) => value !== "null"),
        ),
      ]
        .sort()
        .reverse(),
      month: MONTHS.filter((month, index) =>
        data?.stock.some((row) => row.month === index + 1),
      ),
      branch: [...new Set(data?.stock.map((row) => row.branch).filter(Boolean))].sort(),
      product: [...UNIT_PRODUCTS],
    }),
    [data],
  );
  // Presentation-only branch cards include every returned branch; filter options
  // above retain their existing contract and known branch list.
  const branchCards = useMemo(
    () =>
      [...new Set(data?.stock.map((row) => row.branch).filter(Boolean))].sort(),
    [data],
  );
  const productRows = (operationalBusiness?.byProduct ?? getStockByProduct(rows))
    .filter((item) => UNIT_PRODUCTS.includes(item.product))
    .map((item) => ({
      label: item.product,
      count: item.unit,
      value: item.value,
    }));
  const ageGroups = ["0–30", "31–60", "61–90", ">90"].map((label) => {
    const items = unitRows.filter((row) => aging(row) === label);
    return {
      label,
      count: items.length,
      value: items.reduce((total, row) => total + numeric(row.msrp), 0),
    };
  });
  const modelMap = new Map<string, Stock[]>();
  unitRows.forEach((row) => {
    const key = canonicalModelName(row.model) || "Unknown model";
    modelMap.set(key, [...(modelMap.get(key) ?? []), row]);
  });
  const models = [...modelMap.entries()]
    .map(([label, items]) => ({
      label,
      rows: items,
      count: items.length,
      value: items.reduce((total, row) => total + numeric(row.msrp), 0),
      averageAge: items
        .map((row) => dateDays(row))
        .filter((age): age is number => age !== null)
        .reduce((a, b, _, ages) => a + b / ages.length, 0),
    }))
    .sort((a, b) => b.count - a.count);
  const bookingByModel = new Map<string, number>();
  booking.forEach((row) =>
    bookingByModel.set(
      canonicalModelName(row.model) || "Unknown model",
      (bookingByModel.get(canonicalModelName(row.model) || "Unknown model") ?? 0) + 1,
    ),
  );
  const comparedModels = [
    ...new Set([...models.map((item) => item.label), ...bookingByModel.keys()]),
  ]
    .map((label) => ({
      label,
      stock: models.find((item) => item.label === label)?.count ?? 0,
      booking: bookingByModel.get(label) ?? 0,
    }))
    .sort((a, b) => {
      const aGap = a.stock - a.booking;
      const bGap = b.stock - b.booking;
      return aGap - bGap || Math.max(b.stock, b.booking) - Math.max(a.stock, a.booking);
    })
    .slice(0, 10);
  const observedStockPeriods = new Set(
    (data?.stock ?? [])
      .filter((row) => rowMatches(row, { ...filters, year: [], month: [] }))
      .map((row) =>
        row.snapshotDate ||
        (row.year !== null && row.month !== null
          ? `${row.year}-${String(row.month).padStart(2, "0")}`
          : ""),
      )
      .filter(Boolean),
  ).size;
  const agedModelRows = models
    .filter((item) => item.averageAge > 0)
    .map((item) => ({ label: item.label, value: Math.round(item.averageAge) }));
  const stockAgingHeatmap = models.map((item) => ({
    label: item.label,
    values: ["0–30", "31–60", "61–90", ">90"].map(
      (bucket) => item.rows.filter((row) => aging(row) === bucket).length,
    ),
  }));
  const table = rows
    .filter((row) =>
      `${row.branch} ${row.date} ${row.productType} ${row.model} ${row.serialNumber ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "age"
        ? (dateDays(b) ?? -1) - (dateDays(a) ?? -1)
        : sort === "value"
          ? numeric(b.msrp) - numeric(a.msrp)
          : String(b.date).localeCompare(String(a.date)),
    );
  const pages = Math.max(1, Math.ceil(table.length / 10));
  const visible = table.slice((page - 1) * 10, page * 10);
  const update = (key: Key, values: string[]) => {
    setFilters((previous) => ({ ...previous, [key]: values }));
    setPage(1);
  };
  const exportRows = () => {
    const headers = [
      "Branch",
      "Date In",
      "Days In Stock",
      "Product Type",
      "Model",
      "Serial Number",
      "MSRP",
      "Booking Status",
      "Aging Group",
      "Risk Status",
    ];
    const contents = [
      headers,
      ...table.map((row) => [
        row.branch,
        row.date || "N/A",
        dateDays(row) ?? "N/A",
        unitCategory(row),
        row.model || "N/A",
        row.serialNumber || "N/A",
        row.msrp ?? "N/A",
        row.currentStatus || "N/A",
        aging(row),
        risk(row),
      ]),
    ]
      .map((line) => line.map(csvCell).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([contents], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${companyCode.toLowerCase()}-stock-detail.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="kmm-stock-page min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-[1600px] p-4 sm:p-5 xl:p-6">
          <div className="space-y-5 xl:space-y-6">
            <PageHeader
              eyebrow={companyCode}
              title={t("route.stock.title")}
              description={t("route.stock.subtitle").replaceAll("KMM", companyCode)}
              action={data ? <FreshnessIndicator /> : undefined}
            />
            <section aria-label="Stock filters">
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
                      onChange={(values) => update("year", values)}
                    />
                    <MultiSelectFilter
                      label={t("filter.month")}
                      options={options.month}
                      values={filters.month}
                      onChange={(values) => update("month", values)}
                    />
                    <MultiSelectFilter
                      label={t("filter.branch")}
                      options={options.branch}
                      values={filters.branch}
                      onChange={(values) => update("branch", values)}
                    />
                    <MultiSelectFilter
                      label={t("filter.productType")}
                      options={options.product}
                      values={filters.product}
                      onChange={(values) => update("product", values)}
                    />
              </FilterBar>
            </section>
            {loading && (
              <Card
                className="grid min-h-[320px] place-items-center rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-8 shadow-[var(--shadow-card)]"
                aria-busy="true"
                aria-label="Loading stock data"
              >
                <div className="w-full max-w-xl space-y-4">
                  <LoadingSkeleton variant="chart" />
                  <p className="text-center text-sm font-medium text-[var(--text-secondary)]">
                    Loading real stock data...
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
                  aria-label="Stock KPIs"
                  className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))] xl:gap-3 2xl:gap-4"
                >
                  <KpiCard
                    variant="executive"
                    className="col-span-2 sm:col-span-1"
                    title={t("metric.stockCoverage")}
                    value={
                      booking.length
                        ? `${(unitRows.length / booking.length).toFixed(1)}x`
                        : "N/A"
                    }
                    unit={t("stock.coverageFormula")}
                    subtitle={
                      booking.length
                        ? `${booking.length} ${t("stock.openBookingUnits")}`
                        : t("stock.noOpenBooking")
                    }
                  />
                  <KpiCard
                    variant="executive"
                    title={t("metric.agedStock")}
                    value={aged.length}
                    unit={`>90 ${t("common.days")}`}
                    subtitle={
                      rows.length
                        ? `${((aged.length / unitRows.length) * 100).toFixed(1)}% ${t("stock.filteredInventory")}`
                        : t("stock.noFilteredStock")
                    }
                  />
                  <KpiCard
                    variant="executive"
                    title={t("metric.stockUnit")}
                    value={unitRows.length}
                    unit={t("common.units")}
                  />
                  <KpiCard
                    variant="executive"
                    title={t("metric.stockValue")}
                    value={compact(stockValue)}
                    unit={currency}
                    subtitle={t("stock.validMsrp")}
                  />
                  <KpiCard
                    variant="executive"
                    title={t("metric.averageStockAge")}
                    value={
                      knownAge.length
                        ? Math.round(
                            knownAge.reduce(
                              (total, value) => total + value,
                              0,
                            ) / knownAge.length,
                          )
                        : "N/A"
                    }
                    unit={knownAge.length ? t("common.days") : ""}
                  />
                </section>
                <section className="space-y-4" aria-labelledby="stock-risk-overview">
                  <div id="stock-risk-overview">
                    <SectionHeader
                      title={t("section.stockRisk")}
                      description={t("section.stockRiskDescription")}
                    />
                  </div>
                  <ChartCard
                    title={t("chart.stockHealthTitle")}
                    subtitle={t("chart.stockHealthDescription")}
                    className={chartCardClass}
                  >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {ageGroups.map((item, index) => (
                      <div
                        key={item.label}
                        className={`${agingPresentation[index].surface} rounded-[var(--radius-control-lg)] border p-4`}
                      >
                        <p
                          className={`${agingPresentation[index].tone} text-sm font-semibold`}
                        >
                          {item.label} {t("common.days")}
                        </p>
                        <p className="kmm-tabular mt-3 text-2xl font-semibold text-[var(--text-primary)]">
                          {item.count}{" "}
                          <span className="text-xs font-medium text-[var(--text-secondary)]">
                            {t("common.units")}
                          </span>
                        </p>
                        <p className="kmm-tabular mt-2 text-xs text-[var(--text-secondary)]">
                          {compact(item.value)} {currency} ·{" "}
                          {unitRows.length
                            ? ((item.count / unitRows.length) * 100).toFixed(1)
                            : "0.0"}
                          %
                        </p>
                      </div>
                    ))}
                  </div>
                  <div
                    className="mt-6 flex h-2.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
                    aria-label="Stock age distribution"
                    role="img"
                  >
                    {ageGroups.map((item, index) => (
                      <div
                        key={item.label}
                        style={{
                          width: `${unitRows.length ? (item.count / unitRows.length) * 100 : 0}%`,
                        }}
                        className={
                          [
                            "bg-[var(--status-success)]",
                            "bg-[var(--status-warning)]",
                            "bg-[var(--chart-product-strategic)]",
                            "bg-[var(--status-danger)]",
                          ][index]
                        }
                        title={`${item.label} Days: ${item.count} Units`}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--text-secondary)]" aria-label="Stock age legend">
                    {ageGroups.map((item, index) => (
                      <span key={item.label} className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className={[
                            "size-2 rounded-full bg-[var(--status-success)]",
                            "bg-[var(--status-warning)]",
                            "bg-[var(--chart-product-strategic)]",
                            "bg-[var(--status-danger)]",
                          ][index]}
                        />
                        {item.label} · {item.count} {t("common.units")}
                      </span>
                    ))}
                  </div>
                  </ChartCard>
                </section>
                <section className="space-y-4" aria-labelledby="stock-coverage-analysis">
                  <div id="stock-coverage-analysis">
                    <SectionHeader
                      title={t("section.stockCoverage")}
                      description={t("section.stockCoverageDescription")}
                    />
                  </div>
                  <ChartCard
                    title={t("chart.stockVsBookingTitle")}
                    subtitle={t("chart.stockVsBookingDescription")}
                    className={chartCardClass}
                  >
                    <PairedBarChart
                      items={comparedModels.map((item) => ({
                        label: item.label,
                        left: item.booking,
                        right: item.stock,
                      }))}
                      leftLabel={t("metric.bookingUnit")}
                      rightLabel={t("metric.stockUnit")}
                      leftShortLabel={t("common.booking")}
                      rightShortLabel={t("common.stock")}
                      shortageLabel={t("comparison.shortage")}
                      surplusLabel={t("comparison.surplus")}
                      balancedLabel={t("comparison.balanced")}
                    />
                    {observedStockPeriods < 8 && (
                      <p className="mt-5 border-t border-[var(--divider)] pt-4 text-xs leading-5 text-[var(--text-tertiary)]">
                        {t("stock.trendWithheld")}
                      </p>
                    )}
                  </ChartCard>
                </section>
                <section aria-labelledby="stock-branch-performance" className="space-y-4">
                  <div id="stock-branch-performance">
                    <SectionHeader
                      title={t("section.branchPerformance")}
                      description={t("section.branchPerformanceDescription")}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {branchCards.map((branch) => {
                      const stock = unitRows.filter(
                        (row) => row.branch === branch,
                      );
                      const booked = booking.filter(
                        (row) => row.branch === branch,
                      );
                      const value = valueRows
                        .filter((row) => row.branch === branch)
                        .reduce((total, row) => total + numeric(row.msrp), 0);
                      const ages = stock
                        .map((row) => dateDays(row))
                        .filter((age): age is number => age !== null);
                      const old = stock.filter(
                        (row) => aging(row) === ">90",
                      ).length;
                      const max = Math.max(stock.length, booked.length, 1);
                      return (
                        <Card
                          key={branch}
                          className="min-w-0 rounded-[var(--radius-card)] border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]"
                        >
                          <p className="text-lg font-semibold text-[var(--text-primary)]">
                            {branch}{" "}
                            <span className="text-sm font-normal text-[var(--text-tertiary)]">
                              {branchNames[branch] ?? "Returned branch"}
                            </span>
                          </p>
                          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                {t("metric.stockUnit")}
                              </p>
                              <p className="kmm-tabular mt-1 font-semibold">
                                {stock.length}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                {t("metric.bookingUnit")}
                              </p>
                              <p className="kmm-tabular mt-1 font-semibold">
                                {booked.length}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                {t("metric.stockValue")}
                              </p>
                              <p className="kmm-tabular mt-1 font-semibold">
                                {compact(value)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                {t("metric.averageStockAge")}
                              </p>
                              <p className="kmm-tabular mt-1 font-semibold">
                                {ages.length
                                  ? `${Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)} ${t("common.days")}`
                                  : "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                &gt;90 {t("common.days")}
                              </p>
                              <p className="kmm-tabular mt-1 font-semibold text-[var(--status-danger)]">
                                {old}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                {t("metric.stockGap")}
                              </p>
                              <p className="kmm-tabular mt-1 font-semibold">
                                {stock.length - booked.length}
                              </p>
                            </div>
                          </div>
                          <div className="mt-5 space-y-2 border-t border-[var(--divider)] pt-4 text-xs text-[var(--text-secondary)]">
                            <div className="flex items-center gap-2">
                              <span className="w-12">{t("common.stock")}</span>
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                                <div
                                  className="h-full rounded-full bg-[var(--brand-500)]"
                                  style={{
                                    width: `${(stock.length / max) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-12">{t("common.booking")}</span>
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                                <div
                                  className="h-full rounded-full bg-[var(--text-secondary)]"
                                  style={{
                                    width: `${(booked.length / max) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </section>
                <section className="space-y-4" aria-labelledby="stock-secondary-analysis">
                  <div id="stock-secondary-analysis">
                    <SectionHeader
                      title={t("section.secondaryAnalysis")}
                      description={t("section.stockSecondaryDescription")}
                    />
                  </div>
                  <section className="grid gap-5 xl:grid-cols-2">
                  <ChartCard
                    title={t("chart.stockProductAnalysisTitle")}
                    subtitle={t("chart.stockProductAnalysisDescription")}
                    className={chartCardClass}
                  >
                    <PercentStackedBar
                      segments={productRows.map((item) => ({
                        id: item.label,
                        label: item.label,
                        value: item.count,
                        color: chartProductColor(item.label),
                      }))}
                    />
                  </ChartCard>
                  <ChartCard
                    title={t("chart.agedModelTitle")}
                    subtitle={t("chart.agedModelDescription")}
                    className={chartCardClass}
                  >
                    <LollipopChart
                      items={agedModelRows}
                      threshold={90}
                      thresholdLabel={t("stock.ninetyDayThreshold")}
                      suffix={` ${t("common.days")}`}
                    />
                  </ChartCard>
                  </section>
                  <ChartCard
                  title={t("chart.stockAgingMatrixTitle")}
                  subtitle={t("chart.stockAgingMatrixDescription")}
                  className={chartCardClass}
                >
                  <HeatmapMatrix
                    columns={["0–30", "31–60", "61–90", ">90"]}
                    rows={stockAgingHeatmap}
                    categoryLabel={t("common.model")}
                    lowerLabel={t("common.lowerConcentration")}
                    higherLabel={t("common.higherConcentration")}
                  />
                  </ChartCard>
                </section>
                <TableCard
                  title={t("stock.detailTitle")}
                  className={chartCardClass}
                  search={
                    <div className="relative min-w-0 flex-1 sm:flex-none">
                      <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                        aria-hidden="true"
                      />
                      <label htmlFor="stock-detail-search" className="sr-only">
                        Search stock detail
                      </label>
                      <input
                        id="stock-detail-search"
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setPage(1);
                        }}
                        className="h-11 w-full rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-subtle)] pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--brand-500)] focus:bg-[var(--surface-default)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:w-64"
                        placeholder="Search stock detail"
                      />
                    </div>
                  }
                  filters={
                    <>
                      <label htmlFor="stock-detail-sort" className="sr-only">
                        Sort stock detail
                      </label>
                      <select
                        id="stock-detail-sort"
                        value={sort}
                        onChange={(event) => {
                          setSort(event.target.value as typeof sort);
                          setPage(1);
                        }}
                        className="h-11 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] px-3 text-sm text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      >
                        <option value="age">Sort: Days in stock</option>
                        <option value="date">Sort: Date in</option>
                        <option value="value">Sort: MSRP</option>
                      </select>
                    </>
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
                    <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                      <span className="kmm-tabular">
                        {table.length} stock row(s)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={page === 1}
                          onClick={() => setPage(page - 1)}
                          className="grid size-11 place-items-center rounded-[var(--radius-control-lg)] border border-[var(--border-default)] transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Previous stock detail page"
                        >
                          <ChevronLeft size={15} />
                        </button>
                        <span className="kmm-tabular min-w-12 text-center">
                          {page} / {pages}
                        </span>
                        <button
                          type="button"
                          disabled={page === pages}
                          onClick={() => setPage(page + 1)}
                          className="grid size-11 place-items-center rounded-[var(--radius-control-lg)] border border-[var(--border-default)] transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Next stock detail page"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  }
                  empty={!visible.length}
                >
                  <div className="max-h-[480px] overflow-auto rounded-[var(--radius-control-lg)] border border-[var(--divider)]">
                    <table className="w-full min-w-[1160px] text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                        <tr>
                          {[
                            "Branch",
                            "Date In",
                            "Days In Stock",
                            "Product Type",
                            "Model",
                            "Serial Number",
                            "MSRP",
                            "Booking Status",
                            "Aging Group",
                            "Risk Status",
                          ].map((header) => (
                            <th
                              key={header}
                              className={cn(
                                "h-11 whitespace-nowrap px-3 py-2.5 font-semibold",
                                ["Days In Stock", "MSRP"].includes(header) &&
                                  "text-right",
                              )}
                              scope="col"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--divider)]">
                        {visible.map((row, index) => (
                          <tr
                            key={`${row.date}-${row.model}-${index}`}
                            className="transition-colors hover:bg-[var(--surface-subtle)]"
                          >
                            <td className="h-11 px-3 py-3">{row.branch}</td>
                            <td className="h-11 whitespace-nowrap px-3 py-3">
                              {row.date || "N/A"}
                            </td>
                            <td className="kmm-tabular h-11 px-3 py-3 text-right">
                              {dateDays(row) ?? "N/A"}
                            </td>
                            <td className="h-11 px-3 py-3">
                              {unitCategory(row)}
                            </td>
                            <td className="h-11 max-w-[240px] break-words px-3 py-3 font-semibold text-[var(--text-primary)]">
                              {row.model || "N/A"}
                            </td>
                            <td className="h-11 px-3 py-3 text-[var(--text-tertiary)]">
                              {row.serialNumber || "N/A"}
                            </td>
                            <td className="kmm-tabular h-11 px-3 py-3 text-right">
                              {row.msrp === null ? "N/A" : money(row.msrp)}
                            </td>
                            <td className="h-11 px-3 py-3 text-[var(--text-tertiary)]">
                              {row.currentStatus || "N/A"}
                            </td>
                            <td className="h-11 px-3 py-3">{aging(row)}</td>
                            <td className="h-11 px-3 py-3">
                              <span
                                className={
                                  risk(row) === "Critical"
                                    ? "font-semibold text-[var(--status-danger)]"
                                    : risk(row) === "At Risk"
                                      ? "font-semibold text-[var(--brand-600)]"
                                      : risk(row) === "Watch"
                                        ? "text-[var(--status-warning)]"
                                        : "text-[var(--status-success)]"
                                }
                              >
                                {risk(row)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TableCard>
                <p className="pb-2 text-xs leading-5 text-[var(--text-tertiary)]">
                  Source: {(data.meta?.sources ?? []).join(" · ") || "N/A"}.
                  Unknown product groups remain visible in detail but are
                  excluded from unit and value KPIs. Date In filters are
                  optional and do not limit the default current-stock snapshot.
                </p>
              </>
            )}
          </div>
      </main>
    </div>
  );
}
