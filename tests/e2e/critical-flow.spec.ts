import { test, expect } from "@playwright/test";

test.setTimeout(90000);

test("critical flow: login, create asset, and see it in list", async ({ page }, testInfo) => {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error("Missing required env vars: E2E_EMAIL and/or E2E_PASSWORD");
  }

  // Helpful API logging in CI/local
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("/api/")) console.log("[REQ]", req.method(), u);
  });
  page.on("response", (res) => {
    const u = res.url();
    if (u.includes("/api/")) console.log("[RES]", res.status(), u);
  });

  const runId = ${Date.now()}-;

  // 1) Login
  await page.goto("/login");
  await page.getByTestId("login-email-input").fill(email);
  await page.getByTestId("login-password-input").fill(password);
  await page.getByTestId("login-submit-button").click();

  // If your app redirects elsewhere, allow it; but dashboard should be reachable.
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/, { timeout: 45000 });

  // 2) Go to assets
  await page.goto("/assets");
  await expect(page).toHaveURL(/\/assets(?:\?.*)?$/, { timeout: 45000 });

  // 3) Create an asset
  await page.getByTestId("asset-name-input").fill(E2E Asset );
  await page.getByTestId("asset-brand-input").fill("TestBrand");
  await page.getByTestId("asset-model-input").fill("TestModel");
  await page.getByTestId("asset-category-select").selectOption("Elektronik");

  // Wait for POST /api/assets (allow querystring or trailing slash)
  const createAssetResponse = page.waitForResponse((response) => {
    const url = response.url();
    const isAssets = /\/api\/assets(\/|\?|$)/.test(url);
    return isAssets && response.request().method() === "POST";
  });

  await page.getByTestId("asset-save-button").click();

  const res = await createAssetResponse;
  if (!res.ok()) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(create asset failed:   body=);
  }

  // 4) Assert created asset appears
  const table = page.getByTestId("assets-table");
  await expect(table).toBeVisible({ timeout: 45000 });
  await expect(table).toContainText(E2E Asset , { timeout: 45000 });
});
