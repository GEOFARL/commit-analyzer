#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

import { STUB_ENV, APP_URL, APP_PORT_NUM } from "./stub-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(WEB_DIR, "../..");
const REPORT_DIR = resolve(REPO_ROOT, "lighthouse");

const PERF_THRESHOLD = Number(process.env.LH_PERF_THRESHOLD ?? 0.8);
const PRESETS = (process.env.LH_PRESETS ?? "desktop,mobile").split(",").map((s) => s.trim()).filter(Boolean);
const RUNS = Math.max(1, Number(process.env.LH_RUNS ?? (process.env.CI ? 3 : 1)));

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
// Must match MOCK_SEEDED_REPO_ID in apps/web/e2e/mock-server.ts.
const MOCK_SEEDED_REPO_ID = "11111111-1111-4111-8111-111111111111";

const cookieValue = "base64-" + Buffer.from(JSON.stringify(MOCK_SESSION)).toString("base64url");

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

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function runAudit(chrome, page, preset, runs) {
  const url = `${APP_URL}${page.path}`;
  const subdir = resolve(REPORT_DIR, preset);
  await mkdir(subdir, { recursive: true });

  const results = [];
  for (let i = 0; i < runs; i++) {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: ["json", "html"],
      onlyCategories: ["performance"],
      logLevel: "error",
      preset,
      extraHeaders: page.auth ? { Cookie: `${SUPABASE_COOKIE_NAME}=${cookieValue}` } : undefined,
    });
    if (!result) throw new Error(`No result for ${page.name} (${preset}) run ${i + 1}`);
    results.push(result);
  }

  const scores = results.map((r) => r.lhr.categories.performance.score ?? 0);
  const score = median(scores);
  const pickedIdx = scores
    .map((s, i) => ({ i, diff: Math.abs(s - score) }))
    .sort((a, b) => a.diff - b.diff)[0].i;
  const [jsonReport, htmlReport] = results[pickedIdx].report;
  await writeFile(resolve(subdir, `${page.name}.json`), jsonReport);
  await writeFile(resolve(subdir, `${page.name}.html`), htmlReport);
  return { score, scores };
}

async function main() {
  await rm(REPORT_DIR, { recursive: true, force: true });
  await mkdir(REPORT_DIR, { recursive: true });

  log("starting mock API server…");
  const mock = spawn("pnpm", ["exec", "tsx", "scripts/start-mock-server.ts"], {
    cwd: WEB_DIR,
    env: { ...process.env, ...STUB_ENV },
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipeOutput(mock, "mock");
  await waitForLine(mock, "mock-server-ready");
  log(`mock API ready on :54321`);

  log(`starting Next.js (production) on :${APP_PORT_NUM}…`);
  const next = spawn("pnpm", ["exec", "next", "start", "--port", String(APP_PORT_NUM)], {
    cwd: WEB_DIR,
    env: { ...process.env, ...STUB_ENV, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipeOutput(next, "next");

  let chrome = null;
  try {
    await waitForUrl(`${APP_URL}/en`, 60_000);
    log("Next.js ready");

    chrome = await chromeLauncher.launch({
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
    });

    const summary = [];
    let failed = false;

    for (const preset of PRESETS) {
      log(`── preset: ${preset} (median of ${RUNS}) ──`);
      for (const page of PAGES) {
        log(`auditing ${page.name} (${page.path}) [${preset}]…`);
        try {
          const { score, scores } = await runAudit(chrome, page, preset, RUNS);
          const passed = score >= PERF_THRESHOLD;
          if (!passed) failed = true;
          summary.push({ preset, page: page.name, score, scores, passed });
          const runs = scores.map((s) => (s * 100).toFixed(0)).join(", ");
          log(`  → median ${(score * 100).toFixed(0)} (runs: ${runs}) ${passed ? "PASS" : "FAIL"}`);
        } catch (err) {
          failed = true;
          summary.push({ preset, page: page.name, score: 0, scores: [], passed: false, error: String(err) });
          log(`  → ERROR ${err}`);
        }
      }
    }

    const lines = [
      "# Lighthouse perf summary",
      "",
      `Threshold: ${(PERF_THRESHOLD * 100).toFixed(0)} · Median of ${RUNS}`,
      "",
    ];
    for (const preset of PRESETS) {
      lines.push(`## ${preset}`, "", "| Page | Perf (median) | Runs | Status |", "| --- | ---: | --- | :---: |");
      for (const r of summary.filter((x) => x.preset === preset)) {
        const runs = r.scores.map((s) => (s * 100).toFixed(0)).join(", ");
        lines.push(`| ${r.page} | ${(r.score * 100).toFixed(0)} | ${runs} | ${r.passed ? "✅" : "❌"} |`);
      }
      lines.push("");
    }
    const summaryText = lines.join("\n");
    await writeFile(resolve(REPORT_DIR, "summary.md"), summaryText);
    log("\n" + summaryText);

    if (failed) {
      process.exitCode = 1;
    }
  } finally {
    log("shutting down…");
    if (chrome) {
      try {
        await chrome.kill();
      } catch {
        // chrome already exited
      }
    }
    await Promise.all([killProcess(next), killProcess(mock)]);
  }
}

main().catch((err) => {
  process.stderr.write(`[lh] fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
