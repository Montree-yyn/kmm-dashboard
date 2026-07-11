from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parent / "01_Data"
OUT = ROOT / "public" / "dashboard-data.json"

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def as_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def as_number(value: Any) -> float:
    if value is None or value == "":
        return 0
    try:
        return float(str(value).replace(",", ""))
    except ValueError:
        return 0


def optional_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", ""))
    except ValueError:
        return None


def as_int(value: Any) -> int:
    return int(as_number(value))


def iso_date(value: Any) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    text = as_text(value)
    if not text:
        return ""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    return text[:10]


def year_month_from_code(value: Any) -> tuple[int | None, int | None]:
    text = as_text(value)
    digits = "".join(ch for ch in text if ch.isdigit())
    if len(digits) < 4:
        return None, None
    year = 2000 + int(digits[:2])
    month = int(digits[2:4])
    if month < 1 or month > 12:
        return year, None
    return year, month


def year_month_from_date(value: Any) -> tuple[int | None, int | None]:
    if isinstance(value, datetime):
        return value.year, value.month
    text = iso_date(value)
    if len(text) >= 7 and text[:4].isdigit() and text[5:7].isdigit():
        return int(text[:4]), int(text[5:7])
    return None, None


def normalize_branch(value: Any) -> str:
    text = as_text(value).upper().replace(" ", "")
    if text in {"KMM1", "KMM01"}:
        return "KMM01"
    if text in {"KMM2", "KMM02"}:
        return "KMM02"
    if text in {"KMM3", "KMM03"}:
        return "KMM03"
    return text


def normalize_product_type(value: Any) -> str:
    """Return the approved product group represented by a booking source value."""
    raw = as_text(value).upper()
    key = re.sub(r"[^A-Z0-9]", "", raw)
    aliases = {
        "TT": {"TT", "01TT", "TRACTOR", "01TRACTOR"},
        "CH": {"CH", "02CH", "COMBINE", "COMBINEHARVESTER", "02COMBINE", "02COMBINEHARVESTER"},
        "EX": {"EX", "04EX", "EXCAVATOR", "04EXCAVATOR"},
        "TP": {"TP", "03TP", "TRANSPLANTER", "03TRANSPLANTER"},
        "MAX": {"MAX", "05MAX", "MAXOTHER", "05MAXOTHER"},
        "IM": {"IM", "IMPLEMENT", "IMPLEMENTS"},
        "IMO": {"IMO", "IMPLEMENTOPTION", "IMPLEMENTOPTIONS"},
        "OT": {"OT", "OTHER", "OTHERS"},
    }
    for product, values in aliases.items():
        if key in values:
            return product
    return raw


def header_map(ws: Any, row: int) -> dict[str, int]:
    return {as_text(ws.cell(row, col).value): col for col in range(1, ws.max_column + 1) if as_text(ws.cell(row, col).value)}


def cell(row: tuple[Any, ...], headers: dict[str, int], name: str) -> Any:
    col = headers.get(name)
    if not col or col - 1 >= len(row):
        return None
    return row[col - 1]


def load_plan() -> dict[str, Any]:
    path = DATA_ROOT / "Sales" / "Sales KPI.xlsx"
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["SL 2026"]
    categories = {as_text(ws.cell(row, 2).value): row for row in range(1, ws.max_row + 1)}
    month_cols = list(range(4, 16))

    def row_values(label: str) -> list[float]:
        row = categories[label]
        return [as_number(ws.cell(row, col).value) for col in month_cols]

    return {
        "year": 2026,
        "months": MONTHS,
        "units": row_values("Total Units"),
        "revenue": row_values("Revenue (2026)"),
        "expense": row_values("Expense (2026)"),
    }


def load_sales() -> list[dict[str, Any]]:
    path = DATA_ROOT / "Sales" / "2026_KMM_CPI copy.xlsx"
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["2026_KMM_DATA"]
    headers = header_map(ws, 4)
    rows: list[dict[str, Any]] = []
    for row in ws.iter_rows(min_row=5, values_only=True):
        year = as_int(cell(row, headers, "KMM Year"))
        if not year:
            continue
        code_year, month = year_month_from_code(cell(row, headers, "KMM RS"))
        date = iso_date(cell(row, headers, "Delivery Date"))
        if month is None:
            _, month = year_month_from_date(cell(row, headers, "Delivery Date"))
        rows.append(
            {
                "date": date,
                "year": code_year or year,
                "month": month,
                "branch": normalize_branch(cell(row, headers, "Dealer")),
                "salesperson": as_text(cell(row, headers, "Sales Man")),
                "stateRegion": as_text(cell(row, headers, "States / Division / Region")),
                "township": as_text(cell(row, headers, "Township")),
                "village": as_text(cell(row, headers, "Village")),
                "area": as_text(cell(row, headers, "Area")),
                "productType": as_text(cell(row, headers, "TYPE")),
                "model": as_text(cell(row, headers, "MODEL")),
                "finalReceived": as_number(cell(row, headers, "Final Received")),
                "netReceived": as_number(cell(row, headers, "Net Received")),
                "gp1": as_number(cell(row, headers, "GP1")),
                "expense": as_number(cell(row, headers, "Total Expense")),
            }
        )
    return rows


