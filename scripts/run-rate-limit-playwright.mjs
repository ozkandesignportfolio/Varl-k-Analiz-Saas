import { spawn } from "node:child_process";
import { resolvePlaywrightCliPath } from "./_resolve-playwright-cli.mjs";

const playwrightCliPath = resolvePlaywrightCliPath();
if (!playwrightCliPath) {
  process.stderr.write(
    "[run-rate-limit-playwright] Playwright CLI not found. Run `npm ci` (Node 20.19.x) before executing this test.\n",
  );
  process.exit(1);
}

const args = ["test", "tests/rls/rate-limit-abuse.spec.ts", "--workers=1", ...process.argv.slice(2)];

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
