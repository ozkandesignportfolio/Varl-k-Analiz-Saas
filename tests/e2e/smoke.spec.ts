import { expect, test } from "@playwright/test";

test("login page renders", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByTestId("login-form")).toBeVisible();
});
