# KMM Design System v2.0 Component Library

## Scope

This document defines the official component language for the KMM Executive Dashboard after the Stage 2 Dashboard migration. It records the current implementation rather than proposing new application behavior.

Component maturity is identified as:

- **Shared**: exported from `components/ui` or `components/design-system`.
- **Feature shared**: exported for reuse inside a specific feature.
- **Embedded pattern**: implemented in a page or feature but not yet extracted.
- **Contract only**: the visual and accessibility contract is defined, but no standalone shared component currently exists.

All components use the system font stack and the semantic tokens in `app/globals.css`. Spacing follows the 4px scale. Interactive controls must have a minimum 44px target, visible keyboard focus, and a descriptive accessible name.

For every component, the TSX block immediately after its specification is the official usage example. The following **Do** and **Don't** statements define its implementation guardrails.

## Foundation

| Area               | Official rule                                                              |
| ------------------ | -------------------------------------------------------------------------- |
| Canvas             | `--surface-canvas`                                                         |
| Primary surface    | `--surface-default`                                                        |
| Secondary surface  | `--surface-subtle`                                                         |
| Elevated surface   | `--surface-elevated`                                                       |
| Primary text       | `--text-primary`                                                           |
| Secondary text     | `--text-secondary`                                                         |
| Tertiary text      | `--text-tertiary`                                                          |
| Brand action       | `--brand-500`; pressed/hover uses `--brand-600`                            |
| Status             | `--status-success`, `--status-warning`, `--status-danger`, `--status-info` |
| Control radius     | `--radius-control` or `--radius-control-lg`                                |
| Card radius        | `--radius-card`                                                            |
| Panel radius       | `--radius-panel`                                                           |
| Default elevation  | `--shadow-card`                                                            |
| Hover elevation    | `--shadow-hover`                                                           |
| Floating elevation | `--shadow-floating`                                                        |
| Overlay elevation  | `--shadow-overlay`                                                         |
| Motion             | 160–240ms; state changes use `--ease-state`                                |
| Numbers            | `.kmm-tabular` for KPI, monetary, percentage, unit, and table values       |

## 1. App Shell

**Maturity:** Embedded pattern in page components, composed with `AppSidebar`.

| Property                   | Specification                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Provides the persistent navigation, top navigation, canvas, and constrained page content area.                  |
| Variants                   | Expanded sidebar, collapsed sidebar, mobile drawer, presentation/fullscreen context.                            |
| States                     | Default, navigation open, sidebar collapsed, loading page content, error page content.                          |
| Spacing                    | Page gutter 16px mobile, 20px tablet, 24px desktop; section gap 20–24px.                                        |
| Typography                 | One 28–32px/600 page title; supporting copy 14px/400.                                                           |
| Border radius              | Canvas has none; contained page surfaces use `--radius-card`.                                                   |
| Elevation                  | Canvas none; sticky navigation uses border and translucent elevated surface.                                    |
| Color tokens               | `--surface-canvas`, `--surface-elevated`, `--text-primary`, `--border-default`.                                 |
| Interaction behavior       | Sidebar width transitions without remounting page content.                                                      |
| Accessibility requirements | Exactly one page `h1`; landmarks for navigation and main content; logical focus order.                          |
| Responsive behavior        | Sidebar is fixed at desktop and becomes an off-canvas drawer below `lg`; content padding follows sidebar width. |

```tsx
<div className="min-h-screen bg-[var(--surface-canvas)]">
  <AppSidebar {...sidebarState} />
  <div className={collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]"}>
    <header>{/* top navigation */}</header>
    <main>{/* page content */}</main>
  </div>
</div>
```

**Do:** Keep navigation, page heading, filters, and primary data in predictable order.
**Don't:** Add marketing-style hero sections or change sidebar placement per page.

## 2. Sidebar

**Maturity:** Shared, `components/navigation/app-sidebar.tsx`.

| Property                   | Specification                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Primary application navigation and session exit.                                                                       |
| Variants                   | Expanded 240px, collapsed 76px, mobile drawer 280px.                                                                   |
| States                     | Default, hover, active route, collapsed, mobile open/closed.                                                           |
| Spacing                    | 12px navigation padding; links use 12px horizontal and 10px vertical padding.                                          |
| Typography                 | Link 14px/500; group label 10–12px; status copy 11–12px.                                                               |
| Border radius              | Navigation item `--radius-control-lg`; status block `--radius-control-lg`.                                             |
| Elevation                  | Desktop border only; mobile drawer uses overlay elevation.                                                             |
| Color tokens               | Active `--brand-100`/`--brand-600`; default text `--text-secondary`; border `--border-default`.                        |
| Interaction behavior       | Collapse/expand is 300ms; mobile link selection closes the drawer.                                                     |
| Accessibility requirements | `nav` has an accessible label, active link uses `aria-current="page"`, icon-only collapse control has label and title. |
| Responsive behavior        | Hidden desktop sidebar is replaced by drawer plus dismissible scrim on smaller screens.                                |

