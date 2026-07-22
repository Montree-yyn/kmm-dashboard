#!/usr/bin/env python3
"""Validate a generated PMTiles archive through the local PMTiles CLI."""
from __future__ import annotations
import json, shutil, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]; ARCHIVE = ROOT / "public/maps/vector/myanmar-townships.pmtiles"; REPORT = ROOT / "reports/myanmar-pmtiles-validation.json"
def main():
    result = {"archive": str(ARCHIVE.relative_to(ROOT)), "file_exists": ARCHIVE.exists(), "file_size_bytes": ARCHIVE.stat().st_size if ARCHIVE.exists() else 0, "validation_result": "blocked"}
    if not ARCHIVE.exists(): result["blocked_reason"] = "PMTiles archive does not exist; run maps:build:mm after installing required CLIs."
    elif not shutil.which("pmtiles"): result["blocked_reason"] = "pmtiles CLI is required for archive metadata validation. Install with: npm install --global pmtiles"
    else:
        completed = subprocess.run(["pmtiles", "show", str(ARCHIVE)], check=False, capture_output=True, text=True)
        result.update({"metadata_output": completed.stdout, "stderr": completed.stderr, "validation_result": "passed" if completed.returncode == 0 else "failed"})
    REPORT.parent.mkdir(exist_ok=True); REPORT.write_text(json.dumps(result, indent=2), encoding="utf-8"); print(json.dumps(result, indent=2))
if __name__ == "__main__": main()
