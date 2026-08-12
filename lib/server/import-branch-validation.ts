import { and, eq } from "drizzle-orm";
import { branches } from "../../db/schema";
import type { getCompanyDb } from "../../db";

export class ImportScopeError extends Error {
  readonly status = 422;
}

export async function assertImportBranches(
  companyDb: Awaited<ReturnType<typeof getCompanyDb>>,
  companyId: string,
  branchValues: unknown[],
) {
  const activeBranches = await companyDb
    .select({ code: branches.branchCode, name: branches.branchName })
    .from(branches)
    .where(and(
      eq(branches.companyId, companyId),
      eq(branches.status, "active"),
    ));

  if (!activeBranches.length) {
    throw new ImportScopeError(
      "Configure at least one active branch for the selected company before importing data.",
    );
  }

  const allowed = new Set(activeBranches.flatMap((branch) => [
    normalize(branch.code),
    normalize(branch.name),
  ]));
  const invalid = [...new Set(branchValues
    .map((value) => String(value ?? "").trim())
    .filter((value) => !value || !allowed.has(normalize(value))))]
    .slice(0, 8);
  if (invalid.length) {
    throw new ImportScopeError(
      `The file contains branch values outside the selected company master: ${invalid.map((value) => value || "(blank)").join(", ")}.`,
    );
  }
}

function normalize(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "");
}
