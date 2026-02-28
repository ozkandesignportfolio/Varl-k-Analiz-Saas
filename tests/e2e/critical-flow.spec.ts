import { expect, test } from "@playwright/test";
import { confirmUserEmail } from "./helpers/supabase-admin";

const PASSWORD = "E2E!Pass1234";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function confirmUserEmailWithRetry(email: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      await confirmUserEmail(email);
      return;
    } catch (error) {
      lastError = error;
      await delay(attempt * 300);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to confirm user email.");
}

test("critical flow: register, login, create asset, and see it in list", async ({ page }, testInfo) => {
  const runId = `${Date.now()}-${testInfo.parallelIndex}`;
  const email = `critical-flow-${runId}@example.com`;
  const fullName = `Critical Flow ${runId}`;
  const assetName = `E2E Asset ${runId}`;

  await page.goto("/register");
  await expect(page.locator("input[name='fullName']")).toBeVisible();

  await page.locator("input[name='fullName']").fill(fullName);
  await page.locator("input[name='email']").fill(email);
  await page.locator("input[name='password']").fill(PASSWORD);
  await page.locator("input[name='passwordConfirm']").fill(PASSWORD);
  await page.locator("form button[type='submit']").click();

  await page.waitForURL((url) => url.pathname === "/login" || url.pathname === "/dashboard", {
    timeout: 30_000,
  });

  if (page.url().includes("/login")) {
    await confirmUserEmailWithRetry(email);

    await expect(page.getByTestId("login-form")).toBeVisible();
    await page.getByTestId("login-email-input").fill(email);
    await page.getByTestId("login-password-input").fill(PASSWORD);
    await page.getByTestId("login-submit-button").click();

    await page.waitForURL("**/dashboard", { timeout: 30_000 });
  }

  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
  await expect(page.getByTestId("dashboard-root")).toBeVisible();

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
