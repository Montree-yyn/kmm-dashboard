#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
input="$root/build/maps/myanmar-townships.normalized.geojson"; output="$root/public/maps/vector/myanmar-townships.pmtiles"; intermediate="$root/build/maps/myanmar-townships.mbtiles"
command -v tippecanoe >/dev/null || { echo "BLOCKED: tippecanoe is required. Install it with: brew install tippecanoe" >&2; exit 127; }
command -v pmtiles >/dev/null || { echo "BLOCKED: pmtiles CLI is required. Install it with: npm install --global pmtiles" >&2; exit 127; }
[[ -f "$input" ]] || { echo "Missing normalized input: $input" >&2; exit 1; }
[[ ! -e "$output" || "${MAPS_OVERWRITE:-}" == "1" ]] || { echo "Refusing to overwrite $output. Re-run with MAPS_OVERWRITE=1." >&2; exit 1; }
mkdir -p "$(dirname "$output")" "$(dirname "$intermediate")"
tippecanoe -o "$intermediate" -l townships -Z 3 -z 10 --force --read-parallel --detect-shared-borders --simplification=8 "$input"
pmtiles convert "$intermediate" "$output"
echo "Built $output ($(wc -c < "$output" | tr -d ' ') bytes)"; pmtiles show "$output"
