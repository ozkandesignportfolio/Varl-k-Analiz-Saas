const { chromium } = require('playwright');

function requireEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. Set TEST_LOGIN_EMAIL and TEST_LOGIN_PASSWORD before running this login check.`,
    );
  }
  return value;
}

(async () => {
  const email = requireEnv('TEST_LOGIN_EMAIL');
  const password = requireEnv('TEST_LOGIN_PASSWORD');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('form button[type="submit"]');

  let redirected = true;
  try {
    await page.waitForURL('**/dashboard', { timeout: 25000 });
  } catch {
    redirected = false;
  }

  const messageText = await page
    .locator('p')
    .filter({ hasText: /invalid|failed|hata|credentials|giris/i })
    .first()
    .textContent()
    .catch(() => null);

  console.log(JSON.stringify({ redirected, url: page.url(), errorMessage: messageText }, null, 2));

  await context.close();
  await browser.close();
})();
