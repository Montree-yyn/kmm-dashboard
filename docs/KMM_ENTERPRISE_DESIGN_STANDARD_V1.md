# KMM Enterprise Design Standard v1.0

Status: Phase 1 specification — candidate for design lock before system-wide implementation
Scope: Presentation layer only. No API, database schema, metric definition, aggregation, selector, permission, coordinate, or stored-data changes are authorized by this standard.
Design direction: Enterprise Analytical Clarity / Precision Operations / Restrained Premium
Baseline: KMM Dashboard Design V3.5. Preserve its valid tokens, accessibility contract, single-company data isolation, and analytical truthfulness.

## 1. Enterprise Principles

1. Decision first. Every screen must make the primary business question obvious before exposing detail.
2. One visual language. Shared shell, controls, cards, charts, tables, states, and spacing must use the same token and component contracts.
3. Progressive disclosure. Overview answers what happened; secondary analysis explains why; drill-down identifies where/who; tables provide row-level detail.
4. Data before decoration. Use whitespace, alignment, typography, and separators before shadows, gradients, glass, or extra cards.
5. Semantic color only. Orange identifies brand/current focus. Green, yellow, and red are reserved for defined business status. Gray is the default comparison/neutral language.
6. No fabricated insight. Missing targets, comparisons, or definitions remain unavailable rather than being visually implied.
7. Dense but calm. Executive screens should fit meaningful information without competing cards or unnecessary chrome.
8. Safe migration. UI refactors must preserve data contracts and business logic unless a separate approved change explicitly authorizes otherwise.

## 2. Page Composition Contract

Every analytical page follows this order unless a documented exception exists:

1. Context — route title, active company, period/freshness, compact actions.
2. Filters — global context first; page-specific controls second.
3. Summary — maximum 5 primary KPI cards by default.
4. Primary Insight — one dominant chart, map, or decision visualization.
5. Supporting Analysis — 1 to 3 secondary modules.
6. Action / Exception — risks, gaps, or items needing attention.
7. Detail — drill-down, drawer, expandable section, or table.

Do not place every available chart/table at the same hierarchy level.

### Page width and gutters

- Application content uses the available shell width; avoid arbitrary narrow max-width containers on analytical pages.
- Desktop horizontal page padding: 16px minimum, 20–24px preferred where shell width permits.
- Section gap: 24px standard; 32px between major decision layers when visual separation is needed.
- Card/grid gap: 12px compact, 16px standard, 20px maximum for executive layouts.
- No page-level horizontal scrolling.

## 3. Grid Standard

Desktop analytical layouts use a 12-column mental model even when implemented with CSS grid templates.

- Primary chart: 7–8 columns.
- Secondary chart/panel: 4–5 columns.
- Equal comparison modules: 6 + 6.
- KPI row: maximum 5 cards on standard desktop; allow one featured KPI to span two columns only when it is the primary business outcome.
- Tables may span full width at the detail layer.

Responsive behavior:

- >= 1440px: full enterprise layout.
- 1024–1439px: compact desktop/tablet landscape; preserve hierarchy, reduce columns before reducing readable size.
- 768–1023px: 2-column supporting layouts; KPI cards generally 2 per row.
- < 768px: single-column analytical flow; no hidden content required to understand status.
- ~375px remains a release QA target.

## 4. Typography Standard

Use `--font-heading` (Plus Jakarta Sans) for headings and `--font-body` (Inter) for body, controls, tables, and data. IBM Plex Sans Thai and Noto Sans Myanmar remain the local Thai/Myanmar fallbacks; do not replace them with network-loaded fonts.

Allowed hierarchy:

- Page title: 28–30px, semibold, tight tracking.
- Section title: 18–20px, semibold.
- Card/chart title: 14–16px, semibold.
- KPI value: 30–34px standard; may scale down in narrow cards. Do not exceed 38px except a deliberately featured outcome.
- KPI/unit/supporting number: 12–14px.
- Body: 14px standard; 13px compact table/supporting UI.
- Caption/metadata: 11–12px.
- Labels: 12–13px, medium/semibold according to control role.

Rules:

