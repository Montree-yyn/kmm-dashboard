/** Phase 5A: deterministic, read-only alerts. No forecast or persistence. */
import { isTargetDependentExecutiveSignal, type ExecutiveSignal } from "./executive-intelligence";

export const ALERT_SEVERITY = Object.freeze({ CRITICAL: "CRITICAL", WARNING: "WARNING", WATCH: "WATCH", POSITIVE: "POSITIVE", INFO: "INFO" } as const);
export type AlertSeverity = (typeof ALERT_SEVERITY)[keyof typeof ALERT_SEVERITY];
export type ExecutiveAlert = { id: string; type: ExecutiveSignal["code"]; severity: AlertSeverity; status: "NEW" | "ACTIVE" | "RESOLVED"; scope: "company" | "product" | "branch"; subject: string; period: string; title: string; summary: string; evidence: Record<string, number | string | null>; recommendedFocus: string; source: "KMM Internal Data"; generatedAt: string };

const severity: Record<ExecutiveSignal["code"], AlertSeverity> = {
  TARGET_MATERIAL_GAP: "CRITICAL", ZERO_SALES_WITH_STOCK: "CRITICAL", SALES_GAP_BOOKING_WEAKENING: "CRITICAL",
  HIGH_STOCK_LOW_SALES: "WARNING", GP_PRESSURE: "WARNING", BOOKING_WEAKENING: "WARNING", NEGATIVE_MOMENTUM: "WARNING",
  TARGET_GAP: "WARNING", SALES_GAP_BOOKING_IMPROVING: "WATCH", INVENTORY_PRESSURE_BOOKING_IMPROVING: "WATCH", SALES_UP_BOOKING_DOWN: "WATCH", TARGET_NEAR: "WATCH",
  TARGET_AHEAD: "POSITIVE", POSITIVE_MOMENTUM: "POSITIVE", BOOKING_IMPROVING: "POSITIVE",
};

/** Groups same-condition product evidence into one visible executive alert. */
export type AlertPeriodStatus = "COMPLETED" | "MTD" | "DAILY" | "WEEKLY";
export function evaluateExecutiveAlerts(snapshot: { period: { start?: string; end?: string; scopeLabel: string }; stock: { snapshotDate: string | null }; targetEvaluationEligible?: boolean }, signals: ExecutiveSignal[], generatedAt = new Date().toISOString(), periodStatus: AlertPeriodStatus = "COMPLETED"): ExecutiveAlert[] {
  const targetEvaluationEligible = snapshot.targetEvaluationEligible ?? periodStatus === "COMPLETED";
  const eligible = signals.filter((signal) => {
    if (!targetEvaluationEligible && isTargetDependentExecutiveSignal(signal)) return false;
    // A later snapshot is not evidence of a historical Stock condition.
    if (periodStatus === "COMPLETED" && signal.code.includes("STOCK") && snapshot.stock.snapshotDate && snapshot.period.end && snapshot.stock.snapshotDate > snapshot.period.end) return false;
    return true;
  });
  const groups = new Map<string, ExecutiveSignal[]>();
  for (const signal of eligible) {
    const subject = typeof signal.values.product === "string" ? "product" : typeof signal.values.branch === "string" ? "branch" : "company";
    const key = `${signal.code}:${subject}`; groups.set(key, [...(groups.get(key) ?? []), signal]);
  }
  return [...groups.values()].map((items): ExecutiveAlert => {
    const first = items[0]; const scope: ExecutiveAlert["scope"] = typeof first.values.product === "string" ? "product" : typeof first.values.branch === "string" ? "branch" : "company";
    const subject = scope === "product" ? items.map((item) => item.values.product).join(", ") : scope === "branch" ? String(first.values.branch) : "KMM";
    const evidence = { ...first.values, subjects: subject, ...(first.code.includes("STOCK") ? { stockSnapshotDate: snapshot.stock.snapshotDate } : {}) };
    const id = `${first.code}:${scope}:${subject}:${snapshot.period.scopeLabel}`.replace(/\s+/g, "-");
    return { id, type: first.code, severity: severity[first.code], status: "ACTIVE" as const, scope, subject, period: snapshot.period.scopeLabel, title: `${first.code}: ${subject}`, summary: first.detail, evidence, recommendedFocus: focus(first.code), source: "KMM Internal Data", generatedAt };
  }).sort((a, b) => rank(b.severity) - rank(a.severity) || exposure(b.evidence) - exposure(a.evidence) || a.id.localeCompare(b.id));
}

function rank(value: AlertSeverity) { return ({ CRITICAL: 5, WARNING: 4, WATCH: 3, POSITIVE: 2, INFO: 1 } as const)[value]; }
function exposure(values: Record<string, number | string | null>) { return Object.values(values).reduce<number>((sum, value) => sum + (typeof value === "number" ? Math.min(Math.abs(value), 1000000) : 0), 0); }
function focus(code: ExecutiveSignal["code"]) { if (code.includes("STOCK")) return "Review product sales activity against the dated Stock snapshot."; if (code.includes("BOOKING")) return "Review Booking follow-up; this is not a causal forecast."; if (code.includes("GP")) return "Review Gross Profit percentage and commercial mix."; return "Review the deterministic Sales and Target evidence for this period."; }
