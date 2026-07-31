# Changelog

All notable changes to the KMM Enterprise AI Platform are documented here.

## [1.0.0] - 2026-07-31

### Added

- KMM Design System v2.0 across the executive analytics experience.
- Shared executive KPI, chart, table, filter, loading, empty, and error states.
- Kubota Map Engine with MapLibre, PMTiles, Protomaps/OpenStreetMap basemap,
  township intelligence, Smart Click, Smart Zoom, Layer Manager, heatmaps,
  markers, fullscreen controls, and Area Comparison.
- Sales Organization Intelligence with showroom and employee performance views.
- Expense Intelligence route with an explicit verified-data empty state.
- Settings control center, Company Management Phase 1, D1 persistence,
  permissions, validation, draft/publish workflow, and audit history.
- Global KAI header assistant with keyboard and responsive panel support.
- Centralized Global App Shell, header, sidebar, and navigation configuration.

### Changed

- Migrated Dashboard, Sales, Booking, Stock, Marketing, Team, Expense, and
  Settings to the approved KMM enterprise presentation language.
- Standardized responsive behavior, accessibility, typography, spacing,
  navigation state, and Kubota orange accents.
- Consolidated deployment on the Cloudflare Workers/Vinext architecture.
- Expanded regression coverage for business calculations, GIS behavior,
  application shell, responsive presentation, settings, and release safety.

### Preserved

- Existing KPI values and calculations.
- Existing chart libraries and chart semantics.
- Firebase authentication and existing data sources.
- PMTiles, Natural Breaks, canonical township IDs, business overlays, and
  comparison logic.

### Known Issues

- Expense financial metrics remain unavailable until a verified financial data
  source is connected; the page intentionally shows an empty state.
- The production build reports non-blocking dependency deprecation and
  JavaScript chunk-size advisories.

[1.0.0]: https://github.com/Montree-yyn/kmm-dashboard/releases/tag/v1.0.0
