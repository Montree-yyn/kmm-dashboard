"""Validate generated Stock data against the workbook-backed Stock import rules."""

from __future__ import annotations

import json
from pathlib import Path

from build_dashboard_data import OUT, STOCK_PRODUCT_CONFIG, load_stock


def total(rows: list[dict], products: set[str]) -> float:
    return sum(float(row["msrp"] or 0) for row in rows if row["productGroup"] in products)


def main() -> None:
    source_rows, report = load_stock()
    dashboard = json.loads(Path(OUT).read_text(encoding="utf-8"))
    json_rows = dashboard["stock"]
    unit_products = set(STOCK_PRODUCT_CONFIG["UNIT_PRODUCTS"])
    value_products = set(STOCK_PRODUCT_CONFIG["ALL_VALUE_PRODUCTS"])

    if len(json_rows) != len(source_rows):
        raise SystemExit(f"Stock row mismatch: JSON={len(json_rows)}, source={len(source_rows)}")
    if json_rows != source_rows:
        raise SystemExit("Stock row mismatch: generated JSON does not match the current workbook import.")

    source_unit = sum(row["productGroup"] in unit_products for row in source_rows)
    source_value = total(source_rows, value_products)
    source_aged = sum(row["productGroup"] in unit_products and (row["ageDays"] or 0) > 90 for row in source_rows)
    if report["stockUnit"] != source_unit or report["stockValue"] != source_value or report["agedStockUnit"] != source_aged:
        raise SystemExit("Stock report mismatch: reconciliation totals do not agree with source rows.")
    if any(row["productGroup"] in {"IM", "IMO", "OT"} for row in [row for row in source_rows if row["productGroup"] in unit_products]):
        raise SystemExit("Unit rule mismatch: value-only Stock products entered a unit calculation.")

    print("Stock validation passed")
    print({
        "excel_total_rows": report["excelTotalRows"],
        "current_stock_rows": len(source_rows),
        "stock_unit": source_unit,
        "stock_value": source_value,
        "aged_stock_unit": source_aged,
        "unknown_product_rows": report["unknownProductRows"],
    })


if __name__ == "__main__":
    main()
