import type { CompanySettingsSnapshot } from "../../../lib/company-management/types";
import {
  CompanyServiceError,
  getCompanyManagement,
  publishCompanyDraft,
  recordCompanyAudit,
  saveCompanyDraft,
} from "../../../lib/server/company-management-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return json(await getCompanyManagement(request));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      action?: string;
      snapshot?: CompanySettingsSnapshot;
      oldValue?: unknown;
      newValue?: unknown;
    };

    if (payload.action === "save_draft" && payload.snapshot) {
      return json(await saveCompanyDraft(request, payload.snapshot));
    }
    if (payload.action === "publish") {
      return json(await publishCompanyDraft(request));
    }
    if (
      payload.action === "company.logo_uploaded" ||
      payload.action === "company.logo_removed"
    ) {
      await recordCompanyAudit(
        request,
        payload.action,
        payload.oldValue,
        payload.newValue,
      );
      return json({ ok: true });
    }

    return json({ error: "Unsupported Company Management action." }, 400);
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof CompanyServiceError) {
    return json(
      { error: error.message, details: error.details ?? null },
      error.status,
    );
  }
  const message =
    error instanceof Error ? error.message : "Unexpected Company Management error.";
  return json({ error: message }, 500);
}

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
