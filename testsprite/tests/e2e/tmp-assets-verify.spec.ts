import { expect, test, type Page } from "@playwright/test";
import { getSuiteEnvValues, loadTestEnv } from "../../../scripts/load-test-env.cjs";

loadTestEnv();
const { values: tmpAssetsVerifyEnv } = getSuiteEnvValues("criticalFlow");
const TEST_ASSET_PREFIX = "E2E-AV-";

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

type CreatedTestAsset = {
  id: string;
  name: string;
};

const resolveTmpAssetsVerifyCredentials = () => {
  const email = String(tmpAssetsVerifyEnv.E2E_EMAIL ?? "").trim();
  const password = String(tmpAssetsVerifyEnv.E2E_PASSWORD ?? "").trim();

  if (!email || !password) {
    throw new Error("Missing E2E credentials for tmp-assets-verify");
  }

  return { email, password };
};

const login = async (page: Page, email: string, password: string) => {
  const loginForm = page.locator("form[data-testid='login-form']");
  const emailInput = page.locator("input[name='email'][data-testid='login-email']");
  const passwordInput = page.locator("input[name='password'][data-testid='login-password']");
  const submitButton = page.locator("button[data-testid='login-submit']");
  const selectAllShortcut = process.platform === "darwin" ? "Meta+A" : "Control+A";

  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await loginForm.waitFor({ state: "visible", timeout: 30000 });
  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await passwordInput.waitFor({ state: "visible", timeout: 15000 });
  await submitButton.waitFor({ state: "visible", timeout: 15000 });
  await expect(emailInput).toBeVisible({ timeout: 15000 });
  await expect(passwordInput).toBeVisible({ timeout: 15000 });
  await expect(submitButton).toBeVisible({ timeout: 15000 });
  await expect(emailInput).toBeEnabled({ timeout: 15000 });
  await expect(passwordInput).toBeEnabled({ timeout: 15000 });
  await expect(submitButton).toBeEnabled({ timeout: 15000 });
  await expect
    .poll(() => page.evaluate(() => document.readyState), { timeout: 15000 })
    .toBe("complete");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const nodes = document.querySelectorAll("body *");
          for (const node of nodes) {
            if (!(node instanceof HTMLElement)) {
              continue;
            }

            if ((node.textContent || "").trim() !== "Compiling") {
              continue;
            }

            const style = window.getComputedStyle(node);
            if (style.display !== "none" && style.visibility !== "hidden") {
              return false;
            }
          }

          return true;
        }),
      { timeout: 15000 },
    )
    .toBe(true);

  await emailInput.click();
  await emailInput.press(selectAllShortcut);
  await emailInput.press("Backspace");
  await emailInput.pressSequentially(email, { delay: 25 });
  await expect(emailInput).toHaveValue(email, { timeout: 5000 });
  await emailInput.blur();

  await passwordInput.click();
  await passwordInput.press(selectAllShortcut);
  await passwordInput.press("Backspace");
  await passwordInput.pressSequentially(password, { delay: 25 });
  await expect(passwordInput).toHaveValue(password, { timeout: 5000 });
  await passwordInput.blur();
  await expect
    .poll(
      () =>
        Promise.all([
          emailInput.inputValue().catch(() => ""),
          passwordInput.inputValue().catch(() => ""),
        ]).then(([currentEmail, currentPassword]) => currentEmail === email && currentPassword === password),
      { timeout: 5000 },
    )
    .toBe(true);

  await submitButton.click();

  const outcome = await Promise.race([
    page.waitForURL(/\/(dashboard|assets)(?:\?.*)?$/, { timeout: 20000 }).then(() => "authed" as const),
    page.getByTestId("dashboard-root").waitFor({ state: "visible", timeout: 20000 }).then(() => "authed" as const),
    page.getByTestId("assets-root").waitFor({ state: "visible", timeout: 20000 }).then(() => "authed" as const),
  ]).catch(() => "timeout" as const);

  if (outcome === "authed" || /\/(dashboard|assets)(?:\?.*)?$/.test(page.url())) {
    return;
  }

  const [
    emailVisible,
    emailEnabled,
    passwordVisible,
    passwordEnabled,
    submitVisible,
    submitEnabled,
    emailValue,
    passwordValue,
    visibleMessage,
  ] = await Promise.all([
    emailInput.isVisible().catch(() => false),
    emailInput.isEnabled().catch(() => false),
    passwordInput.isVisible().catch(() => false),
    passwordInput.isEnabled().catch(() => false),
    submitButton.isVisible().catch(() => false),
    submitButton.isEnabled().catch(() => false),
    emailInput.inputValue().catch(() => ""),
    passwordInput.inputValue().catch(() => ""),
    page
      .evaluate(() => {
        const messages: string[] = [];
        const addVisibleText = (selector: string) => {
          const nodes = document.querySelectorAll(selector);
          for (const node of nodes) {
            if (!(node instanceof HTMLElement)) {
              continue;
            }
            const style = window.getComputedStyle(node);
            const text = (node.textContent || "").trim();
            if (style.display !== "none" && style.visibility !== "hidden" && text) {
              messages.push(text);
            }
          }
        };

        addVisibleText("[data-testid='login-message']");
        addVisibleText("[role='alert']");
        addVisibleText(".error");
        addVisibleText("[data-testid*='error']");

        const invalidInput = document.querySelector("form[data-testid='login-form'] input:invalid") as
          | HTMLInputElement
          | null;
        const validationMessage = (invalidInput?.validationMessage || "").trim();
        if (validationMessage) {
          messages.push(validationMessage);
        }

        return messages.join(" | ");
      })
      .catch(() => ""),
  ]);

  throw new Error(
    `login failed: url=${page.url()} emailVisible=${emailVisible} emailEnabled=${emailEnabled} passwordVisible=${passwordVisible} passwordEnabled=${passwordEnabled} submitVisible=${submitVisible} submitEnabled=${submitEnabled} emailLen=${emailValue.length} passwordLen=${passwordValue.length} message=${JSON.stringify(visibleMessage || "(none)")}`,
  );
};

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

