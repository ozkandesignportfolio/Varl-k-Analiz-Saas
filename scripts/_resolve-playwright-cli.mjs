import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

const resolveFromPackage = (specifier) => {
  try {
    return require.resolve(specifier);
  } catch {
    return null;
  }
};

const resolveFromNodeModules = (relativePath) => {
  const fullPath = resolve(process.cwd(), "node_modules", ...relativePath.split("/"));
  return existsSync(fullPath) ? fullPath : null;
};

export const resolvePlaywrightCliPath = () => {
  const candidates = [
    resolveFromPackage("playwright/cli.js"),
    resolveFromPackage("@playwright/test/cli.js"),
    resolveFromNodeModules("playwright/cli.js"),
    resolveFromNodeModules("@playwright/test/cli.js"),
  ].filter(Boolean);

  return candidates[0] ?? null;
};
