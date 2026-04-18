import "reflect-metadata";

import {
  ApiKey,
  AuditEvent,
  Commit,
  CommitFile,
  CommitQualityScore,
  LLMApiKey,
  Repository,
  SyncJob,
  User,
  buildDataSourceOptions,
} from "@commit-analyzer/database";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { CacheService } from "../../common/cache/cache.service.js";

import { GetContributorsHandler } from "./queries/get-contributors.handler.js";
import { GetContributorsQuery } from "./queries/get-contributors.query.js";
import { GetFileFrequencyHandler } from "./queries/get-file-frequency.handler.js";
import { GetFileFrequencyQuery } from "./queries/get-file-frequency.query.js";
import { GetHeatmapHandler } from "./queries/get-heatmap.handler.js";
import { GetHeatmapQuery } from "./queries/get-heatmap.query.js";
import { GetQualityScoresHandler } from "./queries/get-quality-scores.handler.js";
import { GetQualityScoresQuery } from "./queries/get-quality-scores.query.js";
import { GetQualityTrendsHandler } from "./queries/get-quality-trends.handler.js";
import { GetQualityTrendsQuery } from "./queries/get-quality-trends.query.js";
import { GetSummaryHandler } from "./queries/get-summary.handler.js";
import { GetSummaryQuery } from "./queries/get-summary.query.js";
import { GetTimelineHandler } from "./queries/get-timeline.handler.js";
import { GetTimelineQuery } from "./queries/get-timeline.query.js";
import { AnalyticsCacheService } from "./services/analytics-cache.service.js";

const SKIP = process.env.SKIP_INTEGRATION === "1";

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const REPO_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

/** Noop Redis stub — cache always misses so handlers hit SQL every time. */
const noopRedis = {
  get: vi.fn(() => Promise.resolve(null)),
  set: vi.fn(() => Promise.resolve("OK")),
  del: vi.fn(() => Promise.resolve(0)),
  scan: vi.fn(() => Promise.resolve(["0", []])),
  incr: vi.fn(() => Promise.resolve(1)),
};

