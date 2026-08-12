import { AuthError } from "../../../../lib/server/firebase-auth";
import { CompanyAccessError, requireCompanyContext } from "../../../../lib/server/company-context";
import {
  executeKaiRuntimeQuery,
  KaiRuntimeQueryError,
  type RuntimeQueryDatabase,
} from "../../../../lib/kai/runtime-query";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16_384;
const MAX_QUESTION_LENGTH = 1_000;

type RuntimeEnvironment = {
  OPERATIONS_DB?: RuntimeQueryDatabase;
};

export async function POST(request: Request) {
  try {
    const input = await parseInput(request);
    const context = await requireCompanyContext(request, {
      companyId: input.companyId,
      permission: "view",
      allowLegacyKmmRead: true,
    });
    const database = await getOperationsDatabase();
    const result = await executeKaiRuntimeQuery(database, input.question, {
      companyId: context.id,
      timeZone: context.timeZone,
    });
    return Response.json(
      {
        success: true,
        question: input.question,
        ...result,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return failure(
        error.status === 401 ? "unauthorized" : "auth_error",
        error.status === 401 ? "Authentication is required to query KAI." : error.message,
        error.status,
      );
    }
    if (error instanceof CompanyAccessError) {
      return failure("access_denied", error.message, error.status);
    }
    if (error instanceof RequestError) {
      return failure("invalid_request", error.message, error.status);
    }
    if (error instanceof KaiRuntimeQueryError) {
      return failure(error.code, error.message, error.status);
    }
    console.warn("KAI runtime query failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return failure("runtime_error", "KAI could not complete the query.", 500);
  }
}

async function getOperationsDatabase() {
  const { env } = await import("cloudflare:workers");
  const database = (env as unknown as RuntimeEnvironment).OPERATIONS_DB;
  if (!database) {
    throw new KaiRuntimeQueryError(
      "The local Operations D1 binding is unavailable.",
      "database_unavailable",
      503,
    );
  }
  return database;
}

async function parseInput(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new RequestError("The request is too large.", 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new RequestError("The request is too large.", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new RequestError("Send a valid JSON request.", 400);
  }
  if (!body || typeof body !== "object") throw new RequestError("Send a valid JSON request.", 400);
  const record = body as Record<string, unknown>;
  const question = typeof record.question === "string" ? record.question.trim() : "";
  if (!question) throw new RequestError("Question is required.", 400);
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new RequestError(`Keep the question under ${MAX_QUESTION_LENGTH} characters.`, 400);
  }
  const companyId = typeof record.companyId === "string" ? record.companyId.trim() : undefined;
  return { question, companyId: companyId || undefined };
}

function failure(code: string, message: string, status: number) {
  return Response.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