```tsx
<AppSidebar
  collapsed={collapsed}
  mobileOpen={mobileOpen}
  onCollapsedChange={setCollapsed}
  onMobileOpenChange={setMobileOpen}
/>
```

**Do:** Preserve the KMM logo, route order, labels, and active indicator.
**Don't:** Recolor, crop, distort, or reposition the logo.

## 3. Top Navigation

**Maturity:** Embedded pattern in page components.

| Property                   | Specification                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Purpose                    | Holds page-level search, presentation control, notifications, profile, and mobile navigation trigger. |
| Variants                   | Dashboard search header, compact feature header, presentation-hidden header.                          |
| States                     | Sticky default, control hover/focus, notification panel open.                                         |
| Spacing                    | Height 72px on the migrated Dashboard; horizontal padding 16–32px; control gap 8–12px.                |
| Typography                 | Search/body 14px; profile label 12px/600; supporting role 10–11px.                                    |
| Border radius              | Controls `--radius-control-lg`; avatar `--radius-control`.                                            |
| Elevation                  | Bottom border; elevated translucent background with backdrop blur where supported.                    |
| Color tokens               | `--surface-elevated`, `--surface-subtle`, `--border-default`, `--text-secondary`.                     |
| Interaction behavior       | Sticky during page scroll; menus open in place without shifting layout.                               |
| Accessibility requirements | Icon-only actions require `aria-label`; toggles expose `aria-expanded` or `aria-pressed`.             |
| Responsive behavior        | Search and secondary profile text may hide; the mobile navigation control remains 44px.               |

```tsx
<header className="sticky top-0 z-30 h-[72px] border-b border-[var(--border-default)] bg-[var(--surface-elevated)]">
  {/* Search, presentation, notifications, profile */}
</header>
```

**Do:** Keep the bar compact and action-focused.
**Don't:** place page KPIs, charts, or long explanatory content in the top navigation.

## 4. Filter Bar

**Maturity:** Shared base in `components/design-system/filter-bar.tsx`; migrated Dashboard uses a local token-aligned composition.

| Property                   | Specification                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Purpose                    | Groups data filters and their refresh, reset, and export actions.                                                              |
| Variants                   | Four-column Dashboard, denser feature filters, horizontal action group.                                                        |
| States                     | Default, filter menu open, selected values, loading data, disabled action.                                                     |
| Spacing                    | 16–20px surface padding; 12px filter gap; 8px action gap.                                                                      |
| Typography                 | Labels 12px/500; selected values and actions 14px/500–600.                                                                     |
| Border radius              | Surface `--radius-card`; controls `--radius-control-lg`.                                                                       |
| Elevation                  | `--shadow-card`; menus use `--shadow-floating`.                                                                                |
| Color tokens               | Surface/border tokens; focus and selected controls use brand tokens.                                                           |
| Interaction behavior       | Filter changes update current data without page navigation; reset restores the defined default filter state.                   |
| Accessibility requirements | Every field has a visible label; menu buttons expose `aria-expanded`; checkboxes retain native semantics.                      |
| Responsive behavior        | Filters stack one column on mobile, two on tablet, four on wide desktop; actions remain reachable without horizontal overflow. |

```tsx
<FilterBar
  actions={
    <>
      <Button variant="outline">Reset</Button>
      <ExportButton onClick={exportRows} />
    </>
  }
>
  {filters}
</FilterBar>
```

**Do:** Keep filters before the data they affect and preserve their current order.
**Don't:** hide essential filters behind an unlabeled icon or reload the whole page on change.

## 5. KPI Card

**Maturity:** Approved shared component in
`components/design-system/kpi-card.tsx`. Dashboard, Sales, and Booking use the
`executive` variant. This component is mandatory for Stock and every remaining
page when that page enters its approved migration stage.

