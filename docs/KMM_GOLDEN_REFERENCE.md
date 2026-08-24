# KMM Golden Reference

## Purpose And Authority

This is the official visual baseline for the KMM Executive Dashboard. It is
the single source of truth for all page migrations after Dashboard and
Marketing. Dashboard is the master reference for executive analytics and the
application shell. Marketing is the master reference for data-dense map
workspaces, floating controls, and contextual intelligence.

When a future page differs from this document, this document wins unless a
feature-specific requirement has been approved and documented. This reference
governs presentation and interaction quality only. It does not change business
logic, data, APIs, routes, authentication, chart semantics, or map behavior.

Related sources:

- [KMM Design System v2.0](KMM_DESIGN_SYSTEM_V2.md)
- [KMM Component Library](KMM_COMPONENT_LIBRARY.md)
- [KMM Design V2 Visual QA](KMM_DESIGN_V2_VISUAL_QA.md)

## Design Philosophy

KMM Design System v2.0 is an Apple-inspired enterprise system with Kubota
identity. Its governing principles are:

- **Data-first:** business values, trends, filters, and decisions lead; visual
  decoration never competes with data.
- **Executive readability:** a leader can identify the headline, current
  performance, change, and action without scanning the entire page.
- **Apple-inspired clarity:** calm neutral surfaces, deliberate whitespace,
  crisp typography, restrained elevation, and immediate control feedback.
- **Kubota identity:** orange is reserved for primary action, active state,
  focus, map selection, and purposeful emphasis.
- **Consistency before creativity:** established patterns are reused before a
  new visual treatment is considered.
- **Compact enterprise density:** preserve meaningful information; use
  hierarchy and grouping rather than oversized cards or empty space.

Visual quality targets for every migrated page:

| Dimension             | Target |
| --------------------- | ------ |
| Visual consistency    | 10/10  |
| Executive readability | 10/10  |
| Enterprise quality    | 10/10  |
| Brand consistency     | 10/10  |

## Application Shell

| Area           | Approved baseline                                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar        | Preserve the KMM logo, position, route order, active state, 240px expanded width, 76px collapsed width, and mobile drawer behavior. Do not create page-specific navigation.        |
| Top navigation | Sticky translucent elevated surface with a bottom border. Use page-level utility actions only; icon-only controls have 44px targets and accessible names.                          |
| Header         | One page `h1`, concise supporting context, then filters and content. Dashboard uses a 72px header; compact feature workspaces such as Marketing may use 56px. Every authenticated header uses the shared KAI entry before the profile area. |
| Filter bar     | Filters precede the data they affect. Group related controls in one calm surface or workspace toolbar; changes update in place and do not navigate or reload.                      |
| Content width  | Dashboard content uses `max-w-[1600px]` centered within the application shell. Operational workspaces may fill available width where the task benefits, such as the Marketing map. |
| Page padding   | 16px mobile, 20px tablet, 24px desktop as the default content gutter. Preserve feature-specific compact padding only where it protects primary workspace area.                     |
| Grid           | Use explicit CSS grid tracks, `minmax(0, 1fr)`, and `min-w-0` for data regions. Cards align to a shared grid; no arbitrary offset layout.                                          |

### Responsive Breakpoints

| Range                          | Rule                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Mobile: below 640px            | Single-column content, 16px gutter, sidebar becomes drawer, controls wrap without page overflow.     |
| Small/tablet: 640–767px        | Two-column only when cards remain readable; retain 44px controls.                                    |
| Tablet: 768–1023px             | Content may use two tracks; avoid fixed side panels that crowd primary content.                      |
| Desktop: 1024–1279px           | Expanded/collapsed sidebar returns; executive grids grow while controls remain compact.              |
| Wide desktop: 1280px and above | Dashboard can use its full executive grid; Marketing may use a persistent right intelligence column. |
| Extra wide: 1536px and above   | Increase grid capacity or panel width modestly, never scale typography with viewport width.          |

