# KMM Design System v2.0 Visual QA

## Stage 2 Status

The Dashboard page is the first page migrated to KMM Design System v2.0. No other page was modified as part of Stage 2.

The existing KMM logo, sidebar position, navigation order, routes, Dashboard data, KPIs, filters, chart implementations, and business calculations remain unchanged.

## Dashboard Evidence

| Artifact | Capture                                                                |
| -------- | ---------------------------------------------------------------------- |
| Before   | [kmm-v2-dashboard-before.png](screenshots/kmm-v2-dashboard-before.png) |
| After    | [kmm-v2-dashboard-after.png](screenshots/kmm-v2-dashboard-after.png)   |

The before capture uses the authenticated local Dashboard at `1280 × 690`. The final after capture uses the same live Dashboard module at `1280 × 900`.

Responsive evidence:

| Viewport | Capture                                                              |
| -------- | -------------------------------------------------------------------- |
| 1440px   | [kmm-v2-dashboard-1440.png](screenshots/kmm-v2-dashboard-1440.png)   |
| 1280px   | [kmm-v2-dashboard-after.png](screenshots/kmm-v2-dashboard-after.png) |
| 1024px   | [kmm-v2-dashboard-1024.png](screenshots/kmm-v2-dashboard-1024.png)   |
| 768px    | [kmm-v2-dashboard-768.png](screenshots/kmm-v2-dashboard-768.png)     |
| 390px    | [kmm-v2-dashboard-390.png](screenshots/kmm-v2-dashboard-390.png)     |

The after capture verifies:

- A single, clear `Executive Dashboard` page heading.
- All five KPI cards and their original values.
- The four original filters and three original actions.
- Existing Sales Trend and Target Progress chart content.
- Consistent semantic surfaces, type hierarchy, spacing, and Kubota orange emphasis.

## Required Viewports

| Viewport       | Status                                                                    |
| -------------- | ------------------------------------------------------------------------- |
| Desktop 1440px | PASS — no overflow or overlap; desktop sidebar and chart controls visible |
| Desktop 1280px | PASS — no overflow or overlap; trend toolbars fit half-width cards        |
| Tablet 1024px  | PASS — no overflow or overlap; desktop sidebar and stacked trend cards    |
| Tablet 768px   | PASS — no overflow or overlap; mobile navigation and two-column KPI grid  |
| Mobile 390px   | PASS — no overflow or overlap; single-column filters and KPI cards        |

## Per-Page Review Matrix

| Page               | Before screenshot | After screenshot | Content parity | Overflow/overlap                  | Thai typography         | Status           |
| ------------------ | ----------------- | ---------------- | -------------- | --------------------------------- | ----------------------- | ---------------- |
| Dashboard          | Captured          | Captured         | PASS           | PASS at captured desktop viewport | No Thai content changed | Stage 2 complete |
| Sales              | Pending           | Pending          | Pending        | Pending                           | Pending                 | Not migrated     |
| Booking            | Pending           | Pending          | Pending        | Pending                           | Pending                 | Not migrated     |
| Stock              | Pending           | Pending          | Pending        | Pending                           | Pending                 | Not migrated     |
| Marketing          | Captured          | Captured         | PASS           | PASS at five required widths      | PASS                    | Stage 3 complete |
| Sales Organization | Pending           | Pending          | Pending        | Pending                           | Pending                 | Not migrated     |
| Settings           | Pending           | Pending          | Pending        | Pending                           | Pending                 | Not migrated     |

## Foundation Review Notes

- Semantic tokens are additive and do not mass-override page components.
- System-font adoption may produce small text-width changes and must be checked at all supported widths during each page migration.
- Focus visibility is stronger and color-independent through outline plus outer ring.
- Reduced-motion behavior remains active.
- Marketing fullscreen background now references the semantic canvas token; map logic and sizing behavior are unchanged.
- Current Marketing UX work remains uncommitted and requires its own review/commit decision outside this Dashboard gate.

## Dashboard Stage 2 Verification

| Check                              | Result                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| TypeScript (`npx tsc --noEmit`)    | PASS                                                                                                        |
| Tests (`npm test`)                 | PASS — 32/32                                                                                                |
| Production build (`npm run build`) | PASS                                                                                                        |
| Authenticated Dashboard render     | PASS                                                                                                        |
| Heading hierarchy                  | PASS — one `h1`, chart sections remain `h2`                                                                 |
| Filter availability                | PASS — Year, Month, Branch, Salesperson                                                                     |
| Filter interaction                 | PASS — Month exposes 12 options; selecting January updates Sales Unit from 1712 to 177; Reset restores 1712 |
| KPI parity                         | PASS — Sales Unit, Sales Value, Gross Profit, Open Booking Unit, Stock Unit                                 |
| Chart parity                       | PASS — Sales, Booking, Stock, target, branch, product, booking, and stock views remain                      |
| Responsive geometry                | PASS — document width equals viewport width at 1440, 1280, 1024, 768, and 390px                             |
| Card overlap                       | PASS — zero KPI or chart sibling overlaps at all required widths                                            |
| Control sizing                     | PASS — visible Dashboard buttons and selects meet the 44px target                                           |
| Console errors                     | PASS — zero console errors, runtime exceptions, or unhandled rejections                                     |
| Network errors                     | PASS — zero failed application resources; `dashboard-data.json` returned HTTP 200                           |
| Thai clipping                      | Not applicable — the Dashboard contains no Thai text; no Thai content was altered                           |
| Other page migration               | None                                                                                                        |

Build output retains two known non-blocking notices: Vinext cannot yet classify every route through static analysis, and the client build reports a chunk larger than 500 kB. Neither notice was introduced by the Dashboard-only visual migration.

## Stage 2 Defects Fixed

- Trend-card grid items now use `min-width: 0`, allowing the existing 680px chart plot to scroll inside its intended chart viewport instead of expanding the page at mobile widths.
- Trend controls stack below the title below 1400px and return to the compact row layout at wider desktop widths.
- Dashboard trend controls, sidebar controls, navigation links, and searchable filter options meet the 44px interaction target without changing shared components on unfinished pages.

## Manual Review Risks

- The Dashboard does not currently include Thai labels, so Thai wrapping requires review when a page containing Thai content is migrated.
- The responsive automation renders the live `DashboardPage` module with its real data request and styles; the authenticated local browser baseline remains the route-level authentication check.
- Presentation mode is preserved but was not included in this Dashboard-only viewport matrix.
- The Vinext route-classification and client chunk-size notices remain project-level build limitations.

## Stage 3 Marketing Evidence

Stage 3 migrates only the Marketing presentation layer. PMTiles, MapLibre,
Firebase, APIs, filters, Smart Click, Smart Zoom, fullscreen, Compare Area,
township data, Natural Breaks classification, routes, and business
calculations are unchanged.

| Artifact   | Capture                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| Before     | [kmm-v2-marketing-before.png](screenshots/kmm-v2-marketing-before.png)         |
| After      | [kmm-v2-marketing-after.png](screenshots/kmm-v2-marketing-after.png)           |
| Fullscreen | [kmm-v2-marketing-fullscreen.png](screenshots/kmm-v2-marketing-fullscreen.png) |

