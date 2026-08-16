import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const npxExecutable = process.platform === "win32" ? "npx.cmd" : "npx";

const checks = [
  {
    name: "TypeScript",
    run: () => runCommand(npxExecutable, ["tsc", "--noEmit"]),
  },
  // Rendered HTML imports dist/server/index.js, so build must precede it in
  // a clean release worktree instead of accidentally relying on stale dist.
  {
    name: "Build",
    run: () => runCommand(npmExecutable, ["run", "build"]),
  },
  {
    name: "Lint",
    run: () => runCommand(npmExecutable, ["run", "lint"]),
  },
  {
    name: "Map foundation tests",
    run: () => runCommand(process.execPath, ["--test", "tests/map-foundation.test.mjs"]),
  },
  {
    name: "Rendered HTML tests",
    run: () => runCommand(process.execPath, ["--test", "tests/rendered-html.test.mjs"]),
  },
  {
    name: "Release workflow tests",
    run: () => runCommand(process.execPath, ["--test", "tests/release-workflow.test.mjs"]),
  },
  {
    name: "Multi-company isolation tests",
    run: () => runCommand(process.execPath, ["--test", "tests/multi-company-isolation.test.mjs"]),
  },
  {
    name: "Diff whitespace check",
    run: () => runCommand("git", ["diff", "--check"]),
  },
  {
    name: "Repository safety checks",
    run: runRepositorySafetyChecks,
  },
  {
    name: "Required deployment files",
    run: runRequiredDeploymentFileChecks,
  },
  {
    name: "Map safety assertions",
    run: runMapSafetyAssertions,
  },
];

console.log("KMM RELEASE CHECK");
console.log("");

for (const [index, check] of checks.entries()) {
  console.log(`[${index + 1}/${checks.length}] ${check.name}`);

  try {
    check.run();
    console.log("PASS");
    console.log("");
  } catch (error) {
    console.error(`FAILED: ${check.name}`);

    if (error instanceof Error && error.message) {
      console.error(error.message);
    }

    console.error("Release aborted.");
    process.exit(1);
  }
}

console.log("RELEASE CHECK PASSED");

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status ?? "unknown"}.`);
  }
}

function readCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${command} ${args.join(" ")} failed.`).trim());
  }

  return result.stdout;
}

function runRepositorySafetyChecks() {
  const gitStatus = readCommand("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const entries = parseGitStatus(gitStatus);
  const riskyEntries = [];

  for (const entry of entries) {
    if (!entry.isStaged && !entry.isUntracked) {
      continue;
    }

    const risk = getRiskReason(entry.path);
    if (risk) {
      riskyEntries.push(`${entry.path} (${risk})`);
      continue;
    }

    if (isLargeBinary(entry.path)) {
      riskyEntries.push(`${entry.path} (large binary file)`);
    }
  }

  if (riskyEntries.length > 0) {
    throw new Error(`Risky staged/untracked files found:\n- ${riskyEntries.join("\n- ")}`);
  }
}

function parseGitStatus(rawStatus) {
  if (!rawStatus) {
    return [];
  }

  return rawStatus
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const status = record.slice(0, 2);
      const filePath = normalizeGitPath(record.slice(3));

      return {
        path: filePath,
        isStaged: status[0] !== " " && status[0] !== "?" && status[0] !== "!",
        isUntracked: status === "??",
      };
    });
}

function normalizeGitPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function getRiskReason(filePath) {
  const normalized = normalizeGitPath(filePath);
  const basename = path.posix.basename(normalized).toLowerCase();

  if (normalized === "tsconfig.tsbuildinfo" || basename.endsWith(".tsbuildinfo")) {
    return "TypeScript build cache";
  }

  if (basename === ".env" || basename === ".env.local" || basename.startsWith(".env.")) {
    return "environment file";
  }

  if (basename.includes("credential") || basename.includes("credentials")) {
    return "credential file";
  }

  if (basename.includes("service-account") || basename.includes("service_account")) {
    return "service-account file";
  }

  if (basename.includes("private-key") || basename.includes("private_key")) {
    return "private key file";
  }

  if (basename.endsWith(".pem") || basename.endsWith(".key") || basename.endsWith(".p12")) {
    return "private key or certificate file";
  }

  if (normalized === "dist" || normalized.startsWith("dist/")) {
    return "unexpected dist artifact";
  }

  return "";
}

function isLargeBinary(filePath) {
  if (!existsSync(filePath)) {
    return false;
  }

  const stats = statSync(filePath);
  if (!stats.isFile() || stats.size < 10 * 1024 * 1024) {
    return false;
  }

  const binaryExtensions = new Set([
    ".7z",
    ".bin",
    ".db",
    ".dmg",
    ".exe",
    ".gz",
    ".map",
    ".mbtiles",
    ".pdf",
    ".pmtiles",
    ".rar",
    ".sqlite",
    ".tar",
    ".tgz",
    ".zip",
  ]);

  return binaryExtensions.has(path.extname(filePath).toLowerCase());
}

function runRequiredDeploymentFileChecks() {
  const requiredFiles = [
    "package.json",
    "wrangler.json",
    "worker/index.ts",
    "public/maps/vector/myanmar-townships.pmtiles",
    "tests/map-foundation.test.mjs",
    "tests/rendered-html.test.mjs",
  ];

  const missingFiles = requiredFiles.filter((filePath) => !existsSync(filePath));

  if (missingFiles.length > 0) {
    throw new Error(`Missing required deployment files:\n- ${missingFiles.join("\n- ")}`);
  }
}

