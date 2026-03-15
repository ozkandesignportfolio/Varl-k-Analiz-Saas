import { expect, test, type Page } from "@playwright/test";
import { getSuiteEnvValues, loadTestEnv, validateRequiredSuiteEnv } from "../../../scripts/load-test-env.cjs";

loadTestEnv();
validateRequiredSuiteEnv("criticalFlow");
const { values: criticalFlowEnv, sources: criticalFlowEnvSources } = getSuiteEnvValues("criticalFlow");

test.setTimeout(240000);
const TEST_ASSET_PREFIX = "E2E-CF-";

const getApiPath = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
};

const isAssetsCreateRequest = (url: string, method: string) =>
  method.toUpperCase() === "POST" && getApiPath(url) === "/api/assets";

type AssetsApiCursor = {
  value?: string;
  id?: string;
  sort?: string;
};

type AssetsApiListPayload = {
  rows?: Array<{ id?: string; name?: string }>;
  hasMore?: boolean;
  nextCursor?: AssetsApiCursor | null;
  error?: string;
};

type AssetListEntry = {
  id: string;
  name?: string;
};

type AssetCreateSlotResult =
  | {
      ok: true;
      initialAssetCount: number;
      remainingAssetCount: number;
      deletedCount: number;
    }
  | {
      ok: false;
      initialAssetCount: number;
      remainingAssetCount: number;
      deletedCount: number;
      reason: string;
    };

const isPrefixedTestAsset = (name?: string) => typeof name === "string" && name.startsWith(TEST_ASSET_PREFIX);

const listAllAssets = async (page: Page) => {
  const entries = new Map<string, AssetListEntry>();
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
      throw new Error(`asset list failed: status=${response.status()} body=${error}`);
    }

    for (const row of payload?.rows ?? []) {
      if (row?.id) {
        entries.set(row.id, {
          id: row.id,
          name: row.name,
        });
      }
    }

    if (!payload?.hasMore || !payload.nextCursor?.value || !payload.nextCursor?.id || !payload.nextCursor?.sort) {
      break;
    }

    cursor = payload.nextCursor;
  }

  return [...entries.values()];
};

const listAllAssetIds = async (page: Page) => {
  const assets = await listAllAssets(page);
  return assets.map((asset) => asset.id);
};

const ensureAssetCreateSlot = async (page: Page, maxBeforeCreate = 2): Promise<AssetCreateSlotResult> => {
  const assets = await listAllAssets(page);
  const nonTestAssets = assets.filter((asset) => !isPrefixedTestAsset(asset.name));

  if (nonTestAssets.length > 0) {
    return {
      ok: false,
      initialAssetCount: assets.length,
      remainingAssetCount: assets.length,
      deletedCount: 0,
      reason: `critical-flow requires an isolated E2E user; found ${nonTestAssets.length} non-test asset(s) (only ${TEST_ASSET_PREFIX}* assets are allowed)`,
    };
  }

  if (assets.length <= maxBeforeCreate) {
    return {
      ok: true,
      initialAssetCount: assets.length,
      remainingAssetCount: assets.length,
      deletedCount: 0,
    };
  }

  const candidateAssets = assets.slice(maxBeforeCreate).filter((asset) => isPrefixedTestAsset(asset.name));
  let deletedCount = 0;

  for (const asset of candidateAssets) {
    const response = await page.request.delete("/api/assets", {
      data: { id: asset.id },
    });

    if (response.status() === 200 || response.status() === 404) {
      deletedCount += 1;
      continue;
    }

    const body = await response.text().catch(() => "(empty body)");
    throw new Error(`asset pre-cleanup delete failed: assetId=${asset.id} status=${response.status()} body=${body}`);
  }

  const remainingAssetCount = assets.length - deletedCount;
  if (remainingAssetCount > maxBeforeCreate) {
    return {
      ok: false,
      initialAssetCount: assets.length,
      remainingAssetCount,
      deletedCount,
      reason: `asset pre-cleanup blocked: account has ${assets.length} assets, only prefixed test assets (${TEST_ASSET_PREFIX}) are deletable, remaining=${remainingAssetCount}`,
    };
  }

  return {
    ok: true,
    initialAssetCount: assets.length,
    remainingAssetCount,
    deletedCount,
  };
};

