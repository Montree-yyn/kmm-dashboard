import { sql } from "drizzle-orm";
import {
  index,
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

export const companies = sqliteTable(
  "companies",
  {
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
  },
  (table) => [
    uniqueIndex("companies_company_id_unique").on(table.companyId),
  ],
);

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

export const salesTransactions = sqliteTable(
  "sales_transactions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    companyId: text("company_id").notNull(),
    importId: text("import_id").notNull(),
    importYear: integer("import_year").notNull(),
    importMonth: integer("import_month").notNull(),
    saleDate: text("sale_date").notNull(),
    invoiceNo: text("invoice_no").notNull(),
    branch: text("branch").notNull(),
    modelCode: text("model_code").notNull(),
    employeeCode: text("employee_code").notNull().default(""),
    quantity: integer("quantity").notNull(),
    saleAmount: text("sale_amount").notNull(),
    productType: text("product_type"),
    model: text("model"),
    finalReceived: text("final_received"),
    netReceived: text("net_received"),
    gp1: text("gp1"),
    expense: text("expense"),
    // Imported CPI column "Total". Nullable so historic Sales imports remain
    // valid until Commission is present in an approved source workbook.
    commission: text("commission"),
    salespersonCode: text("salesperson_code"),
    salespersonName: text("salesperson_name"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: text("created_by").notNull(),
  },
  (table) => [
    index("sales_scope_invoice_idx").on(
      table.companyId,
      table.importYear,
      table.importMonth,
      table.invoiceNo,
    ),
  ],
);

export const salespersonIdentityAliases = sqliteTable(
  "salesperson_identity_aliases",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    companyId: text("company_id").notNull(),
    sourceSalespersonCode: text("source_salesperson_code"),
    sourceEmployeeCode: text("source_employee_code"),
    sourceSalespersonName: text("source_salesperson_name").notNull(),
    sourceBranch: text("source_branch").notNull(),
    canonicalEmployeeCode: text("canonical_employee_code").notNull(),
    canonicalSalespersonCode: text("canonical_salesperson_code").notNull(),
    evidence: text("evidence").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: text("created_by").notNull(),
  },
  (table) => [
    index("salesperson_identity_alias_company_scope_idx").on(table.companyId, table.sourceBranch, table.sourceSalespersonName),
  ],
);