def load_booking() -> list[dict[str, Any]]:
    path = DATA_ROOT / "Booking" / "KMMF3002 KMM Booking Data.2.xlsx"
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["Data"]
    headers = header_map(ws, 3)
    rows: list[dict[str, Any]] = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        booking_no = as_text(cell(row, headers, "No.BK"))
        date = iso_date(cell(row, headers, "Date"))
        branch = normalize_branch(cell(row, headers, "Dealer"))
        salesperson = as_text(cell(row, headers, "SL Name"))
        product_type = normalize_product_type(cell(row, headers, "Product Type"))

        # A valid booking needs an identifier, date, dealer, salesperson and an
        # approved product group. Price is deliberately not a validity rule:
        # source rows with a missing price still represent a booked unit, but do
        # not contribute a monetary amount.
        if not all([booking_no, date, branch, salesperson]) or product_type not in {
            "TT", "CH", "EX", "TP", "MAX", "IM", "IMO", "OT"
        }:
            continue

        year, month = year_month_from_code(cell(row, headers, "Month"))
        month_out = as_text(cell(row, headers, "Month Out")).upper()
        # In this workbook Month Out carries the outcome: CANCLE is cancelled,
        # a numeric month means delivered, and blank remains open. Purchase
        # Status mirrors this (Fail/Sell/Hot) but is not the status field.
        if "CANC" in month_out:
            status = "Cancelled"
        elif month_out:
            status = "Delivered"
        else:
            status = "Open"
        rows.append(
            {
                "date": date,
                "year": year,
                "month": month,
                "branch": branch,
                "salesperson": salesperson,
                "productType": product_type,
                "model": as_text(cell(row, headers, "Model")),
                "price": optional_number(cell(row, headers, "Price")),
                "bookingNo": booking_no,
                "customer": as_text(cell(row, headers, "CS NAME")),
                "deposit": optional_number(cell(row, headers, "Deposit")),
                "paymentType": as_text(cell(row, headers, "Purchase Type")),
                "financeType": as_text(cell(row, headers, "Leasing")),
                "statusDate": iso_date(cell(row, headers, "Delivery Dete/Cancer Date")),
                "status": status,
            }
        )
    return rows


def load_stock() -> list[dict[str, Any]]:
    path = DATA_ROOT / "Stock" / "2026_KMM_R2_STOCK.xlsx"
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["02) STOCK"]
    headers = header_map(ws, 4)
    rows: list[dict[str, Any]] = []
    for row in ws.iter_rows(min_row=5, values_only=True):
        branch = normalize_branch(cell(row, headers, "BRANCH")) or "Missing"
        year = as_int(cell(row, headers, "Years")) or None
        _, received_month = year_month_from_code(cell(row, headers, "เดือนที่รับจริง"))
        rows.append(
            {
                "date": iso_date(cell(row, headers, "DAY IN")),
                "year": year,
                "month": received_month,
                "branch": branch,
                "salesperson": as_text(cell(row, headers, "Sales Staff")),
                "productType": as_text(cell(row, headers, "TYPE")),
                "model": as_text(cell(row, headers, "MODEL")),
                "ageBucket": as_text(cell(row, headers, "Car Flow")),
                "msrp": as_number(cell(row, headers, "MSRP")),
            }
        )
    return rows


def load_marketing() -> list[dict[str, Any]]:
    path = DATA_ROOT / "Marketing" / "2026 Marketing Summary.xlsx"
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["Sheet1"]
    headers = header_map(ws, 2)
    rows: list[dict[str, Any]] = []
    for row in ws.iter_rows(min_row=3, values_only=True):
        year, month = year_month_from_date(cell(row, headers, "Event Date"))
        rows.append(
            {
                "date": iso_date(cell(row, headers, "Event Date")),
                "year": year,
                "month": month,
                "branch": normalize_branch(cell(row, headers, "Dealer")),
                "salesperson": "",
                "stateRegion": as_text(cell(row, headers, "Division")),
                "township": as_text(cell(row, headers, "Township")),
                "village": as_text(cell(row, headers, "Village")),
                "activity": as_text(cell(row, headers, "Type of Activities")),
                "participants": as_int(cell(row, headers, "Participants")),
                "bookingCount": as_int(cell(row, headers, "BK")),
                "prospectCount": as_int(cell(row, headers, "PC")),
                "expense": as_number(cell(row, headers, "KMM Expense")),
            }
        )
    return rows


def main() -> None:
    sources = [
        DATA_ROOT / "Sales" / "Sales KPI.xlsx",
        DATA_ROOT / "Sales" / "2026_KMM_CPI copy.xlsx",
        DATA_ROOT / "Booking" / "KMMF3002 KMM Booking Data.2.xlsx",
        DATA_ROOT / "Stock" / "2026_KMM_R2_STOCK.xlsx",
        DATA_ROOT / "Marketing" / "2026 Marketing Summary.xlsx",
    ]
    latest_mtime = max(path.stat().st_mtime for path in sources)
    data = {
        "meta": {
            "company": "KUBOTA MAESOD MYANMAR",
            "shortName": "KMM",
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
            "sourceUpdatedAt": datetime.fromtimestamp(latest_mtime).isoformat(timespec="seconds"),
            "sources": [str(path.relative_to(ROOT.parent)) for path in sources],
        },
        "plan": load_plan(),
        "sales": load_sales(),
        "booking": load_booking(),
        "stock": load_stock(),
        "marketing": load_marketing(),
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print({key: len(data[key]) for key in ["sales", "booking", "stock", "marketing"]})


if __name__ == "__main__":
    main()