- Use tabular figures for business numbers.
- Avoid uppercase except small eyebrow/status metadata.
- Do not create page-specific arbitrary font sizes without a documented design-system reason.
- Primary text uses `--text-primary`; secondary explanation uses `--text-secondary`; metadata uses `--text-tertiary`.

## 5. Color Standard

Retain existing semantic tokens in `app/globals.css` as the source of truth.

Brand:
- Primary/current focus: `--brand-500`.
- Hover/emphasis: `--brand-600`.
- Soft brand state: `--brand-50` / `--brand-100`.

Neutral surfaces:
- Canvas: `--surface-canvas`.
- Content card: `--surface-default`.
- Supporting subtle area: `--surface-subtle`.
- Disabled/neutral fill: `--surface-muted`.

Status:
- Success: `--status-success` only for defined positive/healthy meaning.
- Warning: `--status-warning` only for watch/attention meaning.
- Danger: `--status-danger` only for defined negative/critical meaning.
- Info: `--status-info` for informational state, not decoration.

Charts:
- Current/observed: `--chart-current`.
- Previous/comparison: `--chart-previous` or neutral gray.
- Target/plan: neutral gray, typically dashed/marker based.
- Risk colors must always be paired with a label, icon, line style, or explicit status text.

Forbidden for new work:
- arbitrary hard-coded hex colors inside page components when an equivalent semantic token exists;
- decorative gradients on analytical content;
- multi-color chart palettes without categorical or semantic meaning.

## 6. Radius Standard

The existing token family remains authoritative:

- Controls: `--radius-control` = 10px.
- Large controls: `--radius-control-lg` = 12px.
- Cards: `--radius-card` = 14px.
- Floating panels: `--radius-panel` = 18px.
- Pills/chips only: `--radius-pill`.

Do not introduce arbitrary radii in migrated components.

## 7. Elevation and Glass Standard

Elevation is functional, not decorative.

- Standard analytical card: one-pixel border + `--shadow-card` or no visible shadow.
- Hoverable selectable card: `--shadow-hover` only on hover/focus when interaction exists.
- Dropdown/popover/floating layer: `--shadow-floating`.
- Modal/drawer overlay: `--shadow-overlay`.
- Glass is limited to the global/control layer such as the global header/filter bar where already established.
- Charts, KPI cards, tables, operational forms, alerts, and content panels remain opaque.
- Avoid nested shadow-on-shadow card stacks.

## 8. Card Standard

A card is allowed only when it represents a logical content unit.

Use cards for:
- KPI metric;
- chart or analytical module;
- exception/attention group;
- clearly bounded settings/form section;
- drill-down summary.

Do not use cards for:
- decorative wrappers around a single label;
- redundant nested containers;
- toolbar buttons that can be standard controls;
- visual separation that whitespace/dividers can solve.

Maximum default nesting: one content card inside the page. Nested cards require a strong interaction or semantic reason.

## 9. KPI Standard

Default maximum: 5 primary KPI cards per analytical page.

Supported semantic roles:

1. Primary KPI — direct business outcome.
2. Secondary KPI — supporting business measure.
3. Exception KPI — a defined risk/gap requiring attention.

KPI structure:
- label;
- value + unit;
- comparison/status line only when comparison is valid;
- optional factual sparkline when data density supports it.

Rules:
- Not every KPI is featured.
- Color never replaces +/−, labels, or status wording.
- Do not display misleading YoY/target status when comparison scope is invalid.
- KPI cards must preserve height alignment within a row.

## 10. Filter and Control Standard

### Global context filters

Use when relevant:
- Year
- Month
- Company (via approved company context/switcher)
- Branch
- Product
- Salesperson

### Local/page-specific controls

Examples:
- Marketing: metric, map layer, comparison mode.
- Booking: booking status/stage.
- Stock: aging/status/product type.

Rules:
- Global context appears before local controls.
- Desktop filters should remain one compact row where practical; wrap cleanly on smaller widths.
- Use existing shared `FilterBar` and data controls unless a documented requirement cannot be satisfied.
- 44px interaction target where practical.
- Reset is the standard clearing action; avoid duplicated refresh/chip clutter unless functionally required.
- Selected values remain visible inside their controls.
- Menus/popovers remain opaque and sit above analytical surfaces.