## Typography

Use `--font-heading` (Plus Jakarta Sans) for headings and `--font-body` (Inter)
for body, controls, tables, and data. `--font-kmm` remains a compatibility alias
for the body stack. Fonts are self-hosted; page migrations must not add network
font dependencies. IBM Plex Sans Thai and Noto Sans Myanmar provide local
complex-script fallbacks.

| Role            | Size    | Weight  | Usage                                                                   |
| --------------- | ------- | ------- | ----------------------------------------------------------------------- |
| Page title      | 28–32px | 600     | One `h1`; Dashboard reference is 28px mobile / 30px from small screens. |
| Section title   | 18–20px | 600     | Major analytic section or chart group.                                  |
| Card title      | 14–16px | 600     | KPI, chart, table, and intelligence headings.                           |
| Primary KPI     | 28–36px | 600–700 | One dominant value per KPI card or intelligence section.                |
| Body            | 14–15px | 400     | Explanatory content and normal data copy.                               |
| Label           | 12–13px | 500     | Filter labels, field names, and compact metadata.                       |
| Caption/eyebrow | 10–12px | 400–600 | Supporting context, period, source, and quiet metadata.                 |

Numbers for KPI, currency, percent, unit, legend ranges, and table cells must
use `.kmm-tabular`. Values align consistently, units remain visible, and signs
or comparison labels are never expressed by color alone.

Thai rules:

- Thai must use the same system stack and normal letter spacing.
- Do not force single-line Thai content when it would clip; allow deliberate
  wrapping inside a stable control or card height.
- Labels and values retain enough line height for Thai ascenders and marks.
- Never substitute truncated Thai text with a smaller unreadable font.

## Color System

| Role          | Token / value                                                            | Approved use                                                             |
| ------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Brand orange  | `--brand-500` / `#F56600`                                                | Primary action, selected geography, active control, focus.               |
| Brand hover   | `--brand-600` / `#E85D00`                                                | Pressed or hover primary state.                                          |
| Soft brand    | `--brand-50`, `--brand-100`                                              | Selected or quiet emphasis background.                                   |
| Success       | `--status-success` / `#168A45`                                           | Meaningful positive state, always with text/icon cue.                    |
| Warning       | `--status-warning` / `#B76800`                                           | Attention state, never decorative.                                       |
| Danger        | `--status-danger` / `#D92D20`                                            | Error or destructive outcome only.                                       |
| Information   | `--status-info` / `#3B6EA8`                                              | Informational state only.                                                |
| Canvas        | `--surface-canvas` / `#F5F5F7`                                           | Application background.                                                  |
| Card          | `--surface-default` / `#FFFFFF`                                          | Standard content surface.                                                |
| Quiet surface | `--surface-subtle` / `#FAFAFC`                                           | Grouped secondary information.                                           |
| Borders       | `--border-default`, `--border-subtle`, `--divider`                       | Structure, not decoration.                                               |
| Chart palette | `--chart-current`, `--chart-previous`, `--chart-neutral`, `--chart-grid` | Existing chart semantics; do not redesign a chart's meaning.             |
| Map palette   | Existing Natural Breaks and no-data palette                              | Live classification only; orange is reserved for selection/top emphasis. |

Do not introduce blue as a primary brand color, purple gradients, large
gradient backgrounds, or saturated status colors as decoration.

## Spacing, Shape, And Elevation

### Spacing Scale

Use only the established 4px scale: 4, 8, 12, 16, 20, 24, 28, 32, 40, and
48px (`--space-1` through `--space-12`).

| Context               | Approved spacing                                          |
| --------------------- | --------------------------------------------------------- |
| Card internal padding | 16–20px standard; 20–24px for chart/table surfaces.       |
| Card grid gap         | 12–16px KPI grid; 20–24px primary page sections.          |
| Section separation    | 20–24px standard; 32px only between major analytic bands. |
| Toolbar               | 8–12px between controls, 12–16px internal padding.        |
| Filter bar            | 12px field gap, 16–20px surface padding.                  |
| Panel                 | 16–24px padding, 12–16px between information groups.      |
| Table                 | 12px cell padding as the dense default.                   |