The isolated BEFORE capture records the pre-migration shell, filter bar, map
frame, and empty intelligence panel. WebGL was unavailable in that baseline
capture, so the legacy map notice is not used as map-runtime evidence. All
AFTER captures use the live MapLibre and PMTiles runtime.

Responsive evidence:

| Viewport | Capture                                                              | Result                                                |
| -------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| 1440px   | [kmm-v2-marketing-1440.png](screenshots/kmm-v2-marketing-1440.png)   | PASS - immersive map with fixed intelligence column   |
| 1280px   | [kmm-v2-marketing-after.png](screenshots/kmm-v2-marketing-after.png) | PASS - map remains dominant beside one detail panel   |
| 1024px   | [kmm-v2-marketing-1024.png](screenshots/kmm-v2-marketing-1024.png)   | PASS - floating detail panel preserves map context    |
| 768px    | [kmm-v2-marketing-768.png](screenshots/kmm-v2-marketing-768.png)     | PASS - compact filters and floating detail panel      |
| 390px    | [kmm-v2-marketing-390.png](screenshots/kmm-v2-marketing-390.png)     | PASS - filters wrap and detail becomes a bottom sheet |

## Marketing Stage 3 Verification

| Check                              | Result                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| Map dominance                      | PASS - map is no longer wrapped in a decorative card                                |
| Smart Click                        | PASS - selected Township highlight and intelligence content update together         |
| Township Intelligence              | PASS - Header, primary KPIs, Insights, Recommended Actions, and Metadata            |
| Missing data                       | PASS - unavailable business fields render `รอข้อมูล`                                |
| Compare Area                       | PASS - two selected Townships render in one comparison panel                        |
| Fullscreen                         | PASS - filters, map toolbar, legend, selection, and floating panel remain available |
| Layer Manager                      | PASS - 10 controls render; available layers toggle without map reload               |
| Map toolbar                        | PASS - custom and MapLibre controls use 44px targets and accessible names           |
| Legend                             | PASS - live Natural Breaks ranges retain adjacent text and no-data treatment        |
| Responsive geometry                | PASS - document width equals viewport width at all five required widths             |
| TypeScript (`npx tsc --noEmit`)    | PASS                                                                                |
| Lint (`npm run lint`)              | PASS - zero errors; 54 existing warnings remain                                     |
| Tests (`npm run test`)             | PASS - 32/32                                                                        |
| Production build (`npm run build`) | PASS                                                                                |
| Console errors                     | PASS - zero console errors, runtime exceptions, or unhandled rejections             |
| Network errors                     | PASS - zero HTTP 4xx/5xx application responses                                      |
| PMTiles                            | PASS - local basemap and township Range requests returned HTTP 206                  |

MapLibre cancels obsolete tile requests with `net::ERR_ABORTED` when responsive
QA changes the viewport or Smart Zoom changes the camera. CDP marks each as
`canceled: true`; these are expected tile cancellations, not failed
application requests or CORS failures.

## Stage 3 Known Limitations

- Booking, Customer, Campaign, Competitor, Last Sales Visit, Remark, and
  recommendation data are not present in the current Township source and
  correctly remain `รอข้อมูล`.
- The production build still reports the existing Vinext route-classification
  and large client-chunk notices.
- Authentication was not changed. Isolated visual QA mounts the real Marketing
  component inside the application Locale provider because the automation
  profile does not hold the user's Firebase session.

## Marketing Final Polish

The final-polish pass changes presentation only. The Stage 3 after capture is
the polish baseline; map sources, layers, classifications, filters, selection,
comparison calculations, Firebase data, and application behavior are
unchanged.

| Artifact      | Capture                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Before polish | [kmm-v2-marketing-after.png](screenshots/kmm-v2-marketing-after.png)                           |
| After polish  | [kmm-v2-marketing-polish-after.png](screenshots/kmm-v2-marketing-polish-after.png)             |
| Layer Manager | [kmm-v2-marketing-polish-layers.png](screenshots/kmm-v2-marketing-polish-layers.png)           |
| Compare Area  | [kmm-v2-marketing-polish-compare.png](screenshots/kmm-v2-marketing-polish-compare.png)         |
| Fullscreen    | [kmm-v2-marketing-polish-fullscreen.png](screenshots/kmm-v2-marketing-polish-fullscreen.png)   |
| 400% review   | [kmm-v2-marketing-polish-400-percent.png](screenshots/kmm-v2-marketing-polish-400-percent.png) |

Responsive polish evidence:

| Viewport | Capture                                                                          | Result |
| -------- | -------------------------------------------------------------------------------- | ------ |
| 1440px   | [kmm-v2-marketing-polish-1440.png](screenshots/kmm-v2-marketing-polish-1440.png) | PASS   |
| 1280px   | [kmm-v2-marketing-polish-1280.png](screenshots/kmm-v2-marketing-polish-1280.png) | PASS   |
| 1024px   | [kmm-v2-marketing-polish-1024.png](screenshots/kmm-v2-marketing-polish-1024.png) | PASS   |
| 768px    | [kmm-v2-marketing-polish-768.png](screenshots/kmm-v2-marketing-polish-768.png)   | PASS   |
| 390px    | [kmm-v2-marketing-polish-390.png](screenshots/kmm-v2-marketing-polish-390.png)   | PASS   |

### Final Polish Verification

| Check                              | Result                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Township hierarchy                 | PASS - Overview, Performance, Insights, YoY, Recommended Action, then Metadata                         |
| Primary KPI                        | PASS - active metric is the single visual anchor with tabular numerals                                 |
| KPI density                        | PASS - secondary metrics share one quiet divided surface without repeated card borders                 |
| Layer Manager                      | PASS - compact 240px surface, tighter rows, aligned accessible switches                                |
| Legend                             | PASS - compact floating surface with lighter border and shadow                                         |
| Toolbar                            | PASS - 44px controls, consistent hover/focus/active states, restrained 8px blur                        |
| Compare Area                       | PASS - two-township columns fit simultaneously; 3-4 selections retain intentional horizontal scrolling |
| Fullscreen                         | PASS - filter bar, toolbar, legend, panel, and native controls share the same visual system            |
| Control overlap                    | PASS - native MapLibre controls report zero overlap with the 400px floating panel                      |
| Responsive geometry                | PASS - zero horizontal overflow at 1440, 1280, 1024, 768, and 390px                                    |
| 400% review                        | PASS - zero horizontal overflow; no clipped Marketing controls or uneven filter alignment              |
| TypeScript (`npx tsc --noEmit`)    | PASS                                                                                                   |
| Lint (`npm run lint`)              | PASS - zero errors; 54 existing warnings remain                                                        |
| Tests (`npm run test`)             | PASS - 32/32                                                                                           |
| Production build (`npm run build`) | PASS                                                                                                   |
| Console                            | PASS - zero errors, warnings, exceptions, or unhandled rejections                                      |
| Network                            | PASS - zero HTTP 4xx/5xx and zero non-cancelled failed requests                                        |
| PMTiles                            | PASS - basemap and Township assets returned HTTP 206                                                   |

