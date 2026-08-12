import {
  KAI_MAX_HISTORY_CHARACTERS,
  KAI_MAX_HISTORY_MESSAGES,
  KAI_MAX_MESSAGE_LENGTH,
  KAI_MAX_REQUEST_BYTES,
  KAI_REQUEST_TIMEOUT_MS,
  getKaiRuntimeConfig,
} from "../../../../lib/kai/config";
import {
  CloudflareWorkersAIProvider,
  type WorkersAIBinding,
} from "../../../../lib/kai/provider";
import type {
  KaiChatFailure,
  KaiErrorCode,
  KaiMessage,
  KaiSource,
} from "../../../../lib/kai/types";
import { CachedSearchProvider, TavilySearchProvider } from "../../../../lib/kai/search/tavily-provider";
import { resolveKaiBusinessAccess } from "../../../../lib/kai/business/access-context";
import { isKmmBusinessQuestion, isKmmSecurityRequest } from "../../../../lib/kai/tools/kmm-business";
import { runKaiTools } from "../../../../lib/kai/tools/registry";
import { composeKaiToolAnswer } from "../../../../lib/kai/tools/response-composer";
import {
  AuthError,
  verifyFirebaseRequest,
} from "../../../../lib/server/firebase-auth";

export const dynamic = "force-dynamic";

