# KMM Enterprise AI Platform v1.0

## Release

- Version: `v1.0.0`
- Release name: `KMM Enterprise AI Platform v1.0`
- Release date: 2026-07-31
- Deployment target: Cloudflare Workers

## Version Summary

KMM Enterprise AI Platform v1.0 establishes one production application shell
for executive sales, booking, stock, marketing, organization, expense, and
enterprise settings workflows. It combines KMM Design System v2.0 with the
Kubota Map Engine, centralized navigation, Firebase authentication, D1-backed
company configuration, and the global KAI entry point.

The release preserves the approved business calculations, source data, chart
logic, PMTiles architecture, Natural Breaks classification, canonical township
IDs, comparison workflows, and existing routes.

## Release Notes

### Executive Intelligence

- Dashboard, Sales, Booking, and Stock share the approved executive KPI and
  analytics presentation.
- Sales Organization provides showroom ownership, team performance, ranking,
  and employee detail.
- Expense provides a truthful empty state while its approved financial source
  remains pending.

### Kubota Map Engine

- MapLibre and PMTiles power the Myanmar business overlay.
- Protomaps/OpenStreetMap supplies the global basemap.
- Township choropleth, heatmap, markers, Smart Click, Smart Zoom, Layer
  Manager, fullscreen tools, and Area Comparison remain available.

### Enterprise Platform

- One Global App Shell serves Dashboard, Sales, Booking, Stock, Marketing,
  Team, Expense, and Settings.
- The visible sidebar order is Dashboard, Sales, Booking, Stock, Marketing,
  Team, Expense, and Settings.
- KAI is available from the global header with desktop, tablet, and mobile
  behavior.
- Settings and Company Management Phase 1 include structured configuration,
  validation, permissions, drafts, publishing, and audit history.

### Quality

- TypeScript, lint, production build, and the complete automated regression
  suite are required release gates.
- Responsive QA covers desktop, tablet, and 390px mobile layouts.
- Release safety checks reject secrets, caches, generated distribution files,
  and unsafe large binaries.

## Known Issues

- Expense metrics are intentionally unavailable until a verified financial
  source is connected.
- Build output includes a non-blocking Node dependency deprecation warning and
  a JavaScript chunk-size advisory.

## Roadmap

- Connect the approved Expense financial data source.
- Extend KAI from its current assistant architecture to governed enterprise
  conversations and workflow actions.
- Continue country and business-module expansion through the reusable Kubota
  Map Engine.
- Improve client bundle segmentation without changing analytics behavior.
