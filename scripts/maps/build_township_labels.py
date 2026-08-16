#!/usr/bin/env python3
"""Build a compact township-labels dataset for the Marketing map overlay.

Why: the MapLibre marketing map previously fetched the full Myanmar townships
GeoJSON (~11.4 MB) from `installLegacyPresentationOverlays` only to derive a
single label point per township. The label algorithm is the arithmetic mean of
every vertex coordinate (see `getLabelPositions` in
components/marketing/myanmar-marketing-map-maplibre.tsx). This script runs the
same algorithm once at build time and emits a ~100 KB file the map can load
instead of the full geometry.

Output: public/maps/myanmar-township-labels.json
  {
    "generated": "<ISO timestamp>",
    "source": "public/maps/myanmar-townships.geojson",
    "count": 330,
    "labels": [
      { "name": "Hinthada", "stateRegion": "Ayeyarwady", "coordinates": [95.4..., 17.6...] },
      ...
    ]
  }

Usage:
  python3 scripts/maps/build_township_labels.py
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE = REPO_ROOT / "public" / "maps" / "myanmar-townships.geojson"
OUTPUT = REPO_ROOT / "public" / "maps" / "myanmar-township-labels.json"


def collect_points(coordinates: object) -> list[tuple[float, float]]:
    """Mirror the JS collectPoints: walk nested coordinate arrays and collect
    every [lng, lat] pair (detected by its first two elements being numbers)."""
    points: list[tuple[float, float]] = []

    def walk(value: object) -> None:
        if not isinstance(value, (list, tuple)):
            return
        if len(value) >= 2 and all(
            isinstance(item, (int, float)) and not isinstance(item, bool)
            for item in value[:2]
        ):
            points.append((float(value[0]), float(value[1])))
            return
        for item in value:
            walk(item)

    walk(coordinates)
    return points


def label_positions(features: list[dict]) -> list[dict]:
    """Replicate getLabelPositions(features, "township"): group by normalized
    state-township key, average every collected vertex per group."""
    groups: dict[str, dict] = {}
    for feature in features:
        properties = feature.get("properties") or {}
        name = properties.get("TS")
        state_region = properties.get("ST") or ""
        if not name:
            continue
        key = f"{_normalize(state_region)}-{_normalize(name)}"
        points = collect_points(
            (feature.get("geometry") or {}).get("coordinates")
        )
        if not points:
            continue
        group = groups.setdefault(
            key, {"name": name, "stateRegion": state_region, "points": []}
        )
        group["points"].extend(points)
    return [
        {
            "name": group["name"],
            "stateRegion": group["stateRegion"],
            "coordinates": [
                sum(point[0] for point in group["points"]) / len(group["points"]),
                sum(point[1] for point in group["points"]) / len(group["points"]),
            ],
        }
        for group in groups.values()
    ]


def _normalize(value: str) -> str:
    return value.strip().lower()


def main() -> None:
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    features = payload.get("features", [])
    labels = label_positions(features)
    output = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "source": "public/maps/myanmar-townships.geojson",
        "count": len(labels),
        "labels": labels,
    }
    OUTPUT.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"wrote {OUTPUT} ({len(labels)} labels from {len(features)} features)")


if __name__ == "__main__":
    main()
