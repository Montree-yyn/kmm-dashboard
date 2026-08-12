# KMM Dashboard Design V3.5

Status: implemented across Dashboard, Sales, Booking, Stock, and KAI analytical surfaces; V3.3 shell and controls retained

Direction: Precision Operations / Analytical Clarity / Selective Glass
Design seed: `KMM-V3.5-BUSINESS-CLARITY-20260811`

## Product thesis

The interface should let an operator identify the active company, scan performance, inspect risk, and take the next action without interpreting decorative UI. KM and KMM remain isolated, single-company views. V3.5 changes only analytical presentation and KAI's read-only intent layer: it does not change API contracts, database schema, metric definitions, selectors, or stored records.

## Visual system

- Canvas: warm neutral `#f6f6f3`.
- Data surfaces: opaque white with a one-pixel border and restrained elevation.
- Brand action: KMM orange (`--brand-500: #f56600`), used for primary actions and the current data series. Charcoal and warm gray are the default comparison pair; green/red are reserved for genuine health or risk meaning.
- Typography: IBM Plex Sans Thai for Latin/Thai and Noto Sans Myanmar for Myanmar, shipped locally with `font-display: swap`.
- Radius: 10px controls, 14px cards, 18px floating glass bars.
- Spacing: 4/8-based scale with dense dashboard gutters.
- Numbers: tabular figures through `.kmm-tabular`.

## Selective glass rule

Glass is a control-layer treatment, not a card treatment.

Use `.kmm-glass-bar` for the floating global header and filter surface, and `.kmm-glass-control` for compact controls inside them. Dropdown menus, charts, KPI cards, tables, alerts, and operational content stay opaque so blur never competes with data or causes stacking artifacts.

Browsers without `backdrop-filter` fall back to solid white. Reduced-motion users receive non-animated scrolling and existing motion-reduction utilities.

## Application shell

- Expanded sidebar: 216px; collapsed: 72px; mobile drawer: 280px.
- Sidebar remains matte white with a pale-orange active state and a one-pixel orange indicator.
- Global header reserves 72px and contains a 56px floating glass bar.
- Desktop search only navigates to real, permitted application modules and follows the keyboard combobox pattern.
- Company switcher stays single-select. No KM-versus-KMM comparison is introduced.
- A company switch hides the previous snapshot immediately and resets filters before rendering the new company.
- Mobile header keeps only navigation, company, language, and KAI essentials.

## Executive Dashboard hierarchy

1. Active-company title and honest freshness status. Active-filter chips are intentionally omitted; the selected values stay visible in the controls.
2. Five existing KPIs; the first KPI is featured and factual monthly sparklines are shown only for an explicitly selected year.
3. Precision sales trend with current area, dotted previous-period line, keyboard/touch tooltips, and visible legend. Sales is the only default line chart because it has sufficient continuous history.
4. Attention panel using only known facts: open bookings, stock aged 91+ days, and source freshness.
5. Branch Performance and Stock Health. Quick Actions are omitted because their destinations already exist in the global navigation and filter toolbar.
6. Recent operational activity table.
7. Booking lifecycle, Stock-versus-Booking gap, product composition, and aging risk use distinct chart families below the decision layer.

No item is labeled overdue unless the source provides an overdue definition. Target content is not fabricated when targets are unavailable.

YoY is calculated only when exactly one year is selected. With no year or multiple years selected, the comparison is shown as `N/A` rather than comparing an invalid scope. Salesperson filtering applies consistently to Sales, Booking, Stock, and their product breakdowns.

## Charts and data

- Trend: line/area only for continuous time series with at least eight observed periods. Sparse Stock history is explicitly withheld instead of drawing a misleading line.
- Year choices are derived from the active company's source data rather than a hard-coded list; the two latest available years are selected initially.
- Booking lifecycle: stacked monthly columns use the status values returned by the source; no lifecycle stage is fabricated.
- Supply and demand: paired horizontal bars compare current Stock with open Booking on one shared zero baseline and label shortage, surplus, or balance directly.
- Target: Sales actual-versus-target uses a bullet chart with an explicit target marker.
- Ranking: branch performance keeps a compact horizontal bar; salesperson concentration adds cumulative share; aged models use lollipops with a visible 90-day threshold.
- Composition: 100% stacked bars replace donuts for Product Mix and status share so proportions share a common baseline.
- Matrix: Booking and Stock aging use intensity heatmaps with numeric labels; risk meaning does not depend on color alone.
- Stock health: segmented status bar plus text labels and counts; color is not the only signal.
- Exact chart values are available through hover, touch, and keyboard focus.
- Mobile Sales trends show the latest six periods in a compact native view; core analytical charts reflow without hidden horizontal scrolling or page-level overflow.