### Intentionally Unchanged

- Business values, missing-data treatment, Natural Breaks colors, and active
  metric behavior.
- PMTiles, MapLibre source/layer lifecycle, Smart Click, Smart Zoom, filters,
  markers, comparison selection, and Firebase/API access.
- Existing navigation, theme tokens, page routes, and all non-Marketing pages.
- Fields absent from the source remain `รอข้อมูล`; no display-only data was
  invented.

## Complete Marketing Audit

This controlled pass compares the deployed Marketing implementation as far as
the unauthenticated automation profile permits, then verifies the current
Marketing component in a fresh cache-disabled local browser runtime. It changes
only two confirmed presentation regressions.

### Issues And Repairs

| Issue                                              | Root cause                                                                                                                                      | Repair                                                                                                  | Result                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Filter dropdowns rendered behind the map           | `backdrop-filter` created a toolbar stacking context with `z-index: auto`, preventing its `z-50` popovers from outranking the later map sibling | Added a Marketing-scoped positioned stacking context at `z-index: 20` with visible overflow             | PASS in normal and fullscreen layouts                         |
| Compare Area text was larger than adjacent filters | The unlayered global `font: inherit` reset outranked Tailwind's layered text utility, so the button inherited 16px/400 typography               | Added a Marketing-scoped 11px/700 control typography contract                                           | PASS; height, padding, radius, and baseline match the filters |
| Showroom markers reported missing locally          | Not reproduced: all six data-backed markers rendered at the default viewport and responded to the Showroom switch                               | No runtime code changed; added a regression contract around data loading and visibility synchronization | PASS                                                          |

### Runtime Evidence

| Artifact                         | Capture                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Dropdown before repair           | [kmm-v2-marketing-audit-dropdown-before.png](screenshots/kmm-v2-marketing-audit-dropdown-before.png) |
| Dropdown after repair            | [kmm-v2-marketing-audit-dropdown-after.png](screenshots/kmm-v2-marketing-audit-dropdown-after.png)   |
| Fullscreen with comparison state | [kmm-v2-marketing-audit-fullscreen.png](screenshots/kmm-v2-marketing-audit-fullscreen.png)           |
| Fresh cache-disabled runtime     | [kmm-v2-marketing-audit-runtime-clean.png](screenshots/kmm-v2-marketing-audit-runtime-clean.png)     |
| 1440px audit                     | [kmm-v2-marketing-audit-1440.png](screenshots/kmm-v2-marketing-audit-1440.png)                       |
| 390px audit                      | [kmm-v2-marketing-audit-390.png](screenshots/kmm-v2-marketing-audit-390.png)                         |

The cache-disabled runtime recorded zero console errors, zero unhandled promise
rejections, zero non-cancelled failed requests, and zero HTTP 4xx/5xx
responses. Basemap and Township PMTiles requests returned HTTP 206.

### Functional Verification

- Smart Click selected Taunggyi and rendered its actual Township and KPI data.
- Smart Zoom stopped at 7.8; selecting the same Township again did not increase
  zoom.
- Compare Mode selected Taunggyi and Pyinoolwin, rendered one comparison panel,
  retained both selections across fullscreen and Escape, and passed Remove and
  Clear.
- Township Boundary, Showroom, and Sales Heatmap toggles changed visibility
  without map reload or duplicate sources/layers.
- Dealer, Customer, Booking Heatmap, Sales Visit, Campaign, Competitor, and
  Stock Location remain disabled with `รอข้อมูล` because no source exists.
- Metric changes updated the Natural Breaks legend immediately; Thai and English
  controls remained operable.
- At 1440, 1280, 1024, 768, and 390px the document had zero horizontal overflow,
  the map remained interactive, and the six showroom markers remained visible.

### Prevention And Scope

- Added `tests/marketing-regression.test.mjs` contracts for the existing route,
  data-backed marker visibility, layer availability and toggling, dropdown
  stacking, Compare control geometry, shared Compare state, fullscreen panel
  visibility, and map-first sizing.
- PMTiles, MapLibre lifecycle, data, Natural Breaks, filters, Smart Click,
  Smart Zoom, comparison calculations, APIs, authentication, routes, and all
  non-Marketing pages were intentionally left unchanged.
- Authenticated production interaction remains a manual check: the automation
  profile reaches the Firebase login gate. The deployed bundle contains the
  same showroom data URL and visibility pipeline, but that static inspection is
  not treated as authenticated production-runtime proof.

## Stage 4 Sales Migration

Stage 4 applies the approved Dashboard hierarchy and Marketing interaction
standards to the existing Sales page presentation. Sales data, KPI formulas,
chart inputs, filters, sorting, pagination, routes, and authentication remain
unchanged.

### Before And After

| State  | Capture                                                        |
| ------ | -------------------------------------------------------------- |
| Before | [kmm-v2-sales-before.png](screenshots/kmm-v2-sales-before.png) |
| After  | [kmm-v2-sales-after.png](screenshots/kmm-v2-sales-after.png)   |

The before capture was reproduced from the pre-Stage 4 `HEAD` Sales component
with the already approved application tokens. The after capture mounts the
current Sales component in the same cache-disabled local runtime.

### Preserved Business Values

| KPI                         | Before | After  |
| --------------------------- | ------ | ------ |
| Sales Unit                  | 151    | 151    |
| Sales Value                 | 23.02B | 23.02B |
| Gross Profit                | 2.04B  | 2.04B  |
| Achievement                 | 45.1%  | 45.1%  |
| Average Selling Price (ASP) | 152.5M | 152.5M |

The selected filter state also remained Year `2026`, six selected months,
Branch `All`, Salesperson `All`, and Product Group `All Products`.

### Responsive Evidence

| Viewport | Capture                                                    | Result |
| -------- | ---------------------------------------------------------- | ------ |
| 1440px   | [kmm-v2-sales-1440.png](screenshots/kmm-v2-sales-1440.png) | PASS   |
| 1280px   | [kmm-v2-sales-1280.png](screenshots/kmm-v2-sales-1280.png) | PASS   |
| 1024px   | [kmm-v2-sales-1024.png](screenshots/kmm-v2-sales-1024.png) | PASS   |
| 768px    | [kmm-v2-sales-768.png](screenshots/kmm-v2-sales-768.png)   | PASS   |
| 390px    | [kmm-v2-sales-390.png](screenshots/kmm-v2-sales-390.png)   | PASS   |

All five filter controls retained a 44px target at every required viewport.
The Sales shell, filters, KPI grid, chart cards, and controls remained within
the viewport. The 11-column transaction table intentionally scrolls inside its
own bordered container and does not widen the page.

### Stage 4 Verification