const parseDashboardAssetCount = async (page: Page) => {
  const rawValue = await page.getByTestId("dashboard-kpi-assets-value").innerText();
  const onlyDigits = rawValue.replace(/[^0-9]/g, "");
  return Number.parseInt(onlyDigits || "0", 10);
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

const loginDeterministically = async (page: Page, email: string, password: string) => {
  const loginForm = page.locator("form[data-testid='login-form']");
  const emailInput = page.locator("input[name='email'][data-testid='login-email']");
  const passwordInput = page.locator("input[name='password'][data-testid='login-password']");
  const submitButton = page.locator("button[data-testid='login-submit']");

  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await loginForm.waitFor({ state: "visible", timeout: 30000 });
  await page.waitForFunction(
    () => {
      const form = document.querySelector("form[data-testid='login-form']");
      const emailEl = document.querySelector("input[name='email'][data-testid='login-email']");
      const passwordEl = document.querySelector("input[name='password'][data-testid='login-password']");
      if (!(form instanceof HTMLFormElement) || !(emailEl instanceof HTMLInputElement) || !(passwordEl instanceof HTMLInputElement)) {
        return false;
      }

      const reactKeys = [...Object.keys(form), ...Object.keys(emailEl), ...Object.keys(passwordEl)];
      const hydrated = reactKeys.some((key) => key.startsWith("__reactFiber$") || key.startsWith("__reactProps$"));
      return hydrated && emailEl.isConnected && passwordEl.isConnected;
    },
    { timeout: 30000 },
  );
  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await passwordInput.waitFor({ state: "visible", timeout: 15000 });
  await expect(emailInput).toBeEnabled({ timeout: 15000 });
  await expect(passwordInput).toBeEnabled({ timeout: 15000 });

  await emailInput.fill(email);
  await expect(emailInput).toHaveValue(email, { timeout: 5000 });

  await passwordInput.fill(password);
  await expect(passwordInput).toHaveValue(password, { timeout: 5000 });

  const submitted = await page
    .evaluate(
      ({ nextEmail, nextPassword }) => {
        const form = document.querySelector("form[data-testid='login-form']") as HTMLFormElement | null;
        const emailEl = document.querySelector("input[name='email'][data-testid='login-email']") as HTMLInputElement | null;
        const passwordEl = document.querySelector("input[name='password'][data-testid='login-password']") as HTMLInputElement | null;
        const submitEl = document.querySelector("button[data-testid='login-submit']") as HTMLButtonElement | null;

        if (!form || !emailEl || !passwordEl) {
          return false;
        }

        if (emailEl.value !== nextEmail) {
          emailEl.value = nextEmail;
          emailEl.dispatchEvent(new Event("input", { bubbles: true }));
          emailEl.dispatchEvent(new Event("change", { bubbles: true }));
        }

        if (passwordEl.value !== nextPassword) {
          passwordEl.value = nextPassword;
          passwordEl.dispatchEvent(new Event("input", { bubbles: true }));
          passwordEl.dispatchEvent(new Event("change", { bubbles: true }));
        }

        if (!emailEl.value.trim() || !passwordEl.value) {
          return false;
        }

        form.requestSubmit(submitEl ?? undefined);
        return true;
      },
      { nextEmail: email, nextPassword: password },
    )
    .catch(() => false);

  if (!submitted) {
    await submitButton.click();
  }

  const outcome = await Promise.race([
    page.waitForURL(/\/dashboard(?:\?.*)?$/, { timeout: 20000 }).then(() => "dashboard" as const),
    page.getByTestId("dashboard-root").waitFor({ state: "visible", timeout: 20000 }).then(() => "dashboard" as const),
    page
      .waitForFunction(() => {
        const messageEl = document.querySelector("[data-testid='login-message']");
        if (messageEl instanceof HTMLElement) {
          const style = window.getComputedStyle(messageEl);
          if (style.display !== "none" && style.visibility !== "hidden" && (messageEl.textContent || "").trim()) {
            return true;
          }
        }

        const invalidInput = document.querySelector(
          "form[data-testid='login-form'] input:invalid",
        ) as HTMLInputElement | null;
        return Boolean(invalidInput?.validationMessage);
      }, { timeout: 20000 })
      .then(() => "error" as const),
  ]).catch(() => "timeout" as const);

  if (outcome === "dashboard" || page.url().includes("/dashboard")) {
    return;
  }

  const emailValue = await emailInput.inputValue().catch(() => "");
  const passwordValue = await passwordInput.inputValue().catch(() => "");
  const validationMessage = await page
    .evaluate(() => {
      const loginMessage = (document.querySelector("[data-testid='login-message']")?.textContent || "").trim();
      if (loginMessage) {
        return loginMessage;
      }

      const invalidInput = document.querySelector(
        "form[data-testid='login-form'] input:invalid",
      ) as HTMLInputElement | null;
      return (invalidInput?.validationMessage || "").trim();
    })
    .catch(() => "");
  const submitEnabled = await submitButton.isEnabled().catch(() => false);

  throw new Error(
    `login failed: url=${page.url()} emailLen=${emailValue.length} passwordLen=${passwordValue.length} validation=${JSON.stringify(
      validationMessage || "(none)",
    )} submitEnabled=${submitEnabled}`,
  );
};

const openDashboard = async (page: Page) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForURL(/\/dashboard(?:\?.*)?$/, { timeout: 30000 });
  await page.getByTestId("dashboard-kpi-assets-card").waitFor({ state: "visible", timeout: 30000 });
};

