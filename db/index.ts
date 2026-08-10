import { drizzle } from "drizzle-orm/d1";
import type { AnyD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

type DatabaseBinding = "COMPANY_DB" | "OPERATIONS_DB";

async function getBoundDatabase(binding: DatabaseBinding) {
  const { env } = await import("cloudflare:workers");
  const database = (env as Record<string, unknown>)[binding];
  if (!database) {
    throw new Error(
      `Cloudflare D1 binding \`${binding}\` is unavailable. Configure the explicit production binding before using this repository.`,
    );
  }

  return drizzle(database as AnyD1Database, { schema });
}

/** Company, membership, role, and branch authority only. */
export function getCompanyDb() {
  return getBoundDatabase("COMPANY_DB");
}

/** Transactional, import, master-data, target, and daily-management data only. */
export function getOperationsDb() {
  return getBoundDatabase("OPERATIONS_DB");
}
