import { defineConfig, devices } from "@playwright/test";

import { loadTestEnv } from "./scripts/load-test-env.cjs";

loadTestEnv();

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./testsprite/tests",
  testMatch: ["**/*.spec.ts"],
  testIgnore: ["**/*.test.ts"],
  fullyParallel: true,
  outputDir: "testsprite/test-results/artifacts",
  preserveOutput: "failures-only",
  reporter: [
    ["list"],
    ["json", { outputFile: "testsprite/test-results/playwright-results.json" }],
    ["junit", { outputFile: "testsprite/test-results/playwright-junit.xml" }],
    ["html", { outputFolder: "testsprite/test-results/playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- -p 3000",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