### Radius And Elevation

| Object               | Token                                                     | Elevation               |
| -------------------- | --------------------------------------------------------- | ----------------------- |
| Control              | `--radius-control` (10px) or `--radius-control-lg` (12px) | Flat or minimal shadow. |
| Card                 | `--radius-card` (16px)                                    | `--shadow-card`.        |
| Floating panel       | `--radius-panel` (20px)                                   | `--shadow-floating`.    |
| Modal overlay        | `--radius-panel`                                          | `--shadow-overlay`.     |
| Badge / switch track | `--radius-pill`                                           | No decorative shadow.   |

Cards use a quiet border and minimal shadow. Use whitespace and typographic
contrast before adding a divider, border, or stronger elevation.

## Component Standards

| Component             | Approved implementation contract                                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| KPI Card              | Use the mandatory shared `KpiCard` executive variant. One primary metric, visible baseline-aligned unit, tabular figures, optional semantic comparison, fixed 160px height, and 24/48/40/14px internal zones. Preserve KPI name/value/calculation; do not create page-local KPI implementations. |
| Chart Card            | Keep the existing chart library, type, domain, legend, and interaction. Frame with a 16px card, 20–24px padding, stable plot area, loading/empty/error state.                                                                                                                                    |
| Filter Control        | Visible label, 44px target, 10–12px radius, 12–14px text, 12px gap. Keep existing filter order and state.                                                                                                                                                                                        |
| Dropdown              | Trigger/menu use established tokens; menu has floating elevation, keyboard/Escape support, and must open above nearby content. No duplicate filter state.                                                                                                                                        |
| Button                | One clear command. Primary orange only for the leading action; outline/ghost actions remain neutral. Icon-only buttons need name and title.                                                                                                                                                      |
| Status Badge          | 11–12px/600 pill, text plus semantic color, no button behavior.                                                                                                                                                                                                                                  |
| Legend                | Compact, textual swatch/range pairs, no-data treatment present, values sourced from live classification.                                                                                                                                                                                         |
| Map Toolbar           | 44px controls, accessible icon names, visible focus, positioned away from map controls and panels. Commands operate on the current map instance.                                                                                                                                                 |
| Layer Panel           | Compact floating surface; aligned 44px switch targets; unavailable layers remain disabled with `รอข้อมูล`, not fabricated.                                                                                                                                                                       |
| Township Intelligence | One contextual panel only. Hierarchy: overview, performance, insights, recommended action, metadata. Real source-backed values; missing data is `รอข้อมูล`.                                                                                                                                      |
| Compare Panel         | One panel for all selected Townships. Comparable values align in a matrix; remove, clear, and exit are explicit. No duplicate cards.                                                                                                                                                             |
| Table                 | Semantic table, concise headers, right-aligned tabular numbers, contained horizontal scroll if needed, never page-level overflow.                                                                                                                                                                |
| Loading               | Use a dimensionally faithful skeleton and accessible loading state; do not shift final layout.                                                                                                                                                                                                   |
| Empty State           | Explain the empty context; preserve filters and offer a recovery action only when one exists.                                                                                                                                                                                                    |
| Error State           | State what failed and offer a meaningful retry/recovery path; do not hide the error behind a blank card.                                                                                                                                                                                         |

## Marketing Golden Reference

Marketing establishes the approved executive intelligence workspace pattern.
It is a functional map, not a decorative GIS screen.