| Check                              | Result                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------- |
| Golden Reference shell             | PASS - 72px header, semantic surfaces, page hierarchy, and token usage  |
| KPI hierarchy                      | PASS - five values, units, trends, and comparison periods preserved     |
| Charts                             | PASS - existing chart library and data inputs preserved                 |
| Rankings                           | PASS - branch, salesperson, product, and model rankings preserved       |
| Transaction table                  | PASS - all 11 columns, sorting, search, export, and pagination retained |
| Responsive                         | PASS - 1440, 1280, 1024, 768, and 390px                                 |
| Accessibility                      | PASS - one Sales `h1`, named controls, focus ring, and keyboard filters |
| TypeScript (`npx tsc --noEmit`)    | PASS                                                                    |
| Lint (`npm run lint`)              | PASS - zero errors; 54 existing repository warnings remain              |
| Tests (`npm run test`)             | PASS - 47/47                                                            |
| Production build (`npm run build`) | PASS                                                                    |
| Console                            | PASS - zero errors or unhandled exceptions                              |
| Network                            | PASS - zero failed requests and zero HTTP 4xx/5xx responses             |

### Stage 4 Scope And Limitations

- Only `components/sales/sales-page.tsx`, the Sales regression contract, the
  test command, this QA record, and Sales screenshots changed for Stage 4.
- Dashboard, Marketing, Booking, Stock, Sales Organization, Settings,
  Firebase, APIs, and business calculations were not intentionally modified.
- Lint reports 54 pre-existing warnings across the repository, including the
  unused legacy `SalesTrendChart`; Stage 4 introduces no lint errors.
- The automation profile does not contain the user's Firebase credentials.
  Visual QA therefore mounts the real Sales component inside the application
  locale provider after the login route loads; authentication code and behavior
  are unchanged.

## Cross-Page Golden Reference Audit

This audit compares only the approved Dashboard, Marketing, and Sales pages
against `docs/KMM_GOLDEN_REFERENCE.md`. It normalizes presentation contracts
without changing business values, filters, charts, map behavior, routes, data,
or authentication.

### Normalized Inconsistencies

| Area                 | Normalization                                                                                                          | Result |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| Page hierarchy       | Sales now uses the same 32x4px orange title anchor and 28/30px page-title scale as Dashboard                           | PASS   |
| Header controls      | Presentation, navigation, and notification controls retain 44px targets                                                | PASS   |
| Filter controls      | Dashboard, Sales, and Marketing workspace filters use 44px control height and token radii                              | PASS   |
| Dropdown behavior    | Dashboard and Sales expose names/listbox semantics and close with Escape                                               | PASS   |
| KPI cards            | Dashboard and Sales use the same 160px minimum height, five-track grid, radius, shadow, hover, and tabular numerals    | PASS   |
| Chart cards          | Sales chart headings and trend-chart controls now match Dashboard tracking, 44px controls, surface, border, and shadow | PASS   |
| Status color         | Notification indicators use `--status-danger`; orange remains reserved for brand/active/focus use                      | PASS   |
| Loading/error states | Dashboard and Sales share busy/live semantics, stable 320px geometry, token surfaces, and error treatment              | PASS   |
| Marketing workspace  | The approved 56px map-first shell remains; filters/Compare are normalized to 44px without remounting the map           | PASS   |

### Browser Computed-Style Evidence

| Contract         | Dashboard                             | Sales                                 | Marketing                          |
| ---------------- | ------------------------------------- | ------------------------------------- | ---------------------------------- |
| Header           | 72px                                  | 72px                                  | 56px approved workspace exception  |
| Page title       | 30px / 600                            | 30px / 600                            | 17px / 600 compact workspace title |
| Filter controls  | 44px / 12px radius                    | 44px / 12px radius                    | 44px / 10px radius                 |
| KPI cards        | 160px / 16px radius / `--shadow-card` | 160px / 16px radius / `--shadow-card` | Not applicable to map workspace    |
| Chart controls   | 44px                                  | 44px                                  | Not applicable                     |
| Status indicator | `rgb(217, 45, 32)`                    | `rgb(217, 45, 32)`                    | `--status-danger`                  |
| Desktop overflow | 0                                     | 0                                     | 0                                  |
| Mobile overflow  | 0                                     | 0                                     | 0                                  |
| Runtime errors   | 0                                     | 0                                     | 0                                  |

Dashboard and Sales dropdowns opened from their trigger and closed with Escape.
Marketing retained a live MapLibre canvas after its controls increased to
44px. At 1440px its map remained the dominant 743px-high workspace; at 390px
the controls wrapped without horizontal overflow and the map canvas remained
mounted.

### Cross-Page Quality Gate

| Check                              | Result                                          |
| ---------------------------------- | ----------------------------------------------- |
| Golden Reference consistency       | PASS                                            |
| TypeScript (`npx tsc --noEmit`)    | PASS                                            |
| Lint (`npm run lint`)              | PASS - zero errors; 54 existing warnings remain |
| Tests (`npm run test`)             | PASS - 52/52                                    |
| Production build (`npm run build`) | PASS                                            |
| Browser verification               | PASS - Dashboard, Marketing, and Sales          |
| Console/runtime errors             | PASS - zero blocking errors                     |
| Network errors                     | PASS - zero failed application requests         |

The existing Vinext route-classification notice, client chunk-size warning, and
54 repository lint warnings remain unchanged. They are not visual consistency
regressions and were not expanded into unrelated refactoring.

## Stage 5 Booking Migration

Stage 5 applies the approved Dashboard and Sales executive analytics language
to the existing Booking page. Booking selectors, KPI calculations, status and
aging rules, filters, chart data, export content, routes, and source data remain
unchanged.

### Before And After

| State  | Capture                                                            |
| ------ | ------------------------------------------------------------------ |
| Before | [kmm-v2-booking-before.png](screenshots/kmm-v2-booking-before.png) |
| After  | [kmm-v2-booking-after.png](screenshots/kmm-v2-booking-after.png)   |

The after capture uses the real Booking component and current
`/dashboard-data.json` response in a fresh cache-disabled local Chromium
runtime.

### Preserved Business Values

| KPI                     | Before   | After    |
| ----------------------- | -------- | -------- |
| Open Booking Unit       | 66 Units | 66 Units |
| Booking Value           | 9,755.9M | 9,755.9M |
| Deposit Received        | 108.5M   | 108.5M   |
| Average Booking Age     | 60 Days  | 60 Days  |
| Booking Conversion Rate | 49.2%    | 49.2%    |

The booking-aging distribution also remained unchanged: `36` Healthy, `16`
Watch, `3` At Risk, and `11` Critical.

### Responsive Evidence

| Viewport | Capture                                                        | Result |
| -------- | -------------------------------------------------------------- | ------ |
| 1440px   | [kmm-v2-booking-1440.png](screenshots/kmm-v2-booking-1440.png) | PASS   |
| 1280px   | [kmm-v2-booking-1280.png](screenshots/kmm-v2-booking-1280.png) | PASS   |
| 1024px   | [kmm-v2-booking-1024.png](screenshots/kmm-v2-booking-1024.png) | PASS   |
| 768px    | [kmm-v2-booking-768.png](screenshots/kmm-v2-booking-768.png)   | PASS   |
| 390px    | [kmm-v2-booking-390.png](screenshots/kmm-v2-booking-390.png)   | PASS   |

