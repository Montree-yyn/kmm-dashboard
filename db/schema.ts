import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text("updated_by").notNull(),
};

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  companyId: text("company_id").notNull(),
  companyName: text("company_name").notNull(),
  companyCode: text("company_code").notNull().unique(),
  legalName: text("legal_name").notNull().default(""),
  logoUrl: text("logo_url").notNull().default(""),
  taxId: text("tax_id").notNull().default(""),
  registrationNumber: text("registration_number").notNull().default(""),
  businessType: text("business_type").notNull().default(""),
  industry: text("industry").notNull().default(""),
  establishedYear: integer("established_year"),
  website: text("website").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("active"),
  publishedAt: text("published_at"),
  ...timestamps,
});

export const companyUsers = sqliteTable(
  "company_users",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    companyId: text("company_id").notNull(),
    userId: text("user_id").notNull(),
    email: text("email").notNull().default(""),
    role: text("role").notNull().default("viewer"),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("company_users_company_user_unique").on(
      table.companyId,
      table.userId,
    ),
  ],
);

export const branches = sqliteTable(
  "branches",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    companyId: text("company_id").notNull(),
    branchName: text("branch_name").notNull(),
    branchCode: text("branch_code").notNull(),
    region: text("region").notNull().default(""),
    township: text("township").notNull().default(""),
    address: text("address").notNull().default(""),
    manager: text("manager").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    latitude: text("latitude").notNull().default(""),
    longitude: text("longitude").notNull().default(""),
    timeZone: text("time_zone").notNull().default("Asia/Yangon"),
    users: integer("users").notNull().default(0),
    hasTransactions: integer("has_transactions", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("branches_company_code_unique").on(
      table.companyId,
      table.branchCode,
    ),
  ],
);

export const departments = sqliteTable(
  "departments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    companyId: text("company_id").notNull(),
    departmentName: text("department_name").notNull(),
    departmentCode: text("department_code").notNull(),
    branchId: text("branch_id").notNull().default(""),
    head: text("head").notNull().default(""),
    users: integer("users").notNull().default(0),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("departments_company_code_unique").on(
      table.companyId,
      table.departmentCode,
    ),
  ],
);

export const fiscalYears = sqliteTable("fiscal_years", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  companyId: text("company_id").notNull(),
  fiscalYearName: text("fiscal_year_name").notNull(),
  startMonth: integer("start_month").notNull(),
  startDay: integer("start_day").notNull(),
  endMonth: integer("end_month").notNull(),
  endDay: integer("end_day").notNull(),
  currentFiscalYear: integer("current_fiscal_year", { mode: "boolean" })
    .notNull()
    .default(true),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const companyCurrencies = sqliteTable("company_currencies", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  companyId: text("company_id").notNull(),
  primaryCurrency: text("primary_currency").notNull().default("MMK"),
  displayCurrency: text("display_currency").notNull().default("MMK"),
  currencySymbol: text("currency_symbol").notNull().default("K"),
  decimalPlaces: integer("decimal_places").notNull().default(0),
  numberFormat: text("number_format").notNull().default("1,234.56"),
  negativeNumberFormat: text("negative_number_format")
    .notNull()
    .default("-1,234.56"),
  exchangeRateSource: text("exchange_rate_source")
    .notNull()
    .default("manual"),
  manualExchangeRate: text("manual_exchange_rate").notNull().default("1"),
  lastRateUpdate: text("last_rate_update"),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const companyLocalizations = sqliteTable("company_localizations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  companyId: text("company_id").notNull(),
  defaultLanguage: text("default_language").notNull().default("en"),
  fallbackLanguage: text("fallback_language").notNull().default("th"),
  defaultTimeZone: text("default_time_zone")
    .notNull()
    .default("Asia/Yangon"),
  dateFormat: text("date_format").notNull().default("DD/MM/YYYY"),
  timeFormat: text("time_format").notNull().default("24-hour"),
  firstDayOfWeek: text("first_day_of_week").notNull().default("Monday"),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const workingCalendars = sqliteTable("working_calendars", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  companyId: text("company_id").notNull(),
  workingDays: text("working_days").notNull().default("[]"),
  weekendDays: text("weekend_days").notNull().default("[]"),
  workingStartTime: text("working_start_time").notNull().default("08:00"),
  workingEndTime: text("working_end_time").notNull().default("17:00"),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const holidays = sqliteTable("holidays", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  companyId: text("company_id").notNull(),
  branchId: text("branch_id").notNull().default(""),
  holidayName: text("holiday_name").notNull(),
  holidayDate: text("holiday_date").notNull(),
  repeatAnnually: integer("repeat_annually", { mode: "boolean" })
    .notNull()
    .default(false),
  holidayType: text("holiday_type").notNull().default("company"),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const companySettingDrafts = sqliteTable("company_setting_drafts", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  companyId: text("company_id").notNull().unique(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  status: text("status").notNull().default("draft"),
  ...timestamps,
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  companyId: text("company_id").notNull(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  ipAddress: text("ip_address"),
  device: text("device"),
  status: text("status").notNull().default("recorded"),
  ...timestamps,
});
