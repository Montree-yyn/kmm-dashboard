export type CommissionIdentityEmployee = {
  employeeCode: string;
  salespersonCode: string;
  salespersonName: string;
};

export type CommissionIdentityRow = {
  salespersonCode?: string | null;
  employeeCode?: string | null;
  salespersonName?: string | null;
  salesperson?: string | null;
};

export type ResolvedCommissionIdentity = {
  key: string;
  salespersonCode: string | null;
  employeeCode: string | null;
  name: string;
  source: "salesperson_code" | "employee_code" | "unique_master_relation";
};

const stable = (value: unknown) => String(value ?? "").trim().toUpperCase();
const display = (value: unknown) => String(value ?? "").trim();
const nameKey = (value: unknown) => display(value).replace(/\s+/g, " ").replace(/\s*\(\s*out\s*\)\s*$/i, "").toUpperCase();

function usable(value: unknown) {
  const normalized = stable(value);
  return normalized !== "" && normalized !== "-";
}

export function resolveCommissionIdentity(
  row: CommissionIdentityRow,
  employees: CommissionIdentityEmployee[],
): ResolvedCommissionIdentity | null {
  const bySalespersonCode = new Map<string, CommissionIdentityEmployee>();
  const byEmployeeCode = new Map<string, CommissionIdentityEmployee>();
  const byUniqueName = new Map<string, CommissionIdentityEmployee | null>();

  for (const employee of employees) {
    if (usable(employee.salespersonCode)) bySalespersonCode.set(stable(employee.salespersonCode), employee);
    if (usable(employee.employeeCode)) byEmployeeCode.set(stable(employee.employeeCode), employee);
    const key = nameKey(employee.salespersonName);
    if (key) byUniqueName.set(key, byUniqueName.has(key) ? null : employee);
  }

  const salespersonCode = stable(row.salespersonCode);
  if (usable(salespersonCode)) {
    const master = bySalespersonCode.get(salespersonCode);
    return {
      key: `salesperson_code:${master?.salespersonCode ?? salespersonCode}`,
      salespersonCode: master?.salespersonCode ?? salespersonCode,
      employeeCode: master?.employeeCode ?? (usable(row.employeeCode) ? stable(row.employeeCode) : null),
      name: display(master?.salespersonName) || display(row.salespersonName) || display(row.salesperson) || salespersonCode,
      source: "salesperson_code",
    };
  }

  const employeeCode = stable(row.employeeCode);
  if (usable(employeeCode)) {
    const master = byEmployeeCode.get(employeeCode);
    return {
      key: `employee_code:${master?.employeeCode ?? employeeCode}`,
      salespersonCode: master?.salespersonCode ?? null,
      employeeCode: master?.employeeCode ?? employeeCode,
      name: display(master?.salespersonName) || display(row.salespersonName) || display(row.salesperson) || employeeCode,
      source: "employee_code",
    };
  }

  const master = byUniqueName.get(nameKey(row.salespersonName ?? row.salesperson));
  if (!master) return null;
  return {
    key: `salesperson_code:${master.salespersonCode}`,
    salespersonCode: master.salespersonCode,
    employeeCode: master.employeeCode,
    name: master.salespersonName,
    source: "unique_master_relation",
  };
}
