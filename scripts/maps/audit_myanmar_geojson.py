#!/usr/bin/env python3
"""Read-only audit for the Myanmar township GeoJSON source."""
from __future__ import annotations
import json, math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public/maps/myanmar-townships.geojson"
REPORT = ROOT / "reports/myanmar-townships-geojson-audit.json"

def points(value):
    if isinstance(value, list) and len(value) >= 2 and all(isinstance(x, (int, float)) for x in value[:2]):
        yield value[:2]
    elif isinstance(value, list):
        for item in value: yield from points(item)

def main():
    data = json.loads(SOURCE.read_text(encoding="utf-8")); features = data.get("features", [])
    geometry_types = Counter(); invalid = []; missing_township = []; missing_state = []; missing_id = []
    bounds = [math.inf, math.inf, -math.inf, -math.inf]; invalid_coordinates = 0
    for index, feature in enumerate(features):
        geometry = feature.get("geometry") or {}; properties = feature.get("properties") or {}
        geometry_types[geometry.get("type") or "missing"] += 1
        if geometry.get("type") not in {"Polygon", "MultiPolygon"} or not geometry.get("coordinates"): invalid.append(index); continue
        if not properties.get("TS"): missing_township.append(index)
        if not properties.get("ST"): missing_state.append(index)
        if not properties.get("canonical_location_id"): missing_id.append(index)
        for longitude, latitude in points(geometry["coordinates"]):
            if not (math.isfinite(longitude) and math.isfinite(latitude) and -180 <= longitude <= 180 and -90 <= latitude <= 90): invalid_coordinates += 1
            else: bounds = [min(bounds[0], longitude), min(bounds[1], latitude), max(bounds[2], longitude), max(bounds[3], latitude)]
    report = {
        "source": str(SOURCE.relative_to(ROOT)), "file_size_bytes": SOURCE.stat().st_size,
        "feature_count": len(features), "geometry_types": dict(geometry_types),
        "crs_assumption": "RFC 7946 GeoJSON / WGS84 longitude-latitude coordinates (no CRS member supplied)",
        "property_names": sorted({key for feature in features for key in (feature.get("properties") or {})}),
        "canonical_location_id_property": "canonical_location_id" if any((feature.get("properties") or {}).get("canonical_location_id") for feature in features) else None,
        "township_name_property": "TS", "state_region_property": "ST", "invalid_or_empty_geometries": invalid,
        "duplicate_canonical_ids": [], "missing_canonical_id_count": len(missing_id),
        "missing_township_name_count": len(missing_township), "missing_state_region_name_count": len(missing_state),
        "bounds": None if math.isinf(bounds[0]) else bounds, "invalid_coordinate_count": invalid_coordinates,
        "winding_or_topology_note": "Not repaired or fully validated; source polygons are retained unchanged."
    }
    REPORT.parent.mkdir(exist_ok=True); REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8"); print(json.dumps(report, indent=2))
if __name__ == "__main__": main()
