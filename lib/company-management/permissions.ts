import type {
  CompanyPermissions,
  CompanyRole,
} from "./types";

export const ROLE_PERMISSIONS: Record<CompanyRole, CompanyPermissions> = {
  super_admin: {
    view: true,
    edit: true,
    publish: true,
    disable: true,
    restore: true,
  },
  company_admin: {
    view: true,
    edit: true,
    publish: true,
    disable: false,
    restore: false,
  },
  manager: {
    view: true,
    edit: true,
    publish: false,
    disable: false,
    restore: false,
  },
  viewer: {
    view: true,
    edit: false,
    publish: false,
    disable: false,
    restore: false,
  },
};

export function isCompanyRole(value: unknown): value is CompanyRole {
  return (
    value === "super_admin" ||
    value === "company_admin" ||
    value === "manager" ||
    value === "viewer"
  );
}
