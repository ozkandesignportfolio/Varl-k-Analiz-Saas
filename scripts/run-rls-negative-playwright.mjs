import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const testResultsDir = resolve(process.cwd(), "test-results");
mkdirSync(testResultsDir, { recursive: true });

const logPath = resolve(testResultsDir, "rls-negative.log");
const logStream = createWriteStream(logPath, { flags: "w" });

const playwrightCliPath = resolve(process.cwd(), "node_modules", "playwright", "cli.js");
const args = [
  "test",
  "tests/rls/rls-negative.spec.ts",
  "--workers=1",
  "--retries=1",
  "--trace=on",
  ...process.argv.slice(2),
];

const env = { ...process.env };

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
