"""Validate generated Stock data against the workbook-backed Stock import rules."""

from __future__ import annotations

import json
from pathlib import Path

from build_dashboard_data import OUT, STOCK_PRODUCT_CONFIG, booking_reconciliation_report, load_booking, load_stock


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
    if any(row.get("kmm") != 1 or " ".join(str(row.get("currentStatus") or "").casefold().split()) != "free stock" for row in source_rows):
        raise SystemExit("Current Stock rule mismatch: JSON contains a row outside KMM = 1 and Status PD = Free Stock.")
    if report["kmmFreeStockRows"] < len(source_rows):
        raise SystemExit("Current Stock rule mismatch: deduplicated rows exceed KMM Free Stock source rows.")
    if any(row["productGroup"] in {"IM", "IMO", "OT"} for row in [row for row in source_rows if row["productGroup"] in unit_products]):
        raise SystemExit("Unit rule mismatch: value-only Stock products entered a unit calculation.")
    if sum(report["unitTotalByProductType"][product] for product in unit_products) != source_unit:
        raise SystemExit("Stock product reconciliation mismatch.")
    if sum(report["unitTotalByBranch"].values()) + report["otherOrUnknownBranchUnit"] != source_unit:
        raise SystemExit("Stock branch reconciliation mismatch.")
    if report["exactDuplicateRows"]:
        identifiers = {(row.get("stockId"), row.get("serialNumber"), row.get("engineNumber")) for row in source_rows}
        if len(identifiers) != len(source_rows):
            raise SystemExit("Stock duplicate reconciliation mismatch.")

    booking_source = load_booking()
    booking_json = dashboard["booking"]
    booking_report = booking_reconciliation_report(booking_source)
    if booking_json != booking_source:
        raise SystemExit("Booking row mismatch: generated JSON does not match the current workbook import.")
    if dashboard_report := json.loads(Path(OUT).with_name("data-import-report.json").read_text(encoding="utf-8")):
        if dashboard_report.get("booking") != booking_report:
            raise SystemExit("Booking report mismatch: reconciliation totals do not agree with source rows.")
    if sum(item["openUnit"] for item in booking_report["byProduct"].values()) != booking_report["openUnitTotal"]:
        raise SystemExit("Booking product reconciliation mismatch.")
    if sum(item["openUnit"] for item in booking_report["byBranch"].values()) != booking_report["openUnitTotal"]:
        raise SystemExit("Booking branch reconciliation mismatch.")

    print("Stock validation passed")
    print({
        "excel_total_rows": report["excelTotalRows"],
        "current_stock_rows": len(source_rows),
        "stock_unit": source_unit,
        "stock_value": source_value,
        "aged_stock_unit": source_aged,
        "unknown_product_rows": report["unknownProductRows"],
        "duplicate_rows_removed": report["exactDuplicateRows"],
        "by_product": report["unitTotalByProductType"],
        "by_branch": report["unitTotalByBranch"],
    })
    print({"booking_reconciliation": booking_report})


if __name__ == "__main__":
    main()