const createTestAsset = async (page: Page, name: string): Promise<CreatedTestAsset> => {
  await expect(page.getByTestId("asset-create-form")).toBeVisible({ timeout: 45000 });
  await waitForHydratedAssetCreateForm(page);

  await page.getByTestId("asset-name-input").fill(name);
  await page.getByTestId("asset-category-select").selectOption({ value: "Elektronik" });
  await expect(page.getByTestId("asset-name-input")).toHaveValue(name, { timeout: 5000 });
  await expect(page.getByTestId("asset-category-select")).toHaveValue("Elektronik", { timeout: 5000 });

  const createResponsePromise = page.waitForResponse(
    (response) => {
      const request = response.request();
      return isAssetsCreateRequest(request.url(), request.method());
    },
    { timeout: 45000 },
  );

  await submitAssetCreateFormDeterministically(page, name, "Elektronik");

  const response = await createResponsePromise;
  const payload = (await response.json().catch(() => null)) as
    | { id?: string; error?: string }
    | null;

  if (!response.ok() || !payload?.id) {
    const body = payload?.error ?? (await response.text().catch(() => "(empty body)"));
    throw new Error(`create asset failed: status=${response.status()} body=${body}`);
  }

  await page.locator(`[data-testid='asset-row'][data-asset-id='${payload.id}']`).first().waitFor({ state: "visible", timeout: 45000 });

  return { id: payload.id, name };
};

const waitForHydratedAssetCreateForm = async (page: Page) => {
  const createForm = page.getByTestId("asset-create-form");
  const nameInput = page.locator("input[name='name'][data-testid='asset-name-input']");
  const categorySelect = page.locator("select[name='category'][data-testid='asset-category-select']");
  const submitButton = page.locator("button[data-testid='asset-submit']");

  try {
    await createForm.waitFor({ state: "visible", timeout: 30000 });
    await expect(nameInput).toBeVisible({ timeout: 30000 });
    await expect(categorySelect).toBeVisible({ timeout: 30000 });
    await expect(submitButton).toBeVisible({ timeout: 30000 });
    await expect(nameInput).toBeEnabled({ timeout: 30000 });
    await expect(categorySelect).toBeEnabled({ timeout: 30000 });
    await expect(submitButton).toBeEnabled({ timeout: 30000 });
  } catch {
    const [
      createFormVisible,
      nameVisible,
      nameEnabled,
      categoryVisible,
      categoryEnabled,
      submitVisible,
      submitEnabled,
    ] = await Promise.all([
      createForm.isVisible().catch(() => false),
      nameInput.isVisible().catch(() => false),
      nameInput.isEnabled().catch(() => false),
      categorySelect.isVisible().catch(() => false),
      categorySelect.isEnabled().catch(() => false),
      submitButton.isVisible().catch(() => false),
      submitButton.isEnabled().catch(() => false),
    ]);

    throw new Error(
      `asset create form not ready: url=${page.url()} createFormVisible=${createFormVisible} nameVisible=${nameVisible} nameEnabled=${nameEnabled} categoryVisible=${categoryVisible} categoryEnabled=${categoryEnabled} submitVisible=${submitVisible} submitEnabled=${submitEnabled}`,
    );
  }
};

