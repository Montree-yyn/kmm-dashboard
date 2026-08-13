export type CommissionIdentityEmployee = {
  employeeCode: string;
  salespersonCode: string;
  salespersonName: string;
};

export type CommissionIdentityAlias = {
  sourceSalespersonCode?: string | null;
  sourceEmployeeCode?: string | null;
  sourceSalespersonName: string;
  sourceBranch: string;
  canonicalEmployeeCode: string;
  canonicalSalespersonCode: string;
};

export type CommissionIdentityRow = {
  salespersonCode?: string | null;
  employeeCode?: string | null;
  salespersonName?: string | null;
  salesperson?: string | null;
  branch?: string | null;
};

export type ResolvedCommissionIdentity = {
  key: string;
  salespersonCode: string | null;
  employeeCode: string | null;
  name: string;
  source: "salesperson_code" | "employee_code" | "unique_master_relation" | "controlled_legacy_alias";
};

const stable = (value: unknown) => String(value ?? "").trim().toUpperCase();
const display = (value: unknown) => String(value ?? "").trim();
const sourceNameKey = (value: unknown) => display(value).replace(/\s+/g, " ").toUpperCase();

function usable(value: unknown) {
  const normalized = stable(value);
  return normalized !== "" && normalized !== "-";
}

function identityKey(employee: CommissionIdentityEmployee) {
  // A row may carry only employee_code while its approved alias resolves via
  // salesperson_code.  Both identifiers belong to the same master record, so
  // the grouping key must be derived from one canonical field rather than the
  // lookup path used to find that record.
  const employeeCode = stable(employee.employeeCode);
  if (usable(employeeCode)) return `employee_code:${employeeCode}`;
  return `salesperson_code:${stable(employee.salespersonCode)}`;
}

export function resolveCommissionIdentity(
  row: CommissionIdentityRow,
  employees: CommissionIdentityEmployee[],
  aliases: CommissionIdentityAlias[] = [],
): ResolvedCommissionIdentity | null {
  const bySalespersonCode = new Map<string, CommissionIdentityEmployee>();
  const byEmployeeCode = new Map<string, CommissionIdentityEmployee>();

  for (const employee of employees) {
    if (usable(employee.salespersonCode)) bySalespersonCode.set(stable(employee.salespersonCode), employee);
    if (usable(employee.employeeCode)) byEmployeeCode.set(stable(employee.employeeCode), employee);
  }

  const salespersonCode = stable(row.salespersonCode);
  if (usable(salespersonCode)) {
    const master = bySalespersonCode.get(salespersonCode);
    if (master) return {
      key: identityKey(master),
      salespersonCode: master.salespersonCode,
      employeeCode: master.employeeCode,
      name: master.salespersonName,
      source: "salesperson_code",
    };
  }

  const employeeCode = stable(row.employeeCode);
  if (usable(employeeCode)) {
    const master = byEmployeeCode.get(employeeCode);
    if (master) return {
      key: identityKey(master),
      salespersonCode: master.salespersonCode,
      employeeCode: master.employeeCode,
      name: master.salespersonName,
      source: "employee_code",
    };
  }

  const alias = aliases.filter((candidate) =>
    stable(candidate.sourceSalespersonCode) === salespersonCode
    && stable(candidate.sourceEmployeeCode) === employeeCode
    && sourceNameKey(candidate.sourceSalespersonName) === sourceNameKey(row.salespersonName ?? row.salesperson)
    && stable(candidate.sourceBranch) === stable(row.branch),
  );
  if (alias.length !== 1) return null;
  const canonical = alias[0];
  const canonicalMaster = bySalespersonCode.get(stable(canonical.canonicalSalespersonCode)) ?? byEmployeeCode.get(stable(canonical.canonicalEmployeeCode));
  if (!canonicalMaster) return null;
  return {
    key: identityKey(canonicalMaster),
    salespersonCode: canonicalMaster.salespersonCode,
    employeeCode: canonicalMaster.employeeCode,
    name: canonicalMaster.salespersonName,
    source: "controlled_legacy_alias",
  };
}
