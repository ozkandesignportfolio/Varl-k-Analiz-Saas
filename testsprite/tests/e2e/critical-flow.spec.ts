import { expect, test, type Locator, type Page } from "@playwright/test";
import { getSuiteEnvValues, loadTestEnv, validateRequiredSuiteEnv } from "../../../scripts/load-test-env.cjs";

loadTestEnv();
validateRequiredSuiteEnv("criticalFlow");
const { values: criticalFlowEnv, sources: criticalFlowEnvSources } = getSuiteEnvValues("criticalFlow");

test.setTimeout(240000);

const getApiPath = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
};

const isAssetsCreateRequest = (url: string, method: string) => {
  return method.toUpperCase() === "POST" && getApiPath(url) === "/api/assets";
};

const ensureFilledInput = async (locator: Locator, value: string, attempts = 3) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await locator.fill(value, { timeout: 1200 });
    const currentValue = await locator.inputValue().catch(() => "");
    if (currentValue === value) {
      return true;
    }
    await locator.page().waitForTimeout(120);
  }

  return false;
};

const clickWithRetry = async (page: Page, locator: Locator, attempts = 2) => {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await locator.click({ timeout: 1200, noWaitAfter: true });
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
      await page.waitForTimeout(120).catch(() => undefined);
    }
  }

  throw lastError;
};

const waitWithoutSecondaryTimeout = async (page: Page, timeoutMs: number) => {
  if (page.isClosed()) {
    return false;
  }

  await page.waitForTimeout(timeoutMs).catch(() => undefined);
  return !page.isClosed();
};

const readLoginFormState = async (page: Page) => {
  return page
    .evaluate(() => {
      const emailInput = document.querySelector("[data-testid='login-email']") as HTMLInputElement | null;
      const passwordInput = document.querySelector("[data-testid='login-password']") as HTMLInputElement | null;
      return {
        emailValidation: emailInput?.validationMessage ?? "",
        passwordValidation: passwordInput?.validationMessage ?? "",
        emailValue: emailInput?.value ?? "",
        passwordValue: passwordInput?.value ?? "",
      };
    })
    .catch(() => ({
      emailValidation: "",
      passwordValidation: "",
      emailValue: "",
      passwordValue: "",
    }));
};

const readVisibleLoginErrorMessage = async (page: Page) => {
  const loginMessageLocator = page.getByTestId("login-message");
  const hasLoginMessage = await loginMessageLocator.isVisible().catch(() => false);
  if (!hasLoginMessage) {
    return "";
  }

  return (await loginMessageLocator.textContent({ timeout: 250 }).catch(() => "")).trim();
};

const submitAssetCreateAndWaitResponse = async (page: Page) => {
  const submitButton = page.getByTestId("asset-submit");
  await submitButton.waitFor({ state: "visible", timeout: 30000 }).catch(() => undefined);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const pendingResponse = page
      .waitForResponse(
        (response) => {
          const request = response.request();
          return isAssetsCreateRequest(request.url(), request.method());
        },
        { timeout: 30000 },
      )
      .catch(() => null);

    const clicked = await submitButton
      .click({ timeout: 2500, noWaitAfter: true })
      .then(() => true)
      .catch(() => false);
    if (!clicked) {
      const canRetry = await waitWithoutSecondaryTimeout(page, 250);
      if (!canRetry) {
        break;
      }
      continue;
    }

    const response = await pendingResponse;
    if (response) {
      return response;
    }

    const canRetry = await waitWithoutSecondaryTimeout(page, 500);
    if (!canRetry) {
      break;
    }
  }

  const createFormVisible = await page.getByTestId("asset-create-form").isVisible().catch(() => false);
  const submitButtonState = page.getByTestId("asset-submit");
  const submitVisible = await submitButtonState.isVisible().catch(() => false);
  const submitEnabled = await submitButtonState.isEnabled().catch(() => false);
  const visibleDialogCount = await page
    .evaluate(() => {
      const dialogs = Array.from(document.querySelectorAll("[role='dialog']")) as HTMLElement[];
      return dialogs.filter((dialog) => {
        const style = window.getComputedStyle(dialog);
        const rect = dialog.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      }).length;
    })
    .catch(() => 0);
  const feedback = (await page.getByTestId("assets-feedback").textContent().catch(() => "")).trim();
  const formValidationErrors = await page
    .evaluate(() => {
      const form = document.querySelector("[data-testid='asset-create-form']");
      if (!form) return [];
      const controls = Array.from(form.querySelectorAll("input,select,textarea")) as Array<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >;

      return controls
        .map((control) => {
          const validation = control.validationMessage?.trim() ?? "";
          if (!validation) return "";
          const controlName = control.getAttribute("name") || control.getAttribute("data-testid") || "field";
          return `${controlName}: ${validation}`;
        })
        .filter(Boolean);
    })
    .catch(() => [] as string[]);

  throw new Error(
    `create asset request did not fire after submit retries. url=${page.url()} createFormVisible=${String(
      createFormVisible,
    )} submitVisible=${String(submitVisible)} submitEnabled=${String(submitEnabled)} visibleDialogCount=${String(
      visibleDialogCount,
    )} feedback=${feedback || "(empty)"} formErrors=${
      formValidationErrors.length > 0 ? formValidationErrors.join(" | ") : "(none)"
    }`,
  );
};

