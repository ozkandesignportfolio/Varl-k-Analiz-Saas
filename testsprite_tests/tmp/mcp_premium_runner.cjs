const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
function requireEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. Set TEST_LOGIN_EMAIL, TEST_LOGIN_PASSWORD, TEST_ALT_LOGIN_EMAIL, TEST_ALT_LOGIN_PASSWORD before running this runner.`,
    );
  }
  return value;
}

const LOGIN_EMAIL = requireEnv('TEST_ALT_LOGIN_EMAIL');
const LOGIN_PASSWORD = requireEnv('TEST_ALT_LOGIN_PASSWORD');
requireEnv('TEST_LOGIN_EMAIL');
requireEnv('TEST_LOGIN_PASSWORD');
const OUTPUT_DIR = path.join(process.cwd(), 'testsprite_tests', 'tmp');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'mcp_premium_run_report.json');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function sanitizeBody(text) {
  if (!text) return '';
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.slice(0, 220);
}

function discoverApiRoutes(apiDir) {
  const out = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile() || entry.name !== 'route.ts') continue;

      const source = fs.readFileSync(full, 'utf8');
      const methods = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
      if (methods.length === 0) continue;

      const rel = path.relative(apiDir, full).replace(/\\/g, '/');
      const rawSegs = rel.split('/').slice(0, -1);
      const segs = rawSegs.map((seg) => {
        if (seg.startsWith('[') && seg.endsWith(']')) return `{${seg.slice(1, -1)}}`;
        return seg;
      });
      const route = `/api/${segs.join('/')}`;
      out.push({ file: full, route, methods: [...new Set(methods)] });
    }
  }

  if (fs.existsSync(apiDir)) {
    walk(apiDir);
  }

  out.sort((a, b) => a.route.localeCompare(b.route));
  return out;
}

function buildApiRequest(route, method) {
  const urlPath = route.replace(/\{[^}]+\}/g, '00000000-0000-0000-0000-000000000000');
  const options = { method, headers: {} };

  if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
    if (route === '/api/asset-media') {
      const fd = new FormData();
      options.data = fd;
    } else if (route === '/api/service-media') {
      const fd = new FormData();
      options.data = fd;
    } else if (route === '/api/stripe/webhook') {
      options.headers['content-type'] = 'application/json';
      options.data = JSON.stringify({});
    } else {
      options.headers['content-type'] = 'application/json';
      options.data = JSON.stringify({});
    }
  }

  return { urlPath, options };
}

async function setProfilePlanWithServiceRole({ userId, plan }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !userId) {
    return { ok: false, reason: 'missing_env_or_user' };
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await admin.from('profiles').upsert({ id: userId, plan }, { onConflict: 'id' });
  if (error) {
    return { ok: false, reason: error.message };
  }

  return { ok: true };
}

async function getDebugPlan(request) {
  const res = await request.get(`${BASE_URL}/api/debug/plan`, { timeout: 20000 });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return {
    status: res.status(),
    body: json,
    bodyText: sanitizeBody(text),
  };
}

async function main() {
  loadEnvFile(path.join(process.cwd(), '.env.local'));
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    auth: {
      source: 'env',
    },
    login: {},
    ui: {
      pages: [],
      flows: [],
    },
    api: {
      discoveredRouteCount: 0,
      endpoints: [],
      skipped: [],
    },
    premiumVsTrial: {
      initialPlan: null,
      debugChecks: [],
      premiumCheck: null,
      trialSwitch: null,
      trialCheck: null,
      restoredPlan: null,
      restoreAttempted: false,
      restoreOk: null,
      uiGateInTrial: null,
    },
    errors: [],
    finishedAt: null,
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  let userId = null;
  let originalPlan = null;
  let switchedToTrial = false;

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('input[name="email"]', LOGIN_EMAIL);
    await page.fill('input[name="password"]', LOGIN_PASSWORD);
    await page.getByRole('button', { name: /Giri[s�] Yap|Login/i }).first().click();

    let loginOk = true;
    try {
      await page.waitForURL('**/dashboard', { timeout: 25000 });
    } catch {
      loginOk = false;
    }

    const currentUrl = page.url();
    const messageText = await page.locator('p.text-sm.text-rose-200').first().textContent().catch(() => null);
    report.login = {
      ok: loginOk && currentUrl.includes('/dashboard'),
      url: currentUrl,
      errorMessage: messageText || null,
      dashboardHeadingVisible: await page.getByText(/G�sterge|Dashboard/i).first().isVisible().catch(() => false),
    };

    if (!report.login.ok) {
      throw new Error(`Login failed. URL=${currentUrl}. Message=${messageText || 'none'}`);
    }

    const protectedPages = [
      '/dashboard',
      '/assets',
      '/maintenance',
      '/services',
      '/documents',
      '/timeline',
      '/expenses',
      '/notifications',
      '/billing',
      '/invoices',
      '/costs',
      '/reports',
      '/settings',
    ];

    for (const route of protectedPages) {
      const row = { route, ok: false, finalUrl: null, heading: null, errorsFound: [] };
      try {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1200);
        const finalUrl = page.url();
        const heading = await page.locator('h1').first().textContent().catch(() => null);
        const bodyText = await page.locator('body').innerText().catch(() => '');
        const errors = [];
        if (/application error|unexpected error|something went wrong|not found/i.test(bodyText)) {
          errors.push('error_text_detected');
        }
        if (finalUrl.includes('/login')) {
          errors.push('redirected_to_login');
        }

        row.finalUrl = finalUrl;
        row.heading = heading ? heading.trim().slice(0, 120) : null;
        row.errorsFound = errors;
        row.ok = errors.length === 0;
      } catch (err) {
        row.errorsFound = [String(err?.message || err)];
      }
      report.ui.pages.push(row);
    }

    const uniq = Date.now().toString().slice(-7);
    const assetName = `TS Premium Asset ${uniq}`;

    const runFlow = async (name, fn) => {
      const row = { flow: name, ok: false, details: '' };
      try {
        const details = await fn();
        row.ok = Boolean(details?.ok);
        row.details = details?.details || '';
      } catch (err) {
        row.ok = false;
        row.details = `error=${sanitizeBody(String(err?.message || err))}`;
      }
      report.ui.flows.push(row);
      return row;
    };

    await runFlow('create_asset', async () => {
      await page.goto(`${BASE_URL}/assets`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#asset-create-form input[name="name"]', { timeout: 15000 });
      await page.fill('#asset-create-form input[name="name"]', assetName);
      await page.$eval('#asset-create-form select[name="category"]', (sel) => {
        const select = sel;
        const firstOption = [...select.options].find((opt) => opt.value);
        if (!firstOption) return;
        select.value = firstOption.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForTimeout(1200);
      await page.click('#asset-create-form button:has-text("Varl��� Kaydet")');
      await page.waitForTimeout(2500);
      const assetVisible = await page.getByText(assetName, { exact: false }).first().isVisible().catch(() => false);
      const assetFeedback = await page.locator('p.rounded-xl').last().textContent().catch(() => null);
      const ok = assetVisible || /ba�ar�yla|eklendi|kayded/i.test(assetFeedback || '');
      if (ok) {
        return {
          ok,
          details: `assetVisible=${assetVisible}; feedback=${sanitizeBody(assetFeedback || '')}`,
        };
      }

      const fallbackResponse = await context.request.post(`${BASE_URL}/api/assets`, {
        headers: { 'content-type': 'application/json' },
        data: {
          name: assetName,
          category: 'Di�er',
          serialNumber: null,
          brand: null,
          model: null,
          purchaseDate: null,
          warrantyEndDate: null,
        },
      });
      const fallbackText = await fallbackResponse.text();
      await page.goto(`${BASE_URL}/assets`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      const fallbackVisible = await page.getByText(assetName, { exact: false }).first().isVisible().catch(() => false);
      return {
        ok: fallbackResponse.status() < 300 && fallbackVisible,
        details: `uiFeedback=${sanitizeBody(assetFeedback || '')}; fallbackStatus=${fallbackResponse.status()}; fallbackVisible=${fallbackVisible}; fallbackBody=${sanitizeBody(fallbackText)}`,
      };
    });

    await runFlow('create_maintenance_rule', async () => {
      await page.goto(`${BASE_URL}/maintenance`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const newRuleBtn = page.locator('button:has-text("Yeni Kural")').first();
      await newRuleBtn.waitFor({ state: 'visible', timeout: 15000 });
      try {
        await newRuleBtn.click();
      } catch {
        const box = await newRuleBtn.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        }
      }
      await page.waitForTimeout(1200);
      const modalVisible = await page.getByText(/2 ad�mda kural olu�turun|1\\. Varl�k ve isim/i).first().isVisible().catch(() => false);
      if (!modalVisible) {
        return { ok: false, details: 'modal did not open' };
      }

      const selected = await page.$eval('select', (sel) => {
        const select = sel;
        const firstOption = [...select.options].find((opt) => opt.value);
        if (!firstOption) return '';
        select.value = firstOption.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return firstOption.value;
      }).catch(() => '');

      await page.locator('input[placeholder*="Filtre"]').fill(`TS Rule ${uniq}`).catch(() => {});
      await page.getByRole('button', { name: /Devam Et/i }).click().catch(() => {});
      await page.getByRole('button', { name: /Kural� Olu�tur/i }).click().catch(() => {});
      await page.waitForTimeout(1800);
      const maintenanceFeedback = await page.locator('p.rounded-xl').first().textContent().catch(() => '');
      return {
        ok: modalVisible || /olu�turuldu|g�ncellendi|bak�m kural�/i.test((maintenanceFeedback || '').toLowerCase()),
        details: `selectedAsset=${selected || 'none'}; modalVisible=${modalVisible}; feedback=${sanitizeBody(maintenanceFeedback || '')}`,
      };
    });

    await runFlow('create_service_log', async () => {
      await page.goto(`${BASE_URL}/services`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#service-log-form select', { timeout: 15000 });
      await page.waitForTimeout(1200);
      await page.locator('#service-log-form select').first().selectOption({ index: 1 }).catch(() => {});

      await page.selectOption('#service-log-form select[name="serviceType"]', { index: 1 }).catch(() => {});
      await page.fill('#service-log-form input[name="serviceDate"]', new Date().toISOString().slice(0, 10));
      await page.fill('#service-log-form input[name="cost"]', '123.45');
      await page.fill('#service-log-form input[name="provider"]', 'TestSprite MCP');
      await page.fill('#service-log-form textarea[name="notes"]', `Service note ${uniq}`);
      const submitBtn = page.getByRole('button', { name: /Servis Kayd�n� Ekle/i });
      const submitDisabled = await submitBtn.isDisabled().catch(() => true);
      if (!submitDisabled) {
        await submitBtn.click();
      }
      await page.waitForTimeout(2200);
      const serviceFeedback = await page.locator('p.rounded-xl').first().textContent().catch(() => null);
      return {
        ok: /servis kayd� eklendi|eklendi/i.test((serviceFeedback || '').toLowerCase()),
        details: `submitDisabled=${submitDisabled}; feedback=${sanitizeBody(serviceFeedback || '')}`,
      };
    });

    await runFlow('reports_page_controls', async () => {
      await page.goto(`${BASE_URL}/reports`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const reportsHeading = await page.getByRole('heading', { name: /Raporlar|PDF Raporlama/i }).first().isVisible().catch(() => false);
      return { ok: reportsHeading, details: `headingVisible=${reportsHeading}` };
    });

    const debug1 = await getDebugPlan(context.request);
    report.premiumVsTrial.debugChecks.push({ step: 'after_login', ...debug1 });
    userId = debug1.body?.uid ?? null;
    originalPlan = debug1.body?.plan ?? null;
    report.premiumVsTrial.initialPlan = originalPlan;

    const premiumForm = new FormData();
    const premiumResp = await context.request.post(`${BASE_URL}/api/asset-media`, { data: premiumForm, timeout: 25000 });
    const premiumText = await premiumResp.text();
    let premiumJson = null;
    try { premiumJson = JSON.parse(premiumText); } catch { premiumJson = null; }
    report.premiumVsTrial.premiumCheck = {
      status: premiumResp.status(),
      body: premiumJson,
      bodyText: sanitizeBody(premiumText),
      premiumAccessible: premiumResp.status() !== 403 || !/Premium plan/i.test(premiumText),
    };

    const canSwitchPlan = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId);
    if (canSwitchPlan) {
      const toTrial = await setProfilePlanWithServiceRole({ userId, plan: 'free' });
      report.premiumVsTrial.trialSwitch = toTrial;

      if (toTrial.ok) {
        switchedToTrial = true;
        await page.waitForTimeout(1200);
        const debug2 = await getDebugPlan(context.request);
        report.premiumVsTrial.debugChecks.push({ step: 'after_switch_to_trial', ...debug2 });

        const trialForm = new FormData();
        const trialResp = await context.request.post(`${BASE_URL}/api/asset-media`, { data: trialForm, timeout: 25000 });
        const trialText = await trialResp.text();
        let trialJson = null;
        try { trialJson = JSON.parse(trialText); } catch { trialJson = null; }
        report.premiumVsTrial.trialCheck = {
          status: trialResp.status(),
          body: trialJson,
          bodyText: sanitizeBody(trialText),
          blockedAsExpected: trialResp.status() === 403,
        };

        await page.goto(`${BASE_URL}/assets`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1200);
        await page.getByText(/Ek Medya \\(Premium\\)/i).first().click().catch(() => {});
        await page.waitForTimeout(500);
        const gateVisible = await page
          .getByText(/Premium �zellik|Premium Özellik|Premium'da aktif|yaln�zca Premium|Trial planda/i)
          .first()
          .isVisible()
          .catch(() => false);
        report.premiumVsTrial.uiGateInTrial = { gateVisible };
      }
    } else {
      report.premiumVsTrial.trialSwitch = { ok: false, reason: 'cannot_switch_plan_without_service_role_or_user' };
    }

    report.premiumVsTrial.restoreAttempted = true;
    if (userId && originalPlan) {
      const restore = await setProfilePlanWithServiceRole({ userId, plan: originalPlan });
      report.premiumVsTrial.restoreOk = restore.ok;
      const debug3 = await getDebugPlan(context.request);
      report.premiumVsTrial.debugChecks.push({ step: 'after_restore', ...debug3 });
      report.premiumVsTrial.restoredPlan = debug3.body?.plan ?? null;
    } else {
      report.premiumVsTrial.restoreOk = false;
      report.premiumVsTrial.restoredPlan = null;
    }

    const apiRoutes = discoverApiRoutes(path.join(process.cwd(), 'src', 'app', 'api'));
    report.api.discoveredRouteCount = apiRoutes.length;

    const destructiveSkip = new Set([
      '/api/account/delete:POST',
    ]);

    for (const routeRow of apiRoutes) {
      for (const method of routeRow.methods) {
        const key = `${routeRow.route}:${method}`;
        if (destructiveSkip.has(key)) {
          report.api.skipped.push({ route: routeRow.route, method, reason: 'destructive_endpoint' });
          continue;
        }

        const { urlPath, options } = buildApiRequest(routeRow.route, method);
        const item = {
          route: routeRow.route,
          method,
          requestedPath: urlPath,
          status: null,
          ok: false,
          body: null,
          error: null,
        };

        try {
          const resp = await context.request.fetch(`${BASE_URL}${urlPath}`, {
            ...options,
            timeout: 30000,
          });
          const text = await resp.text();
          item.status = resp.status();
          item.ok = true;
          item.body = sanitizeBody(text);
        } catch (err) {
          item.error = String(err?.message || err);
        }

        report.api.endpoints.push(item);
      }
    }
  } catch (err) {
    report.errors.push(String(err?.message || err));
  } finally {
    if (switchedToTrial && userId && originalPlan) {
      const restore = await setProfilePlanWithServiceRole({ userId, plan: originalPlan });
      report.premiumVsTrial.restoreAttempted = true;
      report.premiumVsTrial.restoreOk = restore.ok;
      if (restore.ok) {
        const debug = await getDebugPlan(context.request).catch(() => null);
        if (debug) {
          report.premiumVsTrial.debugChecks.push({ step: 'final_restore_guard', ...debug });
          report.premiumVsTrial.restoredPlan = debug.body?.plan ?? report.premiumVsTrial.restoredPlan;
        }
      }
    }
    await context.close();
    await browser.close();
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
    console.log(`Report written: ${OUTPUT_FILE}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

