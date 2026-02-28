const fs = require("node:fs");
const path = require("node:path");

const routeFile = path.join(process.cwd(), "src", "app", "api", "debug", "plan", "route.ts");
const source = fs.readFileSync(routeFile, "utf8");

const prodGuard = /process\.env\.NODE_ENV\s*===\s*["']production["']/;
const status404 = /status:\s*404/;

const guardIndex = source.search(prodGuard);
const statusIndex = source.search(status404);
const createClientIndex = source.indexOf("createClient()");

if (guardIndex < 0) {
  throw new Error("Missing production guard in /api/debug/plan route.");
}

if (statusIndex < 0) {
  throw new Error("Missing 404 response in /api/debug/plan route.");
}

if (createClientIndex >= 0 && guardIndex > createClientIndex) {
  throw new Error("Production guard must run before createClient() to avoid debug data access.");
}

console.log("OK: /api/debug/plan is guarded for production and returns 404.");
