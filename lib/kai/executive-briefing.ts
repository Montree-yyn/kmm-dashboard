/** Read-only Phase 5B presenter. Authoritative figures stay deterministic. */
import type { ExecutiveAlert } from "./executive-alerts";
import type { ExecutiveRecommendation } from "./executive-intelligence";

type Snapshot = { period:{start:string;end:string;scopeLabel:string}; targetEvaluationEligible?:boolean; sales:{units:number;value:number;gp:number;gpPercent:number|null}; booking:{units:number;value:number}; stock:{units:number;value:number;snapshotDate:string|null}; target:{target:number}|null; progress:{achievementPercent:number;gap:number}|null };
const number = (value:number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
const money = (value:number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
export function composeExecutiveBriefing(snapshot: Snapshot, alerts: ExecutiveAlert[], recommendations: ExecutiveRecommendation[], mode: "daily"|"weekly"|"monthly", isMtd: boolean) {
  const title = mode === "daily" ? "DAILY BRIEFING" : mode === "weekly" ? "WEEKLY BRIEFING" : "EXECUTIVE BRIEFING";
  const historicalStock = mode === "monthly" && !isMtd && Boolean(snapshot.stock.snapshotDate && snapshot.stock.snapshotDate > snapshot.period.end);
  const lines = [title, `${isMtd ? "MTD · " : ""}${snapshot.period.scopeLabel}`, "", "Performance", `• Sales: ${number(snapshot.sales.units)} คัน · ${money(snapshot.sales.value)} MMK`, `• กำไรขั้นต้น: ${money(snapshot.sales.gp)} MMK${snapshot.sales.gpPercent === null ? "" : ` · ${number(snapshot.sales.gpPercent)}%`}`, `• Booking: ${number(snapshot.booking.units)} คัน · ${money(snapshot.booking.value)} MMK`, `• ${historicalStock ? "Latest Available Stock" : "Stock"}: ${number(snapshot.stock.units)} คัน · ${money(snapshot.stock.value)} MMK${snapshot.stock.snapshotDate ? ` · ข้อมูล Stock ณ วันที่ ${snapshot.stock.snapshotDate}` : ""}`];
  if (historicalStock) lines.push("• ไม่มี Stock snapshot ณ สิ้นงวดในข้อมูลปัจจุบัน");
  if (snapshot.target && snapshot.progress) {
    lines.push(snapshot.targetEvaluationEligible
      ? `• Target: ${number(snapshot.target.target)} คัน · Achievement ${number(snapshot.progress.achievementPercent)}% · Gap ${number(snapshot.progress.gap)}`
      : `• Monthly Target Context: ${number(snapshot.target.target)} คัน · งวดยังไม่สิ้นสุด จึงยังไม่ประเมินผล Target ทั้งงวด`);
  }
  for (const [heading, levels] of [["Key Risks", ["CRITICAL","WARNING","WATCH"]], ["Key Positives", ["POSITIVE"]]] as Array<[string, string[]]>) { const selected=alerts.filter(a=>levels.includes(a.severity)).slice(0,3); if(selected.length) lines.push("",heading,...selected.map((a,i)=>`${i+1}. ${thaiAlert(a.type, a.subject)}`)); }
  if (recommendations.length) lines.push("", "Recommended Focus", ...recommendations.slice(0,3).map((item,index)=>`${index+1}. ${item.text}`));
  lines.push("", `ข้อมูล: ${snapshot.period.scopeLabel}`, "แหล่งข้อมูล: KMM Internal Data");
  return lines.join("\n");
}
function thaiAlert(type:string, subject:string) { if (type === "ZERO_SALES_WITH_STOCK") return `${subject} มี Stock แต่ยังไม่มียอดขายในงวด`; if (type.includes("TARGET")) return "ผลการขายเทียบ Target ตามงวดที่สมบูรณ์"; if (type.includes("BOOKING")) return "Booking เปลี่ยนแปลงจากงวดเปรียบเทียบ"; if (type.includes("GP")) return "GP% เปลี่ยนแปลงจากงวดเปรียบเทียบ"; return "ยอดขายเปลี่ยนแปลงจากงวดเปรียบเทียบ"; }
export function isSafeBriefingNarrative(value:string) { return !/(คาดว่า|เดือนหน้าจะ|น่าจะขายได้|forecast|projected|https?:\/\/)/i.test(value); }
