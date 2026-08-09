export const KAI_DEFAULT_PRIMARY_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
export const KAI_DEFAULT_FALLBACK_MODEL = "@cf/meta/llama-3.2-3b-instruct";
// Retained for compatibility with Phase 1 imports. New code uses primaryModel.
export const KAI_DEFAULT_MODEL = KAI_DEFAULT_PRIMARY_MODEL;
export const KAI_DEFAULT_MAX_TOKENS = 384;
export const KAI_DEFAULT_TEMPERATURE = 0.4;

export const KAI_MAX_MESSAGE_LENGTH = 4_000;
export const KAI_MAX_HISTORY_MESSAGES = 20;
export const KAI_MAX_HISTORY_CHARACTERS = 16_000;
export const KAI_MAX_REQUEST_BYTES = 48_000;
export const KAI_REQUEST_TIMEOUT_MS = 30_000;

export type KaiRuntimeConfig = {
  primaryModel: string;
  fallbackModel: string | null;
  maxTokens: number;
  temperature: number;
};

type KaiConfigEnvironment = {
  KAI_PRIMARY_MODEL?: string;
  KAI_FALLBACK_MODEL?: string;
  // Legacy Phase 1 override; used only when KAI_PRIMARY_MODEL is absent.
  KAI_MODEL?: string;
  KAI_MAX_TOKENS?: string;
  KAI_TEMPERATURE?: string;
};

export function getKaiRuntimeConfig(
  environment: KaiConfigEnvironment,
): KaiRuntimeConfig {
  return {
    primaryModel:
      environment.KAI_PRIMARY_MODEL?.trim() ||
      environment.KAI_MODEL?.trim() ||
      KAI_DEFAULT_PRIMARY_MODEL,
    fallbackModel: normalizedFallbackModel(environment.KAI_FALLBACK_MODEL),
    maxTokens: boundedNumber(
      environment.KAI_MAX_TOKENS,
      KAI_DEFAULT_MAX_TOKENS,
      64,
      1_024,
    ),
    temperature: boundedNumber(
      environment.KAI_TEMPERATURE,
      KAI_DEFAULT_TEMPERATURE,
      0,
      1,
    ),
  };
}

function normalizedFallbackModel(value: string | undefined) {
  if (value === "") return null;
  return value?.trim() || KAI_DEFAULT_FALLBACK_MODEL;
}

function boundedNumber(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}
