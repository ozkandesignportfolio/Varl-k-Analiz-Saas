import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(90000);
import { confirmUserEmail } from "./helpers/supabase-admin";

const PASSWORD = "E2E!Pass1234";
const NAV_TIMEOUT_MS = 45_000;
const VERIFY_NOTICE_REGEX = /(do[ğg]rul|verify|verification|confirm|onay)/i;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForPostRegisterMarker(page: Page) {
  const dashboardMarker = page.getByTestId("dashboard-root");
  const loginEmailInput = page.getByTestId("login-email-input");
  const loginSubmitButton = page.getByTestId("login-submit-button");
  const verifyNotice = page
    .locator("[data-testid='login-message'], form p.text-sm")
    .filter({ hasText: VERIFY_NOTICE_REGEX })
    .first();

  await Promise.race([
    dashboardMarker.waitFor({ state: "visible", timeout: NAV_TIMEOUT_MS }),
    (async () => {
      await loginEmailInput.waitFor({ state: "visible", timeout: NAV_TIMEOUT_MS });
      await loginSubmitButton.waitFor({ state: "visible", timeout: NAV_TIMEOUT_MS });
    })(),
    verifyNotice.waitFor({ state: "visible", timeout: NAV_TIMEOUT_MS }),
  ]);
}

async function throwIfRegisterHasError(page: Page) {
  if (!page.url().includes("/register")) {
    return;
  }

  const registerMessage = page.locator("form p.text-sm").first();
  if (page.isClosed()) return;
  let visible = false;
  try { visible = await registerMessage.isVisible(); } catch { return; }
  if (!visible) {
    return;
  }

  const message = (await registerMessage.textContent())?.trim() || "(empty form message)";
  if (VERIFY_NOTICE_REGEX.test(message)) {
    return;
  }

  throw new Error(`register form submission failed: ${message}`);
}

async function failOnVisibleFormMessage(messageLocator: Locator, context: string) {
  if (!(await messageLocator.isVisible())) {
    return;
  }

  const message = (await messageLocator.textContent())?.trim() || "(empty form message)";
  console.error(`[critical-flow] ${context} form message: ${message}`);
  throw new Error(`${context} form submission failed: ${message}`);
}

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

  try {
    await waitForPostRegisterMarker(page);
    await throwIfRegisterHasError(page);
  } catch (error) {
    await throwIfRegisterHasError(page);
    throw error;
  }

  if (page.url().includes("/login")) {
    await confirmUserEmailWithRetry(email);

    await expect(page.getByTestId("login-form")).toBeVisible();
    await page.getByTestId("login-email-input").fill(email);
    await page.getByTestId("login-password-input").fill(PASSWORD);
    await page.getByTestId("login-submit-button").click();

    const dashboardRoot = page.getByTestId("dashboard-root");
    const loginMessage = page.getByTestId("login-message");
    await loginMessage.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);

    await Promise.race([
      dashboardRoot.waitFor({ state: "visible", timeout: NAV_TIMEOUT_MS }),
      loginMessage.waitFor({ state: "visible", timeout: NAV_TIMEOUT_MS }),
    ]);

    await failOnVisibleFormMessage(loginMessage, "login");
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
