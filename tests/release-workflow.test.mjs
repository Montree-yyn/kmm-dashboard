import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("production configuration uses explicit company and operations D1 bindings", async () => {
  const [wrangler, database, salesRepository, operationsRepository, accessContext] = await Promise.all([
    readFile(new URL("../wrangler.json", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/sales/repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/operations/repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/kai/business/access-context.ts", import.meta.url), "utf8"),
  ]);
  assert.match(wrangler, /"binding": "COMPANY_DB"/);
  assert.match(wrangler, /"binding": "OPERATIONS_DB"/);
  assert.doesNotMatch(wrangler, /"binding": "DB"/);
  assert.match(database, /export function getCompanyDb/);
  assert.match(database, /export function getOperationsDb/);
  assert.doesNotMatch(database, /export async function getDb/);
  assert.match(salesRepository, /getOperationsDb/);
  assert.match(operationsRepository, /getOperationsDb/);
  assert.match(accessContext, /getCompanyDb/);
});

test("release dry-run runs checks and never deploys", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "kmm-release-dry-run-"));
  const npmStub = path.join(tempDir, process.platform === "win32" ? "npm.cmd" : "npm");
  const logFile = path.join(tempDir, "npm-calls.log");
  const stubScript =
    process.platform === "win32"
      ? `@echo off\r\necho %*>> "${logFile}"\r\nif "%1 %2"=="run deploy" exit /b 97\r\nexit /b 0\r\n`
      : `#!/bin/sh\nprintf '%s\\n' "$*" >> "${logFile}"\nif [ "$1 $2" = "run deploy" ]; then exit 97; fi\nexit 0\n`;

  await writeFile(npmStub, stubScript, { mode: 0o755 });

  const result = spawnSync(process.execPath, ["scripts/release.mjs", "--dry-run"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${tempDir}${path.delimiter}${process.env.PATH ?? ""}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /DRY RUN/);
  assert.match(result.stdout, /Deployment skipped\./);
  assert.match(result.stdout, /Would execute:\s+npm run deploy/s);
  assert.doesNotMatch(result.stdout, /KMM RELEASE COMPLETE/);

  const npmCalls = await readFile(logFile, "utf8");
  assert.match(npmCalls, /^run release:check$/m);
  assert.doesNotMatch(npmCalls, /^run deploy$/m);
});
