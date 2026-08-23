"use client";
import {
  Fragment,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  MapPin,
  Package2,
  Percent,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { Card } from "../ui/card";
import { LoadingSkeleton } from "../design-system/loading-skeleton";
import { chartTheme } from "../common/charts/chartTheme";
import {
  operationalShowroomForBranch,
  productGroup,
} from "../../lib/marketing/location-mapping";
import {

  defaultExecutiveGisFilters,
  rangeFromYearMonthSelections,
  rowInDateRange,
  rowInYearMonthSelection,
  type ComparisonMode,
  type ExecutiveGisFilters,
  type PeriodMode,
} from "../../lib/marketing/time-filters";
import {
  canonicalBoundaryIds,
  resolveSalesGeography,
  type GeographyFailure,
} from "../../lib/marketing/township-geography";
import { cn } from "../../lib/utils";
import {
  isEngineUnitProduct,
  salesTransactionQuantity,
} from "../../lib/sales/business-service";
import { clientDataLayer } from "../../lib/client-data-layer";
import townshipMaster from "../../data/master-townships.json";

// The map module graph (MapLibre renderer, PMTiles protocol, Protomaps
// basemap) is the heaviest part of the Marketing bundle. Split it into its own
// chunk and load it only when the map view mounts.
const MyanmarMarketingMap = lazy(() =>
  import("./myanmar-marketing-map").then((module) => ({
    default: module.MyanmarMarketingMap,
  })),
);
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
const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const THAI_MONTH_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];
const SHOWROOMS = [
  { id: "KMM-MYAWADDY", name: "Myawaddy" },
  { id: "KMM-HPAAN", name: "Hpa-an" },
  { id: "KMM-MAWLAMYINE", name: "Mawlamyine (Moke Ta Ma)" },
  { id: "KMM-THARYARWADDY", name: "Tharyarwaddy" },
  { id: "KMM-NATTALIN", name: "Nattalin" },
  { id: "KMM-NAWNGHKIO", name: "Naung Cho" },
] as const;
const COLORS = chartTheme.marketing.heatScale;
const ZERO_SALES_COLOR = chartTheme.marketing.zero;
const NO_DATA_COLOR = chartTheme.marketing.noData;
type Product = "All" | "TT" | "CH" | "EX" | "TP";
type ProductGroup = Exclude<Product, "All">;
type Mode = "sales" | "population" | "activity";
type CanonicalTownshipId = string;
type Filters = {
  year: string[];
  month: string[];
  branch: string[];
  showroom: string[];
};
type SalesRow = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  salesperson: string;
  stateRegion: string;
  township: string;
  village: string;
  area: string;
  productType: string;
  model: string;
  quantity?: number;
  finalReceived: number;
  gp1: number;
  expense: number | null;
};
type MarketingRow = {
  date: string;
  year: number | null;
  month: number | null;
  branch: string;
  township: string;
  stateRegion: string;
  village: string;
  activity: string;
  participants: number;
  bookingCount: number;
  prospectCount: number;
  expense: number;
};
type BookingRow = {
  year: number | null;
  month: number | null;
  branch: string;
  productType: string;
  price?: number;
  status: string;
};
type Data = {
  meta: {
    sourceUpdatedAt: string;
    sources: string[];
  };
  sales: SalesRow[];
  marketing: MarketingRow[];
  booking: BookingRow[];
};
type GeoTownship = {
  properties: {
    TS: string;
    ST: string;
  };
};
type ResolvedTownship = {
  key: string | null;
  status: "direct" | "alias" | "missing" | "unmatched" | "ambiguous";
  raw: string;
  normalizedStateRegion: string;
  normalizedTownship: string;
  reason: GeographyFailure | null;
};
type TownshipMetric = {
  township: string;
  stateRegion: string;
  canonicalLocationId?: string;
  responsibleShowroom?: string | null;
  priorSales?: SalesTotals | null;
  yoyState?: YoYState;
  benchmark?: TownshipBenchmark | null;
  validTownshipUnitTotal?: number;
  installedBase: number;
  population: number;
  installedBaseByProduct: {
    tractor: number;
    combineHarvester: number;
    excavator: number;
    transplanter: number;
    drone: number;
    other: number;
  };
  salesByProduct: {
    tractor: number;
    combineHarvester: number;
    excavator: number;
    transplanter: number;
    drone: number;
    other: number;
  };
  activities: number;
  salesUnit: number;
  salesValue: number;
  gpValue: number;
  gpPercent: number | null;
  hasFilteredSalesData?: boolean;
  bookingUnit: number | null;
  bookingValue: number | null;
  lastActivityDate: string | null;
  activityDensity: number | null;
  topActivityType: string | null;
  topSalesperson?: string | null;
  density: number | null;
  fill: string;
  periodLabel?: string;
  comparisonLabel?: string;
  comparison?: {
    salesUnit: number;
    salesValue: number;
    gpValue: number;
    gpPercent: number | null;
    activities: number;
  };
  debugPeriod?: {
    resolvedPeriodMode: PeriodMode;
    resolvedDateFrom: string;
    resolvedDateTo: string;
    comparisonMode: ComparisonMode;
    comparisonDateFrom: string;
    comparisonDateTo: string;
    currentFilteredSalesRows: number;
    comparisonFilteredSalesRows: number;
    currentSalesUnit: number;
    comparisonSalesUnit: number;
    currentSalesValue: number;
    comparisonSalesValue: number;
    currentBookingUnit: number;
    comparisonBookingUnit: number;
    currentGPValue: number;
    comparisonGPValue: number;
    timezoneUsed: string;
  };
};
type SalesTotals = {
  salesUnit: number;
  salesValue: number;
  gpValue: number;
  gpPercent: number | null;
};
type YoYState = "ready" | "multiple-years" | "all-years" | "no-prior-data";
type TownshipBenchmark = {
  rank: number;
  count: number;
  average: number;
  value: number;
  gpAverage: number | null;
};
type ComparisonMetricKey = keyof SalesTotals;
const PRODUCT_MIX_ROWS: {
  key: keyof TownshipMetric["salesByProduct"];
  label: string;
}[] = [
  { key: "tractor", label: "Tractor" },
  { key: "combineHarvester", label: "Combine Harvester" },
  { key: "excavator", label: "Excavator" },
  { key: "transplanter", label: "Rice Transplanter" },
  { key: "drone", label: "MAX" },
  { key: "other", label: "Other" },
];
const MAX_COMPARISON_TOWNSHIPS = 4;
const defaults: Filters = {
  year: ["2026"],
  month: MONTHS.slice(0, 6),
  branch: [],
  showroom: [],
};
const count = (value: number) =>
  Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
const compact = (value: number) =>
  Math.abs(value) >= 1000000
    ? `${(value / 1000000).toFixed(1)}M`
    : count(value);
const formatComparisonValue = (
  value: number | null,
  key: ComparisonMetricKey,
) =>
  value === null
    ? "—"
    : key === "salesUnit"
      ? count(value)
      : key === "gpPercent"
        ? `${value.toFixed(1)}%`
        : `${compact(value)} MMK`;
const formatComparisonGrowth = (
  current: number | null,
  prior: number | null,
  key: ComparisonMetricKey,
) => {
  if (current === null || prior === null) return "—";
  const delta = current - prior;
  if (delta === 0) return "— 0%";
  if (key === "gpPercent")
    return `${changeArrow(delta)}${Math.abs(delta).toFixed(1)} pp`;
  if (prior === 0) return "—";
  return `${changeArrow(delta)}${Math.abs((delta / prior) * 100).toFixed(0)}%`;
};
const isComplete = (row: MarketingRow) =>
  Boolean(row.date && row.activity.trim());
const productLabel = (product: Product) =>
  product === "All"
    ? "ทั้งหมด"
    : product === "TT"
      ? "Tractor"
      : product === "CH"
        ? "Combine Harvester"
        : product === "EX"
          ? "Excavator"
          : "Rice Transplanter";
const metricTotal = (
  metric: SalesTotals,
  key: ExecutiveGisFilters["activeMetric"],
) => metric[key];
const changeArrow = (value: number) =>
  value > 0 ? "▲" : value < 0 ? "▼" : "—";
function aggregateTownshipSales(
  rows: SalesRow[],
  resolveTownship: (township: string, stateRegion: string) => ResolvedTownship,
) {
  const totals = new Map<string, SalesTotals>();
  rows.forEach((row) => {
    const key = resolveTownship(row.township, row.stateRegion).key;
    if (!key) return;
    const total = totals.get(key) ?? {
      salesUnit: 0,
      salesValue: 0,
      gpValue: 0,
      gpPercent: null,
    };
    if (isEngineUnitProduct(row)) {
      total.salesUnit += salesTransactionQuantity(row);
    }
    total.salesValue += row.finalReceived;
    total.gpValue += row.gp1;
    totals.set(key, total);
  });
  totals.forEach((total) => {
    total.gpPercent = total.salesValue
      ? (total.gpValue / total.salesValue) * 100
      : null;
  });
  return totals;
}
function quantile(sorted: number[], ratio: number) {
  return (
    sorted[
      Math.min(
        sorted.length - 1,
        Math.max(0, Math.floor((sorted.length - 1) * ratio)),
      )
    ] ?? 0
  );
}
function heatColor(value: number, values: number[], zeroColor: string = NO_DATA_COLOR) {
  if (!value) return zeroColor;
  const sorted = values.filter((item) => item > 0).sort((a, b) => a - b);
  if (!sorted.length) return zeroColor;
  const levels = [
    quantile(sorted, 0.2),
    quantile(sorted, 0.4),
    quantile(sorted, 0.6),
    quantile(sorted, 0.8),
  ];
  return COLORS[
    value <= levels[0]
      ? 0
      : value <= levels[1]
        ? 1
        : value <= levels[2]
          ? 2
          : value <= levels[3]
            ? 3
            : 4
  ];
}
type MultiSelectOption = { value: string; label: string; shortLabel?: string };
type MultiSelectLayout = "list" | "month-grid";
type OpenMarketingFilter = "year" | "month" | "product" | "metric";
type MetricSelectOption = {
  label: string;
  value: ExecutiveGisFilters["activeMetric"];
  mode: Mode;
  description: string;
  icon: LucideIcon;
};

/**
 * Keeps the menu mounted briefly after close so the compact opacity/translate
 * exit transition can finish. It is intentionally presentation-only: every
 * selection still stays local until the parent invokes its existing callback.
 */
function usePopoverDisclosure() {
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [visible, setVisible] = useState(false);
  const frameRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const show = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    setPresent(true);
    setOpen(true);
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = window.requestAnimationFrame(() => {
        setVisible(true);
        frameRef.current = null;
      });
    });
  }, []);
  const hide = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setOpen(false);
    setVisible(false);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setPresent(false);
      closeTimerRef.current = null;
    }, 140);
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      if (closeTimerRef.current !== null)
        window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  return { open, present, visible, show, hide };
}

