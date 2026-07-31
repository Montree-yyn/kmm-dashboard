import type {
  Branch,
  CompanySettingsSnapshot,
  Department,
} from "./types";

export type ValidationErrors = Record<string, string>;

function isValidUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateCompanySnapshot(
  snapshot: CompanySettingsSnapshot,
): ValidationErrors {
  const errors: ValidationErrors = {};
  const { company, fiscalYear } = snapshot;

  if (!company.companyName.trim()) {
    errors.companyName = "Company Name is required.";
  }
  if (!company.companyCode.trim()) {
    errors.companyCode = "Company Code is required.";
  } else if (company.companyCode !== company.companyCode.toUpperCase()) {
    errors.companyCode = "Company Code must use uppercase letters.";
  }
  if (!company.email.trim()) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(company.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!isValidUrl(company.website)) {
    errors.website = "Enter a valid http or https URL.";
  }
  const currentYear = new Date().getFullYear();
  if (
    company.establishedYear !== null &&
    (company.establishedYear < 1800 ||
      company.establishedYear > currentYear)
  ) {
    errors.establishedYear = `Enter a year between 1800 and ${currentYear}.`;
  }
  if (fiscalYear.startMonth < 1 || fiscalYear.startMonth > 12) {
    errors.startMonth = "Select a valid start month.";
  }
  if (fiscalYear.endMonth < 1 || fiscalYear.endMonth > 12) {
    errors.endMonth = "Select a valid end month.";
  }
  if (fiscalYear.startDay < 1 || fiscalYear.startDay > 31) {
    errors.startDay = "Enter a valid start day.";
  }
  if (fiscalYear.endDay < 1 || fiscalYear.endDay > 31) {
    errors.endDay = "Enter a valid end day.";
  }

  duplicateErrors(snapshot.branches, "branchCode", "branch", errors);
  duplicateErrors(
    snapshot.departments,
    "departmentCode",
    "department",
    errors,
  );

  for (const branch of snapshot.branches) {
    if (!branch.branchName.trim()) {
      errors[`branch.${branch.id}.branchName`] = "Branch Name is required.";
    }
    if (!branch.branchCode.trim()) {
      errors[`branch.${branch.id}.branchCode`] = "Branch Code is required.";
    }
    if (!isValidEmail(branch.email)) {
      errors[`branch.${branch.id}.email`] = "Enter a valid email address.";
    }
  }
  for (const department of snapshot.departments) {
    if (!department.departmentName.trim()) {
      errors[`department.${department.id}.departmentName`] =
        "Department Name is required.";
    }
    if (!department.departmentCode.trim()) {
      errors[`department.${department.id}.departmentCode`] =
        "Department Code is required.";
    }
  }

  return errors;
}

function duplicateErrors<T extends Branch | Department>(
  items: T[],
  field: "branchCode" | "departmentCode",
  prefix: string,
  errors: ValidationErrors,
) {
  const seen = new Set<string>();
  for (const item of items) {
    const value = String(item[field as keyof T] ?? "")
      .trim()
      .toUpperCase();
    if (!value) continue;
    if (seen.has(value)) {
      errors[`${prefix}.${item.id}.${field}`] =
        `${field === "branchCode" ? "Branch" : "Department"} Code must be unique.`;
    }
    seen.add(value);
  }
}

export function normalizeCompanySnapshot(
  snapshot: CompanySettingsSnapshot,
): CompanySettingsSnapshot {
  return {
    ...snapshot,
    company: {
      ...snapshot.company,
      companyName: snapshot.company.companyName.trim(),
      companyCode: snapshot.company.companyCode.trim().toUpperCase(),
      email: snapshot.company.email.trim(),
      website: snapshot.company.website.trim(),
    },
    branches: snapshot.branches.map((branch) => ({
      ...branch,
      branchName: branch.branchName.trim(),
      branchCode: branch.branchCode.trim().toUpperCase(),
      email: branch.email.trim(),
    })),
    departments: snapshot.departments.map((department) => ({
      ...department,
      departmentName: department.departmentName.trim(),
      departmentCode: department.departmentCode.trim().toUpperCase(),
    })),
  };
}
