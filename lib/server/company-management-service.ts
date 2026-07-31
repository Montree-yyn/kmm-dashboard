import { and, desc, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "../../db";
import {
  auditLogs,
  branches,
  companies,
  companyCurrencies,
  companyLocalizations,
  companySettingDrafts,
  companyUsers,
  departments,
  fiscalYears,
  holidays,
  workingCalendars,
} from "../../db/schema";
import {
  COMPANY_ID,
  DEFAULT_COMPANY_SNAPSHOT,
  TENANT_ID,
  type AuditEntry,
  type CompanyManagementResponse,
  type CompanyRole,
  type CompanySettingsSnapshot,
} from "../company-management/types";
import {
  isCompanyRole,
  ROLE_PERMISSIONS,
} from "../company-management/permissions";
import {
  normalizeCompanySnapshot,
  validateCompanySnapshot,
} from "../company-management/validation";
import {
  AuthError,
  type AuthenticatedUser,
  verifyFirebaseRequest,
} from "./firebase-auth";

type CompanyContext = {
  db: Awaited<ReturnType<typeof getDb>>;
  request: Request;
  user: AuthenticatedUser;
  role: CompanyRole;
};

export const COMPANY_AUDIT_ACTIONS = [
  "company.viewed",
  "company.draft_saved",
  "company.published",
  "company.logo_uploaded",
  "company.logo_removed",
  "branch.created",
  "branch.updated",
  "branch.disabled",
  "branch.reactivated",
  "department.created",
  "department.updated",
  "department.disabled",
  "fiscal_year.updated",
  "currency.updated",
  "localization.updated",
  "calendar.updated",
] as const;

export class CompanyServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
  }
}

export async function getCompanyManagement(
  request: Request,
): Promise<CompanyManagementResponse> {
  const context = await getCompanyContext(request);
  const permissions = ROLE_PERMISSIONS[context.role];
  if (!permissions.view) {
    throw new CompanyServiceError("You do not have access to Company Management.", 403);
  }

  await ensureCompanySeed(context);
  const published = await readPublishedSnapshot(context);
  const [draftRow] = await context.db
    .select()
    .from(companySettingDrafts)
    .where(eq(companySettingDrafts.companyId, COMPANY_ID))
    .limit(1);
  const draft = draftRow
    ? parseSnapshot(draftRow.payload)
    : structuredClone(published);
  const audit = await readAudit(context);

  await writeAudit(context, "company.viewed", "company", COMPANY_ID, null, null);

  return {
    companyId: COMPANY_ID,
    role: context.role,
    permissions,
    published,
    draft,
    draftRevision: draftRow?.revision ?? 0,
    workflowStatus: draftRow?.status === "draft" ? "draft" : "published",
    lastSavedAt: draftRow?.updatedAt ?? null,
    lastPublishedAt: (
      await context.db
        .select({ value: companies.publishedAt })
        .from(companies)
        .where(eq(companies.id, COMPANY_ID))
        .limit(1)
    )[0]?.value ?? null,
    audit,
  };
}

export async function saveCompanyDraft(
  request: Request,
  snapshot: CompanySettingsSnapshot,
): Promise<CompanyManagementResponse> {
  const context = await getCompanyContext(request);
  if (!ROLE_PERMISSIONS[context.role].edit) {
    throw new CompanyServiceError("You do not have permission to edit Company settings.", 403);
  }

  const normalized = normalizeCompanySnapshot(snapshot);
  const errors = validateCompanySnapshot(normalized);
  if (Object.keys(errors).length) {
    throw new CompanyServiceError("Please correct the highlighted fields.", 422, errors);
  }

  const [existing] = await context.db
    .select()
    .from(companySettingDrafts)
    .where(eq(companySettingDrafts.companyId, COMPANY_ID))
    .limit(1);
  const previous = existing ? parseSnapshot(existing.payload) : null;
  const permissions = ROLE_PERMISSIONS[context.role];
  if (previous) {
    enforceStatusPermissions(previous, normalized, permissions);
  }
  const now = new Date().toISOString();
  const revision = (existing?.revision ?? 0) + 1;

  await context.db
    .insert(companySettingDrafts)
    .values({
      id: existing?.id ?? crypto.randomUUID(),
      tenantId: TENANT_ID,
      companyId: COMPANY_ID,
      payload: JSON.stringify(normalized),
      revision,
      status: "draft",
      createdBy: existing?.createdBy ?? context.user.id,
      updatedBy: context.user.id,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: companySettingDrafts.companyId,
      set: {
        payload: JSON.stringify(normalized),
        revision,
        status: "draft",
        updatedBy: context.user.id,
        updatedAt: now,
      },
    });

  await writeAudit(
    context,
    "company.draft_saved",
    "company_setting_draft",
    COMPANY_ID,
    previous,
    normalized,
  );
  await writeEntityChangeAudit(context, previous, normalized);
  return getCompanyManagement(request);
}