const submitAssetCreateFormDeterministically = async (page: Page, expectedName: string, expectedCategory: string) => {
  const submitted = await page
    .evaluate(
      ({ name, category }) => {
        const form = document.querySelector("[data-testid='asset-create-form']") as HTMLFormElement | null;
        const nameInput = document.querySelector("[data-testid='asset-name-input']") as HTMLInputElement | null;
        const categorySelect = document.querySelector("[data-testid='asset-category-select']") as HTMLSelectElement | null;
        const submitButton = document.querySelector("[data-testid='asset-submit']") as HTMLButtonElement | null;

        if (!form || !nameInput || !categorySelect) {
          return false;
        }

        if (nameInput.value !== name) {
          nameInput.value = name;
          nameInput.dispatchEvent(new Event("input", { bubbles: true }));
          nameInput.dispatchEvent(new Event("change", { bubbles: true }));
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
      { name: expectedName, category: expectedCategory },
    )
    .catch(() => false);

  if (!submitted) {
    await page.getByTestId("asset-submit").click();
  }
};

const ensurePrefixedAssetForListGrid = async (page: Page) => {
  const assets = await listAllAssets(page);
  const existingPrefixed = assets.find((asset) => typeof asset.name === "string" && asset.name.startsWith(TEST_ASSET_PREFIX));

  if (existingPrefixed?.name) {
    return { targetName: existingPrefixed.name, created: null as CreatedTestAsset | null };
  }

  const created = await createTestAsset(page, `${TEST_ASSET_PREFIX}${Date.now()}`);
  return { targetName: created.name, created };
};

const cleanupCreatedAssets = async (page: Page, createdAssets: CreatedTestAsset[]) => {
  for (const asset of createdAssets) {
    if (!asset.name.startsWith(TEST_ASSET_PREFIX)) {
      continue;
    }

    const response = await page.request.delete("/api/assets", {
      data: { id: asset.id },
    });

    if (response.status() === 200 || response.status() === 404) {
      continue;
    }

    const body = await response.text().catch(() => "(empty body)");
    throw new Error(`asset cleanup delete failed: assetId=${asset.id} status=${response.status()} body=${body}`);
  }
};

test.describe("assets visibility verification", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180000);

  test("existing assets render in list and grid", async ({ page }) => {
    const { email, password } = resolveTmpAssetsVerifyCredentials();
    const createdAssets: CreatedTestAsset[] = [];

    await login(page, email, password);

    try {
      await page.goto("/assets", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("assets-list-section")).toBeVisible({ timeout: 45000 });

      const ensured = await ensurePrefixedAssetForListGrid(page);
      if (ensured.created) {
        createdAssets.push(ensured.created);
      }

      const targetRows = page.locator("[data-testid='asset-row']", { hasText: ensured.targetName });
      await expect
        .poll(async () => targetRows.count(), { timeout: 45000 })
        .toBeGreaterThan(0);

      await page.getByRole("button", { name: /Grid/i }).click();
      await expect
        .poll(async () => targetRows.count(), { timeout: 30000 })
        .toBeGreaterThan(0);

      await expect(page.getByText(/Henuz varlik eklenmedi|Henüz varlık eklenmedi/i)).toHaveCount(0);
    } finally {
      await cleanupCreatedAssets(page, createdAssets);
    }
  });

  test("create and update refreshes asset list", async ({ page }) => {
    const { email, password } = resolveTmpAssetsVerifyCredentials();
    const createdAssets: CreatedTestAsset[] = [];

    await login(page, email, password);

    try {
      await page.goto("/assets", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("asset-create-form")).toBeVisible({ timeout: 45000 });

      const runId = Date.now();
      const createdName = `${TEST_ASSET_PREFIX}${runId}`;
      const updatedName = `${createdName}-Updated`;

      const createdAsset = await createTestAsset(page, createdName);
      createdAssets.push(createdAsset);

      const createdRow = page.locator(`[data-testid='asset-row'][data-asset-id='${createdAsset.id}']`).first();
      await expect(createdRow).toContainText(createdName, { timeout: 45000 });

      await createdRow.getByRole("button", { name: /Duzenle|Düzenle/i }).click();
      const editForm = page.getByTestId("asset-edit-form");
      await expect(editForm).toBeVisible({ timeout: 30000 });

      await editForm.locator("input[name='name']").fill(updatedName);
      await editForm.getByRole("button", { name: /Kaydet/i }).click();

      await expect(editForm).toBeHidden({ timeout: 45000 });
      createdAssets[0] = { ...createdAsset, name: updatedName };

      const updatedRow = page.locator(`[data-testid='asset-row'][data-asset-id='${createdAsset.id}']`).first();
      await expect(updatedRow).toContainText(updatedName, { timeout: 45000 });

      await page.getByRole("button", { name: /Grid/i }).click();
      await expect(updatedRow).toContainText(updatedName, { timeout: 30000 });
    } finally {
      await cleanupCreatedAssets(page, createdAssets);
    }
  });
});