export const dataImportHistory = sqliteTable("data_" + "import_" + "history", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  companyId: text("company_id").notNull(),
  module: text("module").notNull(),
  importYear: integer("import_year").notNull(),
  importMonth: integer("import_month").notNull(),
  filename: text("filename").notNull(),
  status: text("status").notNull(),
  totalRows: integer("total_rows").notNull().default(0),
  validRows: integer("valid_rows").notNull().default(0),
  warningRows: integer("warning_rows").notNull().default(0),
  errorRows: integer("error_rows").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  errorReport: text("error_report"),
  importedBy: text("imported_by").notNull(),
  importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const dataColumnMappings = sqliteTable(
  "data_column_mappings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    companyId: text("company_id").notNull(),
    module: text("module").notNull(),
    mapping: text("mapping").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [
    uniqueIndex("data_column_mappings_scope_unique").on(
      table.companyId,
      table.module,
    ),
  ],
);

export const salespersonMaster = sqliteTable(
  "salesperson_master",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    companyId: text("company_id").notNull(),
    employeeCode: text("employee_code").notNull(),
    salespersonCode: text("salesperson_code").notNull(),
    salespersonName: text("salesperson_name").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: text("created_by").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [
    uniqueIndex("salesperson_master_employee_unique").on(table.companyId, table.employeeCode),
    uniqueIndex("salesperson_master_code_unique").on(table.companyId, table.salespersonCode),
  ],
);

/**
 * Approved, versioned business targets. Empty dimension keys represent an
 * explicit company-wide scope so SQLite can enforce one record per exact
 * target scope and source version without NULL-unique ambiguity.
 */
export const businessTargets = sqliteTable(
  "business_targets",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    companyId: text("company_id").notNull(),
    targetYear: integer("target_year").notNull(),
    targetMonth: integer("target_month").notNull(),
    metric: text("metric").notNull(),
    targetValue: text("target_value").notNull(),
    productGroup: text("product_group").notNull().default(""),
    branchId: text("branch_id").notNull().default(""),
    salespersonId: text("salesperson_id").notNull().default(""),
    source: text("source").notNull(),
    sourceVersion: text("source_version").notNull(),
    approvalStatus: text("approval_status").notNull().default("approved"),
    effectiveFrom: text("effective_from").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: text("created_by").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [
    uniqueIndex("business_targets_exact_version_unique").on(
      table.companyId,
      table.targetYear,
      table.targetMonth,
      table.metric,
      table.productGroup,
      table.branchId,
      table.salespersonId,
      table.sourceVersion,
    ),
    index("business_targets_runtime_lookup_idx").on(
      table.companyId,
      table.targetYear,
      table.targetMonth,
      table.metric,
      table.productGroup,
      table.branchId,
      table.salespersonId,
      table.approvalStatus,
      table.effectiveFrom,
    ),
  ],
);

export const bookingTransactions = sqliteTable("booking_transactions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  companyId: text("company_id").notNull(),
  importId: text("import_id").notNull(),
  importYear: integer("import_year").notNull(),
  importMonth: integer("import_month").notNull(),
  businessWeek: integer("business_week"),
  bookingDate: text("booking_date").notNull(),
  bookingNo: text("booking_no").notNull(),
  bookingNumber: text("booking_number"),
  branch: text("branch").notNull(),
  customer: text("customer").notNull(),
  product: text("product").notNull(),
  status: text("status").notNull(),
  bookingYear: integer("booking_year"),
  bookingMonth: integer("booking_month"),
  branchCode: text("branch_code"),
  branchName: text("branch_name"),
  salespersonCode: text("salesperson_code"),
  salespersonName: text("salesperson_name"),
  productType: text("product_type"),
  productModel: text("product_model"),
  customerName: text("customer_name"),
  bookingPrice: text("booking_price"),
  depositAmount: text("deposit_amount"),
  bookingStatus: text("booking_status"),
  purchaseStatus: text("purchase_status"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull(),
});

export const stockTransactions = sqliteTable("stock_transactions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  companyId: text("company_id").notNull(),
  importId: text("import_id").notNull(),
  importYear: integer("import_year").notNull(),
  importMonth: integer("import_month").notNull(),
  businessWeek: integer("business_week"),
  asOfDate: text("as_of_date").notNull(),
  branch: text("branch").notNull(),
  product: text("product").notNull(),
  quantity: integer("quantity").notNull(),
  stockDate: text("stock_date"),
  branchCode: text("branch_code"),
  branchName: text("branch_name"),
  productType: text("product_type"),
  productGroup: text("product_group"),
  productModel: text("product_model"),
  kmmFlag: integer("kmm_flag"),
  msrp: text("msrp"),
  stockStatus: text("stock_status"),
  stockNumber: text("stock_number"),
  serialNumber: text("serial_number"),
  engineNumber: text("engine_number"),
  chassisNumber: text("chassis_number"),
  stockAgeDays: integer("stock_age_days"),
  snapshotDate: text("snapshot_date"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull(),
});

export const dailyManagementInputs = sqliteTable(
  "daily_management_inputs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    companyId: text("company_id").notNull(),
    reportDate: text("report_date").notNull(),
    branch: text("branch").notNull(),
    draftPayload: text("draft_payload").notNull(),
    publishedPayload: text("published_payload"),
    revision: integer("revision").notNull().default(1),
    savedAt: text("saved_at").notNull(),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: text("created_by").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [
    uniqueIndex("daily_management_inputs_scope_unique").on(
      table.companyId,
      table.reportDate,
      table.branch,
    ),
    index("daily_management_inputs_latest_idx").on(
      table.companyId,
      table.updatedAt,
    ),
  ],
);
