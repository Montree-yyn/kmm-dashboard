import type { AuthorizedCompany } from "./types";

let activeCompany: AuthorizedCompany | null = null;

export function setActiveCompany(company: AuthorizedCompany | null) {
  activeCompany = company;
}

export function getActiveCompany() {
  return activeCompany;
}

export function resolveActiveCompanyId(explicitCompanyId?: string) {
  return explicitCompanyId?.trim() || activeCompany?.id;
}
