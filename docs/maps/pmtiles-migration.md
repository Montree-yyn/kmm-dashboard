# PMTiles migration plan

PMTiles provides a compact, range-addressable vector archive for production boundary maps without a paid map API. GeoJSON remains the current small, inspectable source and the fallback for the working Marketing map.

## Proposed dataset contract

- Filename: `myanmar-townships-v1.pmtiles`
- Map source: `administrative-boundaries-vector`
- Source layer: `townships`
- Required properties: `canonical_location_id`, `country_code`, `location_name`, `state_region`.

## Conversion and hosting

Validate and enrich Myanmar GeoJSON with canonical properties before converting it with an open-source PMTiles tool. Test the archive locally via static hosting first. Later, host it either as a static application asset or in Cloudflare R2; both require HTTP Range Requests, CORS permitting the dashboard origin, and long-lived immutable `Cache-Control` for versioned files.

Do not put a large world archive in this repository. Keep country archives versioned and independently deployable. A no-cost-first rollout uses the existing GeoJSON fallback, then a small Myanmar PMTiles proof, then R2/static assets only after range and cache behavior are verified. No billing or R2 configuration is part of this phase.

## Deployment options and threshold

1. **Small static asset** under `public/maps/vector`: simplest local/static delivery, but the repository and Worker bundle can grow quickly. Acceptable only for a small, country-scoped archive (recommendation: under 20 MB compressed).
2. **Cloudflare R2**: preferred once the archive exceeds that threshold. It supports Range Requests, requires CORS for the dashboard origin, can be public or signed, and should use immutable caching for versioned files. Review storage/egress costs before enabling it; no R2 configuration is performed here.
3. **External object storage**: must provide HTTPS, Range Requests, controlled CORS, reliable cache headers, and an availability/security review. It adds an external dependency and operational risk.

## Rollback

Keep the GeoJSON dataset enabled and the production feature flag set to `legacy`. If PMTiles fails to load, switch the dataset/configuration back to GeoJSON; no business data or geography-resolution logic changes.
