import type { AIProvider } from "../provider";
import type { SearchProvider, SearchResult } from "../search/types";
import type { KaiMessage, KaiUsage } from "../types";

/**
 * A deliberately small, server-resolved context for KMM Business Intelligence.
 * It never comes from a prompt or an LLM-generated parameter.
 */
export type KaiBusinessAccess = {
  companyId: string;
  role: "super_admin" | "company_admin" | "manager";
};

export type KaiToolId = "datetime" | "calculator" | "webSearch" | "kmmBusiness";

export type KaiToolContext = {
  message: string;
  now: Date;
  history: KaiMessage[];
  aiProvider?: AIProvider;
  searchProvider?: SearchProvider;
  maxTokens: number;
  temperature: number;
  businessAccess?: KaiBusinessAccess | null;
};

export type KaiToolOutput = {
  answer: string;
  data: unknown;
  sources?: SearchResult[];
  usage?: KaiUsage;
  model?: string;
  fallbackUsed?: boolean;
};

export interface KaiTool {
  readonly id: KaiToolId;
  matches(message: string): boolean;
  execute(context: KaiToolContext): KaiToolOutput | Promise<KaiToolOutput>;
}

export type KaiToolRunResult = {
  id: KaiToolId;
  status: "success" | "error";
  answer: string;
  data?: unknown;
  sources?: SearchResult[];
  usage?: KaiUsage;
  model?: string;
  fallbackUsed?: boolean;
};

export class KaiToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
