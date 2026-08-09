import { calculatorTool } from "./calculator";
import { dateTimeTool } from "./datetime";
import { webSearchTool } from "./web-search";
import { isKmmSecurityRequest, kmmBusinessTool } from "./kmm-business";
import {
  KaiToolError,
  type KaiTool,
  type KaiToolId,
  type KaiToolRunResult,
} from "./types";

export const kaiTools: readonly KaiTool[] = [
  kmmBusinessTool,
  dateTimeTool,
  calculatorTool,
  webSearchTool,
];

export async function runKaiTools(
  message: string,
  options: Omit<Parameters<KaiTool["execute"]>[0], "message" | "now"> & { now?: Date },
): Promise<KaiToolRunResult[]> {
  // Security requests always win: they must not reach access resolution,
  // deterministic data tools, Tavily, or the general model.
  const businessTool = kaiTools.find((candidate) => candidate.id === "kmmBusiness");
  const businessMatched = Boolean(businessTool?.matches(message));
  const matched = isKmmSecurityRequest(message)
    ? (businessTool ? [businessTool] : [])
    : businessMatched
      // A KMM aggregate and a public-current question may coexist. The web
      // tool normalizes its own provider query and never receives KMM data.
      ? [businessTool!, ...kaiTools.filter((candidate) => candidate.id !== "kmmBusiness" && candidate.matches(message))]
      : kaiTools.filter((candidate) => candidate.matches(message));
  return Promise.all(
    matched.map(async (tool) => {
      try {
        const output = await tool.execute({
          ...options,
          message,
          now: options.now ?? new Date(),
        });
        return { id: tool.id, status: "success" as const, ...output };
      } catch (error) {
        const code = error instanceof KaiToolError
          ? error.code
          : error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "unknown";
        console.warn("KAI tool execution failed", { tool: tool.id, code });
        return {
          id: tool.id,
          status: "error" as const,
          answer: toolFailureAnswer(tool.id, message),
        };
      }
    }),
  );
}

function toolFailureAnswer(tool: KaiToolId, message: string) {
  const language = /[\u1000-\u109f]/.test(message)
    ? "my"
    : /[\u0e00-\u0e7f]/.test(message)
      ? "th"
      : "en";

  if (tool === "datetime") {
    if (language === "th") return "ไม่สามารถตรวจสอบเวลาปัจจุบันได้ กรุณาลองอีกครั้ง";
    if (language === "my") return "လက်ရှိအချိန်ကို မစစ်ဆေးနိုင်ပါ။ ထပ်မံကြိုးစားပါ။";
    return "I could not check the current time. Please try again.";
  }
  if (tool === "calculator") {
    if (language === "th") return "ไม่สามารถคำนวณนิพจน์นี้ได้";
    if (language === "my") return "ဤတွက်ချက်မှုကို မလုပ်ဆောင်နိုင်ပါ။";
    return "I could not calculate that expression.";
  }
  if (tool === "kmmBusiness") {
    if (language === "th") return "ไม่สามารถดึงข้อมูล KMM ได้ในขณะนี้ กรุณาลองอีกครั้ง";
    if (language === "my") return "KMM အချက်အလက်ကို ယခုမရယူနိုင်ပါ။ ထပ်မံကြိုးစားပါ။";
    return "KMM data is unavailable right now. Please try again.";
  }
  if (language === "th") {
    return "ขณะนี้ KAI ไม่สามารถตรวจสอบข้อมูลล่าสุดจากอินเทอร์เน็ตได้ กรุณาลองอีกครั้ง";
  }
  if (language === "my") {
    return "ယခု KAI သည် အင်တာနက်မှ နောက်ဆုံးအချက်အလက်ကို မစစ်ဆေးနိုင်ပါ။ ထပ်မံကြိုးစားပါ။";
  }
  return "KAI cannot check the latest information from the internet right now. Please try again.";
}