All six filter triggers measured 44px at every viewport. Page-level horizontal
overflow measured `0px` at all five widths. The 15-column Booking Detail table
remains horizontally scrollable inside its own bordered container.

### Stage 5 Verification

| Check                              | Result                                                              |
| ---------------------------------- | ------------------------------------------------------------------- |
| Golden Reference shell             | PASS - 72px header, semantic surfaces, title hierarchy, token usage |
| KPI hierarchy                      | PASS - five source-backed values and units preserved                |
| Booking pipeline and aging         | PASS - stages, thresholds, distribution, and status rules preserved |
| Charts and rankings                | PASS - existing chart library and data inputs retained              |
| Booking Detail                     | PASS - 15 columns, search, export, and pagination retained          |
| Responsive                         | PASS - 1440, 1280, 1024, 768, and 390px                             |
| Accessibility                      | PASS - named controls, 44px targets, focus, and Escape dismissal    |
| TypeScript (`npx tsc --noEmit`)    | PASS                                                                |
| Lint (`npm run lint`)              | PASS - zero errors; 53 existing repository warnings remain          |
| Tests (`npm run test`)             | PASS - 59/59                                                        |
| Production build (`npm run build`) | PASS                                                                |
| Console                            | PASS - zero errors, warnings, or unhandled exceptions               |
| Network                            | PASS - data HTTP 200; zero failed requests or HTTP 4xx/5xx          |

### Stage 5 Scope And Limitations

- Stage 5 changes the Booking presentation, adds the Booking regression
  contract, enables a presentation-only `className` override on the shared
  `TableCard`, records screenshots, and includes the new test in the test
  command.
- Dashboard, Marketing, Sales, Stock, Sales Organization, Settings, Firebase,
  APIs, authentication, Cloudflare configuration, and business calculations
  were not intentionally modified.
- The existing Vinext route-classification notice, client chunk-size warning,
  and 53 unrelated repository lint warnings remain. Booking introduces no lint
  error or warning.
- The isolated browser profile does not contain Firebase credentials. Visual
  QA mounts the real Booking component inside the canonical locale provider
  after loading the application runtime; authentication code and behavior are
  unchanged.

## Stage 5.5 Shared KPI Card

Stage 5.5 replaces the duplicate approved KPI presentation implementations in
Dashboard, Sales, and Booking with the shared
`components/design-system/kpi-card.tsx` executive variant. KPI labels, values,
units, trends, comparison periods, selectors, calculations, ordering, and page
grids remain unchanged.

### Shared Contract

| Contract                   | Result                                                                      |
| -------------------------- | --------------------------------------------------------------------------- |
| Fixed card height          | 160px                                                                       |
| Header zone                | 24px                                                                        |
| Value zone                 | 48px                                                                        |
| Context zone               | 40px                                                                        |
| Footer zone                | 14px                                                                        |
| Value/unit alignment       | Native flex baseline                                                        |
| Primary numeric typography | Tabular, 32px/40px; 26px only below a 168px card content width; 34px at 2xl |
| Loading and empty geometry | Reserved inside the same fixed grid                                         |
| Semantic states            | Positive, warning, negative, neutral                                        |

Dashboard, Sales, and Booking contain no local KPI card function or
page-specific KPI class override after migration. Stock and Sales Organization
remain visually unchanged through the shared legacy compatibility variant
until their approved migration stages.

### Stage 5.5 Regression Contract

- `tests/kpi-card-regression.test.mjs` verifies the public API, fixed zones,
  true baseline structure, tabular values, loading/empty states, semantic
  trends, shared usage, preserved labels, selector/calculation attachment, and
  legacy isolation for unmigrated pages.
- Dashboard, Sales, and Booking regression tests now resolve the KPI
  presentation contract from the shared component rather than duplicated page
  markup.
- The shared executive KPI component is mandatory for Stock and all remaining
  page migrations.

### Stage 5.5 Visual Evidence

| Approved page | Shared KPI capture                                                             |
| ------------- | ------------------------------------------------------------------------------ |
| Dashboard     | [kmm-v2-shared-kpi-dashboard.png](screenshots/kmm-v2-shared-kpi-dashboard.png) |
| Sales         | [kmm-v2-shared-kpi-sales.png](screenshots/kmm-v2-shared-kpi-sales.png)         |
| Booking       | [kmm-v2-shared-kpi-booking.png](screenshots/kmm-v2-shared-kpi-booking.png)     |

At 1440, 1280, 1024, 768, and 390px, all three pages measured:

- Five KPI cards using the shared executive variant.
- One 160px card height and one 41px primary-value offset.
- Native `baseline` alignment in every value/unit zone.
- Zero clipped values or units.
- Zero page-level horizontal overflow.

The 1280px five-card layout uses the shared narrow-container safeguard for
long currency values. This is a discrete card-width rule, not viewport-scaled
typography, and does not change KPI content.

### Stage 5.5 Quality Gate

| Check                | Result                                                                    |
| -------------------- | ------------------------------------------------------------------------- |
| Shared KPI component | PASS                                                                      |
| Dashboard parity     | PASS                                                                      |
| Sales parity         | PASS                                                                      |
| Booking parity       | PASS                                                                      |
| Responsive           | PASS - 15 page/viewport combinations                                      |
| Accessibility        | PASS - semantic trend cues, accessible loading state, visible text status |
| TypeScript           | PASS                                                                      |
| Lint                 | PASS - zero errors; 53 existing repository warnings                       |
| Tests                | PASS - 65/65                                                              |
| Production build     | PASS                                                                      |
| Console              | PASS - zero errors, warnings, or unhandled exceptions                     |
| Network              | PASS - three data requests; zero failed requests or HTTP 4xx/5xx          |

## Stage 6 Stock Intelligence Migration

Stage 6 applies the approved Golden Reference presentation to the existing
Stock page. Stock selectors, product definitions, age buckets, risk labels,
model ranking, filters, sorting, export, pagination, source data, and all
displayed calculations remain in the Stock feature layer.

### Before And After

| State  | Capture                                                        |
| ------ | -------------------------------------------------------------- |
| Before | [kmm-v2-stock-before.png](screenshots/kmm-v2-stock-before.png) |
| After  | [kmm-v2-stock-after.png](screenshots/kmm-v2-stock-after.png)   |

The captures mount the real `StockIntelligencePage` with the current
`/dashboard-data.json` response inside the canonical locale provider.
Authentication files and behavior were not modified.

### Preserved Business Values

| KPI               | Before   | After    |
| ----------------- | -------- | -------- |
| Stock Unit        | 76 Units | 76 Units |
| Stock Value       | 394.1M   | 394.1M   |
| Average Stock Age | 203 Days | 203 Days |
| Aged Stock        | 30       | 30       |
| Stock Coverage    | 1.2x     | 1.2x     |

