const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
function requireEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. Set TEST_LOGIN_EMAIL, TEST_LOGIN_PASSWORD, TEST_ALT_LOGIN_EMAIL, TEST_ALT_LOGIN_PASSWORD before running this audit.`,
    );
  }
  return value;
}

const TRIAL_EMAIL = requireEnv('TEST_LOGIN_EMAIL');
const TRIAL_PASSWORD = requireEnv('TEST_LOGIN_PASSWORD');
requireEnv('TEST_ALT_LOGIN_EMAIL');
requireEnv('TEST_ALT_LOGIN_PASSWORD');
const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, 'testsprite', 'testsprite_tests', 'tmp', 'trial_test_report.json');
const SERVER_LOG_PATH = path.join(ROOT, 'testsprite', 'testsprite_tests', 'tmp', 'trial_devserver_live.log');

const DYNAMIC_ID_PLACEHOLDER = '00000000-0000-4000-8000-000000000000';

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function normalizeRouteFromPagePath(filePath) {
  const rel = path.relative(path.join(ROOT, 'src', 'app'), filePath).replace(/\\/g, '/');
  const segments = rel.split('/');
  segments.pop();

  const routeSegments = [];
  for (const seg of segments) {
    if (!seg) continue;
    if (seg.startsWith('(') && seg.endsWith(')')) continue;
    if (seg.startsWith('[') && seg.endsWith(']')) return null;
    routeSegments.push(seg);
  }

  if (routeSegments.length === 0) return '/';
  return `/${routeSegments.join('/')}`;
}

function discoverUiRoutes() {
  const pageFiles = walkFiles(path.join(ROOT, 'src', 'app')).filter((p) => p.endsWith('page.tsx'));
  const routes = new Set();
  for (const file of pageFiles) {
    if (file.includes(`${path.sep}api${path.sep}`)) continue;
    const route = normalizeRouteFromPagePath(file);
    if (!route) continue;
    routes.add(route);
  }
  return [...routes].sort((a, b) => a.localeCompare(b));
}

function discoverApiEndpoints() {
  const apiRouteFiles = walkFiles(path.join(ROOT, 'src', 'app', 'api')).filter((p) => p.endsWith('route.ts'));
  const endpoints = [];

  for (const file of apiRouteFiles) {
    const relDir = path
      .relative(path.join(ROOT, 'src', 'app', 'api'), path.dirname(file))
      .replace(/\\/g, '/');

    const rawPath = relDir ? `/api/${relDir}` : '/api';
    const endpointPath = rawPath.replace(/\[[^\]]+\]/g, DYNAMIC_ID_PLACEHOLDER);

    const src = fs.readFileSync(file, 'utf8');
    const methodMatches = [...src.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g)];
    const methods = [...new Set(methodMatches.map((m) => m[1]))].sort();

    endpoints.push({
      file: path.relative(ROOT, file).replace(/\\/g, '/'),
      path: endpointPath,
      methods,
    });
  }

  endpoints.sort((a, b) => a.path.localeCompare(b.path));
  return endpoints;
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerUp() {
  try {
    const res = await fetch(BASE_URL, { redirect: 'manual' });
    return res.status > 0;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerUp()) return true;
    await wait(1200);
  }
  return false;
}

function startDevServer() {
  const logStream = fs.createWriteStream(SERVER_LOG_PATH, { flags: 'w' });
  const child = spawn('npm', ['run', 'dev'], {
    cwd: ROOT,
    shell: true,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => logStream.write(chunk));
  child.stderr.on('data', (chunk) => logStream.write(chunk));
  child.on('close', () => logStream.end());

  return child;
}

function shortBody(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 280);
}

async function run() {
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    auth: { source: 'env' },
    login: null,
    ui: {
      discoveredRoutes: [],
      routeResults: [],
      flowResults: [],
    },
    api: {
      discoveredEndpoints: [],
      results: [],
      skipped: [],
    },
    notes: [],
  };

  let serverProcess = null;
  let launchedServer = false;
  let browser = null;
  let context = null;

  try {
    const serverAlreadyUp = await isServerUp();
    if (!serverAlreadyUp) {
      serverProcess = startDevServer();
      launchedServer = true;
      const up = await waitForServer(120000);
      if (!up) {
        throw new Error('Dev server did not become available on http://localhost:3000 within 120s');
      }
      report.notes.push('Dev server started by test runner.');
    } else {
      report.notes.push('Reused existing dev server on localhost:3000.');
    }

    const discoveredRoutes = discoverUiRoutes();
    report.ui.discoveredRoutes = discoveredRoutes;

    const discoveredEndpoints = discoverApiEndpoints();
    report.api.discoveredEndpoints = discoveredEndpoints;

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const emailInput = page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"], input[autocomplete="current-password"]').first();
    const submitButton = page
      .locator('form button[type="submit"], form button:has-text("Giriï¿½"), form button:has-text("Giris"), form button:has-text("Login"), form button:has-text("Sign in"), form button:has-text("Giriï¿½ Yap")')
      .first();

    await emailInput.fill(TRIAL_EMAIL);
    await passwordInput.fill(TRIAL_PASSWORD);

    await Promise.allSettled([
      page.waitForURL('**/dashboard**', { timeout: 15000 }),
      submitButton.click({ timeout: 10000 }),
    ]);

    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 });
    }

    const loginAlert = await page
      .locator('[role="alert"], .text-red-500, .text-red-600, .error, [data-state="error"]')
      .first()
      .textContent()
      .catch(() => null);

    const loginSuccess = page.url().includes('/dashboard');
    report.login = {
      attempted: true,
      success: loginSuccess,
      finalUrl: page.url(),
      dashboardReached: loginSuccess,
      errorText: loginAlert ? shortBody(loginAlert) : null,
    };

    const uiTargets = discoveredRoutes;
    for (const route of uiTargets) {
      const result = {
        route,
        status: null,
        finalUrl: null,
        title: null,
        redirectedToLogin: null,
        runtimeErrorLikeText: null,
        ok: null,
        error: null,
      };

      try {
        const resp = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const status = resp ? resp.status() : null;
        const finalUrl = page.url();
        const title = await page.title();
        const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
        const runtimeErrorLike = /Application error|Unhandled Runtime Error|Internal Server Error|Something went wrong|Error:\s/i.test(
          bodyText.slice(0, 6000),
        );

        const redirectedToLogin = finalUrl.includes('/login') && route !== '/login';
        const ok = (status === null || status < 400) && !runtimeErrorLike && !redirectedToLogin;

        result.status = status;
        result.finalUrl = finalUrl;
        result.title = title;
        result.redirectedToLogin = redirectedToLogin;
        result.runtimeErrorLikeText = runtimeErrorLike;
        result.ok = ok;
      } catch (error) {
        result.error = String(error && error.message ? error.message : error);
        result.ok = false;
      }

      report.ui.routeResults.push(result);
    }

    const flowChecks = [
      {
        flow: 'Protected route chain',
        steps: ['/dashboard', '/assets', '/maintenance', '/services', '/documents', '/reports', '/settings'],
      },
      {
        flow: 'Billing route chain',
        steps: ['/billing', '/subscriptions', '/invoices'],
      },
      {
        flow: 'Insights route chain',
        steps: ['/timeline', '/costs', '/expenses', '/notifications'],
      },
    ];

    for (const flow of flowChecks) {
      const flowResult = {
        flow: flow.flow,
        steps: flow.steps,
        stepResults: [],
        finalUrl: null,
        ok: false,
        error: null,
      };

      try {
        let allStepsOk = true;
        for (const step of flow.steps) {
          const resp = await page.goto(step, { waitUntil: 'domcontentloaded', timeout: 30000 });
          const finalUrl = page.url();
          const stepOk = finalUrl.includes(step) && (!resp || resp.status() < 400);
          if (!stepOk) allStepsOk = false;
          flowResult.stepResults.push({
            step,
            status: resp ? resp.status() : null,
            finalUrl,
            ok: stepOk,
          });
        }
        flowResult.finalUrl = page.url();
        flowResult.ok = allStepsOk;
        if (!allStepsOk) {
          flowResult.error = 'At least one route transition failed in chain.';
        }
      } catch (error) {
        flowResult.error = String(error && error.message ? error.message : error);
      }

      report.ui.flowResults.push(flowResult);
    }

    const anonymousFlowResult = {
      flow: 'Auth guard for /dashboard',
      expected: 'redirect to /login when unauthenticated',
      initialStatus: null,
      finalUrl: null,
      ok: false,
      error: null,
    };

    try {
      const anonContext = await browser.newContext({ baseURL: BASE_URL });
      const anonPage = await anonContext.newPage();
      const anonResp = await anonPage.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      anonymousFlowResult.initialStatus = anonResp ? anonResp.status() : null;
      anonymousFlowResult.finalUrl = anonPage.url();
      anonymousFlowResult.ok = anonPage.url().includes('/login');
      if (!anonymousFlowResult.ok) {
        anonymousFlowResult.error = 'Unauthenticated user was not redirected to /login.';
      }
      await anonContext.close();
    } catch (error) {
      anonymousFlowResult.error = String(error && error.message ? error.message : error);
    }

    report.ui.flowResults.push(anonymousFlowResult);

    for (const endpoint of discoveredEndpoints) {
      for (const method of endpoint.methods) {
        if (endpoint.path === '/api/account/delete' && method === 'POST') {
          report.api.skipped.push({
            endpoint: endpoint.path,
            method,
            reason: 'Skipped to avoid destructive account deletion.',
          });
          continue;
        }

        const apiResult = {
          endpoint: endpoint.path,
          method,
          status: null,
          ok: false,
          bodySnippet: null,
          error: null,
        };

        try {
          const options = {
            method,
            failOnStatusCode: false,
            timeout: 30000,
          };

          if (method !== 'GET') {
            options.headers = { 'Content-Type': 'application/json' };
            if (endpoint.path.includes('/maintenance-rules/') && endpoint.path !== '/api/maintenance-rules') {
              options.data = { id: DYNAMIC_ID_PLACEHOLDER };
            } else if (endpoint.path === '/api/assets') {
              options.data = method === 'PATCH' || method === 'DELETE' ? { id: DYNAMIC_ID_PLACEHOLDER } : {};
            } else if (endpoint.path === '/api/service-logs') {
              options.data = method === 'PATCH' ? { id: DYNAMIC_ID_PLACEHOLDER } : {};
            } else if (endpoint.path === '/api/stripe/webhook') {
              options.data = {};
            } else {
              options.data = {};
            }
          }

          const resp = await context.request.fetch(`${BASE_URL}${endpoint.path}`, options);
          const body = await resp.text();
          apiResult.status = resp.status();
          apiResult.ok = resp.status() >= 200 && resp.status() < 300;
          apiResult.bodySnippet = shortBody(body);
        } catch (error) {
          apiResult.error = String(error && error.message ? error.message : error);
        }

        report.api.results.push(apiResult);
      }
    }

    report.completedAt = new Date().toISOString();

    const uiPass = report.ui.routeResults.filter((r) => r.ok).length;
    const uiTotal = report.ui.routeResults.length;
    const flowPass = report.ui.flowResults.filter((r) => r.ok).length;
    const flowTotal = report.ui.flowResults.length;
    const api2xx = report.api.results.filter((r) => r.status >= 200 && r.status < 300).length;
    const apiTotal = report.api.results.length;

    report.summary = {
      loginSuccess: report.login.success,
      uiRoutePass: `${uiPass}/${uiTotal}`,
      uiFlowPass: `${flowPass}/${flowTotal}`,
      api2xx: `${api2xx}/${apiTotal}`,
      apiSkipped: report.api.skipped.length,
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

    console.log('LOGIN_SUCCESS=' + report.login.success);
    console.log('UI_ROUTES=' + report.summary.uiRoutePass);
    console.log('UI_FLOWS=' + report.summary.uiFlowPass);
    console.log('API_2XX=' + report.summary.api2xx);
    console.log('API_SKIPPED=' + report.summary.apiSkipped);
    console.log('REPORT=' + REPORT_PATH);
  } catch (error) {
    const failed = {
      failedAt: new Date().toISOString(),
      error: String(error && error.message ? error.message : error),
    };

    try {
      fs.writeFileSync(REPORT_PATH, JSON.stringify(failed, null, 2), 'utf8');
    } catch {}

    console.error('RUN_FAILED=' + failed.error);
    process.exitCode = 1;
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (launchedServer && serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
  }
}

run();