| Property                   | Specification                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Communicates one executive metric, its unit, and optional comparison or support context.                                                             |
| Variants                   | Executive value, trend/comparison, subtitle, icon, footer, loading, empty; legacy compatibility is retained only for unmigrated pages.               |
| States                     | Default, hover, loading skeleton, empty/no data, positive, warning, negative, neutral.                                                               |
| Spacing                    | Executive cards use 16px padding and a fixed 160px height; value and unit use an 8px baseline-aligned gap.                                           |
| Typography                 | Title 14–15px/600; KPI 32px/600 with a discrete 26px narrow-card safeguard and 34px at 2xl; unit 12px/500 (11px narrow safeguard); support 12px/400. |
| Border radius              | `--radius-card`.                                                                                                                                     |
| Elevation                  | `--shadow-card`; hover may use `--shadow-hover` without moving surrounding layout.                                                                   |
| Color tokens               | Neutral surface/text; brand for emphasis; semantic status tokens for comparisons.                                                                    |
| Interaction behavior       | Primarily read-only; hover may clarify elevation but must not imply navigation unless clickable.                                                     |
| Accessibility requirements | Status uses arrow/text as well as color; values remain readable at text zoom; loading has an accessible label.                                       |
| Responsive behavior        | Five-column desktop grid, two/three columns at intermediate widths, single column on small screens. Internal zones remain fixed at 24/48/40/14px.    |

```tsx
<KpiCard
  variant="executive"
  title="Sales Value"
  value={formatCompact(salesValue)}
  unit="MMK"
  trendValue="+4.2%"
  trendDirection="up"
  comparisonLabel="vs last year"
  status="positive"
/>
```

**Do:** Use tabular figures and retain the unit next to the value.
**Don't:** invent a value, show decorative metrics, rely on green/red alone, or
create a page-local KPI card implementation.

### Executive KPI Contract

The internal grid is mandatory:

1. Header: title and optional icon.
2. Value: primary value and optional unit with true baseline alignment.
3. Context: subtitle or trend plus comparison label.
4. Footer: optional content with reserved geometry.

Supported executive props are `title`, `value`, `unit`, `subtitle`,
`trendValue`, `trendDirection`, `comparisonLabel`, `icon`, `footer`, `status`,
`loading`, `empty`, and `className`. New pages must use
`variant="executive"`. The legacy variant exists only to prevent presentation
changes on pages that have not yet entered migration and must not be used for
new KPI sections.

## 6. Chart Card

**Maturity:** Shared in `components/design-system/chart-card.tsx`.

| Property                   | Specification                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Purpose                    | Frames an existing chart with title, context, legend, action, and data states.                        |
| Variants                   | Standard, with subtitle, with legend, with action, loading, empty, error.                             |
| States                     | Default, loading skeleton, empty, error, chart interaction.                                           |
| Spacing                    | 20px mobile, 24px desktop; 28px before chart content in the shared implementation.                    |
| Typography                 | Title 18–20px/600; subtitle 14px/400; legend 12–13px/500–600.                                         |
| Border radius              | `--radius-card`.                                                                                      |
| Elevation                  | `--shadow-card`; no decorative glow.                                                                  |
| Color tokens               | Surface, border, and text tokens; chart colors come from the controlled chart palette.                |
| Interaction behavior       | Card remains stable while chart controls, tooltip, or series state changes.                           |
| Accessibility requirements | Chart needs an accessible name/summary; legends and controls must be keyboard reachable.              |
| Responsive behavior        | Container fills its grid track; wide chart plots may scroll internally rather than overflow the page. |

```tsx
<ChartCard title="Sales by Branch" empty={!rows.length}>
  <HorizontalBarChart data={rows} />
</ChartCard>
```

**Do:** Preserve the chart type, labels, legend, and data domain.
**Don't:** redesign chart geometry merely to match a new surface style.

## 7. Intelligence Card

**Maturity:** Embedded pattern in Marketing right-side intelligence panels.

| Property                   | Specification                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Presents selected Township or feature intelligence and operational context.                                                        |
| Variants                   | Empty selection, selected detail, fullscreen floating panel, mobile bottom sheet.                                                  |
| States                     | No selection, selected, updating selection, collapsed, expanded, closed.                                                           |
| Spacing                    | 16–24px panel padding; 12–16px between information groups.                                                                         |
| Typography                 | Eyebrow 11–12px/600; title 18–20px/600; labels 12px/500; values 14–18px/600.                                                       |
| Border radius              | `--radius-panel` floating; `--radius-card` in normal layout.                                                                       |
| Elevation                  | Standard layout uses border; fullscreen/mobile uses `--shadow-floating`.                                                           |
| Color tokens               | Neutral surfaces; brand for selected geography; status tokens only for semantic values.                                            |
| Interaction behavior       | Content updates immediately when selection changes; close clears or hides according to feature contract without reloading the map. |
| Accessibility requirements | Panel has an accessible label; close/collapse controls are named; focus remains predictable.                                       |
| Responsive behavior        | Fixed right column on desktop, floating right in fullscreen, bottom sheet on mobile.                                               |

```tsx
<aside aria-label="Right Intelligence Panel">
  <Phase1TownshipPanel metric={metric} onClose={clearSelection} />
</aside>
```

**Do:** Display real source-backed values and the approved missing-data label.
**Don't:** use map popups, mock values, or a second duplicate detail panel.

