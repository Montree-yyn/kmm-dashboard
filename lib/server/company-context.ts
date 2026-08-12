import { and, eq, inArray } from "drizzle-orm";
import { getCompanyDb } from "../../db";
import {
  branches,
  companies,
  companyCurrencies,
  companyLocalizations,
  companyUsers,
} from "../../db/schema";
import {
  isCompanyRole,
  ROLE_PERMISSIONS,
} from "../company-management/permissions";
import {
  COMPANY_ID,
  type CompanyPermissions,
} from "../company-management/types";
import {
  capabilitiesForCompany,
  type AuthorizedCompany,
} from "../company-context/types";
import {
  type AuthenticatedUser,
  verifyFirebaseRequest,
} from "./firebase-auth";

export const COMPANY_CONTEXT_HEADER = "x-company-id";

type AuthorizedCompanyBase = Pick<
  AuthorizedCompany,
  "id" | "tenantId" | "code" | "name" | "role" | "logoUrl"
>;

export type CompanyContext = AuthorizedCompany & {
  companyDb: Awaited<ReturnType<typeof getCompanyDb>>;
  user: AuthenticatedUser;
  permissions: CompanyPermissions;
  multiCompanyEnabled: boolean;
  legacyReadFallback: boolean;
};

export type CompanyContextOptions = {
  companyId?: string | null;
  permission?: keyof CompanyPermissions;
  allowLegacyKmmRead?: boolean;
  includeDisabledCompany?: boolean;
};

export class CompanyAccessError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function isMultiCompanyEnabled() {
  return process.env.MULTI_COMPANY_ENABLED === "true";
}

export function requestedCompanyId(
  request: Request,
  explicitCompanyId?: string | null,
) {
  const explicit = explicitCompanyId?.trim();
  const header = request.headers.get(COMPANY_CONTEXT_HEADER)?.trim();
  const query = new URL(request.url).searchParams.get("companyId")?.trim();
  const companyId = explicit || header || query || COMPANY_ID;
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(companyId)) {
    throw new CompanyAccessError("The company selection is invalid.", 400);
  }
  return companyId;
}

export function selectAuthorizedCompany(
  authorizedCompanies: AuthorizedCompany[],
  companyId: string,
  multiCompanyEnabled: boolean,
) {
  if (!multiCompanyEnabled && companyId !== COMPANY_ID) {
    throw new CompanyAccessError("You do not have access to the selected company.", 403);
  }
  const selected = authorizedCompanies.find((company) => company.id === companyId);
  if (!selected) {
    throw new CompanyAccessError("Active company membership is required.", 403);
  }
  return selected;
}

export async function listAuthorizedCompanies(
  request: Request,
  options: Pick<CompanyContextOptions, "allowLegacyKmmRead"> = {},
) {
  const user = await verifyFirebaseRequest(request);
  const companyDb = await getCompanyDb();
  const multiCompanyEnabled = isMultiCompanyEnabled();
  const companyList = await listAuthorizedCompaniesForUser(
    companyDb,
    user,
    multiCompanyEnabled,
    options.allowLegacyKmmRead === true,
    false,
  );
  return { user, companyDb, multiCompanyEnabled, companies: companyList };
}

export async function requireCompanyContext(
  request: Request,
  options: CompanyContextOptions = {},
): Promise<CompanyContext> {
  const user = await verifyFirebaseRequest(request);
  return requireCompanyContextForUser(user, request, options);
}

export async function requireCompanyContextForUser(
  user: AuthenticatedUser,
  request: Request,
  options: CompanyContextOptions = {},
): Promise<CompanyContext> {
  const companyId = requestedCompanyId(request, options.companyId);
  const multiCompanyEnabled = isMultiCompanyEnabled();

  const companyDb = await getCompanyDb();
  const authorized = await listAuthorizedCompaniesForUser(
    companyDb,
    user,
    multiCompanyEnabled,
    options.allowLegacyKmmRead === true,
    options.includeDisabledCompany === true,
  );
  const selected = selectAuthorizedCompany(authorized, companyId, multiCompanyEnabled);

  const permissions = ROLE_PERMISSIONS[selected.role];
  if (options.permission && !permissions[options.permission]) {
    throw new CompanyAccessError(
      "Your role does not have permission for this action.",
      403,
    );
  }

  return {
    ...selected,
    companyDb,
    user,
    permissions,
    multiCompanyEnabled,
    legacyReadFallback: selected.role === "viewer"
      && options.allowLegacyKmmRead === true
      && !multiCompanyEnabled
      && !await hasActiveMembership(companyDb, user.id, companyId),
  };
}

