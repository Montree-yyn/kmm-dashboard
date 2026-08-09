export type KaiRole = "user" | "assistant";

export type KaiMessage = {
  role: KaiRole;
  content: string;
};

export type KaiUsage = Record<string, number> | null;

export type KaiSource = {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt: string | null;
};

export type KaiToolResult = {
  id: "datetime" | "calculator" | "webSearch" | "kmmBusiness";
  status: "success" | "error";
  data?: unknown;
};

export type KaiChatSuccess = {
  success: true;
  answer: string;
  model: string;
  usage: KaiUsage;
  tool?: KaiToolResult;
  tools?: KaiToolResult[];
  sources?: KaiSource[];
};

export type KaiErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "rate_limited"
  | "quota_exceeded"
  | "offline"
  | "timeout"
  | "provider_error";

export type KaiChatFailure = {
  success: false;
  error: {
    code: KaiErrorCode;
    message: string;
  };
};

export type KaiChatResponse = KaiChatSuccess | KaiChatFailure;