function enforceStatusPermissions(
  previous: CompanySettingsSnapshot,
  next: CompanySettingsSnapshot,
  permissions: (typeof ROLE_PERMISSIONS)[CompanyRole],
) {
  const transitions = [
    [previous.company.status, next.company.status],
    ...statusTransitions(previous.branches, next.branches),
    ...statusTransitions(previous.departments, next.departments),
  ];
  for (const [oldStatus, newStatus] of transitions) {
    if (oldStatus === newStatus) continue;
    if (newStatus === "disabled" && !permissions.disable) {
      throw new CompanyServiceError(
        "Your role cannot disable Company entities.",
        403,
      );
    }
    if (newStatus === "active" && !permissions.restore) {
      throw new CompanyServiceError(
        "Your role cannot reactivate Company entities.",
        403,
      );
    }
  }
}

function statusTransitions<T extends { id: string; status: string }>(
  previous: T[],
  next: T[],
) {
  const oldById = new Map(previous.map((item) => [item.id, item.status]));
  return next
    .filter((item) => oldById.has(item.id))
    .map((item) => [oldById.get(item.id)!, item.status] as const);
}

export async function publishCompanyDraft(
  request: Request,
): Promise<CompanyManagementResponse> {
  const context = await getCompanyContext(request);
  if (!ROLE_PERMISSIONS[context.role].publish) {
    throw new CompanyServiceError("You do not have permission to publish Company settings.", 403);
  }

  const [draftRow] = await context.db
    .select()
    .from(companySettingDrafts)
    .where(eq(companySettingDrafts.companyId, COMPANY_ID))
    .limit(1);
  if (!draftRow) {
    throw new CompanyServiceError("Save a draft before publishing.", 409);
  }

  const snapshot = normalizeCompanySnapshot(parseSnapshot(draftRow.payload));
  const errors = validateCompanySnapshot(snapshot);
  if (Object.keys(errors).length) {
    throw new CompanyServiceError("The draft is not ready to publish.", 422, errors);
  }

  const previous = await readPublishedSnapshot(context);
  const now = new Date().toISOString();
  const publishedDraft: CompanySettingsSnapshot = {
    ...snapshot,
    branches: snapshot.branches.map((branch) => ({
      ...branch,
      updatedAt: now,
    })),
  };
  const statements: BatchItem<"sqlite">[] = [
    context.db
      .insert(companies)
      .values({
        ...snapshot.company,
        tenantId: TENANT_ID,
        companyId: COMPANY_ID,
        publishedAt: now,
        createdBy: context.user.id,
        updatedBy: context.user.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: companies.id,
        set: {
          companyName: snapshot.company.companyName,
          companyCode: snapshot.company.companyCode,
          legalName: snapshot.company.legalName,
          logoUrl: snapshot.company.logoUrl,
          taxId: snapshot.company.taxId,
          registrationNumber: snapshot.company.registrationNumber,
          businessType: snapshot.company.businessType,
          industry: snapshot.company.industry,
          establishedYear: snapshot.company.establishedYear,
          website: snapshot.company.website,
          email: snapshot.company.email,
          phone: snapshot.company.phone,
          address: snapshot.company.address,
          description: snapshot.company.description,
          status: snapshot.company.status,
          publishedAt: now,
          updatedBy: context.user.id,
          updatedAt: now,
        },
      }),
    context.db.delete(branches).where(eq(branches.companyId, COMPANY_ID)),
    context.db
      .delete(departments)
      .where(eq(departments.companyId, COMPANY_ID)),
    context.db
      .delete(fiscalYears)
      .where(eq(fiscalYears.companyId, COMPANY_ID)),
    context.db.insert(fiscalYears).values({
      ...snapshot.fiscalYear,
      tenantId: TENANT_ID,
      companyId: COMPANY_ID,
      createdBy: context.user.id,
      updatedBy: context.user.id,
      updatedAt: now,
    }),
    context.db
      .delete(companyCurrencies)
      .where(eq(companyCurrencies.companyId, COMPANY_ID)),
    context.db.insert(companyCurrencies).values({
      ...snapshot.currency,
      tenantId: TENANT_ID,
      companyId: COMPANY_ID,
      createdBy: context.user.id,
      updatedBy: context.user.id,
      updatedAt: now,
    }),
    context.db
      .delete(companyLocalizations)
      .where(eq(companyLocalizations.companyId, COMPANY_ID)),
    context.db.insert(companyLocalizations).values({
      ...snapshot.localization,
      tenantId: TENANT_ID,
      companyId: COMPANY_ID,
      createdBy: context.user.id,
      updatedBy: context.user.id,
      updatedAt: now,
    }),
    context.db
      .delete(workingCalendars)
      .where(eq(workingCalendars.companyId, COMPANY_ID)),
    context.db.insert(workingCalendars).values({
      id: snapshot.workingCalendar.id,
      tenantId: TENANT_ID,
      companyId: COMPANY_ID,
      workingDays: JSON.stringify(snapshot.workingCalendar.workingDays),
      weekendDays: JSON.stringify(snapshot.workingCalendar.weekendDays),
      workingStartTime: snapshot.workingCalendar.workingStartTime,
      workingEndTime: snapshot.workingCalendar.workingEndTime,
      status: snapshot.workingCalendar.status,
      createdBy: context.user.id,
      updatedBy: context.user.id,
      updatedAt: now,
    }),
    context.db.delete(holidays).where(eq(holidays.companyId, COMPANY_ID)),
    context.db
      .update(companySettingDrafts)
      .set({
        payload: JSON.stringify(publishedDraft),
        status: "published",
        updatedAt: now,
        updatedBy: context.user.id,
      })
      .where(eq(companySettingDrafts.companyId, COMPANY_ID)),
  ];
  if (snapshot.branches.length) {
    statements.push(
      context.db.insert(branches).values(
        snapshot.branches.map((branch) => ({
          ...branch,
          tenantId: TENANT_ID,
          companyId: COMPANY_ID,
          createdBy: context.user.id,
          updatedBy: context.user.id,
          updatedAt: now,
        })),
      ),
    );
  }
  if (snapshot.departments.length) {
    statements.push(
      context.db.insert(departments).values(
        snapshot.departments.map((department) => ({
          ...department,
          tenantId: TENANT_ID,
          companyId: COMPANY_ID,
          createdBy: context.user.id,
          updatedBy: context.user.id,
          updatedAt: now,
        })),
      ),
    );
  }
  if (snapshot.workingCalendar.holidays.length) {
    statements.push(
      context.db.insert(holidays).values(
        snapshot.workingCalendar.holidays.map((holiday) => ({
          ...holiday,
          tenantId: TENANT_ID,
          companyId: COMPANY_ID,
          createdBy: context.user.id,
          updatedBy: context.user.id,
          updatedAt: now,
        })),
      ),
    );
  }
  await context.db.batch(
    statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );

  await writeAudit(
    context,
    "company.published",
    "company",
    COMPANY_ID,
    previous,
    snapshot,
  );
  return getCompanyManagement(request);
}