## 11. Chart Standard

Every chart must answer a business question. Chart type is selected by analytical purpose, not visual preference.

- Time trend: line/area only with sufficient continuous history.
- Actual vs target: bullet/marker or clearly separated target line.
- Ranking: horizontal bar.
- Composition/share: 100% stacked bar preferred over donut when comparison accuracy matters.
- Supply vs demand: paired bars on common baseline.
- Status health: segmented bar + labels/counts.
- Aging/risk distribution: heatmap, histogram, lollipop, or ordered bars depending on source structure.
- Geographic performance: map with restrained overlays and drill-down.

Required behavior:
- visible chart title;
- optional concise subtitle explaining scope;
- exact values accessible by hover/touch/keyboard where interactive;
- visible legend when multiple series cannot be understood directly;
- no chart junk, unnecessary grid lines, decorative 3D, or excessive color;
- empty/insufficient history state instead of a misleading visualization.

## 12. Table Standard

Tables are detail-layer components, not the primary executive visualization unless the task is explicitly operational/data-entry oriented.

Rules:
- Use shared responsive table viewport.
- Sticky header where long vertical lists justify it.
- Horizontal scroll is allowed inside the table region, never at page level.
- Numerical columns right-align; text identifiers left-align; status columns use semantic badges.
- Sorting/search/export controls belong in a consistent table toolbar.
- Mobile may transform to a linear summary/list only when all critical information remains accessible.
- Dense row height target: approximately 44–48px for normal enterprise tables.

## 13. Drill-down Standard

Use progressive disclosure instead of placing all details on the overview.

Preferred sequence:

Overview -> selected entity -> drill-down drawer/panel -> full detail/table route when needed.

Use a drawer for:
- branch/product/salesperson summary;
- map area details;
- booking/stock exception details;
- quick contextual analysis that should not lose the parent page state.

Use a dedicated detail route when:
- the task requires sustained analysis, editing, many tabs, or large tables.

Drill-down must preserve active company and relevant filters.

## 14. Map Standard

The map is a spatial decision workspace.

Keep map canvas visually dominant. Floating controls must be compact and grouped by task.

Hierarchy:
- State/Division boundaries: primary administrative layer, restrained dashed treatment.
- Township/internal boundaries: lighter secondary treatment.
- State/Division labels: readable but not visually competing with selected data.
- Showroom markers: restrained pulse allowed because they represent persistent physical locations.
- Metric heat/color overlays must not obscure labels/boundaries.

Interaction:
- click/keyboard selection -> geographic drill-down;
- selected area receives one clear active state;
- details move to a side panel/drawer rather than permanently crowding the map;
- layer/metric/filter controls follow the same control tokens as the rest of the application.

## 15. Navigation Standard

Sidebar keeps the current shell behavior but modules are grouped conceptually:

- Overview: Dashboard, Daily Management.
- Commercial: Sales, Booking, Stock, Marketing.
- Intelligence: Weather, Expense.
- Organization: Team.
- Administration: Data Hub, Settings.

Rules:
- Role/permission visibility remains authoritative.
- Administration should not visually compete with core commercial workflows for ordinary users.
- Active route uses one brand indicator/state.
- Do not add duplicate quick-action navigation to dashboard cards when the sidebar already exposes the destination.

## 16. Operational Forms / Daily Management Standard

Operational/data-entry pages use the same shell and tokens but may be denser than executive dashboards.

Form hierarchy:
- context/title;
- progress/step if required;
- grouped form sections;
- validation/status message;
- sticky or end-of-form action bar when task length requires it.

Rules:
- standard controls and status badges;
- avoid decorative analytics cards around input fields;
- primary action is visually dominant; destructive actions are separated;
- loading/saving/error states must not lose entered data.

## 17. Loading, Empty, Error, and Freshness States

Every data surface supports:
- ready;
- loading;
- empty;
- error.

Rules:
- use skeletons for page/module loading where layout is known;
- use spinner primarily for short indeterminate control-level operations;
- empty state explains why no data is visible and provides the next valid action when one exists;
- error state explains impact and exposes Retry when recovery is possible;
- freshness/source state uses the shared freshness indicator and does not imply live data when the source is stale.

