import { defineConfig, devices } from "@playwright/test";

const MOCK_PORT = 54321;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:3000",
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
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${MOCK_PORT}`,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
  },
});
