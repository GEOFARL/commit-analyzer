#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(WEB_DIR, "../..");
const REPORT_DIR = resolve(REPO_ROOT, "lighthouse");

const APP_PORT = Number(process.env.LH_APP_PORT ?? 3100);
const MOCK_PORT = 54321;
const APP_URL = `http://localhost:${APP_PORT}`;
const PERF_THRESHOLD = Number(process.env.LH_PERF_THRESHOLD ?? 0.8);

const SUPABASE_COOKIE_NAME = "sb-127-auth-token";
const MOCK_ACCESS_TOKEN = "mock-access-token";
const MOCK_SESSION = {
  access_token: MOCK_ACCESS_TOKEN,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 9_999_999_999,
  refresh_token: "mock-refresh-token",
  user: {
    id: "test-user-id",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    email_confirmed_at: "2024-01-01T00:00:00Z",
    user_metadata: { full_name: "Test User", avatar_url: null },
    app_metadata: { provider: "github" },
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
};
const MOCK_SEEDED_REPO_ID = "11111111-1111-4111-8111-111111111111";

const cookieValue = "base64-" + Buffer.from(JSON.stringify(MOCK_SESSION)).toString("base64url");

const SERVER_ENV = {
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

const PAGES = [
  { name: "landing", path: "/en", auth: false },
  { name: "login", path: "/en/login", auth: false },
  { name: "dashboard", path: "/en/dashboard", auth: true },
  { name: "repositories", path: "/en/repositories", auth: true },
  { name: "repo-detail", path: `/en/repositories/${MOCK_SEEDED_REPO_ID}`, auth: true },
  { name: "generate", path: "/en/generate", auth: true },
  { name: "policies", path: "/en/policies", auth: true },
  { name: "settings", path: "/en/settings", auth: true },
];

const log = (msg) => process.stdout.write(`[lh] ${msg}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForUrl(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.status < 500) return;
    } catch {
      // not yet up
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForLine(child, marker, timeoutMs = 60_000) {
  return new Promise((resolveP, rejectP) => {
    const timer = setTimeout(() => rejectP(new Error(`Timed out waiting for "${marker}"`)), timeoutMs);
    const onData = (chunk) => {
      if (chunk.toString().includes(marker)) {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        resolveP();
      }
    };
    child.stdout.on("data", onData);
  });
}

function pipeOutput(child, prefix) {
  child.stdout?.on("data", (c) => process.stdout.write(`[${prefix}] ${c}`));
  child.stderr?.on("data", (c) => process.stderr.write(`[${prefix}] ${c}`));
}

async function killProcess(child) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await new Promise((r) => {
    const t = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // already dead
      }
      r();
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(t);
      r();
    });
  });
}

async function runAudit(page) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const url = `${APP_URL}${page.path}`;
    const opts = {
      port: chrome.port,
      output: ["json", "html"],
      onlyCategories: ["performance"],
      logLevel: "error",
      preset: "desktop",
      extraHeaders: page.auth ? { Cookie: `${SUPABASE_COOKIE_NAME}=${cookieValue}` } : undefined,
    };
    const result = await lighthouse(url, opts);
    if (!result) throw new Error(`No result for ${page.name}`);
    const [jsonReport, htmlReport] = result.report;
    await writeFile(resolve(REPORT_DIR, `${page.name}.json`), jsonReport);
    await writeFile(resolve(REPORT_DIR, `${page.name}.html`), htmlReport);
    const score = result.lhr.categories.performance.score ?? 0;
    return score;
  } finally {
    await chrome.kill();
  }
}

async function main() {
  await rm(REPORT_DIR, { recursive: true, force: true });
  await mkdir(REPORT_DIR, { recursive: true });

  log("starting mock API server…");
  const mock = spawn("pnpm", ["exec", "tsx", "scripts/start-mock-server.ts"], {
    cwd: WEB_DIR,
    env: { ...process.env, ...SERVER_ENV },
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipeOutput(mock, "mock");
  await waitForLine(mock, "mock-server-ready");
  log(`mock API ready on :${MOCK_PORT}`);

  log(`starting Next.js (production) on :${APP_PORT}…`);
  const next = spawn("pnpm", ["exec", "next", "start", "--port", String(APP_PORT)], {
    cwd: WEB_DIR,
    env: { ...process.env, ...SERVER_ENV, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipeOutput(next, "next");

  try {
    await waitForUrl(`${APP_URL}/en`, 60_000);
    log("Next.js ready");

    const summary = [];
    let failed = false;

    for (const page of PAGES) {
      log(`auditing ${page.name} (${page.path})…`);
      try {
        const score = await runAudit(page);
        const passed = score >= PERF_THRESHOLD;
        if (!passed) failed = true;
        summary.push({ page: page.name, score, passed });
        log(`  → ${(score * 100).toFixed(0)} ${passed ? "PASS" : "FAIL"}`);
      } catch (err) {
        failed = true;
        summary.push({ page: page.name, score: 0, passed: false, error: String(err) });
        log(`  → ERROR ${err}`);
      }
    }

    const summaryText = [
      "# Lighthouse perf summary",
      "",
      `Threshold: ${(PERF_THRESHOLD * 100).toFixed(0)}`,
      "",
      "| Page | Perf | Status |",
      "| --- | ---: | :---: |",
      ...summary.map((r) => `| ${r.page} | ${(r.score * 100).toFixed(0)} | ${r.passed ? "✅" : "❌"} |`),
      "",
    ].join("\n");
    await writeFile(resolve(REPORT_DIR, "summary.md"), summaryText);
    log("\n" + summaryText);

    if (failed) {
      process.exitCode = 1;
    }
  } finally {
    log("shutting down…");
    await Promise.all([killProcess(next), killProcess(mock)]);
  }
}

main().catch((err) => {
  process.stderr.write(`[lh] fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