## 18. Interaction and Accessibility Standard

- Keyboard reachability for interactive UI.
- Visible focus ring using the existing focus token.
- Escape closes popover/modal/drawer when appropriate.
- Icon-only controls have accessible names.
- Minimum 44px target where practical for touch/mobile-critical actions.
- Status does not rely on color alone.
- Main text/control contrast targets WCAG AA.
- Respect reduced motion.
- Charts with interaction provide equivalent accessible value discovery.

## 19. Motion Standard

Allowed motion:
- state transitions;
- selection feedback;
- drawer/modal/popover transitions;
- factual loading state;
- showroom pulse;
- restrained hover feedback on genuinely interactive cards.

Standard durations use existing tokens:
- fast: 160ms;
- standard: 200ms;
- slow: 240ms.

Do not add continuous decorative animation, glow, bounce, or large transforms to analytical content.

## 20. Page-Specific Enterprise Decisions

### Dashboard
Keep core 5 KPI and primary sales trend. Merge redundant summaries. Move large detail datasets to drill-down. Target 6–8 meaningful modules in the executive decision layer.

### Sales
Keep current analytical core. Standardize page composition and controls. Use drill-down for branch/product/salesperson detail.

### Booking
Reduce simultaneous chart density. Keep the strongest booking lifecycle/pipeline/gap analyses; merge overlapping visualizations and move secondary detail to drill-down.

### Stock
Keep KPI, health, aging, supply/demand analyses. Move row-level inventory details to the detail layer.

### Marketing
Keep the map as the primary workspace. Standardize filters/toolbars/legend. Move area detail to geographic drill-down. Eliminate page-specific visual language that duplicates shared controls.

### Team
Keep organization visualization as the primary module. Reduce competing KPI/table weight. Salesperson detail becomes drill-down.

### Daily Management
Keep workflow and business inputs. Migrate visual styling to enterprise shell/forms/sections without changing workflow/data contracts.

### Settings / Company Management / Data Hub
Use configuration/workspace patterns, not executive dashboard decoration. Group settings logically and preserve role-based access.

## 21. Keep / Improve / Remove / Merge / Drill-down Rules

Keep when:
- business value is clear;
- component already follows enterprise tokens/contracts;
- information is needed at current hierarchy.

Improve when:
- business value is correct but visual hierarchy, responsiveness, accessibility, or consistency is weak.

Remove when:
- purely decorative;
- duplicates navigation/action/information;
- has no decision or operational value.

Merge when:
- multiple cards/controls/charts answer the same business question;
- local page implementation duplicates a shared design-system capability.

Drill-down when:
- information is valid but too detailed for the current hierarchy;
- interaction can preserve context while exposing detail on demand.

## 22. Migration Guardrails

During implementation phases:

- Do not change database schema.
- Do not alter API contracts.
- Do not change metric formulas/aggregation.
- Do not change company isolation or permissions.
- Do not change map coordinates/geographic source data unless separately approved.
- Do not rewrite working workflows merely to achieve visual consistency.
- Refactor presentation incrementally and verify route parity after each page.
- Keep changes phase-scoped and reviewable.

Required checks after each implementation slice:
- TypeScript check;
- lint;
- relevant automated tests;
- visual QA at desktop and mobile target widths;
- loading/empty/error states;
- keyboard/focus path for changed controls;
- Git diff review confirming only intended files changed.

## 23. Enterprise Design Lock Checklist

Before Phase 2 begins, approve the following as locked defaults:

- [ ] Page composition contract
- [ ] Typography hierarchy
- [ ] Existing semantic color/token direction
- [ ] 10/12/14/18px radius family
- [ ] restrained elevation/selective glass rule
- [ ] maximum 5 primary KPI default
- [ ] global-vs-local filter separation
- [ ] semantic chart rules
- [ ] table-as-detail-layer rule
- [ ] progressive drill-down pattern
- [ ] map-as-spatial-workspace pattern
- [ ] navigation grouping direction
- [ ] standard loading/empty/error/freshness states
- [ ] accessibility and motion rules
- [ ] presentation-only migration guardrails

Once this checklist is approved, Phase 2 may normalize shared components before page-by-page migration.