Product composition also remained unchanged: `TT 10`, `CH 60`, `EX 1`,
`TP 5`, and `MAX 0`. All model names, including Thai/English mixed labels,
remain visible in the contained detail table.

The current Stock source and pre-migration page contain no Stock-specific
Purchase Plan or Received metric. Stage 6 intentionally does not infer these
values from the Sales plan or fabricate additional KPIs.

### Responsive Evidence

| Viewport | Capture                                                    | Result |
| -------- | ---------------------------------------------------------- | ------ |
| 1440px   | [kmm-v2-stock-1440.png](screenshots/kmm-v2-stock-1440.png) | PASS   |
| 1280px   | [kmm-v2-stock-1280.png](screenshots/kmm-v2-stock-1280.png) | PASS   |
| 1024px   | [kmm-v2-stock-1024.png](screenshots/kmm-v2-stock-1024.png) | PASS   |
| 768px    | [kmm-v2-stock-768.png](screenshots/kmm-v2-stock-768.png)   | PASS   |
| 390px    | [kmm-v2-stock-390.png](screenshots/kmm-v2-stock-390.png)   | PASS   |

At all five viewports:

- Page-level horizontal overflow measured `0px`.
- All five KPI cards measured `160px` high with a `41px` value-zone offset.
- Every KPI value/unit row used native baseline alignment and had `0px`
  clipping.
- All four filter triggers measured `44px`.
- Stock Aging Matrix and Stock Detail overflow remained contained inside their
  own horizontal scrollers.
- Thai and English model labels remained present.

Browser zoom checks at 100%, 125%, 150%, and 200% also measured zero final
page overflow, KPI clipping, or control clipping. The Stock Trend controls use
a Stock-specific narrow-width wrap below 760px to remain contained at 200%
zoom.

### Interaction And Accessibility Verification

- Branch filtering changed Stock Unit from `76` to `56` for KMM01 and Reset
  restored `76`.
- Filter menus exposed listbox state, searchable options, visible labels,
  44px controls, and Escape dismissal.
- Stock Detail search returned the expected `BS350` row without changing
  sorting, pagination, or export behavior.
- Numeric KPI, branch, chart, and table values use tabular figures.
- Focus-visible rings, named pagination controls, semantic table headers, and
  reduced-motion handling are present.

### Stage 6 Quality Gate

| Check                               | Result                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Scope compliance                    | PASS - Stock UI, related test contracts, test command, and QA docs only |
| Golden Reference                    | PASS                                                                    |
| Shared executive KPI Card           | PASS                                                                    |
| KPI and calculation parity          | PASS                                                                    |
| Product and model breakdown parity  | PASS                                                                    |
| Filters, sorting, table, and export | PASS                                                                    |
| Responsive and browser zoom         | PASS                                                                    |
| Accessibility                       | PASS                                                                    |
| TypeScript (`npx tsc --noEmit`)     | PASS                                                                    |
| Lint (`npm run lint -- --quiet`)    | PASS - zero errors                                                      |
| Tests (`npm run test`)              | PASS - 73/73                                                            |
| Production build                    | PASS                                                                    |
| Console errors/warnings             | PASS - zero application errors or warnings                              |
| Network                             | PASS - data HTTP 200; zero failed or HTTP 4xx/5xx                       |

The existing Vinext route-classification notice, Node deprecation notice, and
client chunk-size warning remain build-tool notices. Stage 6 introduces no new
application warning, failed request, or runtime exception.

## Stage 7 Expense Intelligence Migration

Stage 7 replaces the generic Expense placeholder with a Golden Reference
application shell and an approved financial empty state. Repository history
confirms that `/expense` has always rendered `PlaceholderPage`; no
Expense-specific KPI, budget, actual, variance, ratio, category, trend, filter,
table, calculation, API, or data source exists to migrate.

To preserve source integrity, Stage 7 does not infer Expense values from
Dashboard or Marketing data and does not fabricate financial metrics. The
shared executive `KpiCard` remains the mandatory presentation component when
an approved Expense KPI source is introduced, but no KPI card is rendered
without a supported value.

### Before And After

| State  | Capture                                                            |
| ------ | ------------------------------------------------------------------ |
| Before | [kmm-v2-expense-before.png](screenshots/kmm-v2-expense-before.png) |
| After  | [kmm-v2-expense-after.png](screenshots/kmm-v2-expense-after.png)   |
| Mobile | [kmm-v2-expense-390.png](screenshots/kmm-v2-expense-390.png)       |

The before capture mounts the unchanged historical `PlaceholderPage` with the
title `Expense`. The after captures mount the real
`ExpenseIntelligencePage` inside the current application runtime.
Authentication source and behavior were not modified.

### Source And Value Parity

| Contract                         | Before | After | Result |
| -------------------------------- | ------ | ----- | ------ |
| Expense data source              | None   | None  | PASS   |
| Expense KPI values               | None   | None  | PASS   |
| Budget / Actual / Variance       | None   | None  | PASS   |
| Categories / Trend / Detail data | None   | None  | PASS   |
| Filters, sorting, pagination     | None   | None  | PASS   |
| Route and authentication gate    | Yes    | Yes   | PASS   |

### Responsive And Accessibility Evidence

Runtime measurement at 1440, 1280, 1024, 768, and 390px found:

- Zero page-level horizontal overflow.
- Zero clipped headings or supporting copy.
- A stable contained empty-state surface at every width.
- A 44px visible navigation control on desktop and mobile.
- One semantic `h1`, one labelled empty-state section, and descriptive
  navigation control names.
- Visible focus-ring styles, reduced-motion handling, and token-based AA text
  colors.

Browser zoom simulation at 100%, 125%, 150%, and 200% also measured zero
horizontal overflow or clipped text.

### Stage 7 Quality Gate

| Check                            | Result                                                                  |
| -------------------------------- | ----------------------------------------------------------------------- |
| Scope compliance                 | PASS - Expense UI, test command, Expense regression, QA docs/screenshots |
| Golden Reference                 | PASS                                                                    |
| Shared KPI policy                | PASS - no local KPI markup; no unsupported KPI is rendered              |
| Financial source/value parity    | PASS - source remains absent; no value or calculation was introduced    |
| Empty state                      | PASS - explicit, non-technical, and contains no fake financial value    |
| Responsive and browser zoom      | PASS                                                                    |
| Accessibility                    | PASS                                                                    |
| Expense regression               | PASS - 5/5                                                              |
| TypeScript (`npx tsc --noEmit`)  | PASS                                                                    |
| Lint (`npm run lint -- --quiet`) | PASS - zero errors                                                      |
| Full tests (`npm run test`)      | PASS - 78/78                                                            |
| Production build                 | PASS                                                                    |
| Production route smoke           | PASS - `/expense` HTTP 200 and compiled Expense asset present           |
| Console errors / exceptions      | PASS - zero                                                             |
| Network failures / HTTP 4xx/5xx  | PASS - zero                                                             |

