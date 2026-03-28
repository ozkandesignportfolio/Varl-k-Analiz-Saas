/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SRC_APP_DIR = path.join(ROOT, "src", "app");
const OUTPUT_DIR = path.join(ROOT, "testsprite", "testsprite_tests", "generated");
const FRONTEND_PLAN_PATH = path.join(OUTPUT_DIR, "frontend_test_plan.needLogin.json");
const BACKEND_PLAN_PATH = path.join(OUTPUT_DIR, "backend_test_plan.needLogin.json");

const PROTECTED_UI_ROUTES = [
  "/dashboard",
  "/assets",
  "/maintenance",
  "/services",
  "/documents",
  "/timeline",
  "/expenses",
  "/notifications",
  "/billing",
  "/invoices",
  "/costs",
  "/reports",
  "/settings",
  "/subscriptions",
];

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(fullPath));
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

function discoverApiEndpoints() {
  const apiDir = path.join(SRC_APP_DIR, "api");
  const routeFiles = walkFiles(apiDir).filter((file) => file.endsWith(`${path.sep}route.ts`));
  const endpoints = [];

  for (const file of routeFiles) {
    const relDir = path
      .relative(apiDir, path.dirname(file))
      .replace(/\\/g, "/");
    const endpointPath = `/api/${relDir}`.replace(/\/+/g, "/").replace(/\[([^\]]+)\]/g, "{$1}");
    const source = fs.readFileSync(file, "utf8");
    const methods = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map(
      (m) => m[1],
    );

    endpoints.push({
      endpoint: endpointPath,
      methods: [...new Set(methods)],
    });
  }

  endpoints.sort((a, b) => a.endpoint.localeCompare(b.endpoint));
  return endpoints;
}

function buildFrontendPlan() {
  const tests = [
    {
      id: "FE-LOGIN-001",
      name: "Login with exact credentials and verify dashboard root",
      needLogin: true,
      route: "/login",
      selector: "[data-testid='dashboard-root']",
      expected: "User reaches dashboard and dashboard root is visible.",
    },
    {
      id: "FE-ROUTES-002",
      name: "Protected route smoke checks",
      needLogin: true,
      routes: PROTECTED_UI_ROUTES,
      expected: "Each protected route loads without redirecting back to login.",
    },
    {
      id: "FE-ASSET-003",
      name: "Create asset with stable selectors",
      needLogin: true,
      route: "/assets",
      selectors: [
        "[data-testid='asset-create-form']",
        "[data-testid='asset-name-input']",
        "[data-testid='asset-category-select']",
        "[data-testid='asset-submit']",
      ],
    },
    {
      id: "FE-MAINT-004",
      name: "Create maintenance rule from maintenance page",
      needLogin: true,
      route: "/maintenance",
      selectors: [
        "[data-testid='maintenance-new-rule-button']",
        "[data-testid='rule-editor-modal']",
        "[data-testid='rule-asset-select']",
        "[data-testid='rule-title-input']",
        "[data-testid='rule-save-button']",
      ],
    },
    {
      id: "FE-SERVICE-005",
      name: "Create service log and verify history table",
      needLogin: true,
      route: "/services",
      selectors: [
        "[data-testid='service-create-form']",
        "[data-testid='service-asset-select']",
        "[data-testid='service-type-select']",
        "[data-testid='service-save-button']",
        "[data-testid='service-history-table']",
      ],
    },
    {
      id: "FE-DOCS-006",
      name: "Upload a document and verify listing",
      needLogin: true,
      route: "/documents",
      selectors: [
        "[data-testid='documents-upload-form']",
        "[data-testid='documents-file-input']",
        "[data-testid='documents-upload-button']",
        "[data-testid='documents-table']",
      ],
    },
    {
      id: "FE-REPORTS-007",
      name: "Reports date controls and export button visibility",
      needLogin: true,
      route: "/reports",
      selectors: [
        "[data-testid='reports-start-date-input']",
        "[data-testid='reports-end-date-input']",
        "[data-testid='reports-export-pdf-button']",
      ],
    },
  ];

  return {
    target: "http://localhost:3000",
    generatedAt: new Date().toISOString(),
    needLogin: true,
    suite: "frontend",
    tests,
  };
}

function buildBackendPlan() {
  const endpoints = discoverApiEndpoints();
  const tests = [];
  let seq = 1;

  for (const endpoint of endpoints) {
    for (const method of endpoint.methods) {
      const id = `BE-${String(seq).padStart(3, "0")}`;
      seq += 1;

      tests.push({
        id,
        name: `${method} ${endpoint.endpoint}`,
        needLogin: true,
        endpoint: endpoint.endpoint,
        method,
        expected: "Endpoint responds without server crash; status is validated per endpoint contract.",
      });
    }
  }

  return {
    target: "http://localhost:3000",
    generatedAt: new Date().toISOString(),
    needLogin: true,
    suite: "backend",
    tests,
  };
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const frontendPlan = buildFrontendPlan();
  const backendPlan = buildBackendPlan();

  fs.writeFileSync(FRONTEND_PLAN_PATH, JSON.stringify(frontendPlan, null, 2));
  fs.writeFileSync(BACKEND_PLAN_PATH, JSON.stringify(backendPlan, null, 2));

  console.log(`FRONTEND_PLAN=${FRONTEND_PLAN_PATH}`);
  console.log(`BACKEND_PLAN=${BACKEND_PLAN_PATH}`);
  console.log(`BACKEND_CASES=${backendPlan.tests.length}`);
}

main();