## 8. Compare Card

**Maturity:** Embedded pattern in the Marketing comparison panel.

| Property                   | Specification                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| Purpose                    | Summarizes selected areas and their comparison metrics.                                         |
| Variants                   | Empty guidance, partial selection, completed comparison, comparison matrix.                     |
| States                     | Disabled, active, selected item, item removed, cleared, exited.                                 |
| Spacing                    | 16–20px card padding; 8–12px item gaps.                                                         |
| Typography                 | Heading 16–20px/600; labels 12px/500; comparison values 14–18px/600 with tabular figures.       |
| Border radius              | `--radius-card`; removable selection chips use `--radius-pill`.                                 |
| Elevation                  | Border plus `--shadow-card`; floating comparison panel may use `--shadow-floating`.             |
| Color tokens               | Brand selected state, neutral structure, semantic colors only for performance meaning.          |
| Interaction behavior       | Add/remove/clear operates without map reload; Township selection and filter state persist.      |
| Accessibility requirements | Remove buttons name the area; selection count and state are conveyed in text; focus is visible. |
| Responsive behavior        | Right panel on desktop; stacked or sheet presentation at narrow widths.                         |

```tsx
<ComparisonPanel
  selectedTownships={selectedTownships}
  onRemove={removeTownship}
  onClear={clearTownships}
  onExit={exitCompareMode}
/>
```

**Do:** Keep comparable values aligned and selection controls explicit.
**Don't:** encode rank or change only through color.

## 9. Table

**Maturity:** Shared frame in `components/design-system/table-card.tsx`; table markup remains feature-owned.

| Property                   | Specification                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Purpose                    | Displays dense row-level business data with optional search, filters, export, and pagination.         |
| Variants                   | Standard, sortable, searchable, paginated, loading, empty, error.                                     |
| States                     | Default, row hover/selected where supported, loading, empty, error, disabled pagination.              |
| Spacing                    | Card 20–24px; cells generally 12px vertical/horizontal; toolbar gap 8px.                              |
| Typography                 | Title 18–20px/600; headers 12px/600; cells 12–14px/400–500; numeric cells tabular.                    |
| Border radius              | Outer card `--radius-card`; inner scroll frame `--radius-control-lg`.                                 |
| Elevation                  | Outer `--shadow-card`; table body has no separate elevation.                                          |
| Color tokens               | Header `--surface-subtle`; dividers `--divider`; text tokens by hierarchy.                            |
| Interaction behavior       | Sorting and pagination update the current view; sticky headers may be used in long scroll regions.    |
| Accessibility requirements | Semantic `table`, `thead`, `tbody`, and `th`; sortable headers use `aria-sort`; controls have labels. |
| Responsive behavior        | Preserve columns and allow contained horizontal scrolling; never force page-level overflow.           |

```tsx
<TableCard
  title="Stock Detail"
  search={search}
  pagination={pagination}
  empty={!rows.length}
>
  <div className="overflow-x-auto">
    <table>{/* rows */}</table>
  </div>
</TableCard>
```

**Do:** Align numbers right and keep headers visible and concise.
**Don't:** convert dense business data into decorative cards solely for mobile.

## 10. Status Badge

**Maturity:** Shared in `components/design-system/status-badge.tsx`.

| Property                   | Specification                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| Purpose                    | Labels compact categorical or operational status.                                            |
| Variants                   | Positive, negative, warning, neutral, active, inactive.                                      |
| States                     | Static; may inherit disabled emphasis from its parent.                                       |
| Spacing                    | Compact horizontal padding 8–10px and vertical padding 3–5px.                                |
| Typography                 | 11–12px/600.                                                                                 |
| Border radius              | `--radius-pill`.                                                                             |
| Elevation                  | None.                                                                                        |
| Color tokens               | Status foreground/background pairs; neutral uses border and text tokens.                     |
| Interaction behavior       | Read-only unless placed inside a separately named interactive control.                       |
| Accessibility requirements | Badge text must state the status; color cannot be the only signal.                           |
| Responsive behavior        | Remains inline and may wrap with surrounding content; do not truncate critical status words. |

```tsx
<StatusBadge status="warning">At Risk</StatusBadge>
```

**Do:** Use approved semantic statuses and short text.
**Don't:** use a badge as a button or invent a new color for each label.

## 11. Button

**Maturity:** Shared in `components/ui/button.tsx`.