export async function recordCompanyAudit(
  request: Request,
  action: "company.logo_uploaded" | "company.logo_removed",
  oldValue: unknown,
  newValue: unknown,
) {
  const context = await getCompanyContext(request);
  if (!ROLE_PERMISSIONS[context.role].edit) {
    throw new CompanyServiceError("You do not have permission to edit Company settings.", 403);
  }
  await writeAudit(
    context,
    action,
    "company",
    COMPANY_ID,
    oldValue,
    newValue,
  );
}

async function getCompanyContext(request: Request): Promise<CompanyContext> {
  let user: AuthenticatedUser;
  try {
    user = await verifyFirebaseRequest(request);
  } catch (error) {
    if (error instanceof AuthError) {
      throw new CompanyServiceError(error.message, error.status);
    }
    throw error;
  }

  const db = await getDb();
  const [existing] = await db
    .select()
    .from(companyUsers)
    .where(
      and(
        eq(companyUsers.companyId, COMPANY_ID),
        eq(companyUsers.userId, user.id),
        eq(companyUsers.status, "active"),
      ),
    )
    .limit(1);

  let role: CompanyRole;
  if (existing && isCompanyRole(existing.role)) {
    role = existing.role;
  } else {
    const [count] = await db
      .select({ value: sql<number>`count(*)` })
      .from(companyUsers)
      .where(
        and(
          eq(companyUsers.companyId, COMPANY_ID),
          eq(companyUsers.status, "active"),
        ),
      );
    role = Number(count?.value ?? 0) === 0 ? "super_admin" : "viewer";
    const now = new Date().toISOString();
    await db
      .insert(companyUsers)
      .values({
        id: crypto.randomUUID(),
        tenantId: TENANT_ID,
        companyId: COMPANY_ID,
        userId: user.id,
        email: user.email,
        role,
        status: "active",
        createdBy: user.id,
        updatedBy: user.id,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  return { db, request, user, role };
}

async function ensureCompanySeed(context: CompanyContext) {
  const [existing] = await context.db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, COMPANY_ID))
    .limit(1);
  if (existing) return;

  const now = new Date().toISOString();
  const snapshot = DEFAULT_COMPANY_SNAPSHOT;
  await context.db
    .insert(companies)
    .values({
      ...snapshot.company,
      tenantId: TENANT_ID,
      companyId: COMPANY_ID,
      createdBy: context.user.id,
      updatedBy: context.user.id,
      updatedAt: now,
    })
    .onConflictDoNothing();
  await persistDefaultConfiguration(context, snapshot, now);
}

async function persistDefaultConfiguration(
  context: CompanyContext,
  snapshot: CompanySettingsSnapshot,
  now: string,
) {
  const metadata = {
    tenantId: TENANT_ID,
    companyId: COMPANY_ID,
    createdBy: context.user.id,
    updatedBy: context.user.id,
    updatedAt: now,
  };
  await context.db.insert(fiscalYears).values({
    ...snapshot.fiscalYear,
    ...metadata,
  }).onConflictDoNothing();
  await context.db.insert(companyCurrencies).values({
    ...snapshot.currency,
    ...metadata,
  }).onConflictDoNothing();
  await context.db.insert(companyLocalizations).values({
    ...snapshot.localization,
    ...metadata,
  }).onConflictDoNothing();
  await context.db.insert(workingCalendars).values({
    id: snapshot.workingCalendar.id,
    ...metadata,
    workingDays: JSON.stringify(snapshot.workingCalendar.workingDays),
    weekendDays: JSON.stringify(snapshot.workingCalendar.weekendDays),
    workingStartTime: snapshot.workingCalendar.workingStartTime,
    workingEndTime: snapshot.workingCalendar.workingEndTime,
    status: snapshot.workingCalendar.status,
  }).onConflictDoNothing();
}

async function readPublishedSnapshot(
  context: CompanyContext,
): Promise<CompanySettingsSnapshot> {
  const [company] = await context.db
    .select()
    .from(companies)
    .where(eq(companies.id, COMPANY_ID))
    .limit(1);
  if (!company) return structuredClone(DEFAULT_COMPANY_SNAPSHOT);

  const branchRows = await context.db
    .select()
    .from(branches)
    .where(eq(branches.companyId, COMPANY_ID));
  const departmentRows = await context.db
    .select()
    .from(departments)
    .where(eq(departments.companyId, COMPANY_ID));
  const [fiscal] = await context.db
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.companyId, COMPANY_ID))
    .limit(1);
  const [currency] = await context.db
    .select()
    .from(companyCurrencies)
    .where(eq(companyCurrencies.companyId, COMPANY_ID))
    .limit(1);
  const [localization] = await context.db
    .select()
    .from(companyLocalizations)
    .where(eq(companyLocalizations.companyId, COMPANY_ID))
    .limit(1);
  const [calendar] = await context.db
    .select()
    .from(workingCalendars)
    .where(eq(workingCalendars.companyId, COMPANY_ID))
    .limit(1);
  const holidayRows = await context.db
    .select()
    .from(holidays)
    .where(eq(holidays.companyId, COMPANY_ID));

  return {
    company: {
      id: company.id,
      companyName: company.companyName,
      companyCode: company.companyCode,
      legalName: company.legalName,
      logoUrl: company.logoUrl,
      taxId: company.taxId,
      registrationNumber: company.registrationNumber,
      businessType: company.businessType,
      industry: company.industry,
      establishedYear: company.establishedYear,
      website: company.website,
      email: company.email,
      phone: company.phone,
      address: company.address,
      description: company.description,
      status: toEntityStatus(company.status),
    },
    branches: branchRows.map((branch) => ({
      id: branch.id,
      branchName: branch.branchName,
      branchCode: branch.branchCode,
      region: branch.region,
      township: branch.township,
      address: branch.address,
      manager: branch.manager,
      phone: branch.phone,
      email: branch.email,
      latitude: branch.latitude,
      longitude: branch.longitude,
      timeZone: branch.timeZone,
      users: branch.users,
      hasTransactions: branch.hasTransactions,
      status: toEntityStatus(branch.status),
      updatedAt: branch.updatedAt,
    })),
    departments: departmentRows.map((department) => ({
      id: department.id,
      departmentName: department.departmentName,
      departmentCode: department.departmentCode,
      branchId: department.branchId,
      head: department.head,
      users: department.users,
      status: toEntityStatus(department.status),
    })),
    fiscalYear: fiscal
      ? {
          id: fiscal.id,
          fiscalYearName: fiscal.fiscalYearName,
          startMonth: fiscal.startMonth,
          startDay: fiscal.startDay,
          endMonth: fiscal.endMonth,
          endDay: fiscal.endDay,
          currentFiscalYear: fiscal.currentFiscalYear,
          status: toEntityStatus(fiscal.status),
        }
      : structuredClone(DEFAULT_COMPANY_SNAPSHOT.fiscalYear),
    currency: currency
      ? {
          id: currency.id,
          primaryCurrency: toCurrency(currency.primaryCurrency),
          displayCurrency: toCurrency(currency.displayCurrency),
          currencySymbol: currency.currencySymbol,
          decimalPlaces: currency.decimalPlaces,
          numberFormat: currency.numberFormat,
          negativeNumberFormat: currency.negativeNumberFormat,
          exchangeRateSource: "manual",
          manualExchangeRate: currency.manualExchangeRate,
          lastRateUpdate: currency.lastRateUpdate,
          status: toEntityStatus(currency.status),
        }
      : structuredClone(DEFAULT_COMPANY_SNAPSHOT.currency),
    localization: localization
      ? {
          id: localization.id,
          defaultLanguage: toLanguage(localization.defaultLanguage),
          fallbackLanguage: toLanguage(localization.fallbackLanguage),
          defaultTimeZone: toTimeZone(localization.defaultTimeZone),
          dateFormat: localization.dateFormat,
          timeFormat:
            localization.timeFormat === "12-hour" ? "12-hour" : "24-hour",
          firstDayOfWeek: localization.firstDayOfWeek,
          status: toEntityStatus(localization.status),
        }
      : structuredClone(DEFAULT_COMPANY_SNAPSHOT.localization),
    workingCalendar: calendar
      ? {
          id: calendar.id,
          workingDays: parseStringArray(calendar.workingDays),
          weekendDays: parseStringArray(calendar.weekendDays),
          workingStartTime: calendar.workingStartTime,
          workingEndTime: calendar.workingEndTime,
          holidays: holidayRows.map((holiday) => ({
            id: holiday.id,
            holidayName: holiday.holidayName,
            holidayDate: holiday.holidayDate,
            repeatAnnually: holiday.repeatAnnually,
            branchId: holiday.branchId,
            holidayType:
              holiday.holidayType === "public" ? "public" : "company",
            status: toEntityStatus(holiday.status),
          })),
          status: toEntityStatus(calendar.status),
        }
      : structuredClone(DEFAULT_COMPANY_SNAPSHOT.workingCalendar),
  };
}