function runMapSafetyAssertions() {
  const requiredFiles = [
    "public/maps/vector/myanmar-townships.pmtiles",
    "components/marketing/myanmar-marketing-map-maplibre.tsx",
    "data/maps/basemaps.json",
    "lib/maps/basemaps.ts",
    "src/kme/core/basemap/protomaps.ts",
  ];

  const missingFiles = requiredFiles.filter((filePath) => !existsSync(filePath));

  if (missingFiles.length > 0) {
    throw new Error(`Missing map foundation files:\n- ${missingFiles.join("\n- ")}`);
  }

  assertFileContains(
    "data/maps/datasets.json",
    "myanmar-townships.pmtiles",
    "Myanmar PMTiles path is no longer registered in the map dataset config.",
  );

  assertFileContains(
    "components/marketing/myanmar-marketing-map-maplibre.tsx",
    "getMapDataset(\"mm-townships-pmtiles\")",
    "Marketing MapLibre component no longer selects the Myanmar PMTiles dataset.",
  );

  assertFileContains(
    "components/marketing/myanmar-marketing-map-maplibre.tsx",
    "GlobalVectorMap",
    "Marketing MapLibre component is missing the GlobalVectorMap integration.",
  );

  assertFileContains(
    "data/maps/basemaps.json",
    "kme-protomaps-osm-light",
    "Basemap config no longer defines the KME Protomaps OSM basemap.",
  );

  assertFileContains(
    "src/kme/core/basemap/protomaps.ts",
    "@protomaps/basemaps",
    "KME basemap no longer uses the Protomaps MapLibre style package.",
  );

  assertFileContains(
    "src/kme/core/basemap/protomaps.ts",
    "/maps/vector/protomaps-osm-v4.pmtiles",
    "KME basemap no longer points at the same-origin Protomaps PMTiles provider.",
  );

  assertFileContains(
    "worker/index.ts",
    "data.source.coop/protomaps/openstreetmap/v4.pmtiles",
    "Worker no longer centralizes the Protomaps v4 PMTiles upstream.",
  );

  assertFileContains(
    "wrangler.json",
    "\"main\": \"dist/server/index.js\"",
    "Wrangler config no longer deploys the Vinext server Worker output.",
  );

  assertFileContains(
    "wrangler.json",
    "\"directory\": \"dist/client\"",
    "Wrangler config no longer serves the Vinext client asset output.",
  );

  assertFileContains(
    "wrangler.json",
    "/maps/vector/myanmar-townships.pmtiles",
    "Wrangler config no longer routes Myanmar PMTiles through the Worker.",
  );

  assertFileContains(
    "wrangler.json",
    "/maps/vector/protomaps-osm-v4.pmtiles",
    "Wrangler config no longer routes Protomaps PMTiles through the Worker.",
  );

  assertNoHardcodedSecrets();
  assertNoScatteredProviderUrls();
  assertNoLegacyDeploymentConfig();
}

function assertFileContains(filePath, needle, message) {
  const contents = readFileSync(filePath, "utf8");

  if (!contents.includes(needle)) {
    throw new Error(message);
  }
}

function assertNoHardcodedSecrets() {
  const filesToScan = [
    "components/marketing/myanmar-marketing-map-maplibre.tsx",
    "components/maps/global-vector-map.tsx",
    "data/maps/basemaps.json",
    "lib/maps/basemaps.ts",
    "worker/index.ts",
  ];

  const secretPattern =
    /(api[_-]?key|access[_-]?token|mapbox_token|maptiler_key|secret|private_key|service_account)\s*[:=]\s*["'][^"']+["']/i;

  const hits = filesToScan.filter((filePath) => {
    const contents = readFileSync(filePath, "utf8");
    return secretPattern.test(contents);
  });

  if (hits.length > 0) {
    throw new Error(`Possible hardcoded secret or token found:\n- ${hits.join("\n- ")}`);
  }
}

function listTextFiles(rootDir) {
  if (!existsSync(rootDir)) {
    return [];
  }

  const entries = readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      if (["fonts", "vector"].includes(entry.name)) {
        continue;
      }

      files.push(...listTextFiles(entryPath));
      continue;
    }

    if (entry.isFile() && /\.(json|mjs|ts|tsx|js|jsx|css|md)$/i.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function assertNoScatteredProviderUrls() {
  const scanRoots = ["components", "data", "lib", "public/maps/styles", "src/kme", "tests", "worker"];
  const allowedProviderFiles = new Set([
    "data/maps/basemaps.json",
    "lib/maps/basemaps.ts",
    "src/kme/core/basemap/protomaps.ts",
    "tests/map-foundation.test.mjs",
  ]);
  const files = [];

  for (const rootDir of scanRoots) {
    files.push(...listTextFiles(rootDir));
  }

  const openFreeMapHits = [];

  for (const filePath of files) {
    const contents = readFileSync(filePath, "utf8");

    if (!allowedProviderFiles.has(normalizeGitPath(filePath)) && /tiles\.openfreemap\.org|openfreemap-liberty-development/i.test(contents)) {
      openFreeMapHits.push(filePath);
    }
  }

  if (openFreeMapHits.length > 0) {
    throw new Error(`OpenFreeMap runtime dependency was reintroduced:\n- ${openFreeMapHits.join("\n- ")}`);
  }
}

function assertNoLegacyDeploymentConfig() {
  const forbiddenFiles = [
    "vercel.json",
    "next.config.ts",
    "next.config.js",
    "next.config.mjs",
  ];
  const present = forbiddenFiles.filter((filePath) => existsSync(filePath));

  if (present.length > 0) {
    throw new Error(`Legacy deployment configuration found:\n- ${present.join("\n- ")}`);
  }

  const forbiddenDirectory = ".vercel";
  if (existsSync(forbiddenDirectory)) {
    throw new Error("Legacy Vercel project metadata found: .vercel");
  }
}
