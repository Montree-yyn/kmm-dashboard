import type { AIProvider, AICompletionResult } from "./provider";
import type { ExecutivePriority, ExecutiveSignal } from "./executive-intelligence";

type ExecutiveSnapshot = {
  period: { start: string; end: string; scopeLabel: string };
  sales: { units: number; value: number; gp: number; gpPercent: number | null };
  booking: { units: number; value: number };
  stock: { units: number; value: number; snapshotDate: string | null };
  target: { target: number; sourceVersion?: string } | null;
  progress: { achievementPercent: number; gap: number } | null;
  products: Array<{ product: string; sales: { units: number }; booking: { units: number }; stock: { units: number }; stockCoverProxy: number | null }>;
  branches: Array<{ branch: string; sales: { units: number; value: number; gpPercent: number | null }; booking: { units: number }; stock: { units: number } }>;
};

export type ExecutiveNarrativeResult = {
  text: string;
  model: string | null;
  fallbackUsed: boolean;
  rejected: boolean;
};

/** Only aggregate, already-authoritative data crosses the model boundary. */
export function createExecutiveNarrativeContext(
  snapshot: ExecutiveSnapshot,
  signals: ExecutiveSignal[],
  priorities: ExecutivePriority[],
) {
  return {
    period: snapshot.period,
    metrics: {
      sales: snapshot.sales,
      booking: snapshot.booking,
      stock: snapshot.stock,
      target: snapshot.target ? { units: snapshot.target.target, achievementPercent: snapshot.progress?.achievementPercent ?? null, gap: snapshot.progress?.gap ?? null } : null,
    },
    products: snapshot.products.slice(0, 4).map((row) => ({ product: row.product, salesUnits: row.sales.units, bookingUnits: row.booking.units, stockUnits: row.stock.units, stockCoverProxy: row.stockCoverProxy })),
    branches: snapshot.branches.slice(0, 3).map((row) => ({ branch: row.branch, salesUnits: row.sales.units, bookingUnits: row.booking.units, stockUnits: row.stock.units })),
    signals: signals.slice(0, 5).map((signal) => ({ code: signal.code, detail: signal.detail, values: signal.values })),
    priorities: priorities.slice(0, 4).map(({ rank, signal, severity, reason }) => ({ rank, signal, severity, reason })),
  };
}

const NARRATIVE_SYSTEM_PROMPT = `You are KAI's executive narrative editor. Write exactly one concise Thai management paragraph from the supplied structured facts.
Do not repeat or add any numbers, dates, targets, or KPI values; deterministic cards already display them. You may name only a product or branch explicitly listed in allowedSubjects.
Do not state causes, forecasts, or certainty beyond the supplied signal wording. Use observation language such as "ข้อมูลบ่งชี้ว่า", "มีสัญญาณ", and "ควรติดตาม". Do not propose actions outside sales activity, booking conversion, stock allocation, promotion effectiveness, GP/discount discipline, or branch/product monitoring. Return only the paragraph.`;

export async function composeExecutiveNarrative(
  provider: AIProvider | undefined,
  snapshot: ExecutiveSnapshot,
  signals: ExecutiveSignal[],
  priorities: ExecutivePriority[],
): Promise<ExecutiveNarrativeResult> {
  const fallback = deterministicExecutiveNarrative(signals, priorities);
  if (!provider) return { text: fallback, model: null, fallbackUsed: true, rejected: false };
  try {
    const narrativeContext = createExecutiveNarrativeContext(snapshot, signals, priorities);
    const completion = await provider.complete({
      message: JSON.stringify({ ...narrativeContext, allowedSubjects: allowedNarrativeSubjects(signals) }),
      history: [],
      maxTokens: 150,
      temperature: 0.15,
      systemPrompt: NARRATIVE_SYSTEM_PROMPT,
    });
    if (!isSafeExecutiveNarrative(completion.answer, allowedNarrativeSubjects(signals))) {
      return { text: fallback, model: completion.model, fallbackUsed: true, rejected: true };
    }
    return { text: completion.answer.trim(), model: completion.model, fallbackUsed: completion.fallbackUsed, rejected: false };
  } catch {
    return { text: fallback, model: null, fallbackUsed: true, rejected: false };
  }
}

/** Fact Lock: narrative cannot introduce figures or causal assertions. */
export function isSafeExecutiveNarrative(value: string, allowedSubjects: string[] = []) {
  const text = value.trim();
  const mentionedSubjects = text.match(/\b(?:TT|CH|EX|TP|KMM0[123])\b/g) ?? [];
  return Boolean(text)
    && text.length <= 900
    && !/[0-9\u0E50-\u0E59]/.test(text)
    && !/(?:สาเหตุ|เกิดจาก|เพราะว่า|because|caused by|therefore)/i.test(text)
    && !/(?:https?:\/\/|www\.)/i.test(text)
    && mentionedSubjects.every((subject) => allowedSubjects.includes(subject));
}

function allowedNarrativeSubjects(signals: ExecutiveSignal[]) {
  return [...new Set(signals.flatMap((signal) => [signal.values.product, signal.values.branch]).filter((value): value is string => typeof value === "string"))];
}

export function deterministicExecutiveNarrative(signals: ExecutiveSignal[], priorities: ExecutivePriority[]) {
  const positive = priorities.find((priority) => priority.severity === "positive");
  const risk = priorities.find((priority) => priority.severity !== "positive");
  const inventorySubjects = [...new Set(signals.filter((signal) => signal.code === "ZERO_SALES_WITH_STOCK" || signal.code === "HIGH_STOCK_LOW_SALES").map((signal) => signal.values.product).filter((value): value is string => typeof value === "string"))];
  const targetAhead = signals.some((signal) => signal.code === "TARGET_AHEAD");
  const momentum = signals.some((signal) => signal.code === "POSITIVE_MOMENTUM");
  const gpPressure = signals.some((signal) => signal.code === "GP_PRESSURE");
  const positiveClause = targetAhead && momentum
    ? "ยอดขายทำได้สูงกว่า Target และดีขึ้นจากงวดก่อนหน้า"
    : targetAhead ? "ยอดขายทำได้สูงกว่า Target" : momentum ? "ยอดขายดีขึ้นจากงวดก่อนหน้า" : "ผลการดำเนินงานมีสัญญาณเชิงบวก";
  const riskClause = inventorySubjects.length
    ? `แต่ยังมีความเสี่ยงด้าน Stock ใน ${inventorySubjects.join(" และ ")}`
    : gpPressure ? "แต่ GP% ควรถูกติดตาม" : "แต่ยังมีประเด็นที่ควรติดตาม";
  if (positive && risk) return `ข้อมูลบ่งชี้ว่า${positiveClause} ${riskClause} จึงควรรักษาโมเมนตัมควบคู่กับการติดตามประเด็นดังกล่าว`;
  if (positive) return "ข้อมูลบ่งชี้ว่าผลการดำเนินงานมีสัญญาณเชิงบวก ควรติดตามการรักษาโมเมนตัมและคุณภาพกำไรอย่างต่อเนื่อง";
  if (risk || signals.length) return "ข้อมูลบ่งชี้ว่ามีประเด็นที่ควรติดตามตามลำดับความสำคัญด้านล่าง โดยข้อมูลปัจจุบันยังไม่เพียงพอที่จะยืนยันสาเหตุ";
  return "ยังไม่พบสัญญาณตามกฎที่กำหนดในขอบเขตนี้ จึงควรติดตามข้อมูลรอบถัดไปอย่างต่อเนื่อง";
}

export type { AICompletionResult };
