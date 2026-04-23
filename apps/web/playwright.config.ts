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
      // The /api/generate-proxy route calls loadServerEnv() at module load and
      // fails the dev build hard if any var is missing. Stub the full server
      // schema so the proxy reaches the mock SSE handler. APP_URL / API_URL /
      // WEB_ORIGIN are the values the proxy actually reads; everything else is
      // schema-required filler.
      APP_URL: "http://localhost:3000",
      API_URL: `http://127.0.0.1:${MOCK_PORT}`,
      WEB_ORIGIN: "http://localhost:3000",
      DATABASE_URL: "postgres://stub:stub@127.0.0.1:5432/stub",
      REDIS_URL: "redis://127.0.0.1:6379",
      SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
      SUPABASE_ANON_KEY: "mock-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "mock-service-role-key",
      GITHUB_CLIENT_ID: "mock-github-client-id",
      GITHUB_CLIENT_SECRET: "mock-github-client-secret",
      ENCRYPTION_KEY_BASE64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    },
  },
});