| Property                   | Specification                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Executes a clear command.                                                                                                         |
| Variants                   | Primary/default, outline, ghost; default, small, and large sizes.                                                                 |
| States                     | Default, hover, focus-visible, active, disabled, loading where composed.                                                          |
| Spacing                    | Minimum 44px target for primary page controls; 8px icon/text gap; 12–20px horizontal padding.                                     |
| Typography                 | 12–14px/600.                                                                                                                      |
| Border radius              | `--radius-control-lg`.                                                                                                            |
| Elevation                  | Primary may use light action elevation; outline/ghost remain flat.                                                                |
| Color tokens               | Primary brand tokens; secondary neutral tokens; danger only for destructive actions.                                              |
| Interaction behavior       | 160–200ms feedback; disabled buttons do not fire; loading actions communicate progress.                                           |
| Accessibility requirements | Native `button`; icon-only buttons require `aria-label`; expose `aria-pressed`, `aria-expanded`, or `aria-busy` where applicable. |
| Responsive behavior        | Labels may wrap only when intentional; action groups stack before controls become cramped.                                        |

```tsx
<Button onClick={onExport}><Download size={16} />Export</Button>
<Button variant="outline" onClick={onReset}><RotateCcw size={16} />Reset</Button>
```

**Do:** Use one visually primary action per action group.
**Don't:** use a rounded text control when a universally recognized icon-only action is clearer.

## 12. Input

**Maturity:** Embedded native-input pattern.

| Property                   | Specification                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Purpose                    | Captures search or typed filter values.                                                                    |
| Variants                   | Search, standard text, compact table search, disabled/read-only.                                           |
| States                     | Empty, populated, hover, focus, disabled, invalid.                                                         |
| Spacing                    | Height 44px for page controls; 12–16px horizontal padding; reserve 36–40px for a leading icon.             |
| Typography                 | 14–16px/400; visible label 12–13px/500.                                                                    |
| Border radius              | `--radius-control` or `--radius-control-lg`.                                                               |
| Elevation                  | `--shadow-card` at most; no floating shadow.                                                               |
| Color tokens               | Default surface/border/text; focus brand; invalid status-danger.                                           |
| Interaction behavior       | Focus changes border and ring without shifting layout; search updates the owned view.                      |
| Accessibility requirements | Visible label or explicit `aria-label`; placeholder is not the label; errors are associated and announced. |
| Responsive behavior        | Fills available grid track; text inputs remain at least 16px on mobile where browser zoom is a concern.    |

```tsx
<label htmlFor="search">Search</label>
<input id="search" className="h-11 rounded-[var(--radius-control-lg)]" />
```

**Do:** Keep native keyboard and autofill behavior.
**Don't:** remove the focus outline or use placeholder-only labeling.

## 13. Dropdown

**Maturity:** Embedded button/list and native `select` patterns.

| Property                   | Specification                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Purpose                    | Selects one or multiple values from a bounded option set.                                                                                  |
| Variants                   | Single select, multi-select checkbox menu, searchable multi-select.                                                                        |
| States                     | Closed, open, selected, partially selected, disabled, no matches.                                                                          |
| Spacing                    | Trigger height 44px; menu padding 8px; option minimum height 40–44px.                                                                      |
| Typography                 | Label 12px/500; trigger and option 14px/500.                                                                                               |
| Border radius              | Trigger `--radius-control-lg`; menu `--radius-card`; options `--radius-control`.                                                           |
| Elevation                  | Trigger `--shadow-card`; open menu `--shadow-floating`.                                                                                    |
| Color tokens               | Neutral surface/text; brand focus and selected checkbox; brand-50 option hover.                                                            |
| Interaction behavior       | Chevron rotates on open; selection does not reload the page; menu search filters options.                                                  |
| Accessibility requirements | Trigger uses `aria-expanded`; native checkboxes/selects retain semantics; keyboard opening, navigation, and Escape dismissal are required. |
| Responsive behavior        | Menu stays within viewport; filter triggers fill their grid tracks.                                                                        |

```tsx
<MultiSelectFilter
  label="Month"
  options={MONTHS}
  values={filters.month}
  onChange={(values) => updateFilter("month", values)}
/>
```

**Do:** Reuse the existing source options and selected state.
**Don't:** create duplicate filter state or place an open menu behind charts.

## 14. Toggle

**Maturity:** Embedded pattern using native checkbox or button semantics.

| Property                   | Specification                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Changes one binary state such as Compare Mode or presentation mode.                                                 |
| Variants                   | Switch with label, icon toggle button, segmented language choice.                                                   |
| States                     | Off, on, hover, focus, disabled.                                                                                    |
| Spacing                    | Minimum 44px target; 8px between switch and label.                                                                  |
| Typography                 | Label 12–14px/500–600.                                                                                              |
| Border radius              | Track uses `--radius-pill`; icon toggle uses `--radius-control-lg`.                                                 |
| Elevation                  | None or `--shadow-card` for toolbar controls.                                                                       |
| Color tokens               | Off uses neutral tokens; on uses brand-500/brand-100; disabled uses text-disabled.                                  |
| Interaction behavior       | State changes immediately and remains stable during related selection changes.                                      |
| Accessibility requirements | Use native checkbox or `role="switch"` with `aria-checked`; icon toggle uses `aria-pressed`; always provide a name. |
| Responsive behavior        | Keep label and control together; compact the visual track without reducing the hit target.                          |

