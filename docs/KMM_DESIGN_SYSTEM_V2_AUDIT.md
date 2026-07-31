# KMM Design System v2.0 Audit

## Scope

Stage 0 covers presentation architecture only. Data, business calculations, authentication, routes, Firebase, Cloudflare Workers, PMTiles, MapLibre, API contracts, and permissions remain out of scope.

Audit branch: `feature/marketing-smart-click-layer-manager`

The worktree already contained uncommitted Marketing fullscreen, filter, toolbar, and comparison UX changes before this design-system audit. They are preserved and treated as an active dependency, not as Stage 0 cleanup.

## Current Architecture

- Framework: React 19, Next.js 16 APIs, Vinext, Vite 8, and Tailwind CSS 4.
- Runtime/deployment: Cloudflare Workers through Wrangler.
- Authentication: Firebase Auth with route-level `AuthGate`.
- Icons: Lucide React.
- Charts: custom React/SVG implementations; no external chart framework.
- Maps: MapLibre GL, PMTiles, Protomaps, and KME basemap modules.
- Localization: shared Thai and English locale context.
- Styling: Tailwind utility classes plus global Map/Presentation CSS.
- Tests: Node test suites for rendered HTML, map foundation, and release workflow.

## Routes

| Route | Main component | Current state |
| --- | --- | --- |
| `/` | `HomeRedirect` | Authentication-aware redirect |
| `/login` | `LoginForm` | Active |
| `/dashboard` | `DashboardPage` | Active |
| `/sales` | `SalesPage` | Active |
| `/booking` | `BookingIntelligencePage` | Active; route-level auth ownership differs from most routes |
| `/stock` | `StockIntelligencePage` | Active |
| `/marketing` | `MarketingIntelligencePage` | Active, map-first |
| `/expense` | `PlaceholderPage` | Placeholder |
| `/team` | `SalesOrganizationPage` | Active |
| `/settings` | `PlaceholderPage` | Placeholder |
| `/dev/vector-map` | `VectorMapPreview` | Development-only |

## Reusable Presentation Components

Existing primitives:

- `Button`, `Card`, `Badge`, `Progress`, `Skeleton`
- `PageHeader`, `FilterBar`, `KpiCard`, `ChartCard`, `TableCard`
- `SectionHeader`, `StatusBadge`, `ProductBadge`
- `EmptyState`, `ErrorState`, `LoadingSkeleton`, `ExportButton`
- `AppSidebar`
- Presentation mode trigger, layout, context, and dock
- Standard and premium SVG trend-chart components
- MapLibre map, layer manager, map fullscreen, legend, and Township panels

These components are the correct migration boundary. Stage 2 should update them before page-specific classes.

## Duplication Findings

- The most repeated colors are `#9CA3AF`, `#E5E7EB`, `#1F2937`, `#6B7280`, and `#4B5563`.
- More than 250 arbitrary visual utility occurrences were found for colors, borders, radii, and shadows.
- Page shell markup is repeated across Dashboard, Sales, Booking, Stock, Marketing, Team, and placeholder pages.
- Header heights are inconsistent: most pages use 82px while Marketing uses 56px for its map-first layout.
- Card treatments use several near-identical borders and custom shadows.
- Orange exists as `#FF8615`, `#FF7A00`, `#F97316`, and `#E86F00`; semantic intent is not explicit.
- Typography roles are mostly expressed with local utility combinations rather than named roles.
- Large page components mix data preparation, interactions, and presentation. Marketing and Dashboard are particularly sensitive.

## Risk Areas

1. Marketing map layout: fullscreen ownership, ResizeObserver behavior, panel padding, layer order, and selection state can regress from visual container changes.
2. Comparison UI: normal and fullscreen rendering use different panel paths and must not compress the map.
3. Charts: custom SVG geometry depends on container sizing; padding and font changes can clip labels.
4. Tables: many use fixed minimum widths and nested overflow regions; global overflow changes are unsafe.
5. Authentication: route wrappers are not fully uniform. Design work must not normalize auth behavior.
6. Presentation mode: global selectors intentionally alter shell visibility and spacing.
7. Mobile navigation: overlay and sidebar stacking depend on current z-index values.
8. Thai typography: compact labels at 10–12px require visual checks after each migration.
9. Existing tests assert selected class and structural strings. Shared-component migrations may require focused test updates.
10. Current uncommitted Marketing UX changes overlap `app/globals.css` and Marketing components and must remain intact.

## Stage 0 Decision

Adopt a token-first migration. Do not mass-replace arbitrary classes. New semantic tokens are introduced in `app/globals.css`; existing components continue rendering with their current classes until their controlled Stage 2 or Stage 3 migration.

The UI UX Max Pro search suggested a blue-led analytics palette and exaggerated minimalism. Both conflict with the explicit KMM brief, so they are rejected. The useful recommendations retained are dense dashboard spacing, restrained motion, visible focus, keyboard access, reduced-motion support, and systematic responsive checks.

## Verification Baseline

- Existing logo path and geometry: preserved.
- Sidebar position and navigation order: preserved.
- Routes: unchanged.
- Business and map logic: unchanged.
- Deployment configuration: unchanged.
- No page migration is included in Stage 0 or Stage 1.