### Known Limitation

Expense cannot present Total Expense, Budget, Actual, Variance, Expense Ratio,
category composition, trend, filters, or detail tables until a verified
financial source and its existing business rules are added in a separately
approved functional stage. Adding those calculations during a
presentation-only migration would violate the Stage 7 source-of-truth
contract.

## Stage 8 Sales Organization Intelligence Migration

Stage 8 applies the approved Golden Reference presentation to the existing
Sales Organization page. The employee normalization rules, inactive employee
handling, branch ownership, target allocation, KPI calculations, ranking
metrics, filter state, employee selection, export, and source request remain
in the original feature component.

### Before And After

| State  | Capture                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------ |
| Before | [kmm-v2-sales-organization-before.png](screenshots/kmm-v2-sales-organization-before.png)         |
| After  | [kmm-v2-sales-organization-after.png](screenshots/kmm-v2-sales-organization-after.png)           |
| Mobile | [kmm-v2-sales-organization-390.png](screenshots/kmm-v2-sales-organization-390.png)               |

The captures mount the real `SalesOrganizationPage` with the current
`/dashboard-data.json` response. Authentication files and behavior were not
modified.

### Preserved Organization And KPI Values

| Contract             | Before                 | After                  |
| -------------------- | ---------------------- | ---------------------- |
| Active Salespeople   | 17 People              | 17 People              |
| Showroom Achievement | 45.1%                  | 45.1%                  |
| Total Sales          | 23.02B MMK              | 23.02B MMK              |
| Sales comparison     | -41.3% vs last year    | -41.3% vs last year    |
| Total GP             | 2.04B MMK / GP% 8.9%   | 2.04B MMK / GP% 8.9%   |
| Best Showroom        | KMM01 / 45.1%          | KMM01 / 45.1%          |
| Best Salesperson     | KMM / KMM03 / 121.8%   | KMM / KMM03 / 121.8%   |
| Branch groups        | KMM01, KMM02, KMM03    | KMM01, KMM02, KMM03    |
| Ranking rows         | 17 current employees   | 17 current employees   |

Showroom Performance retains three rows and all ten columns. Salespeople
Ranking retains all 17 rows, grouped Sales, GP, and Commission columns, all
ranking modes, and the same default Sales Value ordering. Team Summary keeps
the same top/bottom performer links and Employee Detail keeps the same monthly
trend and financial metrics.

### Presentation And Interaction

- All six KPI cards use the shared `KpiCard` executive variant and its fixed
  24/48/40/14px internal zones.
- Showroom hierarchy is grouped consistently by code and branch name, with
  quieter supporting metrics and explicit active-person counts.
- Filter controls retain Year, Month, Showroom, and Salesperson dimensions,
  plus Reset, Refresh, and Export.
- Selecting KMM01 changed Active Salespeople from `17` to `2`; Reset restored
  `17` and every original KPI.
- Keyboard `Enter` on a ranking row updated Employee Detail from `KMM` to
  `03-Daw Nandar Hlaing Win`.
- Ranking rows, filters, header controls, and performer links have visible
  focus states and at least 44px interaction targets.

### Responsive And Zoom Evidence

| Viewport | KPI columns | Page overflow | KPI clipping | Text clipping |
| -------- | ----------- | ------------- | ------------ | ------------- |
| 1440px   | 6           | 0px           | 0            | 0             |
| 1280px   | 6           | 0px           | 0            | 0             |
| 1024px   | 3           | 0px           | 0            | 0             |
| 768px    | 2           | 0px           | 0            | 0             |
| 390px    | 1           | 0px           | 0            | 0             |

Every KPI measured 160px high. The wide showroom and salesperson tables
remain usable through contained horizontal scrolling and never create
page-level overflow. Browser zoom at 100%, 125%, 150%, and 200% measured zero
page overflow, KPI clipping, or non-intentional text clipping.

### Stage 8 Quality Gate

| Check                                      | Result                                                      |
| ------------------------------------------ | ----------------------------------------------------------- |
| Scope compliance                           | PASS - Team presentation, related tests, test script, QA docs |
| Golden Reference                           | PASS                                                        |
| Shared executive KPI Card                  | PASS                                                        |
| Organization and KPI parity                | PASS                                                        |
| Filters, rankings, links, and selection    | PASS                                                        |
| Responsive and browser zoom                | PASS                                                        |
| Accessibility                              | PASS                                                        |
| TypeScript (`npx tsc --noEmit`)            | PASS                                                        |
| Lint (`npm run lint -- --quiet`)           | PASS - zero errors                                          |
| Tests (`npm run test`)                     | PASS - 86/86                                                |
| Production build                           | PASS                                                        |
| Local production route smoke               | PASS - `/team` HTTP 200 and compiled Team asset present     |
| Console errors / runtime exceptions        | PASS - zero                                                 |
| Network failures / HTTP 4xx/5xx            | PASS - zero; dashboard data HTTP 200                        |

### Known Source Limitation

The current source contains salesperson names and branch assignments but no
approved showroom manager, position, direct reporting relationship, or
territory-assignment fields. The existing `Showroom Manager` value therefore
remains `N/A`; Stage 8 does not invent an organization tree, manager, position,
or territory owner.

## Settings MVP Phase 1

The Settings MVP establishes the Enterprise Control Center without changing
authentication, adding backend integrations, or introducing Phase 2 modules.
The route remains protected by the existing `AuthGate`.

### Before And After

| State  | Capture                                                                            |
| ------ | ---------------------------------------------------------------------------------- |
| Before | [kmm-settings-mvp-before.png](screenshots/kmm-settings-mvp-before.png)             |
| After  | [kmm-settings-mvp-after.png](screenshots/kmm-settings-mvp-after.png)               |
| Mobile | [kmm-settings-mvp-390.png](screenshots/kmm-settings-mvp-390.png)                   |

The before capture mounts the unchanged Settings placeholder. The after
captures mount the real `SettingsPage` in the current application runtime.
Authentication source and behavior were not modified.

### Phase 1 Contract

| Contract                                               | Result |
| ------------------------------------------------------ | ------ |
| Exactly eight approved Settings categories             | PASS   |
| Four-column desktop, two-column tablet, one-column mobile | PASS |
| Search filtering remains available without shortcut conflict | PASS |
| Entire Settings cards keyboard accessible              | PASS   |
| Header KAI Assistant opens, closes, and supports Escape | PASS |
| Current company and approved sidebar order retained    | PASS   |
| Phase 2 modules excluded                               | PASS   |
| No fabricated Recent Changes activity                  | PASS   |

Recent Changes renders an explicit empty state because no approved audit
activity source exists. This avoids presenting invented enterprise activity.

### Responsive And Accessibility Evidence

| Viewport | Card columns | Page overflow | Text clipping | Minimum control |
| -------- | ------------ | ------------- | ------------- | --------------- |
| 1440px   | 4            | 0px           | 0             | 44px            |
| 1280px   | 4            | 0px           | 0             | 44px            |
| 1024px   | 2            | 0px           | 0             | 44px            |
| 768px    | 2            | 0px           | 0             | 44px            |
| 390px    | 1            | 0px           | 0             | 44px            |

