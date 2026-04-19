import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, extname, join } from "node:path";

const ROOT = resolve(process.cwd());
const TARGET_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

const findings = [];

const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name));
      continue;
    }

    const fullPath = join(dir, entry.name);
    if (!TARGET_EXT.has(extname(fullPath))) continue;

    const content = readFileSync(fullPath, "utf8");
    if (!content.includes("process.env")) continue;

    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes("process.env")) {
        findings.push({
          file: fullPath.replace(ROOT + "\\", ""),
          line: index + 1,
          snippet: line.trim(),
        });
      }
    });
  }
};

walk(ROOT);

const reportPath = resolve(ROOT, "docs", "qa", "process-env-audit.json");
writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2));

console.log(`[audit-process-env] findings=${findings.length}`);
console.log(`[audit-process-env] report=${reportPath}`);
