import { auth } from "../firebase";
import type { KaiChatResponse, KaiMessage } from "./types";
import { resolveActiveCompanyId } from "../company-context/client-store";

const CLIENT_TIMEOUT_MS = 35_000;

type RuntimeQueryPayload = {
  success?: boolean;
  intent?: string;
  metric?: unknown;
  data?: unknown;
  response?: { text?: unknown };
  error?: { code?: string; message?: string };
};

export async function askKai(
  message: string,
  history: KaiMessage[],
  onRequestStart?: () => void,
  companyId?: string,
): Promise<KaiChatResponse> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    return failure(
      "unauthorized",
      "Your secure session has expired. Sign in again to use KAI.",
    );
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    onRequestStart?.();
    const activeCompanyId = resolveActiveCompanyId(companyId);
    const runtimeResult = await requestRuntimeQuery(
      token,
      message,
      activeCompanyId,
      controller.signal,
    );
    if (runtimeResult.kind === "handled" || runtimeResult.kind === "failure") {
      return runtimeResult.response;
    }

    const response = await fetch("/api/kai/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        history,
        companyId: activeCompanyId,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const data = (await response.json()) as KaiChatResponse;
    if (data && typeof data.success === "boolean") return data;
    return failure("provider_error", "KAI could not complete that response.");
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError"
      ? failure("timeout", "KAI took too long to respond. Please try again.")
      : failure("offline", "KAI is offline right now. Please try again shortly.");
  } finally {
    window.clearTimeout(timeout);
  }
}

async function requestRuntimeQuery(
  token: string,
  message: string,
  companyId: string | undefined,
  signal: AbortSignal,
): Promise<
  | { kind: "handled"; response: KaiChatResponse }
  | { kind: "unsupported" }
  | { kind: "fallback" }
  | { kind: "failure"; response: KaiChatResponse }
> {
  let response: Response;
  try {
    response = await fetch("/api/kai/query", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: message, companyId }),
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    // Keep older environments usable while the new endpoint is not available.
    return { kind: "fallback" };
  }

  const payload = await readRuntimePayload(response);
  if (response.ok && payload.success === true && typeof payload.response?.text === "string") {
    return {
      kind: "handled",
      response: {
        success: true,
        answer: payload.response.text,
        model: "deterministic",
        usage: null,
        tool: {
          id: "kmmBusiness",
          status: "success",
          data: {
            intent: payload.intent,
            metric: payload.metric,
            data: payload.data,
          },
        },
      },
    };
  }

  if (response.status === 404) return { kind: "fallback" };
  if (response.status === 422 && payload.error?.code === "unsupported_question") {
    return { kind: "unsupported" };
  }
  if (response.status === 401) {
    return {
      kind: "failure",
      response: failure(
        "unauthorized",
        payload.error?.message ?? "Authentication is required to use KAI.",
      ),
    };
  }
  if (response.status === 403) {
    return {
      kind: "failure",
      response: failure(
        "provider_error",
        payload.error?.message ?? "You do not have permission to query KAI for this company.",
      ),
    };
  }
  if (response.status === 503) {
    return {
      kind: "failure",
      response: failure(
        "offline",
        payload.error?.message ?? "KAI's internal data service is unavailable right now.",
      ),
    };
  }
  return {
    kind: "failure",
    response: failure(
      "provider_error",
      payload.error?.message ?? "KAI could not query the internal data layer.",
    ),
  };
}

async function readRuntimePayload(response: Response): Promise<RuntimeQueryPayload> {
  try {
    const payload = await response.json() as unknown;
    return payload && typeof payload === "object" ? payload as RuntimeQueryPayload : {};
  } catch {
    return {};
  }
}

function failure(
  code: "unauthorized" | "timeout" | "offline" | "provider_error",
  message: string,
): KaiChatResponse {
  return { success: false, error: { code, message } };
}