async function readAudit(context: CompanyContext): Promise<AuditEntry[]> {
  const rows = await context.db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.companyId, COMPANY_ID))
    .orderBy(desc(auditLogs.createdAt))
    .limit(5);
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    timestamp: row.createdAt,
    userId: row.userId,
  }));
}

async function writeAudit(
  context: CompanyContext,
  action: string,
  entity: string,
  entityId: string,
  oldValue: unknown,
  newValue: unknown,
) {
  const now = new Date().toISOString();
  await context.db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    tenantId: TENANT_ID,
    companyId: COMPANY_ID,
    userId: context.user.id,
    action,
    entity,
    entityId,
    oldValue: oldValue === null ? null : JSON.stringify(oldValue),
    newValue: newValue === null ? null : JSON.stringify(newValue),
    ipAddress: context.request.headers.get("cf-connecting-ip"),
    device: context.request.headers.get("user-agent"),
    status: "recorded",
    createdBy: context.user.id,
    updatedBy: context.user.id,
    updatedAt: now,
  });
}

async function writeEntityChangeAudit(
  context: CompanyContext,
  previous: CompanySettingsSnapshot | null,
  next: CompanySettingsSnapshot,
) {
  if (!previous) return;
  await diffEntities(context, previous.branches, next.branches, "branch");
  await diffEntities(
    context,
    previous.departments,
    next.departments,
    "department",
  );
  type ConfigurationKey =
    | "fiscalYear"
    | "currency"
    | "localization"
    | "workingCalendar";
  const configurationEvents: Array<[ConfigurationKey, string, string]> = [
    ["fiscalYear", "fiscal_year.updated", "fiscal_year"],
    ["currency", "currency.updated", "currency"],
    ["localization", "localization.updated", "localization"],
    ["workingCalendar", "calendar.updated", "working_calendar"],
  ];
  for (const [key, action, entity] of configurationEvents) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) {
      await writeAudit(
        context,
        action,
        entity,
        String(next[key].id),
        previous[key],
        next[key],
      );
    }
  }
}

