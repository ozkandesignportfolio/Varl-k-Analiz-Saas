import { expect, test } from "@playwright/test";

test.setTimeout(90000);

const NAV_TIMEOUT_MS = 45_000;

test("critical flow: login, create asset, and see it in list", async ({ page }, testInfo) => {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error("Missing required env vars: E2E_EMAIL and/or E2E_PASSWORD");
  }

  const runId = `${Date.now()}-${testInfo.parallelIndex}`;
  const assetName = `E2E Asset ${runId}`;

  await page.goto("/login");
  await expect(page.getByTestId("login-form")).toBeVisible();
  await page.getByTestId("login-email-input").fill(email);
  await page.getByTestId("login-password-input").fill(password);
  await page.getByTestId("login-submit-button").click();

  const dashboardRoot = page.getByTestId("dashboard-root");
  const loginMessage = page.getByTestId("login-message");

  await Promise.race([
    dashboardRoot.waitFor({ state: "visible", timeout: NAV_TIMEOUT_MS }),
    loginMessage.waitFor({ state: "visible", timeout: NAV_TIMEOUT_MS }),
  ]);

  if (await loginMessage.isVisible()) {
    const message = (await loginMessage.textContent())?.trim() || "(empty login message)";
    throw new Error(`login failed: ${message}`);
  }

  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
  await expect(dashboardRoot).toBeVisible();

  await page.goto("/assets");
  await expect(page.getByTestId("assets-root")).toBeVisible();
  await expect(page.getByTestId("asset-create-form")).toBeVisible();

  await page.getByTestId("asset-name-input").fill(assetName);
  await page.getByTestId("asset-category-select").selectOption("Elektronik");

  const createAssetResponse = page.waitForResponse(
    (response) => response.url().includes("/api/assets") && response.request().method() === "POST",
  );
  await page.getByTestId("asset-save-button").click();
  expect((await createAssetResponse).ok()).toBeTruthy();

  await expect(page.getByTestId("assets-table")).toBeVisible();
  await expect(page.getByTestId("assets-table").getByText(assetName, { exact: true })).toBeVisible({
    timeout: 30_000,
  });
});

