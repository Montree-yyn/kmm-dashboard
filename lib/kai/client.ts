import { auth } from "../firebase";
import type { KaiChatResponse, KaiMessage } from "./types";

const CLIENT_TIMEOUT_MS = 35_000;

export async function askKai(
  message: string,
  history: KaiMessage[],
  onRequestStart?: () => void,
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
    const response = await fetch("/api/kai/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, history }),
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

function failure(
  code: "unauthorized" | "timeout" | "offline" | "provider_error",
  message: string,
): KaiChatResponse {
  return { success: false, error: { code, message } };
}
