import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";

import { Server as SocketIOServer, type Namespace } from "socket.io";

export const MOCK_PORT = 54321;
export const MOCK_ACCESS_TOKEN = "mock-access-token";

const MOCK_USER = {
  id: "test-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.com",
  email_confirmed_at: "2024-01-01T00:00:00Z",
  user_metadata: { full_name: "Test User", avatar_url: null },
  app_metadata: { provider: "github" },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// Pre-populated so the bypass path (page.route interception) works without
// going through the real token-exchange endpoint.
const validTokens = new Set<string>([MOCK_ACCESS_TOKEN]);

// ─── Repositories & analytics fixtures ──────────────────────────────────────

type GithubRepoFixture = {
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
  htmlUrl: string;
  connected: boolean;
  pushedAt: string | null;
  stargazersCount: number;
  archived: boolean;
};

type ConnectedRepoFixture = {
  id: string;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  lastSyncedAt: string | null;
  createdAt: string;
};

// Stable UUIDs for tests to navigate to deterministic analytics URLs.
export const MOCK_SEEDED_REPO_ID = "11111111-1111-4111-8111-111111111111";
export const MOCK_FRESH_GITHUB_REPO_ID = 1001;
export const MOCK_SEEDED_GITHUB_REPO_ID = 1002;

const GITHUB_REPOS: GithubRepoFixture[] = [
  {
    githubRepoId: MOCK_FRESH_GITHUB_REPO_ID,
    owner: "acme",
    name: "fresh-repo",
    fullName: "acme/fresh-repo",
    private: false,
    defaultBranch: "main",
    description: "A fresh repository ready to be connected.",
    htmlUrl: "https://github.com/acme/fresh-repo",
    connected: false,
    pushedAt: "2024-03-01T00:00:00.000Z",
    stargazersCount: 5,
    archived: false,
  },
  {
    githubRepoId: MOCK_SEEDED_GITHUB_REPO_ID,
    owner: "acme",
    name: "seeded-repo",
    fullName: "acme/seeded-repo",
    private: false,
    defaultBranch: "main",
    description: "Already connected; pre-loaded with analytics fixtures.",
    htmlUrl: "https://github.com/acme/seeded-repo",
    connected: true,
    pushedAt: "2024-02-01T00:00:00.000Z",
    stargazersCount: 12,
    archived: false,
  },
];

const connectedRepos = new Map<string, ConnectedRepoFixture>();

const ANALYTICS_SUMMARY = {
  totalCommits: 1234,
  totalContributors: 7,
  avgQuality: 82.5,
  ccCompliancePercent: 91,
};

const ANALYTICS_TIMELINE = [
  { date: "2024-01-29", count: 12 },
  { date: "2024-01-30", count: 18 },
  { date: "2024-01-31", count: 9 },
  { date: "2024-02-01", count: 22 },
  { date: "2024-02-02", count: 15 },
];

const ANALYTICS_HEATMAP = [
  { day: 1, hour: 9, count: 5 },
  { day: 2, hour: 10, count: 8 },
  { day: 3, hour: 14, count: 3 },
  { day: 4, hour: 16, count: 11 },
  { day: 5, hour: 11, count: 7 },
];

const ANALYTICS_QUALITY_DIST = [
  { bucket: "good", count: 80 },
  { bucket: "average", count: 40 },
  { bucket: "poor", count: 10 },
];

const ANALYTICS_QUALITY_TREND = [
  { date: "2024-01-29", avgScore: 78.2 },
  { date: "2024-01-30", avgScore: 80.1 },
  { date: "2024-01-31", avgScore: 79.5 },
  { date: "2024-02-01", avgScore: 83.4 },
  { date: "2024-02-02", avgScore: 82.5 },
];

const ANALYTICS_CONTRIBUTORS = [
  {
    authorName: "Jane Doe",
    authorEmail: "jane@example.com",
    commitCount: 128,
    avgQuality: 85.4,
  },
  {
    authorName: "John Smith",
    authorEmail: "john@example.com",
    commitCount: 94,
    avgQuality: 79.1,
  },
];

const ANALYTICS_FILES = [
  { filePath: "src/index.ts", changeCount: 120 },
  { filePath: "apps/api/src/app.module.ts", changeCount: 88 },
  { filePath: "packages/contracts/src/analytics.contract.ts", changeCount: 54 },
];

// ─── Policy fixtures ────────────────────────────────────────────────────────

type MockPolicyRule = {
  id: string;
  ruleType: string;
  ruleValue: unknown;
};

type MockPolicy = {
  id: string;
  repositoryId: string;
  name: string;
  isActive: boolean;
  rules: MockPolicyRule[];
  createdAt: string;
  updatedAt: string;
};

const policies = new Map<string, MockPolicy>();

const listPoliciesForRepo = (repoId: string): MockPolicy[] =>
  Array.from(policies.values())
    .filter((p) => p.repositoryId === repoId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const cloneRuleInput = (rule: { ruleType: string; ruleValue: unknown }): MockPolicyRule => ({
  id: randomUUID(),
  ruleType: rule.ruleType,
  ruleValue: rule.ruleValue,
});

const ccFirstLineRegex = /^([a-z]+)(?:\(([^)]+)\))?(!?): (.+)$/;

type RuleResult = { ruleType: string; passed: boolean; message?: string };

const validateAgainstRules = (
  message: string,
  rules: MockPolicyRule[],
): { passed: boolean; results: RuleResult[] } => {
  const firstLine = (message.split("\n")[0] ?? "").trim();
  const match = ccFirstLineRegex.exec(firstLine);
  const parsed = match
    ? { type: match[1] as string, subject: match[4] as string }
    : null;
  const subjectForLen = parsed?.subject ?? firstLine;

  const results: RuleResult[] = rules.map((rule) => {
    switch (rule.ruleType) {
      case "allowedTypes": {
        const list = (rule.ruleValue as string[]) ?? [];
        const passed = parsed != null && list.includes(parsed.type);
        return passed
          ? { ruleType: "allowedTypes", passed: true }
          : {
              ruleType: "allowedTypes",
              passed: false,
              message: `Type '${parsed?.type ?? "unknown"}' is not in the allowed list.`,
            };
      }
      case "maxSubjectLength": {
        const max = rule.ruleValue as number;
        const passed = subjectForLen.length <= max;
        return passed
          ? { ruleType: "maxSubjectLength", passed: true }
          : {
              ruleType: "maxSubjectLength",
              passed: false,
              message: `Subject is ${subjectForLen.length} characters; max is ${max}.`,
            };
      }
      default:
        return { ruleType: rule.ruleType, passed: true };
    }
  });

  return { passed: results.every((r) => r.passed), results };
};

// ─── Sync simulation state ──────────────────────────────────────────────────

type PendingSync = { syncJobId: string };

const pendingSyncs = new Map<string, PendingSync>();

const drivePendingSync = (
  ns: Namespace,
  repositoryId: string,
  pending: PendingSync,
): void => {
  const total = 10;
  let processed = 0;
  const tick = () => {
    processed += 2;
    if (processed >= total) {
      ns.to(repositoryId).emit("sync.completed", {
        repositoryId,
        syncJobId: pending.syncJobId,
        commitsProcessed: total,
      });
      return;
    }
    ns.to(repositoryId).emit("sync.progress", {
      repositoryId,
      syncJobId: pending.syncJobId,
      commitsProcessed: processed,
      totalCommits: total,
    });
    setTimeout(tick, 250);
  };
  setTimeout(tick, 150);
};

// ─── HTTP helpers ───────────────────────────────────────────────────────────

// The browser makes authenticated cross-origin requests from the Next.js dev
// server (localhost:3000) to this mock (127.0.0.1:54321). Without permissive
// CORS headers + OPTIONS preflight support, React Query's client-side
// refetches and the Connect POST fail silently.
const corsHeaders = (req: IncomingMessage): Record<string, string> => ({
  "Access-Control-Allow-Origin": req.headers.origin ?? "*",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    req.headers["access-control-request-headers"] ??
    "authorization, content-type",
  "Access-Control-Max-Age": "600",
});

const sendJson = (
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  body: unknown,
): void => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...corsHeaders(req),
  });
  res.end(JSON.stringify(body));
};