```tsx
<button
  type="button"
  aria-pressed={compareMode}
  onClick={() => setCompareMode(!compareMode)}
>
  Compare Area
</button>
```

**Do:** Use toggles only for immediate binary settings.
**Don't:** use a toggle for an action requiring confirmation or for three or more states.

## 15. Tabs

**Maturity:** Contract only; segmented controls currently cover limited mode/language switching.

| Property                   | Specification                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Purpose                    | Switches between peer views inside one stable context.                                              |
| Variants                   | Underline tabs, compact segmented tabs.                                                             |
| States                     | Default, hover, selected, focus, disabled.                                                          |
| Spacing                    | 8px between tabs; minimum 44px target; 12–16px horizontal padding.                                  |
| Typography                 | 13–14px/500; selected 600.                                                                          |
| Border radius              | Segmented container `--radius-control-lg`; segment `--radius-control`.                              |
| Elevation                  | None.                                                                                               |
| Color tokens               | Selected brand text and brand-50/100 surface; neutral unselected text.                              |
| Interaction behavior       | Changes visible content without route reload unless the tab represents a real route.                |
| Accessibility requirements | Use `tablist`, `tab`, `tabpanel`, `aria-selected`, roving keyboard focus, and arrow-key navigation. |
| Responsive behavior        | May scroll horizontally inside its own region; selected tab must remain visible.                    |

```tsx
<div role="tablist" aria-label="Performance view">
  <button role="tab" aria-selected={view === "unit"}>
    Unit
  </button>
  <button role="tab" aria-selected={view === "value"}>
    Value
  </button>
</div>
```

**Do:** Use tabs for peer content views with a shared hierarchy.
**Don't:** use tabs as a substitute for the primary sidebar or hide required filters inside tabs.

## 16. Tooltip

**Maturity:** Embedded in Dashboard charts and map controls.

| Property                   | Specification                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| Purpose                    | Reveals concise context or exact chart/map values.                                                        |
| Variants                   | Text label, chart value tooltip, map control hint.                                                        |
| States                     | Hidden, hover visible, keyboard-focus visible, pinned only where explicitly supported.                    |
| Spacing                    | 8–12px padding; 4px between label and value rows.                                                         |
| Typography                 | 11–12px/400; tooltip title/value 600.                                                                     |
| Border radius              | `--radius-control`.                                                                                       |
| Elevation                  | `--shadow-floating`.                                                                                      |
| Color tokens               | Elevated surface, default border, primary/secondary text.                                                 |
| Interaction behavior       | Appears without moving layout and dismisses on pointer exit, blur, or Escape.                             |
| Accessibility requirements | Must be reachable by keyboard, associated through `aria-describedby`, and never contain required actions. |
| Responsive behavior        | Repositions to remain inside viewport; chart tooltips clamp horizontal position.                          |

```tsx
<button aria-describedby="reset-help"><RotateCcw /></button>
<span id="reset-help" role="tooltip">Reset view</span>
```

**Do:** Keep content brief and useful.
**Don't:** put forms, buttons, or essential instructions inside a tooltip.

## 17. Dialog

**Maturity:** Contract only; current notification and map panels are popovers/panels, not dialogs.

| Property                   | Specification                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Purpose                    | Handles a focused blocking decision that cannot remain inline.                                       |
| Variants                   | Standard, confirmation, destructive confirmation.                                                    |
| States                     | Closed, opening, open, submitting, error, closing.                                                   |
| Spacing                    | 20–24px body; 16px section gaps; 8px action gap.                                                     |
| Typography                 | Title 18–20px/600; body 14–15px/400.                                                                 |
| Border radius              | `--radius-panel`.                                                                                    |
| Elevation                  | `--shadow-overlay` with a 40–60% neutral scrim.                                                      |
| Color tokens               | Elevated/default surface; neutral text; danger only for destructive confirmation.                    |
| Interaction behavior       | Opens above the current context, traps focus, closes through explicit action and Escape when safe.   |
| Accessibility requirements | `role="dialog"`, `aria-modal="true"`, labelled title, described body, focus trap, focus restoration. |
| Responsive behavior        | Centered bounded dialog on desktop; edge-safe sheet or near-full-width surface on mobile.            |

```tsx
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm action</h2>
</div>
```

