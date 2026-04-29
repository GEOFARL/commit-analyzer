#!/usr/bin/env node
// Builds the Next.js app with stub env vars, so Lighthouse can audit a
// production build without real Supabase/GitHub credentials. Mirrors
// e2e/server-env-stub.ts so the same fixture surface backs both flows.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(__dirname, "..");

const APP_PORT = process.env.LH_APP_PORT ?? "3100";
const MOCK_PORT = "54321";
const APP_URL = `http://localhost:${APP_PORT}`;

const STUB_ENV = {
  APP_URL,
  API_URL: `http://127.0.0.1:${MOCK_PORT}`,
  WEB_ORIGIN: APP_URL,
  DATABASE_URL: "postgres://stub:stub@127.0.0.1:5432/stub",
  REDIS_URL: "redis://127.0.0.1:6379",
  SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
  SUPABASE_ANON_KEY: "mock-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "mock-service-role-key",
  GITHUB_CLIENT_ID: "mock-github-client-id",
  GITHUB_CLIENT_SECRET: "mock-github-client-secret",
  ENCRYPTION_KEY_BASE64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
  NEXT_PUBLIC_API_URL: `http://127.0.0.1:${MOCK_PORT}`,
  NEXT_PUBLIC_APP_URL: APP_URL,
};

const result = spawnSync("pnpm", ["exec", "next", "build"], {
  cwd: WEB_DIR,
  env: { ...process.env, ...STUB_ENV },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