The previous bottom banner, assistant rail, and floating button are removed.
KAI is available through the shared 40px header control. `Command/Ctrl+K`
opens the assistant globally; Escape closes it. The Sidebar collapses without
removing navigation access. Search, card selection, assistant actions, and
mobile navigation expose descriptive accessible names and visible focus
rings.

### Settings MVP Quality Gate

| Check                                      | Result                                             |
| ------------------------------------------ | -------------------------------------------------- |
| Specification and Phase 1 scope            | PASS                                               |
| Reusable Settings component architecture   | PASS                                               |
| Responsive layout                          | PASS                                               |
| Keyboard and focus accessibility           | PASS                                               |
| TypeScript (`npx tsc --noEmit`)            | PASS                                               |
| Lint (`npm run lint -- --quiet`)            | PASS - zero errors                                 |
| Settings regression                        | PASS - 9/9                                         |
| Full tests (`npm run test`)                 | PASS - 95/95                                       |
| Production build                           | PASS                                               |
| Browser console / runtime exceptions       | PASS - zero                                        |
| Network failures / HTTP 4xx/5xx            | PASS - zero                                        |

## Company Management Phase 1

Company Management extends the approved Settings control center without
redesigning it or starting User Management. The page remains protected by the
existing Firebase `AuthGate`; the Worker API independently verifies Firebase
ID tokens before accessing tenant-scoped data.

### Runtime Evidence

| State   | Capture                                                                                     |
| ------- | ------------------------------------------------------------------------------------------- |
| Settings entry | [kmm-company-settings-entry.png](screenshots/kmm-company-settings-entry.png)          |
| Company overview | [kmm-company-management-overview.png](screenshots/kmm-company-management-overview.png) |

At 1200px runtime width, Company Management exposed all eight approved
sections, had zero horizontal overflow, rendered the shared 40px KAI header
control, and produced zero console, request, or HTTP errors. At 390x844, page
overflow remained 0px, desktop company navigation was replaced by the section
selector, and the KAI bottom sheet measured exactly 80vh.

### Persistence And Workflow

| Contract | Result |
| -------- | ------ |
| General Information draft survives refresh | PASS |
| Published configuration remains separate from draft | PASS |
| Publish confirmation and deterministic change summary | PASS |
| Branch add, edit, disable, and reactivate | PASS |
| Department add, edit, disable, and branch assignment | PASS |
| Fiscal, currency, localization, and calendar forms | PASS |
| Viewer write blocked by Worker API | PASS - HTTP 403 |
| Publish handled atomically by D1 batch | PASS - HTTP 200 |
| Audit events persisted with user, company, values, time, IP/device context | PASS |
| Logo validation and Firebase Storage upload path | PASS |

The D1 schema stores company, branch, department, fiscal, currency,
localization, calendar, holiday, draft, membership, and audit records with
tenant/company ownership and creation/update metadata. Company and branch code
uniqueness is enforced by validation and database indexes. Logo uploads use
the existing Firebase project because Cloudflare R2 is not enabled for the
account.

### Company Management Quality Gate

| Check | Result |
| ----- | ------ |
| Scope compliance | PASS - Settings and Company Management only |
| KAI rename; legacy MYRO copy removed | PASS |
| Responsive and accessibility | PASS |
| Draft/publish persistence | PASS |
| Server-side permissions | PASS |
| Audit logging | PASS |
| Targeted regression | PASS - 21/21 |
| Full regression suite | PASS - 107/107 |
| TypeScript (`npx tsc --noEmit`) | PASS |
| Lint (`npm run lint -- --quiet`) | PASS - zero errors |
| Production build | PASS |
| Local production route smoke | PASS - `/`, `/settings`, and `/settings/company` HTTP 200 |
| Unauthenticated API boundary | PASS - HTTP 401 |
| Browser console / runtime exceptions | PASS - zero |
| Network failures / HTTP 4xx/5xx | PASS - zero |

### Phase 1 Boundaries

- Exchange rates remain manual; no external rate provider is called.
- Review/approval workflow is intentionally deferred beyond Draft and
  Published.
- User Management is not implemented.
- Logo storage requires the existing Firebase Storage rules to permit the
  authenticated company-logo path.

## Global KAI Header Entry

KAI now uses one shared, header-native entry across Dashboard, Sales, Booking,
Stock, Expense, Sales Organization, Marketing, Settings, Company Management,
and the future-module shell. The old Settings floating component, positioning,
animation, and notification-dot implementation have been removed.

### Runtime Captures

| Viewport | Capture |
| -------- | ------- |
| Desktop 1440x1000 | [kmm-kai-header-desktop.png](screenshots/kmm-kai-header-desktop.png) |
| Tablet 768x900 | [kmm-kai-header-tablet.png](screenshots/kmm-kai-header-tablet.png) |
| Mobile 390x844 | [kmm-kai-header-mobile.png](screenshots/kmm-kai-header-mobile.png) |

### Geometry And Interaction

| Check | Desktop | Tablet | Mobile |
| ----- | ------- | ------ | ------ |
| Header trigger | 82.45x40px | 82.45x40px | 74.45x40px |
| Panel geometry | 420x1000px | 360x900px | 390x675.19px |
| Panel anchor | Right, full height | Right, full height | Bottom, exactly 80vh |
| Horizontal overflow | 0px | 0px | 0px |
| Floating KAI controls | 0 | 0 | 0 |
| Opaque panel surface | PASS | PASS | PASS |
| Click/toggle close | PASS | PASS | PASS |
| `Command/Ctrl+K` | PASS | PASS | PASS |
| Escape close | PASS | PASS | PASS |
| Initial focus on Global Search | PASS | PASS | PASS |
| Focus trap and restoration | PASS | PASS | PASS |
| Console/network failures | 0 | 0 | 0 |

The panel is portalled to `document.body` so sticky-header backdrop filters
cannot alter fixed positioning. This keeps the mobile sheet on the viewport
bottom and prevents desktop/tablet clipping. There is no dark overlay, and the
application remains visible while the assistant is open.

Production-build route checks confirmed one header-native KAI trigger, zero
fixed/floating KAI buttons, and zero horizontal overflow on `/dashboard`,
`/sales`, `/booking`, `/stock`, `/marketing`, `/expense`, `/team`, `/settings`,
and `/settings/company`.

### Lighthouse

Authenticated local-production Lighthouse results:

| Category | Score |
| -------- | ----- |
| Performance | 65 |
| Accessibility | 95 |
| Best Practices | 100 |
| SEO | 100 |

KAI produced no Lighthouse accessibility finding. Remaining accessibility
deductions are pre-existing Settings card label/name and status-badge contrast
findings plus the existing unsized logo image. Performance remains constrained
by the existing application bundle, image delivery, and authenticated
IndexedDB state; those items are outside this KAI-only change.
