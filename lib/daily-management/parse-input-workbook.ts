import * as XLSX from "@e965/xlsx";
import type { DailyManagementInputSnapshot } from "./input-storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls"]);

function normalized(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function numberValue(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`);
  return parsed;
}

function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new Error("Report Date ไม่ถูกต้อง");
  return parsed.toISOString().slice(0, 10);
}

function sheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`ไม่พบชีต “${sheetName}” กรุณาใช้ Excel Template ของระบบ`);
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
}

function workbookHeaders(workbook: XLSX.WorkBook) {
  return workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
    return rows.slice(0, 12).flatMap((row) => row.map(normalized));
  });
}

function transactionWorkbookType(workbook: XLSX.WorkBook, filename: string) {
  const tokens = new Set([...workbookHeaders(workbook), ...workbook.SheetNames.map(normalized), normalized(filename)]);
  const has = (...values: string[]) => values.some((value) => tokens.has(normalized(value)));
  if ((has("No.BK", "Booking No", "Purchase Status") && has("Dealer", "Customer", "CS NAME")) || normalized(filename).includes("booking")) return "Booking";
  if ((has("Stock Code", "Chassis No", "Engine No") && has("Today", "MSRP", "KMM")) || normalized(filename).includes("stock")) return "Stock";
  if ((has("Invoice No", "Sale Date", "Sales Date") && has("Quantity", "Sale Amount", "Sales Value")) || normalized(filename).includes("sales")) return "Sales";
  return null;
}

function table(rows: unknown[][], requiredHeaders: string[]) {
  const headerIndex = rows.findIndex((row) => requiredHeaders.every((header) => row.some((cell) => normalized(cell) === normalized(header))));
  if (headerIndex < 0) throw new Error(`ไม่พบหัวคอลัมน์ ${requiredHeaders.join(", ")}`);
  const header = rows[headerIndex].map(normalized);
  const records = rows.slice(headerIndex + 1).filter((row) => row.some((cell) => String(cell ?? "").trim()));
  const get = (row: unknown[], name: string) => row[header.indexOf(normalized(name))];
  return { records, get };
}

export type DailyManagementWorkbookResult = {
  snapshot: DailyManagementInputSnapshot;
  counts: { dailyRows: number; actions: number; notes: number };
};

export async function parseDailyManagementWorkbook(file: File, base: DailyManagementInputSnapshot): Promise<DailyManagementWorkbookResult> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error("รองรับเฉพาะไฟล์ Excel .xlsx หรือ .xls");
  if (file.size > MAX_FILE_SIZE) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 10 MB");

  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  if (!workbook.Sheets["Daily Input"]) {
    const transactionType = transactionWorkbookType(workbook, file.name);
    if (transactionType) throw new Error(`ไฟล์นี้เป็น ${transactionType} Data · กรุณาอัปโหลดที่ Data Hub > ${transactionType} ส่วนหน้านี้รับเฉพาะ KMM Daily Management Template`);
  }
  const daily = table(sheetRows(workbook, "Daily Input"), ["Report Date", "Branch", "Prepared By", "MTD Target", "Expected Pace", "Wait Approve", "Wait Delivery", "Delivered Today", "Cancel Units", "Cancel Reason"]);
  if (!daily.records.length) throw new Error("ชีต Daily Input ไม่มีข้อมูล");
  const row = daily.records[0];

  const actionTable = table(sheetRows(workbook, "Actions"), ["Priority", "Issue", "Detail", "Owner", "Next Step"]);
  const actions = actionTable.records.map((action, index) => {
    const priorityText = String(actionTable.get(action, "Priority") ?? "Warning").trim().toLowerCase();
    const priority = priorityText === "critical" ? "critical" : priorityText === "attention" ? "attention" : "warning";
    const title = String(actionTable.get(action, "Issue") ?? "").trim();
    const owner = String(actionTable.get(action, "Owner") ?? "").trim();
    if (!title || !owner) throw new Error(`Actions แถว ${index + 6}: ต้องมี Issue และ Owner`);
    return { title, detail: String(actionTable.get(action, "Detail") ?? "").trim(), owner, nextStep: String(actionTable.get(action, "Next Step") ?? "").trim(), priority } as const;
  });

  const noteTable = table(sheetRows(workbook, "Notes"), ["Category", "Note"]);
  const noteGroups: Record<string, string[]> = { situation: [], decision: [], tomorrowfocus: [] };
  noteTable.records.forEach((note, index) => {
    const category = normalized(noteTable.get(note, "Category"));
    const text = String(noteTable.get(note, "Note") ?? "").trim();
    if (!noteGroups[category]) throw new Error(`Notes แถว ${index + 6}: Category ไม่ถูกต้อง`);
    if (text) noteGroups[category].push(text);
  });

  const snapshot: DailyManagementInputSnapshot = {
    ...structuredClone(base),
    reportDate: dateValue(daily.get(row, "Report Date")),
    branch: String(daily.get(row, "Branch") ?? "All Branches").trim() || "All Branches",
    preparedBy: String(daily.get(row, "Prepared By") ?? "").trim(),
    target: {
      mtdTarget: numberValue(daily.get(row, "MTD Target"), "MTD Target"),
      expectedPace: numberValue(daily.get(row, "Expected Pace"), "Expected Pace"),
    },
    bookingLifecycle: {
      waitApprove: numberValue(daily.get(row, "Wait Approve"), "Wait Approve"),
      waitDelivery: numberValue(daily.get(row, "Wait Delivery"), "Wait Delivery"),
      deliveredToday: numberValue(daily.get(row, "Delivered Today"), "Delivered Today"),
      cancelUnits: numberValue(daily.get(row, "Cancel Units"), "Cancel Units"),
      cancelReason: String(daily.get(row, "Cancel Reason") ?? "").trim(),
    },
    actions,
    notes: {
      situation: noteGroups.situation.join("\n"),
      decision: noteGroups.decision.join("\n"),
      tomorrowFocus: noteGroups.tomorrowfocus.join("\n"),
    },
    savedAt: null,
    publishedAt: base.publishedAt,
  };
  return { snapshot, counts: { dailyRows: daily.records.length, actions: actions.length, notes: noteTable.records.length } };
}
