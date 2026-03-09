import { spawn } from "node:child_process";
import { resolvePlaywrightCliPath } from "./_resolve-playwright-cli.mjs";

import { loadEnvLocal } from "./_load-env-local.mjs";

loadEnvLocal();
process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.RATE_LIMIT_STRICT_IN_TEST = process.env.RATE_LIMIT_STRICT_IN_TEST || "1";
process.env.AUTH_FORCE_PROFILE_FROM_DB = process.env.AUTH_FORCE_PROFILE_FROM_DB || "1";

const playwrightCliPath = resolvePlaywrightCliPath();
if (!playwrightCliPath) {
  process.stderr.write(
    "[run-rate-limit-playwright] Playwright CLI not found. Run `npm ci` (Node 20.19.x) before executing this test.\n",
  );
  process.exit(1);
}

const args = ["test", "testsprite/tests/rls/rate-limit-abuse.spec.ts", "--workers=1", ...process.argv.slice(2)];

const child = spawn(process.execPath, [playwrightCliPath, ...args], {
  cwd: process.cwd(),
  env: { ...process.env },
  stdio: "inherit",
});

child.on("error", (error) => {
  process.stderr.write(`[run-rate-limit-playwright] Failed to start Playwright: ${error.message}\n`);
  process.exit(1);
});

child.on("close", (code) => {
  process.exit(code ?? 1);
});