async function listAuthorizedCompaniesForUser(
  companyDb: Awaited<ReturnType<typeof getCompanyDb>>,
  user: AuthenticatedUser,
  multiCompanyEnabled: boolean,
  allowLegacyKmmRead: boolean,
  includeDisabledCompany: boolean,
) {
  const rows = await companyDb
    .select({
      id: companies.companyId,
      tenantId: companies.tenantId,
      code: companies.companyCode,
      name: companies.companyName,
      logoUrl: companies.logoUrl,
      role: companyUsers.role,
    })
    .from(companyUsers)
    .innerJoin(companies, eq(companies.companyId, companyUsers.companyId))
    .where(and(
      eq(companyUsers.userId, user.id),
      eq(companyUsers.status, "active"),
      includeDisabledCompany ? undefined : eq(companies.status, "active"),
    ));

  const authorized = new Map<string, AuthorizedCompanyBase | AuthorizedCompany>();
  for (const row of rows) {
    if (!isCompanyRole(row.role)) continue;
    if (!multiCompanyEnabled && row.id !== COMPANY_ID) continue;
    if (!authorized.has(row.id)) {
      authorized.set(row.id, { ...row, role: row.role });
    }
  }

  if (!authorized.size && allowLegacyKmmRead && !multiCompanyEnabled) {
    const [legacyCompany] = await companyDb
      .select({
        id: companies.companyId,
        tenantId: companies.tenantId,
        code: companies.companyCode,
        name: companies.companyName,
        logoUrl: companies.logoUrl,
      })
      .from(companies)
      .where(and(
        eq(companies.companyId, COMPANY_ID),
        eq(companies.status, "active"),
      ))
      .limit(1);
    if (legacyCompany) {
      authorized.set(legacyCompany.id, {
        ...legacyCompany,
        role: "viewer",
        currency: "MMK",
        currencySymbol: "K",
        timeZone: "Asia/Yangon",
        defaultLanguage: "en",
        branchCount: 0,
        branches: [],
        capabilities: capabilitiesForCompany(legacyCompany.id),
      });
    }
  }

  const enriched = await enrichAuthorizedCompanies(companyDb, [...authorized.values()]);
  return enriched.sort((left, right) =>
    left.code.localeCompare(right.code),
  );
}

async function enrichAuthorizedCompanies(
  companyDb: Awaited<ReturnType<typeof getCompanyDb>>,
  authorizedCompanies: Array<AuthorizedCompanyBase | AuthorizedCompany>,
) {
  if (!authorizedCompanies.length) return [];
  const companyIds = authorizedCompanies.map((company) => company.id);
  const [currencyRows, localizationRows, branchRows] = await Promise.all([
    companyDb
      .select({
        companyId: companyCurrencies.companyId,
        currency: companyCurrencies.displayCurrency,
        currencySymbol: companyCurrencies.currencySymbol,
      })
      .from(companyCurrencies)
      .where(and(
        inArray(companyCurrencies.companyId, companyIds),
        eq(companyCurrencies.status, "active"),
      )),
    companyDb
      .select({
        companyId: companyLocalizations.companyId,
        timeZone: companyLocalizations.defaultTimeZone,
        defaultLanguage: companyLocalizations.defaultLanguage,
      })
      .from(companyLocalizations)
      .where(and(
        inArray(companyLocalizations.companyId, companyIds),
        eq(companyLocalizations.status, "active"),
      )),
    companyDb
      .select({
        id: branches.id,
        companyId: branches.companyId,
        code: branches.branchCode,
        name: branches.branchName,
      })
      .from(branches)
      .where(and(
        inArray(branches.companyId, companyIds),
        eq(branches.status, "active"),
      )),
  ]);

  const currencies = new Map(currencyRows.map((row) => [row.companyId, row]));
  const localizations = new Map(localizationRows.map((row) => [row.companyId, row]));
  const branchesByCompany = new Map<string, AuthorizedCompany["branches"]>();
  for (const row of branchRows) {
    branchesByCompany.set(row.companyId, [
      ...(branchesByCompany.get(row.companyId) ?? []),
      { id: row.id, code: row.code, name: row.name },
    ]);
  }

  return authorizedCompanies.map((company): AuthorizedCompany => {
    const currency = currencies.get(company.id);
    const localization = localizations.get(company.id);
    const thailand = company.code === "KM";
    const defaultLanguage = localization?.defaultLanguage;
    return {
      id: company.id,
      tenantId: company.tenantId,
      code: company.code,
      name: company.name,
      role: company.role,
      logoUrl: company.logoUrl,
      currency: currency?.currency ?? (thailand ? "THB" : "MMK"),
      currencySymbol: currency?.currencySymbol ?? (thailand ? "฿" : "K"),
      timeZone: localization?.timeZone ?? (thailand ? "Asia/Bangkok" : "Asia/Yangon"),
      defaultLanguage: defaultLanguage === "th" || defaultLanguage === "my" ? defaultLanguage : "en",
      branchCount: branchesByCompany.get(company.id)?.length ?? 0,
      branches: (branchesByCompany.get(company.id) ?? [])
        .sort((left, right) => left.code.localeCompare(right.code)),
      capabilities: capabilitiesForCompany(company.id),
    };
  });
}

async function hasActiveMembership(
  companyDb: Awaited<ReturnType<typeof getCompanyDb>>,
  userId: string,
  companyId: string,
) {
  const [membership] = await companyDb
    .select({ id: companyUsers.id })
    .from(companyUsers)
    .where(and(
      eq(companyUsers.userId, userId),
      eq(companyUsers.companyId, companyId),
      eq(companyUsers.status, "active"),
    ))
    .limit(1);
  return Boolean(membership);
}
