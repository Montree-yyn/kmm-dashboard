export type CompanyRole =
  | "super_admin"
  | "company_admin"
  | "manager"
  | "viewer";

export type EntityStatus = "active" | "disabled";
export type WorkflowStatus = "draft" | "published";
export type CompanySection =
  | "overview"
  | "general"
  | "branches"
  | "departments"
  | "fiscal"
  | "currency"
  | "localization"
  | "calendar";

export type CompanyProfile = {
  id: string;
  companyName: string;
  companyCode: string;
  legalName: string;
  logoUrl: string;
  taxId: string;
  registrationNumber: string;
  businessType: string;
  industry: string;
  establishedYear: number | null;
  website: string;
  email: string;
  phone: string;
  address: string;
  description: string;
  status: EntityStatus;
};

export type Branch = {
  id: string;
  branchName: string;
  branchCode: string;
  region: string;
  township: string;
  address: string;
  manager: string;
  phone: string;
  email: string;
  latitude: string;
  longitude: string;
  timeZone: string;
  users: number;
  hasTransactions: boolean;
  status: EntityStatus;
  updatedAt?: string;
};

export type Department = {
  id: string;
  departmentName: string;
  departmentCode: string;
  branchId: string;
  head: string;
  users: number;
  status: EntityStatus;
};

export type FiscalYear = {
  id: string;
  fiscalYearName: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  currentFiscalYear: boolean;
  status: EntityStatus;
};

export type CompanyCurrency = {
  id: string;
  primaryCurrency: "MMK" | "THB" | "USD";
  displayCurrency: "MMK" | "THB" | "USD";
  currencySymbol: string;
  decimalPlaces: number;
  numberFormat: string;
  negativeNumberFormat: string;
  exchangeRateSource: "manual";
  manualExchangeRate: string;
  lastRateUpdate: string | null;
  status: EntityStatus;
};

export type CompanyLocalization = {
  id: string;
  defaultLanguage: "th" | "en" | "my";
  fallbackLanguage: "th" | "en" | "my";
  defaultTimeZone: "Asia/Yangon" | "Asia/Bangkok" | "UTC";
  dateFormat: string;
  timeFormat: "12-hour" | "24-hour";
  firstDayOfWeek: string;
  status: EntityStatus;
};

export type Holiday = {
  id: string;
  holidayName: string;
  holidayDate: string;
  repeatAnnually: boolean;
  branchId: string;
  holidayType: "public" | "company";
  status: EntityStatus;
};

export type WorkingCalendar = {
  id: string;
  workingDays: string[];
  weekendDays: string[];
  workingStartTime: string;
  workingEndTime: string;
  holidays: Holiday[];
  status: EntityStatus;
};

export type CompanySettingsSnapshot = {
  company: CompanyProfile;
  branches: Branch[];
  departments: Department[];
  fiscalYear: FiscalYear;
  currency: CompanyCurrency;
  localization: CompanyLocalization;
  workingCalendar: WorkingCalendar;
};

export type CompanyPermissions = {
  view: boolean;
  edit: boolean;
  publish: boolean;
  disable: boolean;
  restore: boolean;
};

export type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  userId: string;
};

export type CompanyManagementResponse = {
  companyId: string;
  role: CompanyRole;
  permissions: CompanyPermissions;
  published: CompanySettingsSnapshot;
  draft: CompanySettingsSnapshot;
  draftRevision: number;
  workflowStatus: WorkflowStatus;
  lastSavedAt: string | null;
  lastPublishedAt: string | null;
  audit: AuditEntry[];
};

export const COMPANY_ID = "kmm-company";
export const TENANT_ID = "kmm";

export const DEFAULT_COMPANY_SNAPSHOT: CompanySettingsSnapshot = {
  company: {
    id: COMPANY_ID,
    companyName: "KMM Company",
    companyCode: "KMM",
    legalName: "",
    logoUrl: "",
    taxId: "",
    registrationNumber: "",
    businessType: "",
    industry: "",
    establishedYear: null,
    website: "",
    email: "",
    phone: "",
    address: "",
    description: "",
    status: "active",
  },
  branches: [],
  departments: [],
  fiscalYear: {
    id: "fiscal-default",
    fiscalYearName: `FY${new Date().getFullYear()}`,
    startMonth: 1,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    currentFiscalYear: true,
    status: "active",
  },
  currency: {
    id: "currency-default",
    primaryCurrency: "MMK",
    displayCurrency: "MMK",
    currencySymbol: "K",
    decimalPlaces: 0,
    numberFormat: "1,234.56",
    negativeNumberFormat: "-1,234.56",
    exchangeRateSource: "manual",
    manualExchangeRate: "1",
    lastRateUpdate: null,
    status: "active",
  },
  localization: {
    id: "localization-default",
    defaultLanguage: "en",
    fallbackLanguage: "th",
    defaultTimeZone: "Asia/Yangon",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24-hour",
    firstDayOfWeek: "Monday",
    status: "active",
  },
  workingCalendar: {
    id: "calendar-default",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    weekendDays: ["Saturday", "Sunday"],
    workingStartTime: "08:00",
    workingEndTime: "17:00",
    holidays: [],
    status: "active",
  },
};
