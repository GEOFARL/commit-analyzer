import "reflect-metadata";

import {
  ApiKey,
  AuditEvent,
  Commit,
  CommitFile,
  CommitQualityScore,
  GenerationHistory,
  LLMApiKey,
  Policy,
  PolicyRule,
  Repository,
  SyncJob,
  User,
  buildDataSourceOptions,
  createGenerationHistoryRepository,
  type GenerationHistoryRepository,
} from "@commit-analyzer/database";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const SKIP = process.env.SKIP_INTEGRATION === "1";

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const REPO_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

describe.skipIf(SKIP)("GenerationHistoryRepository (integration)", () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  let repo: GenerationHistoryRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16").start();

    const baseOptions = buildDataSourceOptions({
      url: container.getConnectionUri(),
    });
    ds = new DataSource({
      ...baseOptions,
      entities: [
        ApiKey,
        AuditEvent,
        Commit,
        CommitFile,
        CommitQualityScore,
        GenerationHistory,
        LLMApiKey,
        Policy,
        PolicyRule,
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

    await ds.query(`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users`);
    for (const table of [
      "users",
      "repositories",
      "generation_history",
    ]) {
      await ds.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }

    for (const [id, email, username] of [
      [USER_ID, "user@example.com", "user"],
      [OTHER_USER_ID, "other@example.com", "other"],
    ] as const) {
      await ds.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, '{}'::jsonb)`,
        [id, email],
      );
      await ds.query(
        `INSERT INTO public.users (id, email, username) VALUES ($1, $2, $3)`,
        [id, email, username],
      );
    }
    await ds.query(
      `INSERT INTO repositories (id, user_id, github_repo_id, full_name, is_connected) VALUES ($1, $2, '42', 'u/r', true)`,
      [REPO_ID, USER_ID],
    );

    repo = createGenerationHistoryRepository(ds);
  }, 120_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (container) await container.stop();
  }, 30_000);

  beforeEach(async () => {
    await ds.query(`DELETE FROM generation_history`);
  });

  it("insert persists all scoped fields", async () => {
    const saved = await repo.createOne({
      userId: USER_ID,
      repositoryId: REPO_ID,
      diffHash: "sha256:abc",
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens: 123,
      completionTokens: 45,
      suggestions: [
        {
          type: "feat",
          scope: "api",
          subject: "add endpoint",
          body: null,
          footer: null,
          compliant: true,
        },
      ],
      policyId: null,
    });

    expect(saved.id).toBeTypeOf("string");
    expect(saved.createdAt).toBeInstanceOf(Date);

    const fetched = await repo.findOneByOrFail({ id: saved.id });
    expect(fetched.userId).toBe(USER_ID);
    expect(fetched.repositoryId).toBe(REPO_ID);
    expect(fetched.diffHash).toBe("sha256:abc");
    expect(fetched.provider).toBe("openai");
    expect(fetched.model).toBe("gpt-4o-mini");
    expect(fetched.promptTokens).toBe(123);
    expect(fetched.completionTokens).toBe(45);
    expect(fetched.policyId).toBeNull();
    expect(Array.isArray(fetched.suggestions)).toBe(true);
  });

  it("insert with null repo + null policy succeeds", async () => {
    const saved = await repo.createOne({
      userId: USER_ID,
      diffHash: "sha256:def",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      promptTokens: 10,
      completionTokens: 20,
      suggestions: [],
    });

    const fetched = await repo.findOneByOrFail({ id: saved.id });
    expect(fetched.repositoryId).toBeNull();
    expect(fetched.policyId).toBeNull();
  });

  it("listByUser paginates by created_at DESC and scopes to user", async () => {
    const hashes = ["sha256:a", "sha256:b", "sha256:c", "sha256:d", "sha256:e"];
    const saved: Array<{ id: string; createdAt: Date }> = [];
    for (const h of hashes) {
      const row = await repo.createOne({
        userId: USER_ID,
        diffHash: h,
        provider: "openai",
        model: "gpt-4o-mini",
        promptTokens: 1,
        completionTokens: 1,
        suggestions: [],
      });
      saved.push({ id: row.id, createdAt: row.createdAt });
      // typeorm CreateDateColumn resolution is milliseconds; nudge to guarantee ordering.
      await new Promise((r) => setTimeout(r, 5));
    }

    await repo.createOne({
      userId: OTHER_USER_ID,
      diffHash: "sha256:other",
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens: 1,
      completionTokens: 1,
      suggestions: [],
    });

    const page1 = await repo.listByUser({ userId: USER_ID, limit: 2 });
    expect(page1).toHaveLength(2);
    expect(page1.every((r) => r.userId === USER_ID)).toBe(true);
    expect(page1[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(
      page1[1]!.createdAt.getTime(),
    );
    expect(page1[0]!.diffHash).toBe("sha256:e");

    const page2 = await repo.listByUser({
      userId: USER_ID,
      limit: 2,
      cursor: page1[1]!.createdAt.toISOString(),
    });
    expect(page2).toHaveLength(2);
    expect(page2.every((r) => r.userId === USER_ID)).toBe(true);
    expect(page2[0]!.createdAt.getTime()).toBeLessThan(
      page1[1]!.createdAt.getTime(),
    );
  });
});
