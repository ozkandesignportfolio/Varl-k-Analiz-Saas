import { expect, test } from "@playwright/test";

test("homepage and auth pages load", async ({ page }) => {
  const homeResponse = await page.goto("/");
  expect(homeResponse?.ok()).toBeTruthy();

  const loginResponse = await page.goto("/login");
  expect(loginResponse?.ok()).toBeTruthy();
  await expect(page.locator("[data-testid='login-form']")).toBeVisible();

  const signupResponse = await page.goto("/register");
  expect(signupResponse?.ok()).toBeTruthy();
  await expect(page.getByTestId("register-form")).toBeVisible();
});