function FilterTrigger({
  triggerRef,
  icon: Icon,
  label,
  value,
  overflowCount,
  open,
  onClick,
  onKeyDown,
  popoverId,
  popupRole = "dialog",
  disabled,
  className,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  icon: LucideIcon;
  label: string;
  value: string;
  overflowCount?: number;
  open: boolean;
  onClick: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  popoverId: string;
  popupRole?: "dialog" | "listbox";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      ref={triggerRef}
      type="button"
      aria-label={`${label}: ${value}`}
      aria-expanded={open}
      aria-haspopup={popupRole}
      aria-controls={popoverId}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex h-11 min-w-[116px] shrink-0 items-center gap-2 rounded-[10px] border bg-[var(--surface-default)] px-2.5 text-left shadow-[0_1px_2px_rgba(31,41,55,0.04)] transition-[border-color,background-color,box-shadow] duration-[160ms] ease-[var(--ease-state)] hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)] hover:shadow-[0_4px_12px_rgba(31,41,55,0.05)] focus-visible:border-[var(--brand-500)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        open
          ? "border-2 border-[var(--brand-500)] bg-[var(--surface-default)]"
          : "border-[var(--border-default)]",
        className,
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--surface-muted)] text-[var(--brand-700)]">
        <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium leading-3.5 text-[var(--text-secondary)]">
          {label}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold leading-[18px] text-[var(--text-primary)]">
            {value}
          </span>
          {overflowCount && overflowCount > 0 ? (
            <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-[var(--surface-muted)] px-1.5 text-[10px] font-bold tabular-nums text-[var(--text-secondary)]">
              +{overflowCount}
            </span>
          ) : null}
        </span>
      </span>
      <ChevronDown
        size={14}
        aria-hidden="true"
        className={cn(
          "shrink-0 text-[var(--text-tertiary)] transition-transform duration-[160ms] motion-reduce:transition-none",
          open && "rotate-180 text-[var(--brand-700)]",
        )}
      />
    </button>
  );
}

function useAnchoredPopoverPosition({
  anchorRef,
  popoverRef,
  present,
  preferredWidth,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  popoverRef: RefObject<HTMLDivElement | null>;
  present: boolean;
  preferredWidth: number;
}) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const mobile = window.matchMedia("(max-width: 639px)").matches;
    const viewportMargin = mobile ? 8 : 12;

    if (mobile) {
      setStyle({
        position: "fixed",
        left: viewportMargin,
        right: viewportMargin,
        bottom: viewportMargin,
        width: "auto",
        maxHeight: Math.max(160, viewportHeight - viewportMargin * 2),
        visibility: "visible",
      });
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const gap = 8;
    const width = Math.min(preferredWidth, viewportWidth - viewportMargin * 2);
    const measuredHeight = Math.min(popover.scrollHeight || 320, 320);
    const availableBelow = viewportHeight - anchorRect.bottom - gap - viewportMargin;
    const availableAbove = anchorRect.top - gap - viewportMargin;
    const openAbove = availableBelow < measuredHeight && availableAbove > availableBelow;
    const availableHeight = openAbove ? availableAbove : availableBelow;
    const maxHeight = Math.max(96, Math.min(320, availableHeight));
    const renderedHeight = Math.min(measuredHeight, maxHeight);
    const left = Math.max(
      viewportMargin,
      Math.min(anchorRect.left, viewportWidth - viewportMargin - width),
    );
    const top = openAbove
      ? Math.max(viewportMargin, anchorRect.top - gap - renderedHeight)
      : Math.min(
          anchorRect.bottom + gap,
          viewportHeight - viewportMargin - renderedHeight,
        );

    setStyle({
      position: "fixed",
      left,
      top,
      width,
      maxHeight,
      visibility: "visible",
      transformOrigin: openAbove ? "bottom" : "top",
    });
  }, [anchorRef, popoverRef, preferredWidth]);

  useEffect(() => {
    if (!present) {
      return;
    }
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [present, updatePosition]);

  return style;
}

function FilterPopover({
  id,
  label,
  anchorRef,
  popoverRef,
  present,
  visible,
  preferredWidth,
  onDismiss,
  role = "dialog",
  className,
  children,
}: {
  id: string;
  label: string;
  anchorRef: RefObject<HTMLButtonElement | null>;
  popoverRef: RefObject<HTMLDivElement | null>;
  present: boolean;
  visible: boolean;
  preferredWidth: number;
  onDismiss: () => void;
  role?: "dialog" | "listbox";
  className?: string;
  children: ReactNode;
}) {
  const positionStyle = useAnchoredPopoverPosition({
    anchorRef,
    popoverRef,
    present,
    preferredWidth,
  });
  if (!present || typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label={`ปิด${label}`}
        onClick={onDismiss}
        className="fixed inset-0 z-[1090] hidden bg-black/20 max-sm:block"
      />
      <div
        ref={popoverRef}
        style={positionStyle}
        className={cn(
          "z-[1000] transition-[opacity,transform] ease-[var(--ease-enter)] motion-reduce:transition-none max-sm:z-[1100]",
          visible
            ? "translate-y-0 opacity-100 duration-[160ms]"
            : "pointer-events-none translate-y-1 opacity-0 duration-[140ms] max-sm:translate-y-2",
        )}
      >
        <Card
          id={id}
          role={role}
          aria-label={label}
          aria-hidden={!visible}
          className={cn(
            "flex max-h-[inherit] flex-col overflow-hidden rounded-xl border-[var(--border-default)] bg-[var(--surface-default)] p-0 shadow-[0_8px_24px_rgb(0_0_0_/_10%)]",
            className,
          )}
        >
          {children}
        </Card>
      </div>
    </>,
    document.body,
  );
}