const parseDashboardAssetCount = async (page: Page) => {
  const rawValue = await page.getByTestId("dashboard-kpi-assets-value").innerText();
  const onlyDigits = rawValue.replace(/[^0-9]/g, "");
  return Number.parseInt(onlyDigits || "0", 10);
};

type AssetsApiCursor = {
  value?: string;
  id?: string;
  sort?: string;
};

type AssetsApiListPayload = {
  rows?: Array<{ id?: string }>;
  hasMore?: boolean;
  nextCursor?: AssetsApiCursor | null;
  error?: string;
};

const listAllAssetIds = async (page: Page) => {
  const ids: string[] = [];
  let cursor: AssetsApiCursor | null = null;

  for (let iteration = 0; iteration < 10; iteration += 1) {
    const params = new URLSearchParams({
      pageSize: "100",
      sort: "updated",
    });

    if (cursor?.value && cursor?.id && cursor?.sort) {
      params.set("cursorValue", cursor.value);
      params.set("cursorId", cursor.id);
      params.set("cursorSort", cursor.sort);
    }

    const response = await page.request.get(`/api/assets?${params.toString()}`);
    const payload = (await response.json().catch(() => null)) as AssetsApiListPayload | null;
    if (!response.ok()) {
      const error = payload?.error || (await response.text().catch(() => "(empty body)"));
      throw new Error(`asset pre-cleanup list failed: status=${response.status()} body=${error}`);
    }

    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    for (const row of rows) {
      if (row?.id && !ids.includes(row.id)) {
        ids.push(row.id);
      }
    }

    if (!payload?.hasMore || !payload.nextCursor?.value || !payload.nextCursor?.id || !payload.nextCursor?.sort) {
      break;
    }
    cursor = payload.nextCursor;
  }

  return ids;
};

const ensureAssetCreateSlot = async (page: Page, maxBeforeCreate = 2) => {
  const ids = await listAllAssetIds(page);
  if (ids.length <= maxBeforeCreate) {
    return;
  }

  const idsToDelete = ids.slice(maxBeforeCreate);
  for (const assetId of idsToDelete) {
    const response = await page.request.delete("/api/assets", {
      data: { id: assetId },
    });
    if (response.status() === 200 || response.status() === 404) {
      continue;
    }

    const body = await response.text().catch(() => "(empty body)");
    throw new Error(
      `asset pre-cleanup delete failed: assetId=${assetId} status=${response.status()} body=${body || "(empty body)"}`,
    );
  }
};

const isLikelyEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const ensureUsableLoginCredentials = (email: string, password: string) => {
  if (!isLikelyEmail(email)) {
    const source = criticalFlowEnvSources.E2E_EMAIL || "E2E_EMAIL";
    throw new Error(
      `critical-flow login skipped: invalid E2E_EMAIL from ${source}. Value must be a valid email format.`,
    );
  }

  if (!password || password.trim().length === 0) {
    const source = criticalFlowEnvSources.E2E_PASSWORD || "E2E_PASSWORD";
    throw new Error(`critical-flow login skipped: empty E2E_PASSWORD from ${source}.`);
  }
};

type LoginOutcome =
  | { ok: true; reason: ""; retryable: false }
  | { ok: false; reason: string; retryable: boolean };

