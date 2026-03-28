const { test, expect } = require('playwright/test');

test('smoke home', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await expect(page).toHaveURL(/login/);
});