function ApplyMultiSelect({
  label,
  options,
  values,
  allLabel,
  summary,
  onApply,
  icon,
  dropdownId,
  activeDropdown,
  onActiveDropdownChange,
  popoverWidth,
  triggerClassName,
  showSelectAll = true,
  layout = "list",
}: {
  label: string;
  options: MultiSelectOption[];
  values: string[];
  allLabel: string;
  summary: (values: string[], options: MultiSelectOption[]) => string;
  onApply: (values: string[]) => void;
  icon: LucideIcon;
  dropdownId: OpenMarketingFilter;
  activeDropdown: OpenMarketingFilter | null;
  onActiveDropdownChange: (filter: OpenMarketingFilter | null) => void;
  popoverWidth: number;
  triggerClassName?: string;
  showSelectAll?: boolean;
  layout?: MultiSelectLayout;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLInputElement | null>>([]);
  const popoverId = useId();
  const [draft, setDraft] = useState(values);
  const [error, setError] = useState("");
  const { open, present, visible, show, hide } = usePopoverDisclosure();
  const optionValues = useMemo(
    () => options.map((option) => option.value),
    [options],
  );
  const restoreTriggerFocus = useCallback(() => {
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);
  const openPopover = () => {
    setDraft(values);
    setError("");
    onActiveDropdownChange(dropdownId);
    show();
  };
  const cancel = useCallback(() => {
    setDraft(values);
    setError("");
    hide();
    if (activeDropdown === dropdownId) onActiveDropdownChange(null);
  }, [activeDropdown, dropdownId, hide, onActiveDropdownChange, values]);
  const cancelAndRestoreFocus = useCallback(() => {
    cancel();
    restoreTriggerFocus();
  }, [cancel, restoreTriggerFocus]);

  useEffect(() => {
    if (activeDropdown === dropdownId || !open) return;
    const frame = window.requestAnimationFrame(hide);
    return () => window.cancelAnimationFrame(frame);
  }, [activeDropdown, dropdownId, hide, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        ref.current &&
        !ref.current.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        cancel();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelAndRestoreFocus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, cancel, cancelAndRestoreFocus]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const checked = optionRefs.current.find((input) => input?.checked);
      (checked ?? optionRefs.current.find(Boolean))?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const toggle = (value: string) => {
    setDraft((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
    setError("");
  };
  const apply = () => {
    const next = optionValues.filter((value) => draft.includes(value));
    if (!next.length) {
      setError("กรุณาเลือกอย่างน้อย 1 รายการ");
      return;
    }
    onApply(next);
    setError("");
    hide();
    onActiveDropdownChange(null);
    restoreTriggerFocus();
  };
  const allSelected = optionValues.length > 0 && draft.length === optionValues.length;
  const overflowCount =
    values.length === options.length ? undefined : Math.max(values.length - 3, 0);
  const moveOptionFocus = (currentIndex: number, direction: number) => {
    const visibleIndices = options
      .map((option) => options.findIndex((item) => item.value === option.value))
      .filter((index) => index >= 0);
    const currentPosition = visibleIndices.indexOf(currentIndex);
    const nextPosition =
      currentPosition === -1
        ? 0
        : (currentPosition + direction + visibleIndices.length) %
          visibleIndices.length;
    const nextIndex = visibleIndices[nextPosition];
    if (nextIndex !== undefined) optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div ref={ref} className="relative min-w-0 shrink-0">
      <FilterTrigger
        triggerRef={triggerRef}
        icon={icon}
        label={label}
        value={summary(values, options)}
        overflowCount={overflowCount}
        open={open}
        onClick={open ? cancelAndRestoreFocus : openPopover}
        popoverId={popoverId}
        className={triggerClassName}
      />
      <FilterPopover
        id={popoverId}
        label={`เลือก${label}`}
        anchorRef={triggerRef}
        popoverRef={popoverRef}
        present={present}
        visible={visible}
        preferredWidth={popoverWidth}
        onDismiss={cancelAndRestoreFocus}
      >
        <div className="shrink-0 border-b border-[var(--divider)] px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-semibold leading-5 text-[var(--text-primary)]">
                {label === "สินค้า" ? "เลือกสินค้า" : `เลือก${label}`}
              </h3>
              <p className="text-[11px] font-medium leading-4 text-[var(--text-secondary)]">
                เลือกแล้ว {draft.length} จาก {options.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraft([]);
                setError("");
              }}
              className="min-h-10 rounded-lg px-2 text-xs font-semibold text-[var(--brand-700)] transition-colors hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              ล้างค่า
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
          {layout === "list" && showSelectAll ? (
            <>
              <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => {
                    setDraft(allSelected ? [] : optionValues);
                    setError("");
                  }}
                  aria-label={allLabel}
                  className="size-4 rounded border-[var(--border-default)] accent-[var(--brand-500)]"
                />
                <span>{allLabel}</span>
              </label>
              <div className="mx-2 my-1 border-t border-[var(--divider)]" />
            </>
          ) : null}
          <div
            className={cn(
              layout === "month-grid"
                ? "grid grid-cols-3 gap-1.5"
                : "space-y-0.5",
            )}
          >
            {options.map((option, optionIndex) => {
              const selected = draft.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={cn(
                    "group relative flex cursor-pointer items-center transition-[background-color,border-color,color] duration-[160ms] focus-within:ring-2 focus-within:ring-[var(--focus-ring)] motion-reduce:transition-none",
                    layout === "month-grid"
                      ? "min-h-[38px] justify-center rounded-lg border px-1.5 text-center text-xs font-semibold"
                      : "min-h-10 gap-2.5 rounded-lg px-2 text-sm font-semibold",
                    selected
                      ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                      : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]",
                  )}
                >
                  <input
                    ref={(element) => {
                      optionRefs.current[optionIndex] = element;
                    }}
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggle(option.value)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                        event.preventDefault();
                        moveOptionFocus(optionIndex, 1);
                      }
                      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                        event.preventDefault();
                        moveOptionFocus(optionIndex, -1);
                      }
                      if (event.key === "Enter") {
                        event.preventDefault();
                        toggle(option.value);
                      }
                    }}
                    aria-label={option.label}
                    className={cn(
                      "size-4 rounded border-[var(--border-default)] accent-[var(--brand-500)]",
                      layout === "month-grid" && "sr-only",
                    )}
                  />
                  <span>
                    {layout === "month-grid"
                      ? option.shortLabel ?? option.label
                      : option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        {error ? (
          <p
            role="alert"
            className="mx-3 mb-1 rounded-lg bg-[var(--status-danger-bg)] px-2.5 py-1.5 text-xs font-semibold text-[var(--status-danger)]"
          >
            {error}
          </p>
        ) : null}
        <div className="flex min-h-[50px] shrink-0 items-center justify-between gap-2 border-t border-[var(--divider)] bg-[var(--surface-default)] px-3 py-1.5">
          <button
            type="button"
            onClick={cancelAndRestoreFocus}
            className="min-h-10 rounded-lg px-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={apply}
            className="inline-flex min-h-10 items-center rounded-lg bg-[var(--brand-500)] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            นำไปใช้ ({draft.length})
          </button>
        </div>
      </FilterPopover>
    </div>
  );
}

function MetricSelector({
  options,
  selected,
  onSelect,
  activeDropdown,
  onActiveDropdownChange,
}: {
  options: MetricSelectOption[];
  selected: MetricSelectOption;
  onSelect: (option: MetricSelectOption) => void;
  activeDropdown: OpenMarketingFilter | null;
  onActiveDropdownChange: (filter: OpenMarketingFilter | null) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const popoverId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selected.value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const { open, present, visible, show, hide } = usePopoverDisclosure();
  const restoreTriggerFocus = useCallback(() => {
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);
  const close = useCallback(
    (restoreFocus = false) => {
      hide();
      if (activeDropdown === "metric") onActiveDropdownChange(null);
      if (restoreFocus) restoreTriggerFocus();
    },
    [activeDropdown, hide, onActiveDropdownChange, restoreTriggerFocus],
  );
  const openSelector = (nextIndex = selectedIndex) => {
    setActiveIndex(nextIndex);
    onActiveDropdownChange("metric");
    show();
  };
  const moveActive = (direction: number) => {
    const nextIndex = (activeIndex + direction + options.length) % options.length;
    setActiveIndex(nextIndex);
  };
  const selectMetric = (option: MetricSelectOption) => {
    onSelect(option);
    close(true);
  };

  useEffect(() => {
    if (activeDropdown === "metric" || !open) return;
    const frame = window.requestAnimationFrame(hide);
    return () => window.cancelAnimationFrame(frame);
  }, [activeDropdown, hide, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        ref.current &&
        !ref.current.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      optionRefs.current[activeIndex]?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, open]);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openSelector(
        (selectedIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
          options.length,
      );
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) close();
      else openSelector();
    }
  };

  return (
    <div ref={ref} className="relative min-w-0 shrink-0">
      <FilterTrigger
        triggerRef={triggerRef}
        icon={SlidersHorizontal}
        label="ตัวชี้วัด"
        value={selected.label}
        open={open}
        onClick={() => (open ? close(true) : openSelector())}
        onKeyDown={handleTriggerKeyDown}
        popoverId={popoverId}
        popupRole="listbox"
        className="min-w-[120px]"
      />
      <FilterPopover
        id={popoverId}
        role="listbox"
        label="เลือกตัวชี้วัด"
        anchorRef={triggerRef}
        popoverRef={popoverRef}
        present={present}
        visible={visible}
        preferredWidth={280}
        onDismiss={() => close(true)}
      >
        <div className="flex h-10 shrink-0 items-center border-b border-[var(--divider)] px-3">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
            เลือกตัวชี้วัด
          </h3>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
          {options.map((option, index) => {
            const Icon = option.icon;
            const isSelected = option.value === selected.value;
            return (
              <button
                key={option.value}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                id={`${popoverId}-${option.value}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={activeIndex === index ? 0 : -1}
                onClick={() => selectMetric(option)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveActive(1);
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveActive(-1);
                  }
                  if (event.key === "Home") {
                    event.preventDefault();
                    setActiveIndex(0);
                  }
                  if (event.key === "End") {
                    event.preventDefault();
                    setActiveIndex(options.length - 1);
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectMetric(option);
                  }
                }}
                className={cn(
                  "flex min-h-12 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-[background-color,color] duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] motion-reduce:transition-none",
                  isSelected
                    ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--surface-muted)]",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-md",
                    isSelected
                      ? "bg-[var(--brand-100)] text-[var(--brand-700)]"
                      : "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
                  )}
                >
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-4">{option.label}</span>
                  <span className="block text-[11px] font-medium leading-4 text-[var(--text-secondary)]">
                    {option.description}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-[18px] shrink-0 place-items-center rounded-full border",
                    isSelected
                      ? "border-[var(--brand-500)] bg-[var(--brand-500)] text-white"
                      : "border-[var(--border-default)] bg-[var(--surface-default)]",
                  )}
                >
                  {isSelected ? <Check size={13} strokeWidth={2.5} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </FilterPopover>
    </div>
  );
}
function ComparisonToolbarControl({
  compareMode,
  disabled,
  onChange,
}: {
  compareMode: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={compareMode}
      aria-label="เปิดหรือปิดโหมดเปรียบเทียบพื้นที่"
      disabled={disabled}
      onClick={() => onChange(!compareMode)}
      className={cn(
        "kmm-compare-control inline-flex h-11 min-w-[156px] shrink-0 items-center gap-2 rounded-[10px] border px-2.5 text-left outline-none shadow-[0_1px_2px_rgba(31,41,55,0.04)] transition-[border-color,background-color,box-shadow] duration-[160ms] ease-[var(--ease-state)] focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none",
        compareMode
          ? "border-[var(--brand-600)] bg-[var(--brand-500)] text-white hover:bg-[var(--brand-600)]"
          : "border-[var(--border-default)] bg-[var(--surface-default)] text-[var(--text-primary)] hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)]",
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-lg",
          compareMode ? "bg-white/18 text-white" : "bg-[var(--surface-muted)] text-[var(--brand-700)]",
        )}
      >
        <MapPin size={15} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[10px] font-medium leading-3.5",
            compareMode ? "text-white/80" : "text-[var(--text-secondary)]",
          )}
        >
          เปรียบเทียบพื้นที่
        </span>
        <span className="block text-[13px] font-semibold leading-[18px]">
          {compareMode ? "เปิดใช้งาน" : disabled ? "รอข้อมูล" : "ปิดอยู่"}
        </span>
      </span>
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 text-[9px] font-bold leading-4",
          compareMode
            ? "bg-white/20 text-white"
            : "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
        )}
      >
        {compareMode ? "ON" : "OFF"}
      </span>
    </button>
  );
}
function DecisionToolbar({
  filters,
  onFiltersChange,
  yearOptions,
  selectedProducts,
  onProductsChange,
  productOptions,
  activeMetric,
  onMetricChange,
  compareMode,
  onCompareModeChange,
  compareDisabled,
}: {
  filters: ExecutiveGisFilters;
  onFiltersChange: (next: ExecutiveGisFilters) => void;
  yearOptions: string[];
  selectedProducts: ProductGroup[];
  onProductsChange: (products: ProductGroup[]) => void;
  productOptions: ProductGroup[];
  activeMetric: ExecutiveGisFilters["activeMetric"];
  onMetricChange: (
    metric: ExecutiveGisFilters["activeMetric"],
    mode: Mode,
  ) => void;
  compareMode: boolean;
  onCompareModeChange: (enabled: boolean) => void;
  compareDisabled?: boolean;
}) {
  const [activeDropdown, setActiveDropdown] =
    useState<OpenMarketingFilter | null>(null);
  const yearSelectOptions = useMemo(
    () => yearOptions.map((year) => ({ value: year, label: year })),
    [yearOptions],
  );
  const monthSelectOptions = useMemo(
    () =>
      THAI_MONTHS.map((month, index) => ({
        value: String(index + 1),
        label: month,
        shortLabel: THAI_MONTH_SHORT[index],
      })),
    [],
  );
  const productSelectOptions = useMemo(
    () =>
      productOptions.map((option) => ({
        value: option,
        label: productLabel(option),
      })),
    [productOptions],
  );
  const applyYears = (selectedYears: string[]) => {
    const range = rangeFromYearMonthSelections(
      selectedYears,
      filters.selectedMonths,
    );
    onFiltersChange({
      ...filters,
      selectedYears,
      periodMode: "custom",
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      comparisonMode: "none",
      comparisonDateFrom: "",
      comparisonDateTo: "",
    });
  };
  const applyMonths = (selectedMonths: string[]) => {
    const range = rangeFromYearMonthSelections(
      filters.selectedYears,
      selectedMonths,
    );
    onFiltersChange({
      ...filters,
      selectedMonths,
      periodMode: "custom",
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      comparisonMode: "none",
      comparisonDateFrom: "",
      comparisonDateTo: "",
    });
  };
  const metricOptions: MetricSelectOption[] = [
    {
      label: "Unit",
      value: "salesUnit",
      mode: "sales",
      description: "จำนวน (คัน / เครื่อง)",
      icon: BarChart3,
    },
    {
      label: "Value",
      value: "salesValue",
      mode: "sales",
      description: "มูลค่า (บาท)",
      icon: CircleDollarSign,
    },
    {
      label: "GP",
      value: "gpValue",
      mode: "sales",
      description: "กำไรขั้นต้น (บาท)",
      icon: CircleDollarSign,
    },
    {
      label: "GP%",
      value: "gpPercent",
      mode: "sales",
      description: "อัตรากำไรขั้นต้น (%)",
      icon: Percent,
    },
  ];
  const selectedMetric =
    metricOptions.find((option) => option.value === activeMetric) ??
    metricOptions[0];
  return (
    <section
      aria-label="Decision Toolbar"
      className="kmm-decision-toolbar flex min-h-[58px] shrink-0 flex-wrap items-center gap-2 overflow-visible border-b border-[var(--border-default)] bg-[var(--surface-default)] px-3.5 py-1.5 shadow-[0_1px_0_rgba(31,41,55,0.04)] xl:flex-nowrap xl:overflow-x-auto xl:px-5 max-sm:min-h-0 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-3 max-sm:py-1.5"
    >
      <ApplyMultiSelect
        label="ปี"
        options={yearSelectOptions}
        values={filters.selectedYears}
        allLabel="เลือกทั้งหมด"
        summary={(values, options) => {
          if (values.length === options.length) return "ทุกปี";
          const selected = options
            .filter((option) => values.includes(option.value))
            .map((option) => option.label);
          return selected.slice(0, 3).join(", ");
        }}
        onApply={applyYears}
        icon={CalendarRange}
        dropdownId="year"
        activeDropdown={activeDropdown}
        onActiveDropdownChange={setActiveDropdown}
        popoverWidth={232}
        triggerClassName="min-w-[116px]"
        showSelectAll={false}
      />
      <ApplyMultiSelect
        label="เดือน"
        options={monthSelectOptions}
        values={filters.selectedMonths}
        allLabel="เลือกทั้งหมด"
        summary={(values, options) =>
          values.length === options.length
            ? "ทุกเดือน"
            : values.length === 1
              ? (options.find((option) => option.value === values[0])?.label ??
                values[0])
              : values.length === 2
                ? values
                    .map(
                      (value) =>
                        options.find((option) => option.value === value)
                          ?.shortLabel ?? value,
                    )
                    .join(", ")
                : `${values.length} เดือน`
        }
        onApply={applyMonths}
        icon={CalendarDays}
        dropdownId="month"
        activeDropdown={activeDropdown}
        onActiveDropdownChange={setActiveDropdown}
        popoverWidth={316}
        triggerClassName="min-w-[124px]"
        layout="month-grid"
      />
      <ApplyMultiSelect
        label="สินค้า"
        options={productSelectOptions}
        values={selectedProducts}
        allLabel="เลือกทั้งหมด"
        summary={(values, options) => {
          if (values.length === options.length) return "สินค้าทั้งหมด";
          const first = options.find((option) => option.value === values[0]);
          return values.length === 1
            ? first?.label ?? values[0]
            : `${first?.label ?? values[0]} +${values.length - 1}`;
        }}
        onApply={(values) => onProductsChange(values as ProductGroup[])}
        icon={Package2}
        dropdownId="product"
        activeDropdown={activeDropdown}
        onActiveDropdownChange={setActiveDropdown}
        popoverWidth={300}
        triggerClassName="min-w-[154px]"
      />
      <MetricSelector
        options={metricOptions}
        selected={selectedMetric}
        onSelect={(next) => onMetricChange(next.value, next.mode)}
        activeDropdown={activeDropdown}
        onActiveDropdownChange={setActiveDropdown}
      />
      <ComparisonToolbarControl
        compareMode={compareMode}
        disabled={compareDisabled}
        onChange={onCompareModeChange}
      />
    </section>
  );
}
function Phase1TownshipPanel({
  metric,
  activeMetric,
  filterContext,
  onClose,
  prior = metric?.priorSales ?? null,
  yoyState = metric?.yoyState ?? "no-prior-data",
  benchmark = metric?.benchmark ?? null,
}: {
  metric: TownshipMetric | null;
  activeMetric: ExecutiveGisFilters["activeMetric"];
  filterContext: { year: string; month: string; product: string };
  onClose?: () => void;
  prior?: SalesTotals | null;
  yoyState?: YoYState;
  benchmark?: TownshipBenchmark | null;
}) {
  const current: SalesTotals | null = metric
    ? {
        salesUnit: metric.salesUnit,
        salesValue: metric.salesValue,
        gpValue: metric.gpValue,
        gpPercent: metric.gpPercent,
      }
    : null;
  const primaryRows = current
    ? [
        {
          key: "salesUnit" as const,
          label: "Unit",
          value: metric?.hasFilteredSalesData
            ? count(current.salesUnit)
            : "รอข้อมูล",
        },
        {
          key: "salesValue" as const,
          label: "Value",
          value: metric?.hasFilteredSalesData
            ? `${compact(current.salesValue)} MMK`
            : "รอข้อมูล",
        },
        {
          key: "gpValue" as const,
          label: "GP",
          value: metric?.hasFilteredSalesData
            ? `${compact(current.gpValue)} MMK`
            : "รอข้อมูล",
        },
        {
          key: "gpPercent" as const,
          label: "GP%",
          value:
            current.gpPercent === null
              ? "รอข้อมูล"
              : `${current.gpPercent.toFixed(1)}%`,
        },
      ]
    : [];
  const waiting = "รอข้อมูล";
  const smartClickRows = metric
    ? [
        { label: "Customer", value: waiting },
        { label: "Campaign", value: waiting },
        { label: "Salesman", value: metric.topSalesperson?.trim() || waiting },
        { label: "Last Visit", value: waiting },
        { label: "Remark", value: waiting },
      ]
    : [];
  const mix = metric
    ? PRODUCT_MIX_ROWS.map((row) => ({
        ...row,
        unit: metric.salesByProduct[row.key],
      })).filter((row) => row.unit > 0)
    : [];
  const leadingMix = mix[0];
  const maxMix = Math.max(...mix.map((row) => row.unit), 1);
  const yoyRows =
    current && prior
      ? (["salesUnit", "salesValue", "gpValue", "gpPercent"] as const).map(
          (key) => {
            const currentValue = current[key];
            const priorValue = prior[key];
            const delta =
              currentValue === null || priorValue === null
                ? null
                : currentValue - priorValue;
            const percentage =
              delta === null ||
              key === "gpPercent" ||
              priorValue === null ||
              priorValue === 0
                ? null
                : (delta / priorValue) * 100;
            return {
              key,
              label:
                key === "salesUnit"
                  ? "Unit"
                  : key === "salesValue"
                    ? "Value"
                    : key === "gpValue"
                      ? "GP"
                      : "GP%",
              current: currentValue,
              delta,
              percentage,
            };
          },
        )
      : [];
  const insights =
    metric && benchmark && current
      ? [
          ...(prior &&
          yoyRows[0]?.percentage !== null &&
          yoyRows[0].percentage > 10
            ? [
                {
                  category: "Growth",
                  text: `ยอดขายเพิ่มขึ้น ${yoyRows[0].percentage.toFixed(1)}% จากช่วงเดียวกันปีก่อน`,
                },
              ]
            : prior &&
                yoyRows[0]?.percentage !== null &&
                yoyRows[0].percentage < -10
              ? [
                  {
                    category: "Growth",
                    text: `ยอดขายลดลง ${Math.abs(yoyRows[0].percentage).toFixed(1)}% จากช่วงเดียวกันปีก่อน`,
                  },
                ]
              : []),
          ...(current.gpPercent !== null &&
          benchmark.gpAverage !== null &&
          current.gpPercent > benchmark.gpAverage
            ? [
                {
                  category: "Profit",
                  text: `GP% สูงกว่าค่าเฉลี่ย Township ${(current.gpPercent - benchmark.gpAverage).toFixed(1)} pts`,
                },
              ]
            : current.gpPercent !== null &&
                benchmark.gpAverage !== null &&
                current.gpPercent < benchmark.gpAverage
              ? [
                  {
                    category: "Profit",
                    text: `GP% ต่ำกว่าค่าเฉลี่ย Township ${Math.abs(current.gpPercent - benchmark.gpAverage).toFixed(1)} pts`,
                  },
                ]
              : []),
          ...(leadingMix && leadingMix.unit / current.salesUnit >= 0.6
            ? [
                {
                  category: "Product",
                  text: `${leadingMix.label} คิดเป็น ${Math.round((leadingMix.unit / current.salesUnit) * 100)}% ของยอดขาย`,
                },
              ]
            : []),
        ].slice(0, 3)
      : [];
  const yoyMessage =
    yoyState === "multiple-years"
      ? "YoY comparison unavailable for multiple-year selection"
      : yoyState === "all-years"
        ? "เลือกปีเดียวเพื่อดูการเปรียบเทียบกับปีก่อน"
        : yoyState === "no-prior-data"
          ? "ไม่มีข้อมูลช่วงเดียวกันของปีก่อน"
          : null;
  const percentile = benchmark
    ? benchmark.rank <= Math.ceil(benchmark.count * 0.1)
      ? "Top 10%"
      : benchmark.rank <= Math.ceil(benchmark.count * 0.25)
        ? "Top 25%"
        : benchmark.rank > Math.floor(benchmark.count * 0.75)
          ? "Bottom 25%"
          : "Middle 50%"
    : null;
  return (
    <aside
      aria-label="Right Intelligence Panel"
      className="kmm-executive-intelligence hidden min-h-0 flex-col overflow-y-auto border-l border-[var(--border-default)] bg-[var(--surface-default)] px-5 pb-6 text-sm text-[var(--text-secondary)] xl:flex"
    >
      <div className="kmm-executive-intelligence-header sticky top-0 z-10 -mx-5 bg-[var(--surface-elevated)] px-5 pb-5 pt-5 backdrop-blur-md">
        {metric ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <MapPin
                  className="shrink-0 text-[var(--brand-500)]"
                  size={17}
                  aria-hidden="true"
                />
                <p className="text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">
                  Township Intelligence
                </p>
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                {metric.township}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <p className="truncate text-xs font-medium text-[var(--text-secondary)]">
                  {metric.stateRegion}
                </p>
                <span
                  className={cn(
                    "kmm-intelligence-status inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                    metric.hasFilteredSalesData
                      ? "bg-[var(--status-success-bg)] text-[var(--status-success)]"
                      : "bg-[var(--surface-subtle)] text-[var(--text-tertiary)]",
                  )}
                >
                  {metric.hasFilteredSalesData && (
                    <CheckCircle2 size={11} aria-hidden="true" />
                  )}
                  {metric.hasFilteredSalesData ? "มีข้อมูล" : "รอข้อมูล"}
                </span>
              </div>
              <p className="mt-2 truncate text-[11px] font-medium text-[var(--text-tertiary)]">
                {filterContext.year} · {filterContext.month} ·{" "}
                {filterContext.product}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Township panel"
              title="Close Township panel"
              className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)]">
              Township Executive Intelligence
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              เลือก Township บนแผนที่
            </h2>
          </>
        )}
      </div>
      {!metric ? (
        <div className="grid min-h-56 place-items-center text-center">
          <div className="max-w-56">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-[var(--brand-50)] text-[var(--brand-500)]">
              <MapPin size={20} aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-medium leading-6 text-[var(--text-secondary)]">
              เลือก Township บนแผนที่เพื่อดูรายละเอียด
            </p>
          </div>
        </div>
      ) : (
        <div className="kmm-intelligence-body pt-5">
          <section className="kmm-intelligence-section kmm-intelligence-performance">
            <h3 className="kmm-intelligence-heading">Current Performance</h3>
            {!metric.hasFilteredSalesData && (
              <p className="mt-2 rounded-xl border border-dashed border-[var(--border-default)] bg-white p-4 text-center text-sm font-semibold text-[var(--text-secondary)]">
                ไม่พบข้อมูลตามตัวกรองที่เลือก
              </p>
            )}
            <div className="kmm-intelligence-kpis mt-3 grid grid-cols-2">
              {primaryRows.map((row) => (
                <div
                  key={row.key}
                  className={cn(
                    "kmm-intelligence-kpi min-h-[68px] px-3 py-2.5",
                    activeMetric === row.key
                      ? "kmm-intelligence-kpi-primary -order-1 col-span-2 bg-[var(--brand-50)]"
                      : "bg-[var(--surface-subtle)]",
                  )}
                >
                  <b
                    className={cn(
                      "kmm-tabular block text-base font-semibold leading-6",
                      activeMetric === row.key
                        ? "text-[var(--brand-600)]"
                        : "text-[var(--text-primary)]",
                    )}
                  >
                    {row.value}
                  </b>
                  <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                    {row.label === "Unit"
                      ? "Sales Unit"
                      : row.label === "Value"
                        ? "Sales Value"
                        : row.label}
                  </span>
                </div>
              ))}
              <div className="kmm-intelligence-kpi min-h-[68px] bg-[var(--surface-subtle)] px-3 py-2.5">
                <b className="kmm-tabular block text-base font-semibold leading-6 text-[var(--text-primary)]">
                  {waiting}
                </b>
                <span className="mt-0.5 block text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
                  Booking
                </span>
              </div>
            </div>
          </section>
          <section className="kmm-intelligence-section">
            <h3 className="kmm-intelligence-heading">Insights</h3>
            <dl className="kmm-intelligence-insights mt-2 grid grid-cols-2">
              {[
                { label: "Market Potential", value: percentile ?? waiting },
                { label: "Booking Status", value: waiting },
                { label: "Competitor", value: waiting },
                {
                  label: "Last Activity",
                  value: metric.lastActivityDate || waiting,
                },
              ].map((row) => (
                <div key={row.label} className="px-1 py-2.5">
                  <dt className="text-[10px] font-medium text-[var(--text-tertiary)]">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-xs font-semibold text-[var(--text-primary)]">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="kmm-intelligence-section kmm-intelligence-yoy">
            <h3 className="kmm-intelligence-heading-secondary">
              Year-over-Year Performance
            </h3>
            {yoyMessage ? (
              <p className="mt-2 rounded-lg bg-[var(--surface-subtle)] p-3 text-xs font-medium">
                {yoyMessage}
              </p>
            ) : (
              <div className="mt-2 divide-y divide-[var(--divider)]">
                {yoyRows.map((row) => (
                  <div key={row.key} className="py-2.5 text-xs">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-2">
                      <span className="font-medium text-[var(--text-secondary)]">
                        {row.label}
                      </span>
                      <b className="kmm-tabular text-[var(--text-primary)]">
                        {row.current === null
                          ? waiting
                          : row.key === "gpPercent"
                            ? `${row.current.toFixed(1)}%`
                            : row.key === "salesUnit"
                              ? count(row.current)
                              : `${compact(row.current)} MMK`}
                      </b>
                      <span className="kmm-tabular font-semibold text-[var(--text-secondary)]">
                        {row.delta === null
                          ? waiting
                          : row.key === "gpPercent"
                            ? `${changeArrow(row.delta)} ${Math.abs(row.delta).toFixed(1)} pts`
                            : `${changeArrow(row.delta)} ${row.percentage === null ? waiting : `${Math.abs(row.percentage).toFixed(1)}%`}`}
                      </span>
                    </div>
                    {row.key !== "gpPercent" && row.delta !== null && (
                      <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">
                        เทียบปีก่อน: {row.delta >= 0 ? "+" : ""}
                        {row.key === "salesUnit"
                          ? count(row.delta)
                          : `${compact(row.delta)} MMK`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="kmm-intelligence-section">
            <h3 className="kmm-intelligence-heading">Recommended Actions</h3>
            <p className="kmm-intelligence-action mt-3 rounded-[var(--radius-control)] bg-[var(--brand-50)] px-3 py-3 text-xs font-medium text-[var(--text-secondary)]">
              {waiting}
            </p>
          </section>
          <section className="kmm-intelligence-section kmm-intelligence-metadata">
            <h3 className="kmm-intelligence-heading-secondary">Metadata</h3>
            <dl className="mt-3 grid gap-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="font-medium text-[var(--text-secondary)]">
                  Showroom
                </dt>
                <dd className="text-right font-semibold text-[var(--text-primary)]">
                  {metric.responsibleShowroom ?? waiting}
                </dd>
              </div>
              {smartClickRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3"
                >
                  <dt className="font-medium text-[var(--text-secondary)]">
                    {row.label}
                  </dt>
                  <dd className="text-right font-semibold text-[var(--text-primary)]">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          {metric.hasFilteredSalesData && (
            <>
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  Product Mix
                </h3>
                {mix.length ? (
                  <>
                    <p className="mt-2 text-xs">
                      <span className="font-semibold text-[var(--text-tertiary)]">
                        Top Product
                      </span>
                      <br />
                      <b className="text-[var(--text-primary)]">
                        {leadingMix?.label} ·{" "}
                        {Math.round(
                          ((leadingMix?.unit ?? 0) / metric.salesUnit) * 100,
                        )}
                        %
                      </b>
                    </p>
                    <div className="mt-2 space-y-2">
                      {mix.map((row) => (
                        <div key={row.key} className="text-xs">
                          <div className="flex justify-between gap-2">
                            <span className="font-semibold text-[var(--text-secondary)]">
                              {row.label}
                            </span>
                            <b>
                              {count(row.unit)} ·{" "}
                              {Math.round((row.unit / metric.salesUnit) * 100)}%
                            </b>
                          </div>
                          <div className="mt-1 h-1 rounded-full bg-[var(--surface-muted)]">
                            <div
                              className="h-full rounded-full bg-[var(--chart-current)]"
                              style={{ width: `${(row.unit / maxMix) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 rounded-lg bg-[var(--surface-subtle)] p-3 text-xs font-semibold">
                    ไม่มีข้อมูลยอดขายแยกตามสินค้า
                  </p>
                )}
              </section>
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  Township Benchmark
                </h3>
                {benchmark ? (
                  <div className="mt-2 rounded-lg border border-[var(--border-subtle)] p-3 text-xs">
                    <p className="font-semibold text-[var(--text-primary)]">
                      อันดับ #{benchmark.rank} จาก {benchmark.count} Township
                    </p>
                    <p className="mt-1 font-bold text-[#E86F00]">
                      {percentile}
                    </p>
                    <p className="mt-2">
                      Township Average:{" "}
                      <b>
                        {activeMetric === "gpPercent"
                          ? `${benchmark.average.toFixed(1)}%`
                          : activeMetric === "salesUnit"
                            ? count(benchmark.average)
                            : `${compact(benchmark.average)} MMK`}
                      </b>
                    </p>
                    <p className="mt-1">
                      {changeArrow(benchmark.value - benchmark.average)}{" "}
                      {activeMetric === "gpPercent"
                        ? `${Math.abs(benchmark.value - benchmark.average).toFixed(1)} pts`
                        : benchmark.average
                          ? `${Math.abs(((benchmark.value - benchmark.average) / benchmark.average) * 100).toFixed(1)}% vs Township Average`
                          : waiting}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 rounded-lg bg-[var(--surface-subtle)] p-3 text-xs font-semibold">
                    ไม่มีข้อมูลเปรียบเทียบ Township
                  </p>
                )}
              </section>
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  ประเด็นสำคัญ <span className="normal-case">Key Insights</span>
                </h3>
                {insights.length ? (
                  <ul className="mt-2 space-y-2">
                    {insights.map((insight) => (
                      <li
                        key={insight.category}
                        className="border-l-2 border-[#FFB46E] pl-2 text-xs"
                      >
                        <b className="block text-[var(--text-secondary)]">
                          {insight.category}
                        </b>
                        <span>{insight.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-lg bg-[var(--surface-subtle)] p-3 text-xs font-semibold">
                    ไม่มีประเด็นเพิ่มเติมจากข้อมูลที่เลือก
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
type ComparisonTownshipSummary = {
  id: CanonicalTownshipId;
  township: string;
  stateRegion: string;
  current: SalesTotals | null;
  prior: SalesTotals | null;
  potential: string;
  activity: string;
};

function comparisonWinnerId(
  townships: ComparisonTownshipSummary[],
  key: ComparisonMetricKey,
) {
  const available = townships
    .map((township) => ({
      id: township.id,
      value: township.current?.[key] ?? null,
    }))
    .filter(
      (item): item is { id: CanonicalTownshipId; value: number } =>
        item.value !== null,
    );
  if (available.length < 2) return null;
  const maximum = Math.max(...available.map((item) => item.value));
  const winners = available.filter((item) => item.value === maximum);
  return winners.length === 1 ? winners[0].id : null;
}
function ComparisonMatrix({
  selectedTownships,
}: {
  selectedTownships: ComparisonTownshipSummary[];
}) {
  const groups: {
    title: string;
    rows: {
      key: ComparisonMetricKey;
      label: string;
      kind: "current" | "growth";
    }[];
  }[] = [
    {
      title: "Performance",
      rows: [
        { key: "salesUnit", label: "Unit", kind: "current" },
        { key: "salesValue", label: "Value", kind: "current" },
        { key: "gpValue", label: "GP", kind: "current" },
        { key: "gpPercent", label: "GP%", kind: "current" },
      ],
    },
    {
      title: "Growth",
      rows: [
        { key: "salesUnit", label: "YoY Unit", kind: "growth" },
        { key: "salesValue", label: "YoY Value", kind: "growth" },
        { key: "gpValue", label: "YoY GP", kind: "growth" },
        { key: "gpPercent", label: "YoY GP%", kind: "growth" },
      ],
    },
  ];
  return (
    <section
      aria-label="Comparison Matrix"
      className="kmm-comparison-matrix overflow-x-auto"
    >
      <table
        className={cn(
          "w-full border-collapse text-left text-xs",
          selectedTownships.length <= 2 ? "table-fixed" : "min-w-[420px]",
        )}
      >
        <caption className="sr-only">
          Executive metric comparison for selected Townships
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="w-24 border-b border-[var(--border-subtle)] px-3 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
            >
              Metric
            </th>
            {selectedTownships.map((township, index) => (
              <th
                key={township.id}
                scope="col"
                className="min-w-24 border-b border-[var(--border-subtle)] px-3 py-3 align-top"
              >
                <span
                  className="grid size-6 place-items-center rounded-full bg-[#E86F00] text-xs font-bold text-white"
                  aria-label={`Comparison ${index + 1}`}
                >
                  {index + 1}
                </span>
                <span
                  className="mt-1 block max-w-24 truncate text-xs font-bold text-[var(--text-primary)]"
                  title={township.township}
                >
                  {township.township}
                </span>
                <span className="mt-0.5 block max-w-24 truncate text-[10px] font-semibold text-[var(--text-tertiary)]">
                  {township.stateRegion}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.title}>
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={selectedTownships.length + 1}
                  className="border-b border-[var(--border-subtle)] bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
                >
                  {group.title}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr
                  key={`${group.title}-${row.label}`}
                  className="border-b border-[var(--border-subtle)] last:border-b-0"
                >
                  <th
                    scope="row"
                    className="px-3 py-2.5 font-bold text-[var(--text-secondary)]"
                  >
                    {row.label}
                  </th>
                  {selectedTownships.map((township) => {
                    const currentValue = township.current?.[row.key] ?? null;
                    const priorValue = township.prior?.[row.key] ?? null;
                    const growth =
                      currentValue === null || priorValue === null
                        ? null
                        : currentValue - priorValue;
                    const winner =
                      row.kind === "current" &&
                      comparisonWinnerId(selectedTownships, row.key) ===
                        township.id;
                    return (
                      <td
                        key={`${township.id}-${row.label}`}
                        className={cn(
                          "kmm-tabular px-3 py-2.5 text-right font-semibold text-[var(--text-primary)]",
                          winner &&
                            "bg-[var(--status-success-bg)] text-[var(--status-success)]",
                          row.kind === "growth" &&
                            growth !== null &&
                            growth > 0 &&
                            "text-[var(--status-success)]",
                          row.kind === "growth" &&
                            growth !== null &&
                            growth < 0 &&
                            "text-[var(--status-danger)]",
                        )}
                      >
                        {row.kind === "current"
                          ? formatComparisonValue(currentValue, row.key)
                          : formatComparisonGrowth(
                              currentValue,
                              priorValue,
                              row.key,
                            )}
                        {winner && (
                          <span className="mt-0.5 block text-[9px] font-semibold">
                            สูงสุด
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  );
}
function ComparisonPanel({
  selectedTownships,
  message,
  onRemove,
  onClear,
  onExit,
  floating = false,
}: {
  selectedTownships: ComparisonTownshipSummary[];
  message: string;
  onRemove: (id: CanonicalTownshipId) => void;
  onClear: () => void;
  onExit: () => void;
  floating?: boolean;
}) {
  const selectedCount = selectedTownships.length;
  return (
    <aside
      aria-label="Right Intelligence Panel"
      className={cn(
        "kmm-comparison-panel min-h-0 flex-col overflow-y-auto bg-[var(--surface-default)] px-5 pb-6 text-sm text-[var(--text-secondary)]",
        floating
          ? "fixed bottom-4 right-4 top-[76px] z-[70] flex w-[min(400px,calc(100%-32px))] rounded-[var(--radius-panel)] border border-[var(--border-default)] shadow-[var(--shadow-overlay)] max-sm:inset-x-3 max-sm:bottom-3 max-sm:top-auto max-sm:max-h-[62vh] max-sm:w-auto"
          : "hidden border-l border-[var(--border-default)] xl:flex",
      )}
    >
      <div className="kmm-comparison-header sticky top-0 z-10 -mx-5 bg-[var(--surface-elevated)] px-5 pb-4 pt-5 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              เปรียบเทียบพื้นที่
            </h2>
            <p className="mt-0.5 text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">
              Area Comparison
            </p>
            <p className="mt-2 text-xs font-semibold text-[var(--brand-600)]">
              {selectedCount} / {MAX_COMPARISON_TOWNSHIPS} Township
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={onExit}
              className="min-h-10 rounded-[var(--radius-control)] border border-[var(--border-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)]"
            >
              ออกจากโหมดเปรียบเทียบ
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={selectedCount === 0}
              className="text-xs font-bold text-[#E86F00] hover:text-[#C2410C] disabled:text-[var(--text-disabled)]"
              aria-disabled={selectedCount === 0}
            >
              ล้างทั้งหมด
            </button>
          </div>
        </div>
      </div>
      <div className="kmm-comparison-body space-y-5 pt-5">
        {message && (
          <p
            role="status"
            aria-live="polite"
            className="rounded-lg border border-[#FED7AA] bg-[#FFF7EF] px-3 py-2 text-xs font-bold text-[#C2410C]"
          >
            {message}
          </p>
        )}
        {selectedCount === 0 ? (
          <section className="rounded-xl bg-[var(--surface-subtle)] p-4 text-xs leading-5">
            <h3 className="font-bold text-[var(--text-primary)]">
              เลือกอย่างน้อย 2 Township เพื่อเริ่มเปรียบเทียบ
            </h3>
            <p className="mt-1">คลิกพื้นที่บนแผนที่เพื่อเพิ่มรายการ</p>
          </section>
        ) : (
          <section>
            <p className="mb-2 text-xs font-bold text-[var(--text-secondary)]">
              {selectedCount === 1
                ? "เลือกอีก 1 Township เพื่อเริ่มเปรียบเทียบ"
                : "Township ที่เลือก"}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedTownships.map((township, index) => (
                <div
                  key={township.id}
                  className="kmm-comparison-chip flex min-h-11 max-w-full items-center gap-2 rounded-[var(--radius-control)] bg-[var(--surface-subtle)] px-2 py-1.5"
                >
                  <span
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-[#E86F00] text-xs font-bold text-white"
                    aria-label={`Comparison ${index + 1}`}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block max-w-40 truncate text-xs font-bold text-[var(--text-primary)]"
                      title={township.township}
                    >
                      {township.township}
                    </span>
                    <span className="block max-w-40 truncate text-[10px] font-semibold text-[var(--text-tertiary)]">
                      {township.stateRegion}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(township.id)}
                    className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-default)]"
                    aria-label={`Remove ${township.township} from comparison`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {selectedCount >= 2 && (
          <>
            <ComparisonMatrix selectedTownships={selectedTownships} />
            <section aria-label="Comparison intelligence">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)]">
                Potential &amp; Activity
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {selectedTownships.map((township, index) => (
                  <div
                    key={township.id}
                    className="rounded-[var(--radius-control)] bg-[var(--surface-subtle)] p-3"
                  >
                    <p className="text-[10px] font-semibold text-[var(--text-tertiary)]">
                      Township {index + 1}
                    </p>
                    <p className="mt-1 truncate text-xs font-semibold text-[var(--text-primary)]">
                      {township.township}
                    </p>
                    <dl className="mt-2 grid gap-1.5 text-[11px]">
                      <div className="flex justify-between gap-2">
                        <dt>Potential</dt>
                        <dd className="font-semibold text-[var(--text-primary)]">
                          {township.potential}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Activity</dt>
                        <dd className="kmm-tabular font-semibold text-[var(--text-primary)]">
                          {township.activity}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-[var(--radius-control)] bg-[var(--brand-50)] p-3 text-xs">
              <h3 className="font-semibold text-[var(--text-primary)]">
                Difference
              </h3>
              <p className="kmm-tabular mt-1 text-[var(--text-secondary)]">
                {selectedTownships.length === 2 &&
                selectedTownships[0].current &&
                selectedTownships[1].current
                  ? `${Math.abs(
                      selectedTownships[0].current.salesUnit -
                        selectedTownships[1].current.salesUnit,
                    )} Sales Unit`
                  : "รอข้อมูล"}
              </p>
            </section>
          </>
        )}
        <section className="rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-default)] p-3 text-xs">
          <h3 className="font-semibold text-[var(--text-primary)]">
            Recommendation
          </h3>
          <p className="mt-1 text-[var(--text-secondary)]">รอข้อมูล</p>
          <span className="sr-only">
            ข้อมูลเชิงวิเคราะห์จะถูกเพิ่มใน Phase C3
          </span>
        </section>
      </div>
    </aside>
  );
}
export function MarketingIntelligencePage() {
  const [filters] = useState<Filters>(defaults);
  const [selectedProducts, setSelectedProducts] = useState<ProductGroup[]>([
    "TT",
    "CH",
    "EX",
    "TP",
  ]);
  const [mode, setMode] = useState<Mode>("sales");
  const [gisFilters, setGisFilters] = useState<ExecutiveGisFilters>(() =>
    defaultExecutiveGisFilters(),
  );
  const initializedAllYearsRef = useRef(false);
  const [selectedCanonicalId, setSelectedCanonicalId] =
    useState<CanonicalTownshipId | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedComparisonTownshipIds, setSelectedComparisonTownshipIds] =
    useState<CanonicalTownshipId[]>([]);
  const [comparisonMessage, setComparisonMessage] = useState("");
  const [mapResetSignal] = useState(0);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchMarketingData = useCallback(async (): Promise<Data> => {
    const response = await fetch(`/dashboard-data.json?ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        `Unable to load dashboard-data.json (${response.status})`,
      );
    return (await response.json()) as Data;
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // dashboard-data.json is a build-time artifact; dedupe + a long TTL
      // avoid re-fetching it on every page mount (client-data-layer).
      setData(
        await clientDataLayer.request("marketing:data", fetchMarketingData, {
          ttlMs: 10 * 60_000,
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load marketing data",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchMarketingData]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const supportedYearOptions = useMemo(() => {
    const years = Array.from(
      new Set(
        (data?.sales ?? [])
          .map((row) => row.year)
          .filter((year): year is number => year !== null),
      ),
    )
      .sort((a, b) => b - a)
      .map(String);
    return years;
  }, [data]);
  useEffect(() => {
    if (initializedAllYearsRef.current || supportedYearOptions.length === 0) return;
    initializedAllYearsRef.current = true;
    setGisFilters((current) => {
      const selectedMonths = current.selectedMonths.length
        ? current.selectedMonths
        : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
      const range = rangeFromYearMonthSelections(supportedYearOptions, selectedMonths);
      return {
        ...current,
        selectedYears: supportedYearOptions,
        selectedMonths,
        periodMode: "custom",
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        comparisonMode: "none",
        comparisonDateFrom: "",
        comparisonDateTo: "",
      };
    });
  }, [supportedYearOptions]);

  const supportedProductOptions = useMemo<ProductGroup[]>(() => {
    const supported = new Set(
      (data?.sales ?? [])
        .map((row) => productGroup(row.productType))
        .filter((group) => ["TT", "CH", "EX", "TP"].includes(group)),
    );
    const ordered: ProductGroup[] = ["TT", "CH", "EX", "TP"];
    return ordered.filter((option) => supported.has(option));
  }, [data]);
  // Township name/state pairs were previously derived from the 11.4 MB
  // townships GeoJSON fetch just to read its TS/ST properties; the township
  // master carries the same 330 canonical names (~112 KB, already imported),
  // so no geometry fetch is needed at the page level.
  const geoTownships = useMemo<GeoTownship[]>(
    () =>
      townshipMaster.map((record) => ({
        properties: { TS: record.township, ST: record.state_region },
      })),
    [],
  );
  const boundary = useMemo(
    () =>
      canonicalBoundaryIds(
        geoTownships.map((feature) => ({
          stateRegion: feature.properties.ST,
          township: feature.properties.TS,
        })),
      ),
    [geoTownships],
  );
  const geoIndex = useMemo(
    () =>
      new Map(
        geoTownships
          .map((feature) => {
            const resolved = resolveSalesGeography(
              feature.properties.ST,
              feature.properties.TS,
              boundary.ids,
            );
            return resolved.canonicalLocationId
              ? [resolved.canonicalLocationId, feature]
              : null;
          })
          .filter((entry): entry is [string, GeoTownship] => Boolean(entry)),
      ),
    [geoTownships, boundary],
  );
  const townshipByCanonicalId = useMemo(
    () =>
      new Map(
        Array.from(geoIndex, ([id, feature]) => [
          id,
          {
            id,
            township: feature.properties.TS,
            stateRegion: feature.properties.ST,
          },
        ]),
      ),
    [geoIndex],
  );
  const resolveTownship = useCallback(
    (rawTownship: string, rawStateRegion: string): ResolvedTownship => {
      const resolved = resolveSalesGeography(
        rawStateRegion,
        rawTownship,
        boundary.ids,
      );
      return {
        raw: rawTownship,
        key: resolved.canonicalLocationId,
        status:
          resolved.reason === "MISSING_STATE" ||
          resolved.reason === "MISSING_TOWNSHIP"
            ? "missing"
            : resolved.reason === "AMBIGUOUS_TOWNSHIP"
              ? "ambiguous"
              : resolved.canonicalLocationId
                ? resolved.aliasStatus === "APPROVED_ALIAS"
                  ? "alias"
                  : "direct"
                : "unmatched",
        normalizedStateRegion: resolved.normalizedStateRegion,
        normalizedTownship: resolved.normalizedTownship,
        reason: resolved.reason,
      };
    },
    [boundary],
  );
  const matchesSelectedShowroom = useCallback(
    (branch: string) =>
      !filters.showroom.length ||
      filters.showroom.includes(
        operationalShowroomForBranch(branch)?.name ?? "",
      ),
    [filters.showroom],
  );
  const marketing = useMemo(
    () =>
      (data?.marketing ?? []).filter(
        (row) =>
          rowInYearMonthSelection(row, gisFilters) &&
          matchesSelectedShowroom(row.branch) &&
          isComplete(row),
      ),
    [data, gisFilters, matchesSelectedShowroom],
  );
  const periodSales = useMemo(
    () =>
      (data?.sales ?? []).filter(
        (row) =>
          rowInYearMonthSelection(row, gisFilters) &&
          selectedProducts.includes(
            productGroup(row.productType) as ProductGroup,
          ) &&
          matchesSelectedShowroom(row.branch),
      ),
    [data, gisFilters, selectedProducts, matchesSelectedShowroom],
  );
  const populationSales = useMemo(() => {
    if (!data) return [];
    return data.sales.filter((row) => {
      const category = productGroup(row.productType);
      const inProduct = selectedProducts.includes(category as ProductGroup);
      const dateKey = row.date
        ? rowInDateRange(row, {
            dateFrom: "1900-01-01",
            dateTo: gisFilters.dateTo,
          })
        : (row.year ?? 0) < Number(gisFilters.dateTo.slice(0, 4)) ||
          ((row.year ?? 0) === Number(gisFilters.dateTo.slice(0, 4)) &&
            (row.month ?? 0) <= Number(gisFilters.dateTo.slice(5, 7)));
      return (
        inProduct &&
        dateKey &&
        (!filters.branch.length || filters.branch.includes(row.branch))
      );
    });
  }, [data, filters.branch, gisFilters.dateTo, selectedProducts]);
  const mapped = useMemo(() => {
    const population = new Map<string, number>();
    const activities = new Map<string, number>();
    const salesUnits = new Map<string, number>();
    const salesValues = new Map<string, number>();
    const gpValues = new Map<string, number>();
    const installedBaseByProduct = new Map<
      string,
      TownshipMetric["installedBaseByProduct"]
    >();
    const salesByProduct = new Map<string, TownshipMetric["salesByProduct"]>();
    const salespeople = new Map<string, Map<string, number>>();
    const lastActivityDates = new Map<string, string>();
    const activityTypes = new Map<string, Map<string, number>>();
    const source = new Map<string, GeoTownship>();
    const productKey = (
      category: string,
    ): keyof TownshipMetric["salesByProduct"] =>
      category === "TT"
        ? "tractor"
        : category === "CH"
          ? "combineHarvester"
          : category === "EX"
            ? "excavator"
            : category === "TP"
              ? "transplanter"
              : category === "MAX"
                ? "drone"
                : "other";
    const blankProducts = (): TownshipMetric["salesByProduct"] => ({
      tractor: 0,
      combineHarvester: 0,
      excavator: 0,
      transplanter: 0,
      drone: 0,
      other: 0,
    });
    populationSales.forEach((row) => {
      const resolved = resolveTownship(row.township, row.stateRegion);
      if (resolved.key) {
        population.set(resolved.key, (population.get(resolved.key) ?? 0) + 1);
        const category = productGroup(row.productType);
        const detail =
          installedBaseByProduct.get(resolved.key) ?? blankProducts();
        detail[productKey(category)] += 1;
        installedBaseByProduct.set(resolved.key, detail);
        const feature = geoIndex.get(resolved.key);
        if (feature) source.set(resolved.key, feature);
      }
    });
    periodSales.forEach((row) => {
      const resolved = resolveTownship(row.township, row.stateRegion);
      if (!resolved.key) return;
      const category = productGroup(row.productType);
      if (isEngineUnitProduct(row)) {
        const quantity = salesTransactionQuantity(row);
        salesUnits.set(resolved.key, (salesUnits.get(resolved.key) ?? 0) + quantity);
        if (row.salesperson.trim()) {
          const counts =
            salespeople.get(resolved.key) ?? new Map<string, number>();
          counts.set(row.salesperson, (counts.get(row.salesperson) ?? 0) + quantity);
          salespeople.set(resolved.key, counts);
        }
        const detail = salesByProduct.get(resolved.key) ?? blankProducts();
        detail[productKey(category)] += quantity;
        salesByProduct.set(resolved.key, detail);
      }
      {
        salesValues.set(
          resolved.key,
          (salesValues.get(resolved.key) ?? 0) + row.finalReceived,
        );
        gpValues.set(resolved.key, (gpValues.get(resolved.key) ?? 0) + row.gp1);
      }
    });
    marketing.forEach((row) => {
      const resolved = resolveTownship(row.township, row.stateRegion);
      if (!resolved.key) return;
      activities.set(resolved.key, (activities.get(resolved.key) ?? 0) + 1);
      if (
        row.date &&
        (!lastActivityDates.get(resolved.key) ||
          row.date > (lastActivityDates.get(resolved.key) ?? ""))
      )
        lastActivityDates.set(resolved.key, row.date);
      if (row.activity.trim()) {
        const counts =
          activityTypes.get(resolved.key) ?? new Map<string, number>();
        counts.set(row.activity, (counts.get(row.activity) ?? 0) + 1);
        activityTypes.set(resolved.key, counts);
      }
    });
    const keys = new Set([
      ...population.keys(),
      ...activities.keys(),
      ...salesUnits.keys(),
      ...salesValues.keys(),
    ]);
    const raw = [...keys]
      .map((key) => ({
        key,
        feature: source.get(key) ?? geoIndex.get(key),
        population: population.get(key) ?? 0,
        activities: activities.get(key) ?? 0,
        salesUnit: salesUnits.get(key) ?? 0,
      }))
      .filter(
        (
          item,
        ): item is typeof item & {
          feature: GeoTownship;
        } => Boolean(item.feature),
      );
    const metricValue = (item: {
      population: number;
      activities: number;
      salesUnit: number;
    }) =>
      mode === "sales"
        ? item.salesUnit
        : mode === "population"
          ? item.population
          : item.activities;
    const visible = raw.map(metricValue);
    const metrics: Record<string, TownshipMetric> = {};
    raw.forEach((item) => {
      const density = item.population
        ? item.activities / item.population
        : null;
      const value = salesValues.get(item.key) ?? 0;
      const gp = gpValues.get(item.key) ?? 0;
      const topType =
        Array.from(activityTypes.get(item.key)?.entries() ?? []).sort(
          (a, b) => b[1] - a[1],
        )[0]?.[0] ?? null;
      const topSalesperson =
        Array.from(salespeople.get(item.key)?.entries() ?? []).sort(
          (a, b) => b[1] - a[1],
        )[0]?.[0] ?? null;
      metrics[item.key] = {
        township: item.feature.properties.TS,
        stateRegion: item.feature.properties.ST,
        canonicalLocationId: item.key,
        installedBase: item.population,
        population: item.population,
        installedBaseByProduct:
          installedBaseByProduct.get(item.key) ?? blankProducts(),
        salesByProduct: salesByProduct.get(item.key) ?? blankProducts(),
        activities: item.activities,
        salesUnit: item.salesUnit,
        salesValue: value,
        gpValue: gp,
        gpPercent: value ? (gp / value) * 100 : null,
        hasFilteredSalesData: item.salesUnit > 0,
        bookingUnit: null,
        bookingValue: null,
        lastActivityDate: lastActivityDates.get(item.key) ?? null,
        activityDensity: density,
        topActivityType: topType,
        topSalesperson,
        density,
        fill: heatColor(
          metricValue(item),
          visible,
          mode === "sales" ? ZERO_SALES_COLOR : NO_DATA_COLOR,
        ),
      };
    });
    return { metrics, rows: raw, population, activities, salesUnits };
  }, [
    populationSales,
    periodSales,
    marketing,
    mode,
    geoIndex,
    resolveTownship,
  ]);
  const yoyState = useMemo<YoYState>(() => {
    if (
      gisFilters.selectedYears.length === supportedYearOptions.length &&
      supportedYearOptions.length > 1
    )
      return "all-years";
    return gisFilters.selectedYears.length === 1 ? "ready" : "multiple-years";
  }, [gisFilters.selectedYears, supportedYearOptions.length]);
  const priorYearSales = useMemo(() => {
    if (yoyState !== "ready") return [];
    const previousYear = Number(gisFilters.selectedYears[0]) - 1;
    return (data?.sales ?? []).filter(
      (row) =>
        row.year === previousYear &&
        gisFilters.selectedMonths.includes(String(row.month ?? "")) &&
        selectedProducts.includes(
          productGroup(row.productType) as ProductGroup,
        ) &&
        matchesSelectedShowroom(row.branch),
    );
  }, [
    data,
    gisFilters.selectedYears,
    gisFilters.selectedMonths,
    selectedProducts,
    matchesSelectedShowroom,
    yoyState,
  ]);
  const priorSalesByTownship = useMemo(
    () => aggregateTownshipSales(priorYearSales, resolveTownship),
    [priorYearSales, resolveTownship],
  );
  const showroomByTownship = useMemo(() => {
    const counts = new Map<string, Map<string, number>>();
    periodSales.forEach((row) => {
      const key = resolveTownship(row.township, row.stateRegion).key;
      const showroom = operationalShowroomForBranch(row.branch)?.name;
      if (!key || !showroom) return;
      const entries = counts.get(key) ?? new Map<string, number>();
      entries.set(showroom, (entries.get(showroom) ?? 0) + 1);
      counts.set(key, entries);
    });
    return new Map(
      Array.from(counts, ([key, entries]) => [
        key,
        Array.from(entries.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
          null,
      ]),
    );
  }, [periodSales, resolveTownship]);
  const benchmarkByTownship = useMemo(() => {
    const candidates = Object.entries(mapped.metrics).filter(
      ([, metric]) =>
        metric.hasFilteredSalesData &&
        metricTotal(metric, gisFilters.activeMetric) !== null &&
        Number.isFinite(metricTotal(metric, gisFilters.activeMetric) as number),
    );
    const values = candidates.map(
      ([, metric]) => metricTotal(metric, gisFilters.activeMetric) as number,
    );
    const average = values.length
      ? values.reduce((total, value) => total + value, 0) / values.length
      : 0;
    const sorted = [...values].sort((a, b) => b - a);
    const gpValues = Object.values(mapped.metrics)
      .filter(
        (metric) => metric.hasFilteredSalesData && metric.gpPercent !== null,
      )
      .map((metric) => metric.gpPercent as number);
    const gpAverage = gpValues.length
      ? gpValues.reduce((total, value) => total + value, 0) / gpValues.length
      : null;
    return new Map(
      candidates.map(([id, metric]) => {
        const value = metricTotal(metric, gisFilters.activeMetric) as number;
        return [
          id,
          {
            value,
            average,
            count: values.length,
            rank: sorted.findIndex((candidate) => candidate === value) + 1,
            gpAverage,
          },
        ];
      }),
    );
  }, [mapped.metrics, gisFilters.activeMetric]);
  const validTownshipUnitTotal = useMemo(
    () =>
      Object.values(mapped.metrics)
        .filter((metric) => metric.hasFilteredSalesData)
        .reduce((total, metric) => total + metric.salesUnit, 0),
    [mapped.metrics],
  );
  const quality = useMemo(() => {
    const summarize = (
      rows: Array<{ township: string; stateRegion: string }>,
    ) => {
      const results = rows.map((row) =>
        resolveTownship(row.township, row.stateRegion),
      );
      const names = (status: ResolvedTownship["status"]) =>
        Array.from(
          new Set(
            results
              .filter((result) => result.status === status)
              .map((result) => result.raw),
          ),
        )
          .filter(Boolean)
          .sort();
      return {
        total: rows.length,
        mapped: results.filter((result) => result.key).length,
        normalized: results.filter((result) => result.status === "alias")
          .length,
        missing: results.filter((result) => result.status === "missing").length,
        unmatched: names("unmatched"),
        ambiguous: names("ambiguous"),
      };
    };
    return {
      cpi: summarize(data?.sales ?? []),
      marketing: summarize(data?.marketing ?? []),
    };
  }, [data, resolveTownship]);
  void quality;
  const visibleShowroomIds = filters.showroom.length
    ? SHOWROOMS.filter((showroom) =>
        filters.showroom.includes(showroom.name),
      ).map((showroom) => showroom.id)
    : undefined;
  const appliedFilterContext = {
    year:
      gisFilters.selectedYears.length === supportedYearOptions.length
        ? "ทุกปี"
        : gisFilters.selectedYears.join(", "),
    month:
      gisFilters.selectedMonths.length === 12
        ? "ทุกเดือน"
        : gisFilters.selectedMonths.length > 2
          ? `${gisFilters.selectedMonths.length} เดือน`
          : gisFilters.selectedMonths
              .map((month) => THAI_MONTHS[Number(month) - 1] ?? month)
              .join(", "),
    product:
      selectedProducts.length === supportedProductOptions.length
        ? "สินค้าทั้งหมด"
        : selectedProducts.length > 2
          ? `${selectedProducts.length} สินค้า`
          : selectedProducts.map(productLabel).join(", "),
  };
  const isComparisonTownshipSelected = useCallback(
    (id: CanonicalTownshipId) => selectedComparisonTownshipIds.includes(id),
    [selectedComparisonTownshipIds],
  );
  const isValidComparisonTownshipId = useCallback(
    (id: string | null): id is CanonicalTownshipId =>
      Boolean(id && townshipByCanonicalId.has(id)),
    [townshipByCanonicalId],
  );
  const enterCompareMode = useCallback(() => {
    setComparisonMessage("");
    setCompareMode(true);
    setSelectedComparisonTownshipIds(
      isValidComparisonTownshipId(selectedCanonicalId)
        ? [selectedCanonicalId]
        : [],
    );
  }, [isValidComparisonTownshipId, selectedCanonicalId]);
  const exitCompareMode = useCallback(() => {
    const firstSelectedTownshipId = selectedComparisonTownshipIds[0] ?? null;
    setSelectedCanonicalId(firstSelectedTownshipId);
    setSelectedComparisonTownshipIds([]);
    setComparisonMessage("");
    setCompareMode(false);
  }, [selectedComparisonTownshipIds]);
  const addComparisonTownship = useCallback(
    (id: string | null) => {
      if (!isValidComparisonTownshipId(id)) {
        console.warn(
          "[Area Comparison] Rejected unresolved canonical Township ID",
          id,
        );
        return;
      }
      setSelectedComparisonTownshipIds((current) => {
        if (current.includes(id)) return current;
        if (current.length >= MAX_COMPARISON_TOWNSHIPS) {
          setComparisonMessage("เลือกได้สูงสุด 4 Township");
          return current;
        }
        setComparisonMessage("");
        return [...current, id];
      });
    },
    [isValidComparisonTownshipId],
  );
  const compareModeRef = useRef(compareMode);
  const addComparisonTownshipRef = useRef(addComparisonTownship);
  useEffect(() => {
    compareModeRef.current = compareMode;
    addComparisonTownshipRef.current = addComparisonTownship;
  }, [addComparisonTownship, compareMode]);
  const removeComparisonTownship = useCallback((id: CanonicalTownshipId) => {
    setSelectedComparisonTownshipIds((current) =>
      current.filter((item) => item !== id),
    );
    setComparisonMessage("");
  }, []);
  const clearComparisonTownships = useCallback(() => {
    setSelectedComparisonTownshipIds([]);
    setComparisonMessage("");
  }, []);
  const setCompareModeEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled) enterCompareMode();
      else exitCompareMode();
    },
    [enterCompareMode, exitCompareMode],
  );
  const handleSelectedTownshipChange = useCallback(
    (canonicalId: string | null) => {
      if (!compareModeRef.current) {
        setSelectedCanonicalId(canonicalId);
        return;
      }
      addComparisonTownshipRef.current(canonicalId);
    },
    [],
  );
  const selectedComparisonTownships = selectedComparisonTownshipIds
    .map((id) => {
      const metric = mapped.metrics[id];
      const township = townshipByCanonicalId.get(id);
      const current = metric?.hasFilteredSalesData
        ? {
            salesUnit: metric.salesUnit,
            salesValue: metric.salesValue,
            gpValue: metric.gpValue,
            gpPercent: metric.gpPercent,
          }
        : null;
      const prior =
        yoyState === "ready" ? (priorSalesByTownship.get(id) ?? null) : null;
      const benchmark = benchmarkByTownship.get(id) ?? null;
      const potential = benchmark
        ? benchmark.rank <= Math.ceil(benchmark.count * 0.1)
          ? "Top 10%"
          : benchmark.rank <= Math.ceil(benchmark.count * 0.25)
            ? "Top 25%"
            : benchmark.rank > Math.floor(benchmark.count * 0.75)
              ? "Bottom 25%"
              : "Middle 50%"
        : "รอข้อมูล";
      return township
        ? {
            id,
            township: metric?.township ?? township.township,
            stateRegion: metric?.stateRegion ?? township.stateRegion,
            current,
            prior,
            potential,
            activity: metric ? count(metric.activities) : "รอข้อมูล",
          }
        : null;
    })
    .filter((item): item is ComparisonTownshipSummary => Boolean(item));
  void isComparisonTownshipSelected;
  const selectedTownshipMetric = selectedCanonicalId
    ? (() => {
        const metric = mapped.metrics[selectedCanonicalId];
        const prior =
          yoyState === "ready"
            ? (priorSalesByTownship.get(selectedCanonicalId) ?? null)
            : null;
        const state: YoYState =
          yoyState === "ready" && !prior ? "no-prior-data" : yoyState;
        return metric
          ? {
              ...metric,
              responsibleShowroom:
                showroomByTownship.get(selectedCanonicalId) ?? null,
              priorSales: prior,
              yoyState: state,
              benchmark: benchmarkByTownship.get(selectedCanonicalId) ?? null,
              validTownshipUnitTotal,
            }
          : null;
      })()
    : null;
  return (
    <div className="min-h-[calc(100vh-72px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <main
        data-marketing-workspace="true"
        className="flex h-[calc(100vh-72px)] min-h-[640px] flex-col"
      >
          <DecisionToolbar
            filters={gisFilters}
            onFiltersChange={setGisFilters}
            yearOptions={supportedYearOptions}
            selectedProducts={selectedProducts}
            onProductsChange={setSelectedProducts}
            productOptions={supportedProductOptions}
            activeMetric={gisFilters.activeMetric}
            onMetricChange={(activeMetric, nextMode) => {
              setMode(nextMode);
              setGisFilters((current) => ({ ...current, activeMetric }));
            }}
            compareMode={compareMode}
            onCompareModeChange={setCompareModeEnabled}
            compareDisabled={!data || loading || Boolean(error)}
          />
          <div
            className={cn(
              "grid min-h-0 flex-1 gap-0",
              mapFullscreen
                ? "xl:grid-cols-1"
                : "xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]",
            )}
          >
            <section
              aria-label="Marketing territory map"
              className="min-h-0 overflow-hidden bg-[var(--surface-subtle)]"
            >
              <Suspense
                fallback={
                  <div className="grid h-full min-h-[360px] w-full place-items-center p-6">
                    <LoadingSkeleton variant="chart" label="Loading map" />
                  </div>
                }
              >
              <MyanmarMarketingMap
                visibleShowroomIds={visibleShowroomIds}
                townshipMetrics={mapped.metrics}
                productLabel={selectedProducts.join(",")}
                mode={mode}
                activeMetric={gisFilters.activeMetric}
                filterContext={appliedFilterContext}
                comparisonSelectionIds={
                  compareMode ? selectedComparisonTownshipIds : []
                }
                onActiveMetricChange={(activeMetric) =>
                  setGisFilters((current) => ({ ...current, activeMetric }))
                }
                onSelectedTownshipChange={handleSelectedTownshipChange}
                onFullscreenChange={setMapFullscreen}
                resetSignal={mapResetSignal}
              />
              </Suspense>
            </section>
            {!mapFullscreen &&
              (compareMode ? (
                <ComparisonPanel
                  selectedTownships={selectedComparisonTownships}
                  message={comparisonMessage}
                  onRemove={removeComparisonTownship}
                  onClear={clearComparisonTownships}
                  onExit={exitCompareMode}
                />
              ) : (
                <Phase1TownshipPanel
                  metric={selectedTownshipMetric}
                  activeMetric={gisFilters.activeMetric}
                  filterContext={appliedFilterContext}
                  onClose={() => handleSelectedTownshipChange(null)}
                />
              ))}
            {mapFullscreen && compareMode && (
              <ComparisonPanel
                selectedTownships={selectedComparisonTownships}
                message={comparisonMessage}
                onRemove={removeComparisonTownship}
                onClear={clearComparisonTownships}
                onExit={exitCompareMode}
                floating
              />
            )}
          </div>
      </main>
    </div>
  );
}
