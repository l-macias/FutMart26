import { defineConfig, devices } from "@playwright/test";

import { e2eDatabaseUrl } from "./scripts/e2e-database-url.mjs";

const databaseUrl = e2eDatabaseUrl();
const sharedEnvironment = {
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
  BETTER_AUTH_SECRET: "e2e-only-secret-with-at-least-32-characters",
  BETTER_AUTH_URL: "http://127.0.0.1:4000",
  AUTH_REQUIRE_EMAIL_VERIFICATION: "true",
  AUTH_RATE_LIMIT_TEST_SCALE: "100",
  NEXT_PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION: "true",
  NEXT_PUBLIC_API_URL: "http://127.0.0.1:4000",
  WEB_URL: "http://127.0.0.1:3000",
  ADMIN_URL: "http://127.0.0.1:3001",
  SUPPORT_EMAIL: "support@example.test",
  OBJECT_STORAGE_ENABLED: "false",
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @football/api dev",
      url: "http://127.0.0.1:4000/ready",
      env: sharedEnvironment,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @football/web dev",
      url: "http://127.0.0.1:3000/auth",
      env: sharedEnvironment,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @football/admin dev",
      url: "http://127.0.0.1:3001",
      env: sharedEnvironment,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