## KAI business analysis

- KAI stays read-only and company-scoped. It never compares KM with KMM and never exposes raw rows to the language model.
- Business assessment identifies only data-supported strengths, weaknesses, and risks from approved Target, comparable-period, booking, GP, and stock signals.
- Period comparison reports Sales Units, Sales Value, Booking Units, and GP%; Stock remains a point-in-time snapshot unless sufficient history exists.
- Deterministic evidence is composed before any model narrative. Fact Lock rejects added figures, causal claims, forecasts, and unapproved company/product subjects.
- When comparison evidence is missing, KAI says that evidence is insufficient instead of inventing a conclusion.

## Accessibility and interaction

- Interactive controls target at least 44px where space permits.
- Every icon-only button has an accessible label.
- Focus rings remain visible and company/search menus close with Escape or outside click.
- Navigation search supports Arrow Up/Down and Enter while keeping focus in the combobox.
- Chart hit areas are at least 44px and have descriptive labels.
- Status meaning combines text/icon with color.
- Main text and control colors target WCAG AA contrast on the light surfaces.

## Shared component state contract

- Actions expose default, hover, focus-visible, disabled, and loading states; loading disables repeat activation and exposes aria-busy.
- Data surfaces expose ready, loading, empty, and error states without changing the surrounding layout. Errors provide a retry action when recovery is available.
- Filters are named regions with a consistent keyboard/focus contract; selected values remain visible in the control and the floating list stays opaque.
- KPI, chart, and table surfaces use the same semantic title relationship and state attributes so visual QA and assistive technology can identify the active state.
- Status meaning is carried by text and icon/indicator first; color is supporting context only.

## Compact filter contract

- Desktop filter bars stay on one row; smaller screens wrap without horizontal page overflow.
- Dashboard exposes Year, Month, and Branch. Sales exposes Year, Month, Branch, and Product Group. Booking exposes Year, Month, Branch, and Booking Status. Stock exposes Year, Month, Branch, and Product Type.
- Every multi-select starts with an explicit All option. The Sales product sentinel remains `All Products`, so existing selector behavior is unchanged.
- Dropdown search is omitted because these business lists are short; detail-table search remains available where it is useful.
- Refresh and active-filter chips are not shown. Reset is the single clearing action, while import events continue to refresh data automatically.
- Dropdowns use an opaque floating layer above KPI cards, close with Escape/outside click, and preserve 44px targets.
- Thai labels use business terms rather than literal mixed-language translations. English and Myanmar locale switching remain available.

## Implementation map

- Tokens and glass utilities: `app/globals.css`
- Local fonts and design contract: `app/layout.tsx`
- Shell: `components/layout/global-app-shell.tsx`
- Header and search: `components/layout/global-header.tsx`, `components/navigation/global-navigation-search.tsx`
- Sidebar: `components/navigation/app-sidebar.tsx`
- KPI: `components/design-system/kpi-card.tsx`
- Filters: `components/design-system/filter-bar.tsx`, `components/design-system/data-controls.tsx`
- Trend chart: `components/common/charts/StandardLineChart.tsx`
- Analytical chart primitives: `components/common/charts/AnalyticalCharts.tsx`
- Lifecycle chart preparation: `components/common/charts/chartData.ts`
- Executive composition: `components/dashboard/dashboard-page.tsx`

## Verification

Automated verification runs through `npm test`, including Design V3.3/V3.4, Multi-Company isolation, KAI Knowledge/Runtime, Weather, and regression suites. `npm run lint` and `npm run release:check` run separately; lint warnings remain non-blocking only when there are zero errors.

Authenticated desktop QA has confirmed Dashboard and Stock containment, the paired Stock-versus-Booking chart, single-company KAI responses, and fair Month-to-Date comparisons. Cross-role and 375px mobile UAT remains a rollout approval gate and is tracked in `docs/multi-company/pending-approval.md`.
