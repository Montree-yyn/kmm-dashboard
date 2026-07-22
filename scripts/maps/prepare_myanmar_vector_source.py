#!/usr/bin/env python3
"""Create a deterministic, canonical-property-enriched vector source without changing GeoJSON input."""
from __future__ import annotations
import json, math
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]; SOURCE = ROOT / "public/maps/myanmar-townships.geojson"; MASTER = ROOT / "data/master-townships.json"
OUTPUT = ROOT / "build/maps/myanmar-townships.normalized.geojson"; REPORT = ROOT / "reports/myanmar-vector-source-preparation.json"
def key(value: Any) -> str: return "".join(char for char in str(value or "").casefold() if char.isalnum())
def valid(geometry: dict[str, Any] | None) -> bool: return bool(geometry and geometry.get("type") in {"Polygon", "MultiPolygon"} and geometry.get("coordinates"))
def main():
    source = json.loads(SOURCE.read_text(encoding="utf-8")); master = json.loads(MASTER.read_text(encoding="utf-8"))
    index: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for item in master:
        index.setdefault((key(item["state_region"]), key(item["township"])), []).append(item)
    output = []; skipped = []; missing_ids = []; normalizations = Counter()
    for position, feature in enumerate(source.get("features", [])):
        geometry = feature.get("geometry")
        if not valid(geometry): skipped.append(position); continue
        props = dict(feature.get("properties") or {}); township = str(props.get("TS") or "").strip(); state = str(props.get("ST") or "").strip()
        # Exact canonical Township + State/Region key only. No aliases, fuzzy
        # matching, or IDs derived from labels/geometries are permitted here.
        candidates = index.get((key(state), key(township)), [])
        canonical_id = candidates[0]["township_id"] if len(candidates) == 1 else None
        if canonical_id is None: missing_ids.append({"feature_index": position, "township": township, "state_region": state, "candidate_count": len(candidates)})
        props.update({"canonical_location_id": canonical_id, "country_code": "MM", "location_name": township or None, "state_region": state or None})
        normalizations["canonical_properties_added"] += 4
        output.append({"type": "Feature", "id": feature.get("id") or canonical_id or position, "properties": props, "geometry": geometry})
    output.sort(key=lambda feature: (str(feature["properties"].get("state_region") or ""), str(feature["properties"].get("location_name") or ""), str(feature["properties"].get("canonical_location_id") or "")))
    result = {"type": "FeatureCollection", "features": output}; OUTPUT.parent.mkdir(parents=True, exist_ok=True); OUTPUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    ids = [feature["properties"]["canonical_location_id"] for feature in output if feature["properties"].get("canonical_location_id")]
    report = {"source_feature_count": len(source.get("features", [])), "output_feature_count": len(output), "preserved_features": len(output), "skipped_invalid_geometries": skipped, "missing_canonical_ids": missing_ids, "duplicate_canonical_ids": sorted([value for value, count in Counter(ids).items() if count > 1]), "property_normalization_counts": dict(normalizations), "output_size_bytes": OUTPUT.stat().st_size}
    REPORT.parent.mkdir(exist_ok=True); REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8"); print(json.dumps(report, indent=2))
if __name__ == "__main__": main()
