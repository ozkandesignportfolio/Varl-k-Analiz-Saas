const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
function firstDefinedEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return null;
}

function resolveCredentials(profile) {
  if (profile === "trial") {
    const email = firstDefinedEnv(["TRIAL_LOGIN_EMAIL", "TRIAL_EMAIL", "TEST_LOGIN_EMAIL"]);
    const password = firstDefinedEnv(["TRIAL_LOGIN_PASSWORD", "TRIAL_PASSWORD", "TEST_LOGIN_PASSWORD"]);
    if (!email || !password) {
      throw new Error(
        "Missing trial credentials. Set TRIAL_EMAIL/TRIAL_PASSWORD (or TRIAL_LOGIN_EMAIL/TRIAL_LOGIN_PASSWORD).",
      );
    }
    return { email, password };
  }

  if (profile === "premium") {
    const email = firstDefinedEnv(["PREMIUM_LOGIN_EMAIL", "PREMIUM_EMAIL", "TEST_ALT_LOGIN_EMAIL"]);
    const password = firstDefinedEnv(["PREMIUM_LOGIN_PASSWORD", "PREMIUM_PASSWORD", "TEST_ALT_LOGIN_PASSWORD"]);
    if (!email || !password) {
      throw new Error(
        "Missing premium credentials. Set PREMIUM_EMAIL/PREMIUM_PASSWORD (or PREMIUM_LOGIN_EMAIL/PREMIUM_LOGIN_PASSWORD).",
      );
    }
    return { email, password };
  }

  throw new Error(`Unsupported profile: ${profile}`);
}

function resolveProfiles(target) {
  const normalized = String(target || "both").toLowerCase();
  if (normalized === "trial") return ["trial"];
  if (normalized === "premium") return ["premium"];
  if (normalized === "both") return ["trial", "premium"];
  throw new Error("Invalid STABLE_SUITE_TARGET. Expected: trial | premium | both.");
}

let EMAIL = firstDefinedEnv(["TRIAL_LOGIN_EMAIL", "TRIAL_EMAIL", "TEST_LOGIN_EMAIL"]) || "";
let PASSWORD = firstDefinedEnv(["TRIAL_LOGIN_PASSWORD", "TRIAL_PASSWORD", "TEST_LOGIN_PASSWORD"]) || "";
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "testsprite_tests", "generated");
let REPORT_PATH = path.join(OUT_DIR, "stable_full_suite_report.json");
const DUMMY_ID = "00000000-0000-4000-8000-000000000000";

const PROTECTED_ROUTES = [
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

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(f));
    else out.push(f);
  }
  return out;
}

function discoverApi() {
  const apiDir = path.join(ROOT, "src", "app", "api");
  const files = walk(apiDir).filter((f) => f.endsWith(`${path.sep}route.ts`));
  const out = [];
  for (const file of files) {
    const rel = path.relative(apiDir, path.dirname(file)).replace(/\\/g, "/");
    const endpoint = `/api/${rel}`.replace(/\/+/g, "/").replace(/\[([^\]]+)\]/g, "{$1}");
    const src = fs.readFileSync(file, "utf8");
    const methods = [...src.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
    out.push({ endpoint, methods: [...new Set(methods)] });
  }
  return out.sort((a, b) => a.endpoint.localeCompare(b.endpoint));
}

function countTestIds() {
  const srcDir = path.join(ROOT, "src");
  return walk(srcDir)
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .reduce((sum, file) => {
      const n = (fs.readFileSync(file, "utf8").match(/data-testid=/g) || []).length;
      return sum + n;
    }, 0);
}

function rootTestId(route) {
  const key = route.split("/").filter(Boolean)[0] || "home";
  return `${key}-root`;
}

function short(v) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 260);
}

function catUi(err) {
  const m = String(err?.message || err);
  if (/Timeout|locator|selector|wait/i.test(m)) return "selector_mismatch";
  if (m.startsWith("BACKEND:")) return "backend_error";
  return "assertion_error";
}

function catApi(err) {
  const m = String(err?.message || err);
  if (m.startsWith("BACKEND:") || /status=5\d\d/i.test(m)) return "backend_error";
  return "assertion_error";
}

