#!/usr/bin/env python3
"""Simplify Myanmar state/region boundary geometry for the Marketing map.

The MapLibre marketing map previously loaded the full-resolution states
GeoJSON (~4.5 MB / 117,536 coordinate pairs) just to render state boundary
lines and state labels. This script applies Douglas-Peucker simplification to
each polygon ring and emits a compact dataset. State label positions are
precomputed from the ORIGINAL geometry (arithmetic vertex mean, mirroring
`getLabelPositions` in components/marketing/myanmar-marketing-map-maplibre.tsx)
and stored as a `label_position` property so labels do not move.

Output: public/maps/myanmar-states-simplified.geojson
  Same 15 features with original properties (ST / ST_PCODE / ST_RG / ST_MMR /
  PCode_V) + `label_position: [lng, lat]`, simplified MultiPolygon geometry.

Usage:
  python3 scripts/maps/simplify_myanmar_states.py [tolerance]   (default 0.01)
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE = REPO_ROOT / "public" / "maps" / "myanmar-states.geojson"
OUTPUT = REPO_ROOT / "public" / "maps" / "myanmar-states-simplified.geojson"

DEFAULT_TOLERANCE = 0.01  # degrees (~1.1 km at Myanmar latitude)


def collect_points(coordinates: object) -> list[list[float]]:
    """Collect every [lng, lat] pair (same walk as the JS collectPoints)."""
    points: list[list[float]] = []

    def walk(value: object) -> None:
        if not isinstance(value, list):
            return
        if len(value) >= 2 and all(
            isinstance(item, (int, float)) and not isinstance(item, bool)
            for item in value[:2]
        ):
            points.append([float(value[0]), float(value[1])])
            return
        for item in value:
            walk(item)

    walk(coordinates)
    return points


def perpendicular_distance(
    point: list[float], a: list[float], b: list[float]
) -> float:
    """Distance from point to the segment a-b (Euclidean in degree space)."""
    if a == b:
        return math.hypot(point[0] - a[0], point[1] - a[1])
    segment_length_sq = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2
    t = max(
        0.0,
        min(
            1.0,
            (
                (point[0] - a[0]) * (b[0] - a[0])
                + (point[1] - a[1]) * (b[1] - a[1])
            )
            / segment_length_sq,
        ),
    )
    projection = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
    return math.hypot(point[0] - projection[0], point[1] - projection[1])


def douglas_peucker(points: list[list[float]], tolerance: float) -> list[list[float]]:
    if len(points) < 3:
        return points
    first, last = points[0], points[-1]
    max_distance = 0.0
    index = 0
    for i in range(1, len(points) - 1):
        distance = perpendicular_distance(points[i], first, last)
        if distance > max_distance:
            max_distance = distance
            index = i
    if max_distance > tolerance:
        left = douglas_peucker(points[: index + 1], tolerance)
        right = douglas_peucker(points[index:], tolerance)
        return left[:-1] + right
    return [first, last]


def simplify_ring(ring: list[list[float]], tolerance: float) -> list[list[float]]:
    """Simplify a closed ring, guaranteeing the result stays a valid ring."""
    if len(ring) < 4:
        return ring
    # Rings are closed (first == last); simplify the unique points only.
    simplified = douglas_peucker(ring[:-1], tolerance)
    if len(simplified) < 3:
        return ring
    return simplified + [simplified[0]]


def simplify_polygon(polygon: object, tolerance: float) -> object:
    if not isinstance(polygon, list) or not polygon:
        return polygon
    return [simplify_ring(ring, tolerance) for ring in polygon]


def simplify_geometry(geometry: dict, tolerance: float) -> dict:
    coordinates = geometry.get("coordinates")
    if geometry.get("type") == "MultiPolygon" and isinstance(coordinates, list):
        geometry = dict(geometry)
        geometry["coordinates"] = [
            simplify_polygon(polygon, tolerance) for polygon in coordinates
        ]
    return geometry


def label_position_for(feature: dict) -> list[float] | None:
    """Vertex-mean of the ORIGINAL geometry (mirror of getLabelPositions)."""
    points = collect_points((feature.get("geometry") or {}).get("coordinates"))
    if not points:
        return None
    return [
        sum(point[0] for point in points) / len(points),
        sum(point[1] for point in points) / len(points),
    ]


def main() -> None:
    tolerance = (
        float(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_TOLERANCE
    )
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    features = payload.get("features", [])
    simplified: list[dict] = []
    original_pairs = 0
    simplified_pairs = 0
    for feature in features:
        label_position = label_position_for(feature)
        geometry = simplify_geometry(feature["geometry"], tolerance)
        properties = dict(feature.get("properties") or {})
        if label_position:
            properties["label_position"] = label_position
        simplified.append(
            {
                "type": feature.get("type", "Feature"),
                "geometry": geometry,
                "properties": properties,
            }
        )
        original_pairs += len(collect_points(feature["geometry"].get("coordinates")))
        simplified_pairs += len(collect_points(geometry.get("coordinates")))

    output = {
        "type": "FeatureCollection",
        "generated": json.dumps(
            {"source": "public/maps/myanmar-states.geojson", "tolerance": tolerance}
        ),
        "features": simplified,
    }
    OUTPUT.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"wrote {OUTPUT}: {len(simplified)} features, "
        f"coordinates {original_pairs} -> {simplified_pairs} "
        f"({(simplified_pairs / original_pairs * 100):.1f}%), "
        f"size {OUTPUT.stat().st_size / 1024:.0f} KB"
    )


if __name__ == "__main__":
    main()
