import type { KaiToolRunResult } from "./types";

/**
 * Preserve deterministic tool output verbatim in mixed responses. Web-search
 * prose is deliberately isolated from DateTime, Calculator, and KMM BI so an
 * LLM synthesis cannot overwrite an authoritative value.
 */
export function composeKaiToolAnswer(results: readonly Pick<KaiToolRunResult, "id" | "answer">[]) {
  if (results.length <= 1) return results[0]?.answer ?? "";
  return results.map((result) => {
    const heading = result.id === "datetime"
      ? "เวลาปัจจุบัน"
      : result.id === "calculator"
        ? "ผลการคำนวณ"
        : result.id === "kmmBusiness"
          ? "ข้อมูล KMM"
          : "ข้อมูลปัจจุบันจากเว็บ";
    return `${heading}\n${result.answer}`;
  }).join("\n\n");
}