| Area                  | Golden behavior and presentation                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layer Manager         | Reuses the existing source/layer state. Switches are aligned 44px targets; track/thumb remain contained at all browser scales. Unavailable data layers are disabled and labelled `รอข้อมูล`. |
| Legend                | Compact floating legend with Natural Breaks title, swatch, textual range, and explicit no-data row. It updates from the existing classification.                                             |
| Map controls          | 44px floating controls with restrained glass surface, named icons, focus state, and no overlap with panel or native zoom controls.                                                           |
| Smart Click           | Clicking a Township highlights it and updates the one intelligence panel immediately. Blank-map click clears selection; no popup is used.                                                    |
| Smart Zoom            | Camera movement is smooth, reserves panel space, caps close zoom, and does not zoom further when the current Township is clicked again.                                                      |
| Compare               | The existing Compare Area control preserves its compact filter geometry. Selected Townships appear in one comparison panel; selection/removal/clear does not reload the map.                 |
| Fullscreen            | Filters, toolbar, legend, compare panel, and detail panel remain available. The map instance and selection persist; panels float without compressing the primary map workspace.              |
| Township Intelligence | Performance is visually primary; insights and metadata step back. Missing source fields show `รอข้อมูล`, never synthetic zeroes or mock data.                                                |
| Executive card        | Use neutral surface, purposeful orange selection/status anchor, tabular values, and whitespace-led grouping rather than nested boxes.                                                        |

Marketing retains its existing PMTiles, MapLibre, Natural Breaks, business data,
filters, compare logic, and selection behavior. Those are functional contracts,
not presentation migration targets.

## Responsive Rules

| Context    | Required behavior                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop    | Align panels and content to a stable grid. Use a right intelligence column only when the primary workspace remains dominant.                   |
| Tablet     | Let grids reduce columns before text or controls become cramped. Convert persistent map detail into a floating panel where appropriate.        |
| Mobile     | Use one content column. Filters wrap or stack, side panels become a bottom sheet, and controls remain touch-safe. No horizontal page overflow. |
| Fullscreen | Preserve essential filters, controls, legend, and contextual panel. Do not remount the map, drop selection, or cover essential map controls.   |

At 1440, 1280, 1024, 768, and 390px verify that text does not clip, cards do
not overlap, controls remain reachable, and tables/menus scroll only inside
their own containment region.

## Mandatory QA And Regression Checklist

Every future page migration must pass all applicable checks before review.

### Content And Visual Quality

- Preserve all data, labels, KPIs, calculations, chart semantics, filters, and
  comparison periods.
- Use the approved typography, spacing scale, radii, semantic colors, and
  elevation levels.
- Verify Thai and English copy at every target viewport.
- Confirm no horizontal overflow, clipped text, overlapping cards, or controls
  hidden behind content.
- Inspect at 100%, 125%, 150%, and 200% browser zoom for dense controls,
  tables, and floating panels.

### Accessibility And Interaction

- One page `h1`; logical headings and landmarks.
- Native inputs/buttons where appropriate; all icon-only controls have names.
- Visible keyboard focus and usable keyboard path for filters, menus, tabs,
  toggles, dialogs, and map controls.
- Status is never color-only; loading, empty, and error states have clear text.
- Preserve existing interaction behavior, route behavior, and component state.

### Runtime And Release Gate

- TypeScript passes.
- Lint has zero errors; existing warnings are recorded rather than hidden.
- Relevant regression tests and the full test suite pass.
- Production build passes.
- Fresh browser verification has zero blocking console errors, unhandled
  rejections, failed application requests, and unexpected HTTP 4xx/5xx.
- Verify the migrated page at all five target viewports and update
  `KMM_DESIGN_V2_VISUAL_QA.md` with evidence.
- Run page-specific regression tests for any repaired visual or interaction
  defect so the approved baseline remains protected.

## Governance

1. Dashboard and Marketing remain the approved masters; do not regress them to
   make an unfinished page easier to implement.
2. Prefer existing shared components and tokens. Extract a new shared component
   only when it reduces genuine duplication while preserving behavior.
3. Do not globally override styles to force an unfinished page into compliance.
4. Do not invent data, hide required information, or redesign charts to create
   visual novelty.
5. Update this document and the Component Library when an approved pattern
   changes, then re-run visual QA for affected reference pages.