**Do:** Reserve dialogs for focused decisions.
**Don't:** turn map intelligence, filters, or ordinary navigation into dialogs.

## 18. Toast

**Maturity:** Contract only; no shared toast primitive is currently present.

| Property                   | Specification                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Confirms a non-blocking result or reports a recoverable background failure.                                           |
| Variants                   | Success, warning, error, informational.                                                                               |
| States                     | Entering, visible, paused on interaction, dismissing.                                                                 |
| Spacing                    | 12–16px padding; 8–12px icon/text/action gaps.                                                                        |
| Typography                 | Message 13–14px/500; supporting text 12px/400.                                                                        |
| Border radius              | `--radius-control-lg` or `--radius-card`.                                                                             |
| Elevation                  | `--shadow-floating`.                                                                                                  |
| Color tokens               | Elevated neutral surface plus semantic icon/text; avoid full saturated backgrounds.                                   |
| Interaction behavior       | Auto-dismiss after 3–5 seconds for low-risk messages; pause on hover/focus; errors may remain until dismissed.        |
| Accessibility requirements | `role="status"`/`aria-live="polite"` for normal updates; `role="alert"` only for urgent errors; must not steal focus. |
| Responsive behavior        | Bottom or top safe-area placement; near-full-width with 16px gutters on mobile.                                       |

```tsx
<div role="status" aria-live="polite">
  Export completed.
</div>
```

**Do:** State what happened in plain language.
**Don't:** use a toast for destructive confirmation, authentication, or required corrective action.

## 19. Loading Skeleton

**Maturity:** Shared in `components/design-system/loading-skeleton.tsx`.

| Property                   | Specification                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Reserves layout and communicates asynchronous loading.                                                                                        |
| Variants                   | KPI, chart, table.                                                                                                                            |
| States                     | Loading only; replaced atomically by content, empty, or error state.                                                                          |
| Spacing                    | Matches the dimensions of the content it represents.                                                                                          |
| Typography                 | None; adjacent loading copy may use 14px/500.                                                                                                 |
| Border radius              | Inherits the base `Skeleton` radius; should match the represented content.                                                                    |
| Elevation                  | None.                                                                                                                                         |
| Color tokens               | Neutral subtle surface and pulse tone.                                                                                                        |
| Interaction behavior       | Non-interactive; pulse animation is loading-only and respects reduced motion.                                                                 |
| Accessibility requirements | Parent loading region exposes an accessible loading label or `aria-busy`; decorative blocks stay hidden from reading order where appropriate. |
| Responsive behavior        | Width fills its container; height is stable for each variant.                                                                                 |

```tsx
<LoadingSkeleton variant="chart" />
```

**Do:** Reserve enough space to prevent content jumping.
**Don't:** show an empty chart frame or use decorative perpetual animation.

## 20. Empty State

**Maturity:** Shared in `components/design-system/empty-state.tsx`.

| Property                   | Specification                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Purpose                    | Explains that the current filter or data context has no result.                                   |
| Variants                   | Default message, feature-specific message, optional recovery action when owned by a parent.       |
| States                     | Empty only.                                                                                       |
| Spacing                    | Minimum 128px content area with centered text; parent controls outer padding.                     |
| Typography                 | 14px/500 using tertiary text.                                                                     |
| Border radius              | Inherited from containing card.                                                                   |
| Elevation                  | None beyond the containing surface.                                                               |
| Color tokens               | `--text-tertiary`, default/subtle surface.                                                        |
| Interaction behavior       | Read-only unless the parent supplies a clear reset/retry action.                                  |
| Accessibility requirements | Message must identify the empty context; do not communicate emptiness through a blank area alone. |
| Responsive behavior        | Text wraps and remains centered with normal page gutters.                                         |

```tsx
<EmptyState message="No data available for the selected filters." />
```

**Do:** Explain the empty result and preserve nearby filters.
**Don't:** display a blank card, zero-filled mock data, or an unrelated illustration.

## 21. Map Toolbar

**Maturity:** Feature shared/embedded in the Marketing MapLibre implementation and layer manager.

| Property                   | Specification                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Provides map layer, search, reset, zoom, and fullscreen commands without obscuring business layers.                             |
| Variants                   | Normal floating controls, fullscreen toolbar, collapsed layer-manager trigger.                                                  |
| States                     | Default, hover, focus, active tool, layer manager open, fullscreen.                                                             |
| Spacing                    | 8px control gap; 44px targets; 8–12px internal padding.                                                                         |
| Typography                 | Tool labels 12–14px/500–600; icon-only controls use accessible names.                                                           |
| Border radius              | Individual controls `--radius-control-lg`; grouped surface `--radius-card`.                                                     |
| Elevation                  | `--shadow-floating`.                                                                                                            |
| Color tokens               | Elevated/default surface, neutral controls, brand active state.                                                                 |
| Interaction behavior       | Commands operate on the existing map instance; layer visibility and fullscreen changes never reload the map or clear selection. |
| Accessibility requirements | Every icon button has `aria-label` and tooltip/title; toggle tools expose state; keyboard focus remains visible.                |
| Responsive behavior        | Positioned away from map zoom controls and intelligence panel; compact or wraps in fullscreen/mobile layouts.                   |

