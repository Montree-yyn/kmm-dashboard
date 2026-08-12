import type { CompanyRole } from "../company-management/types";
import { COMPANY_ID } from "../company-management/types";

export type CompanyModule =
  | "dashboard"
  | "sales"
  | "booking"
  | "stock"
  | "dailyManagement"
  | "team"
  | "marketing"
  | "expense"
  | "dataHub"
  | "settings";

export type CompanyCapabilities = Record<CompanyModule, boolean>;

export type AuthorizedCompany = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  role: CompanyRole;
  logoUrl: string;
  currency: string;
  currencySymbol: string;
  timeZone: string;
  defaultLanguage: "th" | "en" | "my";
  branchCount: number;
  branches: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  capabilities: CompanyCapabilities;
};

export type CompanyContextPayload = {
  multiCompanyEnabled: boolean;
  selectedCompanyId: string;
  selected: AuthorizedCompany;
  companies: AuthorizedCompany[];
};

export function capabilitiesForCompany(companyId: string): CompanyCapabilities {
  const hasVerifiedKmmOnlySource = companyId === COMPANY_ID;
  return {
    dashboard: true,
    sales: true,
    booking: true,
    stock: true,
    dailyManagement: true,
    team: true,
    marketing: hasVerifiedKmmOnlySource,
    expense: hasVerifiedKmmOnlySource,
    dataHub: true,
    settings: true,
  };
}

export function companyRoleLabel(role: CompanyRole) {
  if (role === "super_admin") return "Super admin";
  if (role === "company_admin") return "Company admin";
  if (role === "manager") return "Manager";
  return "Viewer";
}