function assertStatus(status, expected, endpoint, method, body) {
  if (status >= 500) throw new Error(`BACKEND: status=${status} ${method} ${endpoint} body=${short(body)}`);
  if (expected?.length && !expected.includes(status)) {
    throw new Error(`ASSERT: unexpected status=${status} ${method} ${endpoint} expected=${expected.join(",")}`);
  }
}

async function selectFirst(page, selector) {
  return page.$eval(selector, (el) => {
    const s = el;
    const o = [...s.options].find((x) => x.value);
    if (!o) return "";
    s.value = o.value;
    s.dispatchEvent(new Event("change", { bubbles: true }));
    return o.value;
  });
}

async function ensureAssetOption(page, context, selector) {
  for (let i = 0; i < 6; i += 1) {
    const picked = await selectFirst(page, selector).catch(() => "");
    if (picked) return picked;
    await page.waitForTimeout(600);
  }

  await context.request.fetch(`${BASE_URL}/api/assets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    data: { name: `TS UI Bootstrap ${Date.now()}`, category: "DiÄŸer" },
    timeout: 30000,
  });

  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
  for (let i = 0; i < 6; i += 1) {
    const picked = await selectFirst(page, selector).catch(() => "");
    if (picked) return picked;
    await page.waitForTimeout(600);
  }

  return "";
}

async function run(profile) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const apiRoutes = discoverApi();
  const report = {
    startedAt: new Date().toISOString(),
    profile,
    target: BASE_URL,
    auth: { source: "env", singleSessionReused: true },
    bootstrap: {
      needLogin: true,
      codebase: {
        dataTestIdCount: countTestIds(),
        protectedRouteCount: PROTECTED_ROUTES.length,
        apiEndpointMethodCount: apiRoutes.reduce((s, r) => s + r.methods.length, 0),
      },
    },
    login: { success: false, finalUrl: null, dashboardRootVisible: false, error: null },
    ui: { tests: [], counts: { passed: 0, failed: 0, skipped: 0, total: 0 } },
    api: { tests: [], counts: { passed: 0, failed: 0, skipped: 0, total: 0 } },
    failuresByCategory: { selector_mismatch: [], assertion_error: [], backend_error: [] },
    finishedAt: null,
  };

  const fail = (cat, id, reason) => report.failuresByCategory[cat].push({ id, reason });
  const uiTest = async (id, name, fn) => {
    const t = { id, name, status: "passed", reason: null, category: null };
    try {
      const r = await fn();
      if (r?.skip) {
        t.status = "skipped";
        t.reason = r.reason || "skipped";
      }
    } catch (e) {
      t.status = "failed";
      t.category = catUi(e);
      t.reason = short(e?.message || e);
      fail(t.category, id, t.reason);
    }
    report.ui.tests.push(t);
  };
  const apiTest = async (id, name, fn) => {
    const t = { id, name, status: "passed", reason: null, category: null };
    try {
      const r = await fn();
      if (r?.skip) {
        t.status = "skipped";
        t.reason = r.reason || "skipped";
      }
    } catch (e) {
      t.status = "failed";
      t.category = catApi(e);
      t.reason = short(e?.message || e);
      fail(t.category, id, t.reason);
    }
    report.api.tests.push(t);
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const state = { assetId: null, ruleId: null, serviceLogId: null };
  const executed = new Set();

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("[data-testid='login-email-input']").fill(EMAIL);
    await page.locator("[data-testid='login-password-input']").fill(PASSWORD);
    await page.locator("[data-testid='login-submit-button']").click();
    await page.waitForURL("**/dashboard**", { timeout: 30000 });
    await page.locator("[data-testid='dashboard-root']").first().waitFor({ state: "visible", timeout: 20000 });
    report.login.success = true;
    report.login.finalUrl = page.url();
    report.login.dashboardRootVisible = true;
  } catch (e) {
    report.login.error = short(e?.message || e);
    fail("selector_mismatch", "LOGIN", report.login.error);
  }

  if (report.login.success) {
    await uiTest("FE-001", "Protected route smoke", async () => {
      for (const route of PROTECTED_ROUTES) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (page.url().includes("/login")) throw new Error(`ASSERT: redirected to login from ${route}`);
        await page.locator(`[data-testid='${rootTestId(route)}']`).first().waitFor({ state: "visible", timeout: 15000 });
      }
    });

    await uiTest("FE-002", "Create asset via stable selectors", async () => {
      await page.goto(`${BASE_URL}/assets`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator("[data-testid='asset-create-form']").waitFor({ state: "visible", timeout: 15000 });
      await page.locator("[data-testid='asset-name-input']").fill(`TS Stable ${Date.now()}`);
      const cat = await selectFirst(page, "[data-testid='asset-category-select']");
      if (!cat) return { skip: true, reason: "no asset category option" };
      await page.locator("[data-testid='asset-save-button']").click();
      await page.waitForTimeout(2200);
      const fb = await page.locator("[data-testid='assets-feedback']").first().textContent().catch(() => "");
      if (/limit|oluÅŸturulamadÄ±|hata/i.test(fb || "")) throw new Error(`BACKEND: ${short(fb)}`);
    });

    await uiTest("FE-003", "Create maintenance rule", async () => {
      const waitForRuleAssetOption = async (maxAttempts = 8) => {
        for (let i = 0; i < maxAttempts; i += 1) {
          const picked = await selectFirst(page, "[data-testid='rule-asset-select']").catch(() => "");
          if (picked) return picked;
          await page.waitForTimeout(700);
        }
        return "";
      };

      await page.goto(`${BASE_URL}/maintenance`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator("[data-testid='maintenance-new-rule-button']").click();
      await page.locator("[data-testid='rule-editor-modal']").waitFor({ state: "visible", timeout: 15000 });
      let asset = await waitForRuleAssetOption();
      if (!asset) {
        const bootstrapResp = await context.request.fetch(`${BASE_URL}/api/assets`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          data: { name: `TS Maintenance Bootstrap ${Date.now()}`, category: "Diğer" },
          timeout: 30000,
        });
        const bootstrapText = await bootstrapResp.text().catch(() => "");
        await page.goto(`${BASE_URL}/maintenance`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.locator("[data-testid='maintenance-new-rule-button']").click();
        await page.locator("[data-testid='rule-editor-modal']").waitFor({ state: "visible", timeout: 15000 });
        asset = await waitForRuleAssetOption();
        if (!asset) {
          throw new Error(
            `ASSERT: maintenance rule modal has no selectable asset option (bootstrapStatus=${bootstrapResp.status()} bootstrapBody=${short(
              bootstrapText,
            )})`,
          );
        }
      }
      await page.locator("[data-testid='rule-title-input']").fill(`TS Rule ${Date.now()}`);
      await page.locator("[data-testid='rule-next-step-button']").click();
      await page.locator("[data-testid='rule-save-button']").click();
      await page.waitForTimeout(1800);
    });

    await uiTest("FE-004", "Create service log", async () => {
      await page.goto(`${BASE_URL}/services`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator("[data-testid='service-create-form']").waitFor({ state: "visible", timeout: 15000 });
      const asset = await ensureAssetOption(page, context, "[data-testid='service-asset-select']");
      if (!asset) return { skip: true, reason: "no asset for service log" };
      await selectFirst(page, "[data-testid='service-type-select']");
      await page.locator("[data-testid='service-date-input']").fill(new Date().toISOString().slice(0, 10));
      await page.locator("[data-testid='service-cost-input']").fill("125");
      await page.locator("[data-testid='service-provider-input']").fill("TS Stable");
      await page.locator("[data-testid='service-save-button']").click();
      await page.waitForTimeout(1800);
      const fb = await page.locator("[data-testid='services-feedback']").first().textContent().catch(() => "");
      if (/oluÅŸturulamadÄ±|hata|iÅŸlenirken/i.test(fb || "")) throw new Error(`BACKEND: ${short(fb)}`);
    });

    await uiTest("FE-005", "Auth guard check", async () => {
      const anon = await browser.newContext();
      const p = await anon.newPage();
      await p.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
      let u = p.url();
      for (let i = 0; i < 10 && !u.includes("/login"); i += 1) {
        await p.waitForTimeout(1000);
        u = p.url();
      }
      await anon.close();
      if (!u.includes("/login")) throw new Error(`ASSERT: /dashboard not redirected to /login; final=${u}`);
    });

    const reqJson = async (method, endpoint, data, expected) => {
      const r = await context.request.fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers: { "content-type": "application/json" },
        data: data ?? {},
        timeout: 30000,
      });
      const text = await r.text();
      assertStatus(r.status(), expected, endpoint, method, text);
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { r, text, json };
    };

    await apiTest("BE-001", "Prime API CRUD entities", async () => {
      executed.add("/api/assets:POST");
      executed.add("/api/assets:PATCH");
      executed.add("/api/service-logs:POST");
      executed.add("/api/service-logs:PATCH");
      executed.add("/api/maintenance-rules:POST");
      const planProbe = await reqJson("GET", "/api/debug/plan", null, [200]);
      const currentPlan = String(planProbe.json?.plan ?? "unknown").toLowerCase();
      const a = await reqJson("POST", "/api/assets", { name: `TS API ${Date.now()}`, category: "Diğer" }, [201, 403]);
      if (a.r.status() === 403) {
        const isPremiumPlan = currentPlan === "premium" || currentPlan === "pro";
        if (isPremiumPlan) {
          throw new Error(`BACKEND: premium plan should allow asset creation but returned 403: ${short(a.text)}`);
        }
        if (!/en fazla|limit|plan/i.test(a.text || "")) {
          throw new Error(`BACKEND: non-premium asset create failed unexpectedly: ${short(a.text)}`);
        }
        return;
      }
      state.assetId = a.json?.id || null;
      if (!state.assetId) return { skip: true, reason: "asset id not returned" };
      await reqJson("PATCH", "/api/assets", { id: state.assetId, name: `TS API U ${Date.now()}` }, [200]);
      const mr = await reqJson(
        "POST",
        "/api/maintenance-rules",
        { assetId: state.assetId, title: `TS Rule ${Date.now()}`, intervalValue: 6, intervalUnit: "month", lastServiceDate: new Date().toISOString().slice(0, 10) },
        [200, 201],
      );
      state.ruleId = mr.json?.id || null;
      const sl = await reqJson(
        "POST",
        "/api/service-logs",
        { assetId: state.assetId, ruleId: state.ruleId, serviceType: "Periyodik Bakım", serviceDate: new Date().toISOString().slice(0, 10), cost: 100 },
        [201],
      );
      state.serviceLogId = sl.json?.id || null;
      if (state.serviceLogId) await reqJson("PATCH", "/api/service-logs", { id: state.serviceLogId, notes: "stable patch" }, [200]);
    });

    await apiTest("BE-002", "Prime informational APIs", async () => {
      executed.add("/api/debug/plan:GET");
      executed.add("/api/dashboard-metrics:GET");
      executed.add("/api/panel-health:GET");
      await reqJson("GET", "/api/debug/plan", null, [200]);
      await reqJson("GET", "/api/dashboard-metrics", null, [200]);
      await reqJson("GET", "/api/panel-health", null, [200]);
    });

    await apiTest("BE-003", "Discovered endpoint sweep", async () => {
      for (const row of apiRoutes) {
        for (const method of row.methods) {
          const key = `${row.endpoint}:${method}`;
          if (executed.has(key) || key === "/api/account/delete:POST") continue;
          let ep = row.endpoint.replace(/\{[^}]+\}/g, state.ruleId || DUMMY_ID);
          let r;
          if (method === "GET") {
            r = await context.request.get(`${BASE_URL}${ep}`, { timeout: 30000 });
          } else {
            let data = {};
            if (row.endpoint === "/api/assets" && method === "PATCH") data = { id: state.assetId || DUMMY_ID, name: `Sweep ${Date.now()}` };
            if (row.endpoint === "/api/assets" && method === "DELETE") data = { id: state.assetId || DUMMY_ID };
            if (row.endpoint === "/api/service-logs" && method === "PATCH") data = { id: state.serviceLogId || DUMMY_ID, notes: "sweep" };
            r = await context.request.fetch(`${BASE_URL}${ep}`, { method, headers: { "content-type": "application/json" }, data, timeout: 30000 });
          }
          const text = await r.text();
          if (r.status() >= 500) throw new Error(`BACKEND: sweep ${method} ${row.endpoint} status=${r.status()} body=${short(text)}`);
        }
      }
    });

    await apiTest("BE-004", "Cleanup API entities", async () => {
      executed.add("/api/maintenance-rules/{id}:DELETE");
      executed.add("/api/assets:DELETE");
      if (state.ruleId) {
        const r = await context.request.fetch(`${BASE_URL}/api/maintenance-rules/${state.ruleId}`, { method: "DELETE", timeout: 30000 });
        const t = await r.text();
        assertStatus(r.status(), [200, 404], "/api/maintenance-rules/{id}", "DELETE", t);
      }
      if (state.assetId) {
        await reqJson("DELETE", "/api/assets", { id: state.assetId }, [200, 404]);
      }
    });
  }

  report.ui.counts.total = report.ui.tests.length;
  report.ui.counts.passed = report.ui.tests.filter((t) => t.status === "passed").length;
  report.ui.counts.failed = report.ui.tests.filter((t) => t.status === "failed").length;
  report.ui.counts.skipped = report.ui.tests.filter((t) => t.status === "skipped").length;

  report.api.counts.total = report.api.tests.length;
  report.api.counts.passed = report.api.tests.filter((t) => t.status === "passed").length;
  report.api.counts.failed = report.api.tests.filter((t) => t.status === "failed").length;
  report.api.counts.skipped = report.api.tests.filter((t) => t.status === "skipped").length;

  await context.close();
  await browser.close();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  const uiPass = report.login.success && report.ui.counts.failed === 0;
  const apiPass = report.login.success && report.api.counts.failed === 0;
  const overallPass = report.login.success && uiPass && apiPass;

  console.log("=== STABLE SUITE SUMMARY ===");
  console.log(`LOGIN: ${report.login.success ? "PASS" : "FAIL"}`);
  console.log(
    `UI: ${uiPass ? "PASS" : "FAIL"} (passed=${report.ui.counts.passed} failed=${report.ui.counts.failed} skipped=${report.ui.counts.skipped} total=${report.ui.counts.total})`,
  );
  console.log(
    `API: ${apiPass ? "PASS" : "FAIL"} (passed=${report.api.counts.passed} failed=${report.api.counts.failed} skipped=${report.api.counts.skipped} total=${report.api.counts.total})`,
  );
  console.log(`OVERALL: ${overallPass ? "PASS" : "FAIL"}`);
  console.log(`FAIL_SELECTOR=${report.failuresByCategory.selector_mismatch.length}`);
  console.log(`FAIL_ASSERT=${report.failuresByCategory.assertion_error.length}`);
  console.log(`FAIL_BACKEND=${report.failuresByCategory.backend_error.length}`);
  console.log(`REPORT=${REPORT_PATH}`);

  if (!overallPass) {
    return false;
  }
  return true;
}

async function runAll() {
  const profiles = resolveProfiles(process.env.STABLE_SUITE_TARGET || "both");
  let hasFailure = false;

  for (const profile of profiles) {
    REPORT_PATH = path.join(OUT_DIR, `stable_full_suite_report.${profile}.json`);

    try {
      const credentials = resolveCredentials(profile);
      EMAIL = credentials.email;
      PASSWORD = credentials.password;
      const passed = await run(profile);
      if (!passed) {
        hasFailure = true;
      }
    } catch (err) {
      hasFailure = true;
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(
        REPORT_PATH,
        JSON.stringify({ profile, failedAt: new Date().toISOString(), error: String(err?.message || err) }, null, 2),
      );
      console.error(`=== STABLE SUITE SUMMARY [${profile}] ===`);
      console.error(`[${profile}] UI: FAIL (runner_error)`);
      console.error(`[${profile}] API: FAIL (runner_error)`);
      console.error(`[${profile}] OVERALL: FAIL`);
      console.error(`[${profile}] REPORT=${REPORT_PATH}`);
      console.error(`[${profile}] RUN_FAILED=${String(err?.message || err)}`);
    }
  }

  if (hasFailure) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error(`RUN_FAILED=${String(err?.message || err)}`);
  process.exit(1);
});