const waitForHydratedAssetCreateForm = async (page: Page) => {
  await page.getByTestId("asset-create-form").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForFunction(
    () => {
      const form = document.querySelector("[data-testid='asset-create-form']");
      const nameInput = document.querySelector("[data-testid='asset-name-input']");
      const categorySelect = document.querySelector("[data-testid='asset-category-select']");
      if (!(form instanceof HTMLFormElement) || !(nameInput instanceof HTMLInputElement) || !(categorySelect instanceof HTMLSelectElement)) {
        return false;
      }

      const reactKeys = [...Object.keys(form), ...Object.keys(nameInput), ...Object.keys(categorySelect)];
      const hydrated = reactKeys.some((key) => key.startsWith("__reactFiber$") || key.startsWith("__reactProps$"));
      return hydrated && nameInput.isConnected && categorySelect.isConnected;
    },
    { timeout: 15000 },
  );
};

const submitAssetCreateFormDeterministically = async (
  page: Page,
  expectedName: string,
  expectedCategory: string,
  expectedBrand: string,
  expectedModel: string,
) => {
  const submitted = await page
    .evaluate(
      ({ name, category, brand, model }) => {
        const form = document.querySelector("[data-testid='asset-create-form']") as HTMLFormElement | null;
        const nameInput = document.querySelector("[data-testid='asset-name-input']") as HTMLInputElement | null;
        const categorySelect = document.querySelector("[data-testid='asset-category-select']") as HTMLSelectElement | null;
        const brandInput = document.querySelector("[data-testid='asset-brand-input']") as HTMLInputElement | null;
        const modelInput = document.querySelector("[data-testid='asset-model-input']") as HTMLInputElement | null;
        const submitButton = document.querySelector("[data-testid='asset-submit']") as HTMLButtonElement | null;

        if (!form || !nameInput || !categorySelect || !brandInput || !modelInput) {
          return false;
        }

        if (nameInput.value !== name) {
          nameInput.value = name;
          nameInput.dispatchEvent(new Event("input", { bubbles: true }));
          nameInput.dispatchEvent(new Event("change", { bubbles: true }));
        }

        if (brandInput.value !== brand) {
          brandInput.value = brand;
          brandInput.dispatchEvent(new Event("input", { bubbles: true }));
          brandInput.dispatchEvent(new Event("change", { bubbles: true }));
        }

        if (modelInput.value !== model) {
          modelInput.value = model;
          modelInput.dispatchEvent(new Event("input", { bubbles: true }));
          modelInput.dispatchEvent(new Event("change", { bubbles: true }));
        }

        if (categorySelect.value !== category) {
          categorySelect.value = category;
          categorySelect.dispatchEvent(new Event("input", { bubbles: true }));
          categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
        }

        if (!nameInput.value.trim() || !categorySelect.value.trim()) {
          return false;
        }

        form.requestSubmit(submitButton ?? undefined);
        return true;
      },
      { name: expectedName, category: expectedCategory, brand: expectedBrand, model: expectedModel },
    )
    .catch(() => false);

  if (!submitted) {
    await page.getByTestId("asset-submit").click();
  }
};