const waitForLoginOutcome = async (page: Page, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (page.isClosed()) {
      return {
        ok: false,
        reason: "page/context closed while waiting for login outcome",
        retryable: false,
      } satisfies LoginOutcome;
    }

    const dashboardVisible = await page.getByTestId("dashboard-root").isVisible().catch(() => false);
    if (dashboardVisible || /\/dashboard(?:\?.*)?$/.test(page.url())) {
      return { ok: true, reason: "", retryable: false } satisfies LoginOutcome;
    }

    const loginMessage = await readVisibleLoginErrorMessage(page);
    if (loginMessage) {
      return { ok: false, reason: `login-message: ${loginMessage}`, retryable: false } satisfies LoginOutcome;
    }

    const validation = await readLoginFormState(page);
    const hasNativeValidation = Boolean(validation.emailValidation || validation.passwordValidation);
    if (hasNativeValidation) {
      return {
        ok: false,
        reason: `native validation: ${validation.emailValidation || validation.passwordValidation}`,
        retryable: true,
      } satisfies LoginOutcome;
    }

    const loginVisible = await page.getByTestId("login-root").isVisible().catch(() => false);
    const emailFilled = validation.emailValue.trim().length > 0;
    const passwordFilled = validation.passwordValue.trim().length > 0;
    if (loginVisible && (!emailFilled || !passwordFilled)) {
      return {
        ok: false,
        reason: "login form reset or hydration race after submit",
        retryable: true,
      } satisfies LoginOutcome;
    }

    const canContinue = await waitWithoutSecondaryTimeout(page, 150);
    if (!canContinue) {
      return {
        ok: false,
        reason: "page/context closed while waiting for login outcome",
        retryable: false,
      } satisfies LoginOutcome;
    }
  }

  if (page.isClosed()) {
    return {
      ok: false,
      reason: "page/context closed while waiting for login outcome",
      retryable: false,
    } satisfies LoginOutcome;
  }

  const stillOnLogin = await page.getByTestId("login-root").isVisible().catch(() => false);
  return {
    ok: false,
    reason: `timeout waiting for login success signal; current URL=${page.url()}`,
    retryable: stillOnLogin,
  } satisfies LoginOutcome;
};

const loginWithRetries = async (page: Page, email: string, password: string) => {
  const maxAttempts = 5;
  let lastFailureReason = "unknown login failure";

  const emailInput = page.getByTestId("login-email");
  const passwordInput = page.getByTestId("login-password");
  const submitButton = page.getByTestId("login-submit");

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (page.isClosed()) {
      lastFailureReason = "page/context closed before login submit";
      break;
    }

    const emailReady = await ensureFilledInput(emailInput, email);
    const passwordReady = await ensureFilledInput(passwordInput, password);
    const valuesBeforeSubmit = await readLoginFormState(page);
    const emailMatches = valuesBeforeSubmit.emailValue === email;
    const passwordMatches = valuesBeforeSubmit.passwordValue === password;
    const hasNativeValidation = Boolean(valuesBeforeSubmit.emailValidation || valuesBeforeSubmit.passwordValidation);

    if (!emailReady || !passwordReady || !emailMatches || !passwordMatches || hasNativeValidation) {
      lastFailureReason = hasNativeValidation
        ? "native validation before submit"
        : "login form did not keep input values before submit";
      if (attempt === maxAttempts) {
        break;
      }

      await waitWithoutSecondaryTimeout(page, 250);
      continue;
    }

    const canSettleBeforeSubmit = await waitWithoutSecondaryTimeout(page, 120);
    if (!canSettleBeforeSubmit) {
      lastFailureReason = "page/context closed before login submit";
      break;
    }

    const settledValues = await readLoginFormState(page);
    const settledEmailMatches = settledValues.emailValue === email;
    const settledPasswordMatches = settledValues.passwordValue === password;
    const settledHasNativeValidation = Boolean(settledValues.emailValidation || settledValues.passwordValidation);
    if (!settledEmailMatches || !settledPasswordMatches || settledHasNativeValidation) {
      lastFailureReason = settledHasNativeValidation
        ? "native validation before submit (post-settle)"
        : "login form became unstable before submit";
      if (attempt === maxAttempts) {
        break;
      }

      await waitWithoutSecondaryTimeout(page, 250);
      continue;
    }

    const submitVisible = await submitButton.isVisible().catch(() => false);
    const submitEnabled = await submitButton.isEnabled().catch(() => false);
    if (!submitVisible || !submitEnabled) {
      lastFailureReason = "login submit button not ready";
      if (attempt === maxAttempts) {
        break;
      }

      await waitWithoutSecondaryTimeout(page, 250);
      continue;
    }

    try {
      await clickWithRetry(page, submitButton, 2);
    } catch (error) {
      lastFailureReason = `login submit click failed: ${String(error)}`;
      if (attempt === maxAttempts) {
        break;
      }

      await waitWithoutSecondaryTimeout(page, 250);
      continue;
    }

    if (page.isClosed()) {
      lastFailureReason = "page/context closed immediately after login submit";
      break;
    }

    const immediateDashboardVisible = await page.getByTestId("dashboard-root").isVisible().catch(() => false);
    if (immediateDashboardVisible || /\/dashboard(?:\?.*)?$/.test(page.url())) {
      return;
    }

    const immediateLoginMessage = await readVisibleLoginErrorMessage(page);
    if (immediateLoginMessage) {
      lastFailureReason = `login-message: ${immediateLoginMessage}`;
      break;
    }

    const immediateValidation = await readLoginFormState(page);
    const nativeValidation = immediateValidation.emailValidation || immediateValidation.passwordValidation;
    if (nativeValidation) {
      lastFailureReason = `native validation after submit: ${nativeValidation}`;
      if (attempt === maxAttempts) {
        break;
      }

      await waitWithoutSecondaryTimeout(page, 250);
      continue;
    }

    const loginVisible = await page.getByTestId("login-root").isVisible().catch(() => false);
    const emailFilled = immediateValidation.emailValue.trim().length > 0;
    const passwordFilled = immediateValidation.passwordValue.trim().length > 0;
    if (loginVisible && (!emailFilled || !passwordFilled)) {
      lastFailureReason = "login form reset or hydration race after submit";
      if (attempt === maxAttempts) {
        break;
      }

      await waitWithoutSecondaryTimeout(page, 250);
      continue;
    }

    const outcome = await waitForLoginOutcome(page, 30000);
    if (outcome.ok) {
      return;
    }

    lastFailureReason = outcome.reason;
    if (!outcome.retryable || attempt === maxAttempts) {
      break;
    }

    const canContinue = await waitWithoutSecondaryTimeout(page, 250);
    if (!canContinue) {
      lastFailureReason = "page/context closed during login retry wait";
      break;
    }
  }

  throw new Error(`login failed before dashboard navigation: ${lastFailureReason}`);
};

