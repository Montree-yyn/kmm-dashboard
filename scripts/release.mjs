import { spawnSync } from "node:child_process";
import process from "node:process";

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const isDryRun = process.argv.includes("--dry-run");

console.log("KMM RELEASE");
console.log("");

runCommand(npmExecutable, ["run", "release:check"], "Release check");

const branch = readCommand("git", ["branch", "--show-current"]).trim() || "unknown";
const status = readCommand("git", ["status", "--porcelain=v1", "--untracked-files=all"]);

console.log(`Current branch: ${branch}`);
console.log(status.trim() ? "Working tree: source changes present" : "Working tree: clean");
console.log("");

if (isDryRun) {
  console.log("DRY RUN");
  console.log("Deployment skipped.");
  console.log("Would execute:");
  console.log("npm run deploy");
  process.exit(0);
}

console.log("Deploying with existing project command: npm run deploy");
console.log("");

runCommand(npmExecutable, ["run", "deploy"], "Deploy");

console.log("");
console.log("KMM RELEASE COMPLETE");
console.log("Production:");
console.log("https://kmm-executive-dashboard.kmm-dashboard.workers.dev");

function runCommand(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(`FAILED: ${label}`);
    console.error(result.error.message);
    console.error("Release aborted.");
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`FAILED: ${label}`);
    console.error("Release aborted.");
    process.exit(result.status ?? 1);
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
    console.error(result.error.message);
    return "";
  }

  if (result.status !== 0) {
    return "";
  }

  return result.stdout;
}