async function diffEntities<T extends { id: string; status: string }>(
  context: CompanyContext,
  previous: T[],
  next: T[],
  entity: "branch" | "department",
) {
  const oldById = new Map(previous.map((item) => [item.id, item]));
  for (const item of next) {
    const old = oldById.get(item.id);
    let action: string | null = null;
    if (!old) action = `${entity}.created`;
    else if (old.status !== item.status) {
      action =
        item.status === "disabled"
          ? `${entity}.disabled`
          : entity === "branch"
            ? "branch.reactivated"
            : `${entity}.updated`;
    } else if (JSON.stringify(old) !== JSON.stringify(item)) {
      action = `${entity}.updated`;
    }
    if (action) {
      await writeAudit(context, action, entity, item.id, old ?? null, item);
    }
  }
}

function parseSnapshot(value: string): CompanySettingsSnapshot {
  try {
    return JSON.parse(value) as CompanySettingsSnapshot;
  } catch {
    throw new CompanyServiceError("The saved Company draft is invalid.", 500);
  }
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toEntityStatus(value: string): "active" | "disabled" {
  return value === "disabled" ? "disabled" : "active";
}

function toCurrency(value: string): "MMK" | "THB" | "USD" {
  return value === "THB" || value === "USD" ? value : "MMK";
}

function toLanguage(value: string): "th" | "en" | "my" {
  return value === "th" || value === "my" ? value : "en";
}

function toTimeZone(value: string): "Asia/Yangon" | "Asia/Bangkok" | "UTC" {
  return value === "Asia/Bangkok" || value === "UTC"
    ? value
    : "Asia/Yangon";
}
