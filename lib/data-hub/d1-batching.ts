// Current Cloudflare D1/Workerd enforces 100 bound variables per individual
// statement. Keep 10 slots unused so generated SQL remains below that ceiling
// if a statement later gains a small number of non-row parameters.
export const D1_BOUND_PARAMETER_LIMIT = 100;
export const D1_SAFE_PARAMETER_BUDGET = 90;
// This secondary cap prevents narrow tables from producing oversized row
// groups even when their parameter count would otherwise permit it.
export const D1_MAX_ROWS_PER_INSERT = 100;

type ParameterizedStatement = {
  toSQL(): { params: unknown[] };
};

export function countBoundParameters(statement: ParameterizedStatement) {
  return statement.toSQL().params.length;
}

export function calculateSafeRowsPerInsert(
  boundParametersPerRow: number,
  parameterBudget = D1_SAFE_PARAMETER_BUDGET,
  configuredMaxRows = D1_MAX_ROWS_PER_INSERT,
) {
  if (!Number.isInteger(boundParametersPerRow) || boundParametersPerRow < 1) {
    throw new Error("D1 insert rows must bind at least one SQL parameter.");
  }
  if (!Number.isInteger(parameterBudget) || parameterBudget < 1 || parameterBudget > D1_BOUND_PARAMETER_LIMIT) {
    throw new Error(`D1 parameter budget must be between 1 and ${D1_BOUND_PARAMETER_LIMIT}.`);
  }
  if (!Number.isInteger(configuredMaxRows) || configuredMaxRows < 1) {
    throw new Error("D1 maximum insert rows must be a positive integer.");
  }

  const parameterLimitedRows = Math.floor(parameterBudget / boundParametersPerRow);
  if (parameterLimitedRows < 1) {
    throw new Error(
      `A single import row binds ${boundParametersPerRow} SQL parameters, exceeding the safe D1 budget of ${parameterBudget}.`,
    );
  }

  return Math.min(configuredMaxRows, parameterLimitedRows);
}

export function chunkRowsForD1<T>(
  rows: readonly T[],
  boundParametersPerRow: number,
) {
  const rowsPerInsert = calculateSafeRowsPerInsert(boundParametersPerRow);
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += rowsPerInsert) {
    chunks.push(rows.slice(index, index + rowsPerInsert));
  }

  return { rowsPerInsert, chunks };
}

export function assertStatementWithinD1Budget(
  statement: ParameterizedStatement,
  parameterBudget = D1_SAFE_PARAMETER_BUDGET,
) {
  const parameterCount = countBoundParameters(statement);
  if (parameterCount > parameterBudget) {
    throw new Error(
      `D1 statement binds ${parameterCount} SQL parameters, exceeding the safe budget of ${parameterBudget}.`,
    );
  }
  return parameterCount;
}

export async function executeAtomicD1Batch<TStatement, TResult>(
  statements: TStatement[],
  execute: (statements: [TStatement, ...TStatement[]]) => Promise<TResult>,
) {
  if (statements.length === 0) {
    throw new Error("D1 atomic batch requires at least one statement.");
  }

  // D1 rolls back the whole sequence when any statement in one batch fails.
  // Keep every scoped delete, insert chunk, and success-history write in this
  // single call so a wide import can never leave a partially replaced period.
  return execute(statements as [TStatement, ...TStatement[]]);
}
