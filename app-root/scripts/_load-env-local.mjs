import { readFileSync, existsSync } from "node:fs";

const parseEnv = (text) => {
  const out = {};
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();

    // strip quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // basic escapes
    val = val.replace(/\\n/g, "\n");
    out[key] = val;
  }
  return out;
};

export const loadEnvLocal = () => {
  const explicitFiles = (process.env.TEST_ENV_FILE || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const candidatePaths = [...explicitFiles, ".env.test", ".env.test.local", ".env", ".env.local"];
  const seen = new Set();

  for (const p of candidatePaths) {
    if (seen.has(p)) {
      continue;
    }
    seen.add(p);

    if (!existsSync(p)) continue;
    const parsed = parseEnv(readFileSync(p, "utf8"));
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] == null || process.env[k] === "") {
        process.env[k] = v;
      }
    }
  }
};
