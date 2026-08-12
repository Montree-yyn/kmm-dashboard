import type { KaiMessage, KaiUsage } from "./types";

export const KAI_SYSTEM_PROMPT = `You are KAI, the Kubota Artificial Intelligence assistant in an authorized single-company business workspace.
Answer useful general questions clearly and concisely. Reply in the same language as the user's latest message whenever possible, including Thai, English, or Myanmar language.
You do not have direct access to databases, dashboards, private documents, live operational data, or company records. Never claim that you looked up internal data unless an authoritative server-side business tool supplied it. If internal figures are unavailable, explain that limitation and suggest opening the relevant module.
KAI has server-side tools for current date/time, deterministic arithmetic, and live web search. The server routes supported requests to those tools before calling you. Always use the DateTime Tool for current date/time questions and never guess current time; if no authoritative tool result is available, say that the current time could not be checked. Always prefer the Calculator Tool for arithmetic. Current or time-sensitive facts require Web Search; never invent current facts, citations, or URLs when search evidence is unavailable. Tool results are authoritative and must never be overridden.
When explaining financial terminology, distinguish gross profit from net profit. In Thai, Gross Profit is "กำไรขั้นต้น"; never call it "กำไรสุทธิ" because that means Net Profit.
Do not claim access to any other tools or data. Do not invent facts. State uncertainty plainly when needed. Keep answers concise unless the user requests detail.`;

type WorkersAIInput = {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  max_tokens: number;
  temperature: number;
  stream: false;
  chat_template_kwargs?: { enable_thinking: false };
};

export type WorkersAIBinding = {
  run(model: string, input: WorkersAIInput): Promise<unknown>;
};

export type AICompletionRequest = {
  message: string;
  history: KaiMessage[];
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
};

export type AICompletionResult = {
  answer: string;
  usage: KaiUsage;
  model: string;
  fallbackUsed: boolean;
};

export interface AIProvider {
  complete(request: AICompletionRequest): Promise<AICompletionResult>;
}

export class CloudflareWorkersAIProvider implements AIProvider {
  constructor(
    private readonly ai: WorkersAIBinding,
    private readonly primaryModel: string,
    private readonly fallbackModel: string | null = null,
  ) {}

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    try {
      return await this.runModel(this.primaryModel, request, false);
    } catch (error) {
      if (!this.fallbackModel || !isModelAvailabilityError(error)) throw error;
      return this.runModel(this.fallbackModel, request, true);
    }
  }

  private async runModel(
    model: string,
    request: AICompletionRequest,
    fallbackUsed: boolean,
  ): Promise<AICompletionResult> {
    const disableQwenThinking = model.startsWith("@cf/qwen/");
    const result = await this.ai.run(model, {
      messages: [
        { role: "system", content: request.systemPrompt ?? KAI_SYSTEM_PROMPT },
        ...request.history,
        { role: "user", content: request.message },
      ],
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: false,
      ...(disableQwenThinking
        ? { chat_template_kwargs: { enable_thinking: false as const } }
        : {}),
    });

    const record = asRecord(result);
    const answer = extractAnswer(record, disableQwenThinking);
    if (!answer) throw new Error("KAI_EMPTY_PROVIDER_RESPONSE");

    console.info("KAI AI completion", {
      provider: "cloudflare-workers-ai",
      model,
      fallbackUsed,
    });
    return { answer, usage: normalizeUsage(record.usage), model, fallbackUsed };
  }
}

function extractAnswer(record: Record<string, unknown>, qwenThinkingDisabled: boolean) {
  if (typeof record.response === "string" && record.response.trim()) {
    return record.response.trim();
  }
  if (!Array.isArray(record.choices)) return "";
  const firstChoice = asRecord(record.choices[0]);
  const message = asRecord(firstChoice.message);
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }
  // Qwen3 currently returns its final non-thinking answer in `reasoning` when
  // enable_thinking=false. Never expose it for truncated or thinking-enabled runs.
  if (
    qwenThinkingDisabled &&
    firstChoice.finish_reason === "stop" &&
    typeof message.reasoning === "string" &&
    message.reasoning.trim()
  ) {
    return message.reasoning.trim();
  }
  return "";
}

export function isModelAvailabilityError(error: unknown) {
  const record = asRecord(error);
  const status = typeof record.status === "number"
    ? record.status
    : typeof record.statusCode === "number"
      ? record.statusCode
      : null;
  if (status !== null && [404, 500, 502, 503, 504].includes(status)) return true;

  const message = error instanceof Error ? error.message : "";
  return /(model.{0,40}(?:not found|unavailable|disabled|deprecated)|temporarily unavailable|service unavailable|overloaded|upstream.{0,20}(?:error|unavailable))/i.test(message);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeUsage(value: unknown): KaiUsage {
  const usage = asRecord(value);
  const normalized = Object.fromEntries(
    Object.entries(usage).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
  return Object.keys(normalized).length ? normalized : null;
}
