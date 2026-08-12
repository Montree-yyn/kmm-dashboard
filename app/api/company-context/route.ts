import {
  COMPANY_CONTEXT_HEADER,
  CompanyAccessError,
  listAuthorizedCompanies,
  requestedCompanyId,
} from "../../../lib/server/company-context";
import { COMPANY_ID } from "../../../lib/company-management/types";
import { AuthError } from "../../../lib/server/firebase-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await listAuthorizedCompanies(request, {
      allowLegacyKmmRead: true,
    });
    const url = new URL(request.url);
    const hasExplicitSelection = Boolean(
      request.headers.get(COMPANY_CONTEXT_HEADER)?.trim()
      || url.searchParams.get("companyId")?.trim(),
    );
    const selectedCompanyId = hasExplicitSelection
      ? requestedCompanyId(request)
      : context.companies.some((company) => company.id === COMPANY_ID)
        ? COMPANY_ID
        : context.companies[0]?.id;
    const selected = context.companies.find(
      (company) => company.id === selectedCompanyId,
    );
    if (!selected) {
      throw new CompanyAccessError(
        "You do not have access to the selected company.",
        403,
      );
    }
    return Response.json({
      multiCompanyEnabled: context.multiCompanyEnabled,
      selectedCompanyId: selected.id,
      selected,
      companies: context.companies,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthError || error instanceof CompanyAccessError
      ? error.status
      : 500;
    return Response.json({
      error: error instanceof Error ? error.message : "Unable to resolve company access.",
    }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
