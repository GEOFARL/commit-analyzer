// Full server-env schema stub for the Playwright webServer. The
// `/api/generate-proxy` route calls `loadServerEnv()` at module load and
// fails the dev build hard if any var is missing, so even the e2e setup that
// only cares about API_URL / WEB_ORIGIN has to provide values for the rest
// of the schema. Kept as a single record so future routes that read more
// server vars can extend this file instead of editing playwright.config.ts.
import { MOCK_PORT } from "./mock-server";

export const TEST_SERVER_ENV: Record<string, string> = {
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
  // 32 zero bytes, base64-encoded — schema requires exactly 32 raw bytes.
  ENCRYPTION_KEY_BASE64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
};