type KaiEnvironment = {
  AI?: WorkersAIBinding;
  KAI_MODEL?: string;
  KAI_PRIMARY_MODEL?: string;
  KAI_FALLBACK_MODEL?: string;
  KAI_MAX_TOKENS?: string;
  KAI_TEMPERATURE?: string;
  TAVILY_API_KEY?: string;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 12;
const requestWindows = new Map<string, number[]>();

export async function POST(request: Request) {
  try {
    const user = await verifyFirebaseRequest(request);
    if (!takeRateLimitToken(user.id)) {
      return fail(
        "rate_limited",
        "KAI is receiving too many requests. Please wait a moment and try again.",
        429,
      );
    }

    const rawBody = await readBoundedBody(request);
    const input = parseInput(rawBody);
    // Resolve access only for recognized company BI requests. The resolver is
    // read-only and derives the company exclusively from active membership.
    // Security denials are deterministic and must not trigger even a
    // read-only access lookup before the tool router refuses the request.
    const securityRequest = isKmmSecurityRequest(input.message);
    const businessAccess = isKmmBusinessQuestion(input.message) && !securityRequest
      ? await resolveKaiBusinessAccess(user, request, input.companyId)
      : undefined;

    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as KaiEnvironment;
    const config = getKaiRuntimeConfig(runtime);
    const provider = runtime.AI
      ? new CloudflareWorkersAIProvider(
          runtime.AI,
          config.primaryModel,
          config.fallbackModel,
        )
      : undefined;
    const searchProvider = runtime.TAVILY_API_KEY
      ? new CachedSearchProvider(new TavilySearchProvider(runtime.TAVILY_API_KEY))
      : undefined;
    const toolResults = await withTimeout(
      runKaiTools(input.message, {
        history: input.history,
        aiProvider: provider,
        searchProvider,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        businessAccess,
      }),
      KAI_REQUEST_TIMEOUT_MS,
    );
    if (toolResults.length) {
      const tools = toolResults.map(({ id, status, data }) => ({ id, status, data }));
      const sources = deduplicateSources(toolResults.flatMap((result) => result.sources ?? []));
      const usage = toolResults.find((result) => result.usage)?.usage ?? null;
      const aiResult = toolResults.find((result) => result.model);
      console.info("KAI route", {
        tools: toolResults.map((result) => result.id),
        model: aiResult?.model ?? null,
        fallbackUsed: aiResult?.fallbackUsed ?? false,
      });
      return Response.json(
        {
          success: true,
          answer: composeKaiToolAnswer(toolResults),
          model: aiResult?.model
            ? aiResult.model
            : "deterministic",
          usage,
          tool: tools[0],
          tools,
          sources,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!provider) {
      return fail(
        "offline",
        "KAI is not connected in this environment yet.",
        503,
      );
    }

    const completion = await withTimeout(
      provider.complete({
        ...input,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      }),
      KAI_REQUEST_TIMEOUT_MS,
    );
    console.info("KAI route", {
      tools: [],
      model: completion.model,
      fallbackUsed: completion.fallbackUsed,
    });

    return Response.json(
      {
        success: true,
        answer: completion.answer,
        model: completion.model,
        usage: completion.usage,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(
        error.status === 401 ? "unauthorized" : "provider_error",
        error.status === 401
          ? "Authentication is required to use KAI."
          : "KAI authentication is temporarily unavailable.",
        error.status,
      );
    }
    if (error instanceof KaiRequestError) {
      return fail("invalid_request", error.message, error.status);
    }

    const category = classifyProviderError(error);
    console.warn("KAI request failed", { category });
    return providerFailure(category);
  }
}

function deduplicateSources(sources: KaiSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

async function readBoundedBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > KAI_MAX_REQUEST_BYTES) {
    throw new KaiRequestError("The KAI request is too large.", 413);
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > KAI_MAX_REQUEST_BYTES) {
    throw new KaiRequestError("The KAI request is too large.", 413);
  }
  return rawBody;
}

function parseInput(rawBody: string): { message: string; history: KaiMessage[]; companyId?: string } {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new KaiRequestError("Send a valid JSON request.", 400);
  }

  if (!body || typeof body !== "object") {
    throw new KaiRequestError("Send a valid KAI request.", 400);
  }
  const record = body as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message.trim() : "";
  if (!message) throw new KaiRequestError("Enter a message for KAI.", 400);
  if (message.length > KAI_MAX_MESSAGE_LENGTH) {
    throw new KaiRequestError(
      `Keep messages under ${KAI_MAX_MESSAGE_LENGTH.toLocaleString()} characters.`,
      400,
    );
  }

  const history = record.history ?? [];
  if (!Array.isArray(history) || history.length > KAI_MAX_HISTORY_MESSAGES) {
    throw new KaiRequestError("The conversation history is invalid.", 400);
  }

  let historyCharacters = 0;
  const cleanHistory = history.map((entry): KaiMessage => {
    if (!entry || typeof entry !== "object") {
      throw new KaiRequestError("The conversation history is invalid.", 400);
    }
    const item = entry as Record<string, unknown>;
    if (
      (item.role !== "user" && item.role !== "assistant") ||
      typeof item.content !== "string" ||
      !item.content.trim() ||
      item.content.length > KAI_MAX_MESSAGE_LENGTH
    ) {
      throw new KaiRequestError("The conversation history is invalid.", 400);
    }
    const content = item.content.trim();
    historyCharacters += content.length;
    return { role: item.role, content };
  });

  if (historyCharacters > KAI_MAX_HISTORY_CHARACTERS) {
    throw new KaiRequestError("The conversation history is too long.", 400);
  }
  const companyId = typeof record.companyId === "string"
    ? record.companyId.trim()
    : undefined;
  return { message, history: cleanHistory, companyId: companyId || undefined };
}

function takeRateLimitToken(userId: string) {
  const now = Date.now();
  const active = (requestWindows.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  if (active.length >= RATE_LIMIT_REQUESTS) {
    requestWindows.set(userId, active);
    return false;
  }
  active.push(now);
  requestWindows.set(userId, active);
  return true;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("KAI_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function classifyProviderError(error: unknown) {
  const text = error instanceof Error ? error.message.toLowerCase() : "";
  if (text.includes("quota") || text.includes("neuron") || text.includes("limit")) {
    return "quota_exceeded" as const;
  }
  if (text.includes("timeout")) return "timeout" as const;
  if (text.includes("binding") || text.includes("unavailable")) {
    return "offline" as const;
  }
  return "provider_error" as const;
}

function providerFailure(code: Exclude<KaiErrorCode, "invalid_request" | "unauthorized" | "rate_limited">) {
  if (code === "quota_exceeded") {
    return fail(code, "KAI has reached today’s AI usage limit. Please try again later.", 429);
  }
  if (code === "timeout") {
    return fail(code, "KAI took too long to respond. Please try again.", 504);
  }
  if (code === "offline") {
    return fail(code, "KAI is offline right now. Please try again shortly.", 503);
  }
  return fail(code, "KAI could not complete that response. Please try again.", 502);
}

function fail(
  code: KaiErrorCode,
  message: string,
  status: number,
) {
  const body: KaiChatFailure = { success: false, error: { code, message } };
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

class KaiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
