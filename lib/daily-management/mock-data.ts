export const dailyManagementMock = {
  reportDate: "2026-08-09",
  lastUpdated: "06:00 AM",
  kpis: [
    { key: "salesToday", label: "Sales Today", value: "3", unit: "Units", detail: "Yesterday 2", tone: "green" },
    { key: "salesMtd", label: "Sales MTD", value: "10", unit: "Units", detail: "Pace (9 days) 14", tone: "blue" },
    { key: "target", label: "Target", value: "48", unit: "Units", detail: "20.8% achievement · -4 vs pace", tone: "teal" },
    { key: "bookingToday", label: "Booking Today", value: "4", unit: "Units", detail: "Yesterday 1", tone: "purple" },
    { key: "activeBooking", label: "Active Booking", value: "79", unit: "Units", detail: "Old BK 32 · New BK 47", tone: "orange" },
    { key: "stockEngine", label: "Stock (Engine)", value: "83", unit: "Units", detail: "Yesterday 83", tone: "teal" },
    { key: "stockValue", label: "Stock Value", value: "12,983", unit: "M MMK", detail: "-11.1% vs Jul-26", tone: "purple" },
  ],
  salesPerformance: {
    branches: [
      { branch: "KMM01 · Hpa-an", sales: 3, target: 4, achievement: "75%", pace: "+1" },
      { branch: "KMM02 · Mawlamyine", sales: 4, target: 20, achievement: "20%", pace: "-2" },
      { branch: "KMM03 · Tharyarwaddy", sales: 3, target: 24, achievement: "12.5%", pace: "-3" },
    ],
    top: [
      { name: "Aung Bo Bo", result: "4 / 5", achievement: "80%" },
      { name: "Than Tun Aung", result: "3 / 5", achievement: "60%" },
      { name: "Hla Myo Oo", result: "2 / 4", achievement: "50%" },
    ],
    attention: [
      { name: "Kyaw Lin Oo", result: "0 / 5", achievement: "0%" },
      { name: "Ye Htet", result: "1 / 4", achievement: "25%" },
      { name: "Htet Lin Aung", result: "1 / 6", achievement: "17%" },
    ],
  },
  bookingPipeline: [
    { label: "New Today", value: 4, color: "#61AF4D", width: 100 },
    { label: "A HOT", value: 49, color: "#F5C338", width: 88 },
    { label: "B HOT", value: 30, color: "#F97316", width: 76 },
    { label: "Wait Approve", value: 3, color: "#3B82F6", width: 64 },
    { label: "Wait Delivery", value: 74, color: "#8B4BB5", width: 52 },
    { label: "Delivered Today", value: 2, color: "#8C8C8C", width: 40 },
  ],
  cancellation: { total: 1, reason: "Not ready to pay / Price adjustment" },
  todayDetail: [
    { branch: "KMM01", salesperson: "Jue", model: "M6240HI+FD", salesToday: 1, salesMtd: 3, aHot: 1, bHot: 0, status: "Ready Delivery", tone: "positive" },
    { branch: "KMM02", salesperson: "Aung Bo Bo", model: "DC70G PRO", salesToday: 1, salesMtd: 4, aHot: 2, bHot: 0, status: "Wait Approve", tone: "warning" },
    { branch: "KMM02", salesperson: "Than Tun Aung", model: "M7040+FD", salesToday: 0, salesMtd: 2, aHot: 1, bHot: 1, status: "A HOT", tone: "warning" },
    { branch: "KMM02", salesperson: "Ye Lin Tun", model: "M6040HI+FD", salesToday: 0, salesMtd: 1, aHot: 0, bHot: 1, status: "B HOT", tone: "warning" },
    { branch: "KMM03", salesperson: "Hla Myo Oo", model: "DC70G PRO", salesToday: 1, salesMtd: 0, aHot: 0, bHot: 1, status: "Wait Delivery", tone: "neutral" },
  ],
  stock: {
    value: "12,983",
    previousMonthChange: "-11.1%",
    psi: "8.3",
    locations: [
      { label: "03-Hlegu", units: 35 },
      { label: "02-Mawlamyine", units: 24 },
      { label: "03-Tharyarwaddy", units: 18 },
      { label: "01-Hpa-an", units: 2 },
      { label: "01-Naung Cho", units: 2 },
      { label: "Warehouse (NCH)", units: 2 },
    ],
    aging: [
      { label: "≤ 30 Days", units: 21, percent: 25, color: "#54A948" },
      { label: "31–60 Days", units: 22, percent: 27, color: "#F6C43C" },
      { label: "61–90 Days", units: 7, percent: 8, color: "#F28C28" },
      { label: "91+ Days", units: 33, percent: 40, color: "#EF4B2F" },
    ],
  },
  bookingStock: [
    { model: "M6240 Series", aHot: 15, bHot: 4, total: 19, stock: 4, coverage: "0.2 Month", status: "Potential shortage", tone: "negative" },
    { model: "DC70G PRO", aHot: 22, bHot: 8, total: 30, stock: 50, coverage: "1.7 Months", status: "High stock", tone: "warning" },
    { model: "M7040 Series", aHot: 6, bHot: 3, total: 9, stock: 8, coverage: "0.9 Month", status: "Low stock", tone: "warning" },
    { model: "Others (All Models)", aHot: 6, bHot: 15, total: 21, stock: 21, coverage: "1.0 Month", status: "Normal", tone: "positive" },
  ],
  actions: [
    { title: "DC70G PRO: 21 units > 90 days", detail: "Locations: Hlegu (14), NL (4), MLY (3)", owner: "KMM03", action: "Review", tone: "negative" },
    { title: "3 bookings waiting for approval", detail: "A HOT 1 · B HOT 2", owner: "All branches", action: "Follow up", tone: "warning" },
    { title: "Sales behind expected pace", detail: "MTD 10 vs expected 14 (-4 units)", owner: "All sales", action: "Action", tone: "negative" },
  ],
  notes: [
    { title: "Today’s Situation", items: ["Customer traffic improving at KMM02", "Combine demand still strong", "Competitor offering 2–3 year leasing"] },
    { title: "Management Decision", items: ["Prioritize combine delivery this week", "Follow up MCB & MADB approval", "Plan promotion for aged CH stock"] },
    { title: "Tomorrow Focus", items: ["Close 3 A-HOT bookings", "Follow up approval cases", "Transfer aged stock from Hlegu to MLY"] },
  ],
} as const;

export type DailyManagementMock = typeof dailyManagementMock;