test(
  "critical flow: login -> create asset -> verify asset on dashboard -> logout",
  async ({ page }, testInfo) => {
    const email = criticalFlowEnv.E2E_EMAIL;
    const password = criticalFlowEnv.E2E_PASSWORD;
    ensureUsableLoginCredentials(email, password);

    const runId = `${Date.now()}-${testInfo.workerIndex}`;
    const assetName = `${TEST_ASSET_PREFIX}${runId}`;

    await loginDeterministically(page, email, password);
    await page.getByTestId("dashboard-root").waitFor({ state: "visible", timeout: 30000 });
    await page.getByTestId("dashboard-content").waitFor({ state: "visible", timeout: 30000 });

    const slotResult = await ensureAssetCreateSlot(page);
    if (!slotResult.ok) {
      // This flow must run on isolated E2E credentials to avoid touching real user assets.
      test.skip(
        true,
        `${slotResult.reason}. Configure E2E_EMAIL/E2E_PASSWORD to a dedicated clean test account to run this flow safely.`,
      );
    }
    const assetCountBeforeCreate = slotResult.remainingAssetCount;

    const assetsListResponsePromise = page
      .waitForResponse(
        (response) => response.request().method().toUpperCase() === "GET" && getApiPath(response.url()) === "/api/assets",
        { timeout: 45000 },
      )
      .catch(() => null);
    await page.goto("/assets", { waitUntil: "domcontentloaded", timeout: 30000 });
    await assetsListResponsePromise;
    await page.getByTestId("assets-root").waitFor({ state: "visible", timeout: 30000 });
    await page.getByTestId("assets-list-section").waitFor({ state: "visible", timeout: 30000 });
    await waitForHydratedAssetCreateForm(page);

    const createNameInput = page.getByTestId("asset-name-input");
    const createCategorySelect = page.getByTestId("asset-category-select");
    const createBrandInput = page.getByTestId("asset-brand-input");
    const createModelInput = page.getByTestId("asset-model-input");

    const assetBrand = "TestBrand";
    const assetModel = "TestModel";

    await createNameInput.fill(assetName);
    await createBrandInput.fill(assetBrand);
    await createModelInput.fill(assetModel);
    await createCategorySelect.selectOption({ value: "Elektronik" });
    await expect(createNameInput).toHaveValue(assetName, { timeout: 5000 });
    await expect(createCategorySelect).toHaveValue("Elektronik", { timeout: 5000 });

    const createResponsePromise = page.waitForResponse(
      (response) => {
        const request = response.request();
        return isAssetsCreateRequest(request.url(), request.method());
      },
      { timeout: 45000 },
    );
    await submitAssetCreateFormDeterministically(page, assetName, "Elektronik", assetBrand, assetModel);

    const response = await createResponsePromise;
    const createPayload = (await response.json().catch(() => null)) as
      | { id?: string; error?: string }
      | null;

    if (!response.ok() || !createPayload?.id) {
      const body = createPayload?.error ?? (await response.text().catch(() => "(empty body)"));
      const normalizedBody = String(body).toLowerCase();
      const quotaLikeError =
        response.status() === 429 ||
        /\blimit\b|\bkota\b|\bquota\b|en fazla|plan/.test(normalizedBody);

      if (quotaLikeError) {
        test.skip(
          true,
          `critical-flow skipped: asset create blocked by account limits (status=${response.status()}). Use an isolated E2E user with free quota.`,
        );
      }

      throw new Error(`create asset failed: status=${response.status()} body=${body}`);
    }

    await expect(page.getByTestId("assets-feedback")).toContainText(/eklendi/i, { timeout: 30000 });

    const createdRow = page.locator(`[data-testid='asset-row'][data-asset-id='${createPayload.id}']`).first();
    await createdRow.waitFor({ state: "visible", timeout: 45000 });
    await expect(createdRow).toContainText(assetName, { timeout: 15000 });

    await expect
      .poll(
        async () => {
          const ids = await listAllAssetIds(page);
          return ids.includes(createPayload.id ?? "");
        },
        { timeout: 45000 },
      )
      .toBe(true);

    await expect
      .poll(async () => (await listAllAssetIds(page)).length, { timeout: 45000 })
      .toBe(assetCountBeforeCreate + 1);

    const assetCountAfterCreate = (await listAllAssetIds(page)).length;
    expect(assetCountAfterCreate).toBe(assetCountBeforeCreate + 1);

    await openDashboard(page);
    await expect
      .poll(async () => parseDashboardAssetCount(page), { timeout: 45000 })
      .toBe(assetCountAfterCreate);

    await page.getByTestId("topbar-user-menu-toggle").click();
    await page.getByTestId("topbar-signout-button").click();
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/, { timeout: 30000 });
    await page.getByTestId("login-form").waitFor({ state: "visible", timeout: 30000 });
  },
);