const isAuthorized = (req: IncomingMessage): boolean => {
  const auth = req.headers.authorization ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  return token.length > 0 && validTokens.has(token);
};

const drainBody = (req: IncomingMessage): Promise<void> =>
  new Promise((resolve) => {
    req.on("data", () => {});
    req.on("end", () => resolve());
    req.on("error", () => resolve());
  });

const readJsonBody = (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });

// ─── Server & socket state ──────────────────────────────────────────────────

let server: Server | null = null;
let io: SocketIOServer | null = null;
let syncNamespace: Namespace | null = null;

const handleRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${MOCK_PORT}`);
  const { pathname, searchParams } = url;

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  if (
    req.method === "POST" &&
    pathname === "/auth/v1/token" &&
    searchParams.get("grant_type") === "pkce"
  ) {
    validTokens.add(MOCK_ACCESS_TOKEN);
    const session = {
      access_token: MOCK_ACCESS_TOKEN,
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user: MOCK_USER,
    };
    req.resume();
    sendJson(req, res, 200, session);
    return;
  }

  if (req.method === "GET" && pathname === "/auth/v1/user") {
    if (isAuthorized(req)) sendJson(req, res, 200, MOCK_USER);
    else sendJson(req, res, 401, { message: "not authenticated" });
    return;
  }

  if (
    req.method === "POST" &&
    (pathname === "/auth/sync" || pathname === "/auth/sign-in-event")
  ) {
    await drainBody(req);
    sendJson(req, res, 200, { ok: true });
    return;
  }

  // ── Repositories ─────────────────────────────────────────────────────────
  if (req.method === "GET" && pathname === "/repos/github") {
    if (!isAuthorized(req)) {
      sendJson(req, res, 401, { message: "unauthorized" });
      return;
    }
    // Reflect current connection state so the UI sees freshly-connected repos.
    const items = GITHUB_REPOS.map((repo) => ({
      ...repo,
      connected: Array.from(connectedRepos.values()).some(
        (c) => c.githubRepoId === repo.githubRepoId,
      ),
    }));
    sendJson(req, res, 200, { items });
    return;
  }

  if (req.method === "GET" && pathname === "/repos") {
    if (!isAuthorized(req)) {
      sendJson(req, res, 401, { message: "unauthorized" });
      return;
    }
    sendJson(req, res, 200, { items: Array.from(connectedRepos.values()) });
    return;
  }

  const connectMatch = /^\/repos\/(\d+)\/connect$/.exec(pathname);
  if (req.method === "POST" && connectMatch) {
    if (!isAuthorized(req)) {
      sendJson(req, res, 401, { message: "unauthorized" });
      return;
    }
    await drainBody(req);
    const githubRepoId = Number(connectMatch[1]);
    const source = GITHUB_REPOS.find((r) => r.githubRepoId === githubRepoId);
    if (!source) {
      sendJson(req, res, 404, { message: "not found" });
      return;
    }
    const existing = Array.from(connectedRepos.values()).find(
      (r) => r.githubRepoId === githubRepoId,
    );
    if (existing) {
      sendJson(req, res, 409, { message: "already connected" });
      return;
    }
    const connected: ConnectedRepoFixture = {
      id: randomUUID(),
      githubRepoId: source.githubRepoId,
      owner: source.owner,
      name: source.name,
      fullName: source.fullName,
      defaultBranch: source.defaultBranch,
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
    };
    connectedRepos.set(connected.id, connected);
    // Queue a sync — driven once a WS subscriber joins the room, so the banner
    // always observes the full progress → completed sequence regardless of
    // navigation timing between list and analytics pages.
    pendingSyncs.set(connected.id, { syncJobId: `mock-sync-${connected.id}` });
    sendJson(req, res, 201, connected);
    return;
  }

  const resyncMatch = /^\/repos\/([0-9a-fA-F-]+)\/resync$/.exec(pathname);
  if (req.method === "POST" && resyncMatch) {
    if (!isAuthorized(req)) {
      sendJson(req, res, 401, { message: "unauthorized" });
      return;
    }
    await drainBody(req);
    const repoId = resyncMatch[1] as string;
    if (!connectedRepos.has(repoId)) {
      sendJson(req, res, 404, { message: "not found" });
      return;
    }
    pendingSyncs.set(repoId, { syncJobId: `mock-sync-${repoId}-${Date.now()}` });
    sendJson(req, res, 202, {});
    return;
  }

  const disconnectMatch = /^\/repos\/([0-9a-fA-F-]+)$/.exec(pathname);
  if (req.method === "DELETE" && disconnectMatch) {
    if (!isAuthorized(req)) {
      sendJson(req, res, 401, { message: "unauthorized" });
      return;
    }
    const repoId = disconnectMatch[1] as string;
    if (!connectedRepos.delete(repoId)) {
      sendJson(req, res, 404, { message: "not found" });
      return;
    }
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  // ── Analytics ────────────────────────────────────────────────────────────
  const analyticsMatch = /^\/repos\/([0-9a-fA-F-]+)\/analytics\/(.+)$/.exec(
    pathname,
  );
  if (req.method === "GET" && analyticsMatch) {
    if (!isAuthorized(req)) {
      sendJson(req, res, 401, { message: "unauthorized" });
      return;
    }
    const repoId = analyticsMatch[1] as string;
    const sub = analyticsMatch[2] as string;
    if (!connectedRepos.has(repoId)) {
      sendJson(req, res, 404, { message: "not found" });
      return;
    }
    switch (sub) {
      case "summary":
        sendJson(req, res, 200, ANALYTICS_SUMMARY);
        return;
      case "timeline":
        sendJson(req, res, 200, { items: ANALYTICS_TIMELINE });
        return;
      case "heatmap":
        sendJson(req, res, 200, { items: ANALYTICS_HEATMAP });
        return;
      case "quality":
        sendJson(req, res, 200, { items: ANALYTICS_QUALITY_DIST });
        return;
      case "quality/trends":
        sendJson(req, res, 200, { items: ANALYTICS_QUALITY_TREND });
        return;
      case "contributors":
        sendJson(req, res, 200, { items: ANALYTICS_CONTRIBUTORS });
        return;
      case "files":
        sendJson(req, res, 200, { items: ANALYTICS_FILES });
        return;
    }
    sendJson(req, res, 404, { message: "not found" });
    return;
  }

  // ── Policies ─────────────────────────────────────────────────────────────
  const policiesListMatch = /^\/repos\/([0-9a-fA-F-]+)\/policies$/.exec(
    pathname,
  );
  if (policiesListMatch) {
    if (!isAuthorized(req)) {
      sendJson(req, res, 401, { message: "unauthorized" });
      return;
    }
    const repoId = policiesListMatch[1] as string;
    if (!connectedRepos.has(repoId)) {
      sendJson(req, res, 404, { message: "not found" });
      return;
    }
    if (req.method === "GET") {
      sendJson(req, res, 200, { items: listPoliciesForRepo(repoId) });
      return;
    }
    if (req.method === "POST") {
      const body = (await readJsonBody(req)) as {
        name?: unknown;
        rules?: unknown;
      };
      const name = typeof body.name === "string" ? body.name : "";
      const rulesInput = Array.isArray(body.rules)
        ? (body.rules as { ruleType: string; ruleValue: unknown }[])
        : [];
      const now = new Date().toISOString();
      const created: MockPolicy = {
        id: randomUUID(),
        repositoryId: repoId,
        name,
        isActive: false,
        rules: rulesInput.map(cloneRuleInput),
        createdAt: now,
        updatedAt: now,
      };
      policies.set(created.id, created);
      sendJson(req, res, 201, created);
      return;
    }
  }

  const policyDetailMatch =
    /^\/repos\/([0-9a-fA-F-]+)\/policies\/([0-9a-fA-F-]+)$/.exec(pathname);
  if (policyDetailMatch) {
    if (!isAuthorized(req)) {
      sendJson(req, res, 401, { message: "unauthorized" });
      return;
    }
    const repoId = policyDetailMatch[1] as string;
    const policyId = policyDetailMatch[2] as string;
    const policy = policies.get(policyId);
    if (!policy || policy.repositoryId !== repoId) {
      await drainBody(req);
      sendJson(req, res, 404, { message: "not found" });
      return;
    }
    if (req.method === "GET") {
      sendJson(req, res, 200, policy);
      return;
    }
    if (req.method === "PATCH") {
      const body = (await readJsonBody(req)) as {
        name?: unknown;
        rules?: unknown;
      };
      if (typeof body.name === "string") policy.name = body.name;
      if (Array.isArray(body.rules)) {
        policy.rules = (
          body.rules as { ruleType: string; ruleValue: unknown }[]
        ).map(cloneRuleInput);
      }
      policy.updatedAt = new Date().toISOString();
      sendJson(req, res, 200, policy);
      return;
    }
    if (req.method === "DELETE") {
      await drainBody(req);
      if (policy.isActive) {
        sendJson(req, res, 400, { message: "cannot delete active policy" });
        return;
      }
      policies.delete(policyId);
      res.writeHead(204, corsHeaders(req));
      res.end();
      return;
    }
  }

  const policyActivateMatch =
    /^\/repos\/([0-9a-fA-F-]+)\/policies\/([0-9a-fA-F-]+)\/activate$/.exec(
      pathname,
    );
  if (req.method === "POST" && policyActivateMatch) {
    if (!isAuthorized(req)) {
      sendJson(req, res, 401, { message: "unauthorized" });
      return;
    }
    await drainBody(req);
    const repoId = policyActivateMatch[1] as string;
    const policyId = policyActivateMatch[2] as string;
    const target = policies.get(policyId);
    if (!target || target.repositoryId !== repoId) {
      sendJson(req, res, 404, { message: "not found" });
      return;
    }
    // Atomic swap: deactivate any currently active policy on the same repo.
    for (const p of policies.values()) {
      if (p.repositoryId === repoId && p.id !== policyId && p.isActive) {
        p.isActive = false;
        p.updatedAt = new Date().toISOString();
      }
    }
    target.isActive = true;
    target.updatedAt = new Date().toISOString();
    sendJson(req, res, 200, target);
    return;
  }

  const policyValidateMatch =
    /^\/repos\/([0-9a-fA-F-]+)\/policies\/([0-9a-fA-F-]+)\/validate$/.exec(
      pathname,
    );
  if (req.method === "POST" && policyValidateMatch) {
    if (!isAuthorized(req)) {
      sendJson(req, res, 401, { message: "unauthorized" });
      return;
    }
    const repoId = policyValidateMatch[1] as string;
    const policyId = policyValidateMatch[2] as string;
    const target = policies.get(policyId);
    if (!target || target.repositoryId !== repoId) {
      await drainBody(req);
      sendJson(req, res, 404, { message: "not found" });
      return;
    }
    const body = (await readJsonBody(req)) as { message?: unknown };
    if (typeof body.message !== "string" || body.message.length === 0) {
      sendJson(req, res, 400, { message: "message required" });
      return;
    }
    sendJson(req, res, 200, validateAgainstRules(body.message, target.rules));
    return;
  }

  res.writeHead(404, corsHeaders(req));
  res.end();
};

// ─── Lifecycle ──────────────────────────────────────────────────────────────

const resetState = (): void => {
  connectedRepos.clear();
  connectedRepos.set(MOCK_SEEDED_REPO_ID, {
    id: MOCK_SEEDED_REPO_ID,
    githubRepoId: MOCK_SEEDED_GITHUB_REPO_ID,
    owner: "acme",
    name: "seeded-repo",
    fullName: "acme/seeded-repo",
    defaultBranch: "main",
    lastSyncedAt: "2024-02-02T00:00:00.000Z",
    createdAt: "2024-02-01T00:00:00.000Z",
  });
  pendingSyncs.clear();
  policies.clear();
};

export const startMockServer = (): Promise<void> =>
  new Promise((resolve, reject) => {
    resetState();
    server = createServer((req, res) => {
      void handleRequest(req, res).catch(() => {
        if (!res.headersSent) sendJson(req, res, 500, { message: "mock error" });
      });
    });

    io = new SocketIOServer(server, {
      cors: { origin: true, credentials: true },
    });
    syncNamespace = io.of("/sync");
    syncNamespace.use((socket, next) => {
      const auth = socket.handshake.auth as { token?: unknown } | undefined;
      const token = auth?.token;
      if (typeof token === "string" && token.length > 0) return next();
      next(new Error("unauthorized"));
    });
    syncNamespace.on("connection", (socket) => {
      socket.on("join", async (payload: { repositoryId?: string }) => {
        const repositoryId = payload?.repositoryId;
        if (!repositoryId) return;
        await socket.join(repositoryId);
        const pending = pendingSyncs.get(repositoryId);
        if (!pending || !syncNamespace) return;
        pendingSyncs.delete(repositoryId);
        drivePendingSync(syncNamespace, repositoryId, pending);
      });
    });

    server.listen(MOCK_PORT, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

export const stopMockServer = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const done = () => {
      server = null;
      io = null;
      syncNamespace = null;
      resetState();
      resolve();
    };
    // Socket.io's `close()` closes the attached HTTP server too — calling
    // `server.close()` afterwards throws "Server is not running" and trips
    // Playwright's teardown even when every test passed.
    if (io) {
      void io.close((err) => (err ? reject(err) : done()));
    } else if (server) {
      server.close((err) => (err ? reject(err) : done()));
    } else {
      done();
    }
  });
