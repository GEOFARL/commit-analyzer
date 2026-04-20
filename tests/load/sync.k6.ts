// Phase 2 exit criterion (docs/12-roadmap.md): connecting a real ~1000-commit
// repository finishes in ≤ 60 s. This script automates that gate.
//
// Usage:
//   K6_API_BASE_URL=https://api.staging.example.com \
//   K6_AUTH_TOKEN=<supabase-jwt> \
//   K6_GITHUB_REPO_ID=<numeric-github-id-of-seeded-repo> \
//   k6 run tests/load/sync.k6.ts
//
// Requirements:
// - k6 v0.52+ (native TypeScript support).
// - The authenticated user's GitHub OAuth grant must include the seeded repo.
// - The seeded repo must hold ≥ 1000 commits (see tests/load/README.md).

import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = (__ENV.K6_API_BASE_URL ?? "http://localhost:3001").replace(
  /\/+$/,
  "",
);
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN;
const GITHUB_REPO_ID = __ENV.K6_GITHUB_REPO_ID;
const POLL_INTERVAL_MS = Number(__ENV.K6_POLL_INTERVAL_MS ?? 2000);
const TIMEOUT_MS = Number(__ENV.K6_SYNC_TIMEOUT_MS ?? 60_000);

const syncDuration = new Trend("sync_duration_ms", true);

export const options = {
  scenarios: {
    one_user_one_sync: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "2m",
    },
  },
  thresholds: {
    // Phase 2 exit criterion: a single 1000-commit sync must complete in
    // ≤ 60 s end-to-end.
    sync_duration_ms: ["max<60000"],
    checks: ["rate==1.0"],
  },
};

type ConnectedRepo = {
  id: string;
  githubRepoId: number;
  fullName: string;
  lastSyncedAt: string | null;
};

const headers = () => ({
  Authorization: `Bearer ${AUTH_TOKEN}`,
  "Content-Type": "application/json",
});

const connect = (githubRepoId: number): ConnectedRepo => {
  const res = http.post(
    `${BASE_URL}/repos/${githubRepoId}/connect`,
    null,
    { headers: headers() },
  );
  if (!check(res, { "connect → 201": (r) => r.status === 201 })) {
    fail(`connect failed: ${res.status} ${res.body}`);
  }
  return res.json() as ConnectedRepo;
};

const lastSyncedAt = (repoId: string): string | null => {
  const res = http.get(`${BASE_URL}/repos`, { headers: headers() });
  if (res.status !== 200) return null;
  const body = res.json() as { items: ConnectedRepo[] };
  const repo = body.items.find((r) => r.id === repoId);
  return repo?.lastSyncedAt ?? null;
};

export default function syncPerf(): void {
  if (!AUTH_TOKEN) fail("K6_AUTH_TOKEN env var is required");
  if (!GITHUB_REPO_ID) fail("K6_GITHUB_REPO_ID env var is required");

  const start = Date.now();
  const repo = connect(Number(GITHUB_REPO_ID));

  const deadline = start + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const at = lastSyncedAt(repo.id);
    if (at !== null) {
      const elapsed = Date.now() - start;
      syncDuration.add(elapsed);
      check(elapsed, { "sync ≤ 60s": (ms) => ms <= TIMEOUT_MS });
      return;
    }
    sleep(POLL_INTERVAL_MS / 1000);
  }

  syncDuration.add(Date.now() - start);
  fail(`sync did not complete within ${TIMEOUT_MS}ms`);
}
