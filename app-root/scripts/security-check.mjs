import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const commandExists = (command) => {
  const checker = isWindows ? "where" : "which";
  const result = spawnSync(checker, [command], { stdio: "ignore" });
  return (result.status ?? 1) === 0;
};

const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: isWindows,
  });
  return result.status ?? 1;
};

const ensureEnvLocalIgnored = () => {
  if (!existsSync(".gitignore")) {
    throw new Error(".gitignore not found.");
  }

  const gitignore = readFileSync(".gitignore", "utf8");
  const hasEnvLocalRule = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === ".env.local" || line === "/.env.local");

  if (!hasEnvLocalRule) {
    throw new Error(".gitignore must include .env.local to prevent committing local secrets.");
  }
};

const runGitleaks = () => {
  if (process.env.SKIP_GITLEAKS === "1") {
    console.log("[security:check] SKIP_GITLEAKS=1, skipping gitleaks.");
    return 0;
  }

  if (!commandExists("gitleaks")) {
    console.log("[security:check] gitleaks not found, skipping local gitleaks scan.");
    return 0;
  }

  console.log("[security:check] Running gitleaks...");
  return run("gitleaks", ["detect", "--source", ".", "--no-banner", "--redact"]);
};

const runAudit = () => {
  console.log("[security:check] Running npm audit --omit=dev...");
  return run("npm", ["audit", "--omit=dev"]);
};

const main = () => {
  ensureEnvLocalIgnored();
  console.log("[security:check] .gitignore check passed (.env.local ignored).");

  const gitleaksCode = runGitleaks();
  if (gitleaksCode !== 0) {
    process.exit(gitleaksCode);
  }

  const auditCode = runAudit();
  if (auditCode !== 0) {
    process.exit(auditCode);
  }

  console.log("[security:check] Completed successfully.");
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[security:check] ${message}`);
  process.exit(1);
}
