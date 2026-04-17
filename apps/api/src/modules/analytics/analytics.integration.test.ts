import "reflect-metadata";

import {
  ApiKey,
  AuditEvent,
  Commit,
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
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AnalyticsService } from "./analytics.service.js";

const SKIP = process.env.SKIP_INTEGRATION === "1";

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const REPO_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe.skipIf(SKIP)("AnalyticsService (integration)", () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  let service: AnalyticsService;

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

    service = new AnalyticsService(ds);
  }, 120_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (container) await container.stop();
  }, 30_000);

  // ── Timeline ─────────────────────────────────────────────────

  it("timeline returns commits per day", async () => {
    const items = await service.timeline(REPO_ID, USER_ID, "day");
    expect(items.length).toBe(3); // Jan 6, 7, 8
    expect(items[0]!.date).toBe("2025-01-06");
    expect(items[0]!.count).toBe(2);
    expect(items[1]!.count).toBe(2);
    expect(items[2]!.count).toBe(1);
  });

  it("timeline groups by week", async () => {
    const items = await service.timeline(REPO_ID, USER_ID, "week");
    expect(items.length).toBeGreaterThanOrEqual(1);
    const total = items.reduce((sum, p) => sum + p.count, 0);
    expect(total).toBe(5);
  });

  // ── Heatmap ──────────────────────────────────────────────────

  it("heatmap returns day × hour cells", async () => {
    const items = await service.heatmap(REPO_ID, USER_ID);
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const cell of items) {
      expect(cell.day).toBeGreaterThanOrEqual(0);
      expect(cell.day).toBeLessThanOrEqual(6);
      expect(cell.hour).toBeGreaterThanOrEqual(0);
      expect(cell.hour).toBeLessThanOrEqual(23);
      expect(cell.count).toBeGreaterThan(0);
    }
  });

  // ── Quality distribution ─────────────────────────────────────

  it("quality distribution returns score buckets", async () => {
    const items = await service.qualityDistribution(REPO_ID, USER_ID);
    expect(items.length).toBeGreaterThanOrEqual(1);

    const byBucket = Object.fromEntries(items.map((b) => [b.bucket, b.count]));
    // good: 85, 90 = 2; average: 70, 55 = 2; poor: 40 = 1
    expect(byBucket["good"]).toBe(2);
    expect(byBucket["average"]).toBe(2);
    expect(byBucket["poor"]).toBe(1);
  });

  // ── Quality trend ────────────────────────────────────────────

  it("quality trend returns avg score per day", async () => {
    const items = await service.qualityTrend(REPO_ID, USER_ID, "day");
    expect(items.length).toBe(3);
    // Jan 6: avg(85,70) = 77.5
    expect(items[0]!.avgScore).toBeCloseTo(77.5, 1);
  });

  // ── Contributors ─────────────────────────────────────────────

  it("contributors returns top authors", async () => {
    const items = await service.contributors(REPO_ID, USER_ID, 10);
    expect(items.length).toBe(2);
    // Alice has 3 commits, Bob has 2
    expect(items[0]!.authorName).toBe("Alice");
    expect(items[0]!.commitCount).toBe(3);
    expect(items[0]!.avgQuality).toBeGreaterThan(0);
    expect(items[1]!.authorName).toBe("Bob");
    expect(items[1]!.commitCount).toBe(2);
  });

  // ── Files churn ──────────────────────────────────────────────

  it("files churn returns empty (no file-level data yet)", async () => {
    const items = await service.filesChurn(REPO_ID, USER_ID, 10);
    expect(items).toEqual([]);
  });

  // ── Summary ──────────────────────────────────────────────────

  it("summary returns aggregate totals", async () => {
    const result = await service.summary(REPO_ID, USER_ID);
    expect(result.totalCommits).toBe(5);
    expect(result.totalContributors).toBe(2);
    expect(result.avgQuality).toBeGreaterThan(0);
    // 4 out of 5 are conventional = 80%
    expect(result.ccCompliancePercent).toBe(80);
  });

  // ── Ownership guard ──────────────────────────────────────────

  it("throws 404 for repo not owned by user", async () => {
    await expect(
      service.timeline(REPO_ID, OTHER_USER_ID, "day"),
    ).rejects.toThrow("repository not found");
  });
});
