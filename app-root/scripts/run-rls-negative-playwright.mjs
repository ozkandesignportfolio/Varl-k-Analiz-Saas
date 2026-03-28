import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { loadEnvLocal } from "./_load-env-local.mjs";
import { resolvePlaywrightCliPath } from "./_resolve-playwright-cli.mjs";

const require = createRequire(import.meta.url);
const { loadTestEnv } = require("./load-test-env.cjs");

loadEnvLocal();
loadTestEnv();
process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.RATE_LIMIT_STRICT_IN_TEST = process.env.RATE_LIMIT_STRICT_IN_TEST || "1";
process.env.AUTH_FORCE_PROFILE_FROM_DB = process.env.AUTH_FORCE_PROFILE_FROM_DB || "1";

const testResultsDir = resolve(process.cwd(), "testsprite", "test-results");
mkdirSync(testResultsDir, { recursive: true });
mkdirSync(resolve(testResultsDir, "artifacts"), { recursive: true });

const logPath = resolve(testResultsDir, "rls-negative.log");
const logStream = createWriteStream(logPath, { flags: "w" });

const playwrightCliPath = resolvePlaywrightCliPath();
if (!playwrightCliPath) {
  const message =
    "[run-rls-negative-playwright] Playwright CLI not found. Run `npm ci` (Node 20.19.x) before executing this test.\n";
  process.stderr.write(message);
  logStream.end(message);
  process.exit(1);
}

const args = [
  "test",
  "testsprite/tests/rls/rls-negative.spec.ts",
  "--workers=1",
  "--retries=1",
  "--trace=on",
  ...process.argv.slice(2),
];

const env = { ...process.env };
const configuredBaseUrl = (env.TEST_BASE_URL || env.PLAYWRIGHT_BASE_URL || "").trim();
if (configuredBaseUrl.length > 0) {
  env.PLAYWRIGHT_BASE_URL = configuredBaseUrl;
}

const child = spawn(process.execPath, [playwrightCliPath, ...args], {
  cwd: process.cwd(),
  env,
  stdio: ["inherit", "pipe", "pipe"],
});

const write = (target, chunk) => {
  const text = chunk.toString();
  target.write(text);
  logStream.write(text);
};

child.stdout.on("data", (chunk) => write(process.stdout, chunk));
child.stderr.on("data", (chunk) => write(process.stderr, chunk));

child.on("error", (error) => {
  const message = `[run-rls-negative-playwright] Failed to start Playwright: ${error.message}\n`;
  process.stderr.write(message);
  logStream.end(message);
  process.exit(1);
});

child.on("close", (code) => {
  const finalCode = code ?? 1;
  logStream.end(`\n[run-rls-negative-playwright] Exit code: ${finalCode}\n`);
  process.exit(finalCode);
});