```tsx
<MarketingLayerManager
  open={open}
  onOpenChange={setOpen}
  layerState={layerState}
  onToggle={toggleLayer}
/>
```

**Do:** Reuse existing sources/layers and preserve map state.
**Don't:** duplicate sources, reload MapLibre, or place controls beneath the intelligence panel.

## 22. Map Legend

**Maturity:** Embedded in the Marketing MapLibre implementation.

| Property                   | Specification                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Explains choropleth classes, active metric, and no-data treatment.                                                               |
| Variants                   | Natural Breaks metric legend, compact fullscreen/mobile legend.                                                                  |
| States                     | Visible metric, updated classes after filter/metric change, no-data class.                                                       |
| Spacing                    | 12–16px surface padding; 6–8px class-row gap.                                                                                    |
| Typography                 | Metric/title 12–13px/600; class labels 11–12px/400–500; numeric ranges tabular.                                                  |
| Border radius              | `--radius-card`.                                                                                                                 |
| Elevation                  | `--shadow-floating` when over the map; border-only when in layout flow.                                                          |
| Color tokens               | Controlled choropleth palette, neutral text/surface, explicit no-data neutral.                                                   |
| Interaction behavior       | Updates from the existing Natural Breaks classification; remains read-only unless a future approved filter interaction is added. |
| Accessibility requirements | Each color swatch has adjacent text/range; no-data is named; color is never the only cue.                                        |
| Responsive behavior        | Compact and repositioned to avoid map controls; rows may wrap but labels and swatches stay paired.                               |

```tsx
<aside aria-label="Sales Unit legend">
  <p>Natural Breaks (Jenks)</p>
  {/* Swatch + text range for every class and No Data */}
</aside>
```

**Do:** Keep ranges synchronized with the live classification and include No Data.
**Don't:** hardcode stale ranges, obscure the map, or show color without a textual range.

## 23. KAI Header Assistant

**Maturity:** Shared implementation in `components/kai/kai-header-assistant.tsx`.

| Property                   | Specification                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                    | Provides one consistent enterprise AI entry in every authenticated application header.                                           |
| Variants                   | 420px desktop right panel, 360px tablet right panel, 80vh mobile bottom sheet.                                                     |
| States                     | Closed, open, focused, filtered search, no suggestions, contextual suggestions.                                                   |
| Spacing                    | 40px trigger height; 12–16px horizontal padding; 20px panel gutters; mobile safe-area bottom padding.                             |
| Typography                 | Trigger 14px/600; panel title 16px/600; section labels 12px/600; body and actions 12–14px.                                        |
| Border radius              | Trigger 20px; controls use `--radius-control-lg`; mobile sheet uses top `--radius-card`.                                          |
| Elevation                  | Header trigger uses no elevation; open panel uses `--shadow-overlay`.                                                             |
| Color tokens               | White surface, `#E8E8E8` trigger border, semantic text, orange Sparkles accent, semantic Online status.                           |
| Interaction behavior       | Click toggles; `Cmd/Ctrl+K` toggles globally; Escape closes; focus enters the panel and remains trapped until close.              |
| Accessibility requirements | Descriptive ARIA labels, dialog semantics, visible focus, focus restoration, keyboard-operable actions, and reduced-motion support. |
| Responsive behavior        | Header trigger remains available at every width; desktop/tablet slide from the right; mobile opens from the bottom at max 80vh.   |

```tsx
<KaiHeaderAssistant
  suggestions={companySuggestions}
  onAction={handleKaiAction}
/>
```

**Do:** use this one shared component in the existing header and provide only
source-backed contextual suggestions.
**Don't:** create floating KAI buttons, notification dots, dark modal overlays,
or page-specific assistant implementations.

## Library Governance

1. Shared component behavior must remain backward compatible during page-by-page migration.
2. Embedded patterns may be extracted only when doing so preserves their existing behavior.
3. New variants must use semantic tokens and the established spacing, type, radius, and elevation scales.
4. Business calculations, chart libraries, map sources/layers, routes, and API contracts are outside the component library.
5. Every migrated component requires TypeScript, test, build, keyboard, responsive, and visual checks.
6. Documentation must be updated when a contract-only or embedded pattern becomes a shared implementation.
