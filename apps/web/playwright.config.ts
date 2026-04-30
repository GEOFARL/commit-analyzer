import { defineConfig, devices } from "@playwright/test";

import { TEST_SERVER_ENV } from "./e2e/server-env-stub";

const MOCK_PORT = 54321;
const APP_PORT = process.env.E2E_APP_PORT ?? "3000";
const APP_URL = `http://localhost:${APP_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  webServer: {
    command: `pnpm dev --port ${APP_PORT}`,
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${MOCK_PORT}`,
      NEXT_PUBLIC_APP_URL: APP_URL,
      ...TEST_SERVER_ENV,
      // Override APP_URL/WEB_ORIGIN from TEST_SERVER_ENV so the
      // generate-proxy origin check (`req.headers.origin === WEB_ORIGIN`)
      // accepts requests when E2E_APP_PORT shifts the dev server off :3000.
      // Both vars come from the shared-types env schema (T-0.5).
      APP_URL,
      WEB_ORIGIN: APP_URL,
    },
  },
});