test(
  "critical flow: login -> create asset -> verify asset on dashboard -> logout",
  async ({ page }, testInfo) => {
    const email = criticalFlowEnv.E2E_EMAIL;
    const password = criticalFlowEnv.E2E_PASSWORD;
    ensureUsableLoginCredentials(email, password);
    const runId = `${Date.now()}-${testInfo.workerIndex}`;
    const assetName = `E2E Asset ${runId}`;

    // Trace hooks: helps identify whether the request path is truly /api/assets and whether auth flow is stable.
    page.on("request", (request) => {
      if (isAssetsCreateRequest(request.url(), request.method())) {
        console.log("[REQ][critical-flow]", request.method(), request.url());
      }
    });
    page.on("response", (response) => {
      const request = response.request();
      if (isAssetsCreateRequest(request.url(), request.method())) {
        console.log("[RES][critical-flow]", response.status(), request.url());
      }
    });

    // 1) Login and wait for dashboard shell test IDs to confirm auth + routing reached.
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("login-form")).toBeVisible({ timeout: 30000 });
    await loginWithRetries(page, email, password);

    await expect(page.getByTestId("dashboard-root")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("dashboard-content")).toBeVisible({ timeout: 30000 });
    await ensureAssetCreateSlot(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("dashboard-kpi-assets-card")).toBeVisible({ timeout: 30000 });

    const assetCountBefore = await parseDashboardAssetCount(page);

    // 2) Open assets, create one via API-backed form submission, and wait for POST /api/assets.
    await page.goto("/assets", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("assets-root")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("assets-list-section")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("asset-name-input")).toBeVisible({ timeout: 30000 });

    await page.getByTestId("asset-name-input").fill(assetName);
    await page.getByTestId("asset-brand-input").fill("TestBrand");
    await page.getByTestId("asset-model-input").fill("TestModel");
    await page.getByTestId("asset-category-select").selectOption("Elektronik");

    const response = await submitAssetCreateAndWaitResponse(page);
    const createPayload = (await response.json().catch(() => null)) as
      | { id?: string; error?: string }
      | null;

    if (!response.ok() || !createPayload?.id) {
      const body = createPayload?.error ?? (await response.text().catch(() => "(empty body)"));
      throw new Error(`create asset failed: status=${response.status()} body=${body}`);
    }

    await expect(page.getByTestId("assets-feedback")).toContainText("eklendi", { timeout: 30000 });
    const createdRow = page.locator(`[data-testid='asset-row'][data-asset-id='${createPayload.id}']`);
    await expect
      .poll(
        async () => {
          return createdRow.count();
        },
        { timeout: 45000 },
      )
      .toBeGreaterThan(0);
    await createdRow.first().scrollIntoViewIfNeeded().catch(() => undefined);
    await expect(createdRow.first()).toContainText(assetName, { timeout: 15000 });

    // 3) Re-open dashboard and confirm KPI count includes the newly created asset.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/, { timeout: 30000 });
    await expect(page.getByTestId("dashboard-kpi-assets-card")).toBeVisible({ timeout: 30000 });
    await expect
      .poll(async () => {
        return parseDashboardAssetCount(page);
      }, { timeout: 45000 })
      .toBe(assetCountBefore + 1);

    // 4) Logout via header action and ensure login page returns.
    await page.getByTestId("topbar-user-menu-toggle").click();
    await page.getByTestId("topbar-signout-button").click();
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/, { timeout: 30000 });
    await expect(page.getByTestId("login-form")).toBeVisible({ timeout: 30000 });
  },
);