describe.skipIf(SKIP)("Git-analysis query handlers (integration)", () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  let cache: AnalyticsCacheService;

  let timelineHandler: GetTimelineHandler;
  let heatmapHandler: GetHeatmapHandler;
  let qualityScoresHandler: GetQualityScoresHandler;
  let qualityTrendsHandler: GetQualityTrendsHandler;
  let contributorsHandler: GetContributorsHandler;
  let fileFrequencyHandler: GetFileFrequencyHandler;
  let summaryHandler: GetSummaryHandler;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16").start();

    const baseOptions = buildDataSourceOptions({
      url: container.getConnectionUri(),
    });
    ds = new DataSource({
      ...baseOptions,
      entities: [
        AuditEvent,
        ApiKey,
        Commit,
        CommitFile,
        CommitQualityScore,
        LLMApiKey,
        Repository,
        SyncJob,
        User,
      ],
    });
    await ds.initialize();

    await ds.query(`CREATE SCHEMA IF NOT EXISTS auth`);
    await ds.query(
      `CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb)`,
    );
    await ds.query(
      `CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT NULL::uuid $$ LANGUAGE sql STABLE`,
    );

    await ds.runMigrations();

    await ds.query(
      `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users`,
    );
    for (const table of [
      "users",
      "repositories",
      "api_keys",
      "llm_api_keys",
      "audit_events",
      "commits",
      "commit_files",
      "commit_quality_scores",
      "sync_jobs",
    ]) {
      await ds.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }

    // Seed users
    await ds.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, '{}'::jsonb)`,
      [USER_ID, "user@example.com"],
    );
    await ds.query(
      `INSERT INTO public.users (id, email, username) VALUES ($1, $2, $3)`,
      [USER_ID, "user@example.com", "user"],
    );

    // Seed repository
    await ds.query(
      `INSERT INTO repositories (id, user_id, github_repo_id, full_name, default_branch, is_connected)
       VALUES ($1, $2, 12345, 'user/repo', 'main', true)`,
      [REPO_ID, USER_ID],
    );

    // Seed commits across different days/hours
    const commits = [
      { sha: "aaa1", name: "Alice", email: "alice@ex.com", date: "2025-01-06 09:00:00+00", ins: 10, del: 2, files: 3 },
      { sha: "aaa2", name: "Alice", email: "alice@ex.com", date: "2025-01-06 14:00:00+00", ins: 5, del: 1, files: 1 },
      { sha: "bbb1", name: "Bob",   email: "bob@ex.com",   date: "2025-01-07 10:00:00+00", ins: 20, del: 5, files: 4 },
      { sha: "bbb2", name: "Bob",   email: "bob@ex.com",   date: "2025-01-07 22:00:00+00", ins: 3, del: 0, files: 1 },
      { sha: "ccc1", name: "Alice", email: "alice@ex.com", date: "2025-01-08 09:00:00+00", ins: 8, del: 3, files: 2 },
    ];

    for (const c of commits) {
      await ds.query(
        `INSERT INTO commits (repository_id, sha, author_name, author_email, message, subject, insertions, deletions, files_changed, authored_at)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9)`,
        [REPO_ID, c.sha, c.name, c.email, `commit ${c.sha}`, c.ins, c.del, c.files, c.date],
      );
    }

    // Seed quality scores
    const scores = [
      { sha: "aaa1", conventional: true, type: "feat", score: 85 },
      { sha: "aaa2", conventional: true, type: "fix", score: 70 },
      { sha: "bbb1", conventional: false, type: null, score: 40 },
      { sha: "bbb2", conventional: true, type: "chore", score: 55 },
      { sha: "ccc1", conventional: true, type: "feat", score: 90 },
    ];

    for (const s of scores) {
      await ds.query(
        `INSERT INTO commit_quality_scores (commit_id, is_conventional, cc_type, overall_score, details)
         SELECT c.id, $2, $3, $4, '{}'::jsonb
           FROM commits c
          WHERE c.sha = $1 AND c.repository_id = $5`,
        [s.sha, s.conventional, s.type, s.score, REPO_ID],
      );
    }

    // Seed commit_files — path frequencies used by file-churn query:
    //   src/app.ts      → 3 commits (aaa1, bbb1, ccc1)
    //   src/auth.ts     → 2 commits (aaa1, bbb1)
    //   README.md       → 2 commits (aaa2, bbb2)
    //   src/lib/util.ts → 1 commit  (ccc1)
    const files: Array<{ sha: string; path: string; status: string }> = [
      { sha: "aaa1", path: "src/app.ts", status: "modified" },
      { sha: "aaa1", path: "src/auth.ts", status: "added" },
      { sha: "aaa2", path: "README.md", status: "modified" },
      { sha: "bbb1", path: "src/app.ts", status: "modified" },
      { sha: "bbb1", path: "src/auth.ts", status: "modified" },
      { sha: "bbb2", path: "README.md", status: "modified" },
      { sha: "ccc1", path: "src/app.ts", status: "modified" },
      { sha: "ccc1", path: "src/lib/util.ts", status: "added" },
    ];
    for (const f of files) {
      await ds.query(
        `INSERT INTO commit_files (commit_id, file_path, additions, deletions, status)
         SELECT c.id, $2, 5, 1, $3
           FROM commits c
          WHERE c.sha = $1 AND c.repository_id = $4`,
        [f.sha, f.path, f.status, REPO_ID],
      );
    }

    const cacheService = new CacheService(noopRedis as never);
    cache = new AnalyticsCacheService(cacheService);

    timelineHandler = new GetTimelineHandler(ds, cache);
    heatmapHandler = new GetHeatmapHandler(ds, cache);
    qualityScoresHandler = new GetQualityScoresHandler(ds, cache);
    qualityTrendsHandler = new GetQualityTrendsHandler(ds, cache);
    contributorsHandler = new GetContributorsHandler(ds, cache);
    fileFrequencyHandler = new GetFileFrequencyHandler(ds, cache);
    summaryHandler = new GetSummaryHandler(ds, cache);
  }, 120_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (container) await container.stop();
  }, 30_000);

  // ── Timeline ─────────────────────────────────────────────────

  it("timeline returns commits per day", async () => {
    const items = await timelineHandler.execute(
      new GetTimelineQuery(REPO_ID, USER_ID, "day"),
    );
    expect(items.length).toBe(3);
    expect(items[0]!.date).toBe("2025-01-06");
    expect(items[0]!.count).toBe(2);
    expect(items[1]!.count).toBe(2);
    expect(items[2]!.count).toBe(1);
  });

  it("timeline groups by week", async () => {
    const items = await timelineHandler.execute(
      new GetTimelineQuery(REPO_ID, USER_ID, "week"),
    );
    expect(items.length).toBeGreaterThanOrEqual(1);
    const total = items.reduce((sum, p) => sum + p.count, 0);
    expect(total).toBe(5);
  });

  // ── Heatmap ──────────────────────────────────────────────────

  it("heatmap returns day × hour cells", async () => {
    const items = await heatmapHandler.execute(
      new GetHeatmapQuery(REPO_ID, USER_ID),
    );
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const cell of items) {
      expect(cell.day).toBeGreaterThanOrEqual(0);
      expect(cell.day).toBeLessThanOrEqual(6);
      expect(cell.hour).toBeGreaterThanOrEqual(0);
      expect(cell.hour).toBeLessThanOrEqual(23);
      expect(cell.count).toBeGreaterThan(0);
    }
  });

  // ── Quality scores ───────────────────────────────────────────

  it("quality scores returns score buckets", async () => {
    const items = await qualityScoresHandler.execute(
      new GetQualityScoresQuery(REPO_ID, USER_ID),
    );
    expect(items.length).toBeGreaterThanOrEqual(1);

    const byBucket = Object.fromEntries(items.map((b) => [b.bucket, b.count]));
    expect(byBucket["good"]).toBe(2);
    expect(byBucket["average"]).toBe(2);
    expect(byBucket["poor"]).toBe(1);
  });

  // ── Quality trends ───────────────────────────────────────────

  it("quality trends returns avg score per day", async () => {
    const items = await qualityTrendsHandler.execute(
      new GetQualityTrendsQuery(REPO_ID, USER_ID, "day"),
    );
    expect(items.length).toBe(3);
    expect(items[0]!.avgScore).toBeCloseTo(77.5, 1);
  });

  // ── Contributors ─────────────────────────────────────────────

  it("contributors returns top authors", async () => {
    const items = await contributorsHandler.execute(
      new GetContributorsQuery(REPO_ID, USER_ID, 10),
    );
    expect(items.length).toBe(2);
    expect(items[0]!.authorName).toBe("Alice");
    expect(items[0]!.commitCount).toBe(3);
    expect(items[0]!.avgQuality).toBeGreaterThan(0);
    expect(items[1]!.authorName).toBe("Bob");
    expect(items[1]!.commitCount).toBe(2);
  });

  // ── File frequency ───────────────────────────────────────────

  it("file frequency returns top files by change count desc", async () => {
    const items = await fileFrequencyHandler.execute(
      new GetFileFrequencyQuery(REPO_ID, USER_ID, 10),
    );
    expect(items.map((i) => i.filePath)).toEqual([
      "src/app.ts",
      "README.md",
      "src/auth.ts",
      "src/lib/util.ts",
    ]);
    const byPath = Object.fromEntries(items.map((i) => [i.filePath, i.changeCount]));
    expect(byPath["src/app.ts"]).toBe(3);
    expect(byPath["README.md"]).toBe(2);
    expect(byPath["src/auth.ts"]).toBe(2);
    expect(byPath["src/lib/util.ts"]).toBe(1);
  });

  it("file frequency respects the limit", async () => {
    const items = await fileFrequencyHandler.execute(
      new GetFileFrequencyQuery(REPO_ID, USER_ID, 2),
    );
    expect(items).toHaveLength(2);
    expect(items[0]!.filePath).toBe("src/app.ts");
  });

  // ── Summary ──────────────────────────────────────────────────

  it("summary returns aggregate totals", async () => {
    const result = await summaryHandler.execute(
      new GetSummaryQuery(REPO_ID, USER_ID),
    );
    expect(result.totalCommits).toBe(5);
    expect(result.totalContributors).toBe(2);
    expect(result.avgQuality).toBeGreaterThan(0);
    expect(result.ccCompliancePercent).toBe(80);
  });

  // ── Ownership guard ──────────────────────────────────────────

  it("throws 404 for repo not owned by user", async () => {
    await expect(
      timelineHandler.execute(
        new GetTimelineQuery(REPO_ID, OTHER_USER_ID, "day"),
      ),
    ).rejects.toThrow("repository not found");
  });
});
