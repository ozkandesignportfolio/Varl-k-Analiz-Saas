import { test, expect } from "@playwright/test";

const login = async (page: import("@playwright/test").Page, email: string, password: string) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("login-form")).toBeVisible({ timeout: 30000 });
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/(dashboard|assets)(\?.*)?$/, { timeout: 45000 });
};

test.describe("assets visibility verification", () => {
  test.setTimeout(180000);

  test("existing assets render in list and grid", async ({ page }) => {
    await login(page, process.env.E2E_EMAIL ?? "", process.env.E2E_PASSWORD ?? "");

    await page.goto("/assets", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("assets-list-section")).toBeVisible({ timeout: 45000 });

    const rows = page.locator("[data-testid='asset-row']");
    await expect
      .poll(async () => rows.count(), { timeout: 45000 })
      .toBeGreaterThan(0);

    await page.getByRole("button", { name: /Grid/i }).click();
    await expect
      .poll(async () => rows.count(), { timeout: 30000 })
      .toBeGreaterThan(0);

    await expect(page.getByText(/Henuz varlik eklenmedi|Henüz varlýk eklenmedi/i)).toHaveCount(0);
  });

  test("create and update refreshes asset list", async ({ page }) => {
    await login(page, process.env.PREMIUM_EMAIL ?? "", process.env.PREMIUM_PASSWORD ?? "");

    await page.goto("/assets", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("asset-create-form")).toBeVisible({ timeout: 45000 });

    const runId = Date.now();
    const createdName = `Codex Verify ${runId}`;
    const updatedName = `${createdName} Updated`;

    await page.getByTestId("asset-name-input").fill(createdName);
    await page.getByTestId("asset-category-select").selectOption("Elektronik");
    await page.getByTestId("asset-submit").click();

    await expect(page.getByTestId("assets-feedback")).toContainText(/eklendi/i, { timeout: 45000 });

    const createdRow = page.locator("[data-testid='asset-row']", { hasText: createdName });
    await expect
      .poll(async () => createdRow.count(), { timeout: 45000 })
      .toBeGreaterThan(0);

    await createdRow.first().getByRole("button", { name: /Duzenle|Düzenle/i }).click();
    const editForm = page.getByTestId("asset-edit-form");
    await expect(editForm).toBeVisible({ timeout: 30000 });

    await editForm.locator("input[name='name']").fill(updatedName);
    await editForm.getByRole("button", { name: /Kaydet/i }).click();

    await expect(page.getByTestId("assets-feedback")).toContainText(/guncellendi|güncellendi/i, { timeout: 45000 });

    const updatedRow = page.locator("[data-testid='asset-row']", { hasText: updatedName });
    await expect
      .poll(async () => updatedRow.count(), { timeout: 45000 })
      .toBeGreaterThan(0);

    await page.getByRole("button", { name: /Grid/i }).click();
    await expect
      .poll(async () => updatedRow.count(), { timeout: 30000 })
      .toBeGreaterThan(0);
  });
});
