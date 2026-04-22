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
  encodeGenerationHistoryCursor,
  decodeGenerationHistoryCursor,
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
    for (const table of ["users", "repositories", "generation_history"]) {
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

  it("insert persists all scoped fields with defaults", async () => {
    const saved = await repo.createOne({
      userId: USER_ID,
      repositoryId: REPO_ID,
      diffHash: "sha256:abc",
      provider: "openai",
      model: "gpt-4o-mini",
      tokensUsed: 168,
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

    const fetched = await repo.findOneByOrFail({ id: saved.id });
    expect(fetched.userId).toBe(USER_ID);
    expect(fetched.repositoryId).toBe(REPO_ID);
    expect(fetched.diffHash).toBe("sha256:abc");
    expect(fetched.provider).toBe("openai");
    expect(fetched.model).toBe("gpt-4o-mini");
    expect(fetched.tokensUsed).toBe(168);
    expect(fetched.status).toBe("pending");
    expect(fetched.policyId).toBeNull();
    expect(fetched.suggestions).toHaveLength(1);
    expect(fetched.suggestions[0]!.type).toBe("feat");
    expect(fetched.suggestions[0]!.compliant).toBe(true);
    expect(fetched.createdAt).toBeInstanceOf(Date);
  });

  it("insert with null repo + null policy + explicit status succeeds", async () => {
    const saved = await repo.createOne({
      userId: USER_ID,
      diffHash: "sha256:def",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      tokensUsed: 30,
      status: "completed",
      suggestions: [],
    });

    const fetched = await repo.findOneByOrFail({ id: saved.id });
    expect(fetched.repositoryId).toBeNull();
    expect(fetched.policyId).toBeNull();
    expect(fetched.status).toBe("completed");
  });

  it("check constraint rejects invalid status", async () => {
    await expect(
      ds.query(
        `INSERT INTO generation_history (user_id, diff_hash, provider, model, tokens_used, status, suggestions) VALUES ($1, 'x', 'openai', 'gpt', 0, 'bogus', '[]'::jsonb)`,
        [USER_ID],
      ),
    ).rejects.toThrow(/generation_history_status_chk/);
  });

  it("listByUser paginates via compound cursor DESC and scopes to user", async () => {
    for (const hash of ["sha:a", "sha:b", "sha:c", "sha:d", "sha:e"]) {
      await repo.createOne({
        userId: USER_ID,
        diffHash: hash,
        provider: "openai",
        model: "gpt-4o-mini",
        tokensUsed: 1,
        suggestions: [],
      });
    }

    await repo.createOne({
      userId: OTHER_USER_ID,
      diffHash: "sha:other",
      provider: "openai",
      model: "gpt-4o-mini",
      tokensUsed: 1,
      suggestions: [],
    });

    const page1 = await repo.listByUser({ userId: USER_ID, limit: 2 });
    expect(page1).toHaveLength(2);
    expect(page1.every((r) => r.userId === USER_ID)).toBe(true);

    const page2 = await repo.listByUser({
      userId: USER_ID,
      limit: 2,
      cursor: {
        createdAt: page1[1]!.createdAt.toISOString(),
        id: page1[1]!.id,
      },
    });
    expect(page2).toHaveLength(2);
    expect(page2.every((r) => r.userId === USER_ID)).toBe(true);

    const page3 = await repo.listByUser({
      userId: USER_ID,
      limit: 2,
      cursor: {
        createdAt: page2[1]!.createdAt.toISOString(),
        id: page2[1]!.id,
      },
    });
    expect(page3).toHaveLength(1);

    const seen = [...page1, ...page2, ...page3];
    expect(seen).toHaveLength(5);
    expect(new Set(seen.map((r) => r.id)).size).toBe(5);
    for (let i = 1; i < seen.length; i++) {
      const prev = seen[i - 1]!;
      const cur = seen[i]!;
      const sameStamp = prev.createdAt.getTime() === cur.createdAt.getTime();
      expect(
        sameStamp
          ? prev.id > cur.id
          : prev.createdAt.getTime() > cur.createdAt.getTime(),
      ).toBe(true);
    }
  });

  it("compound cursor breaks ties on equal created_at", async () => {
    const stamp = new Date("2026-04-22T12:00:00.000Z");
    const ids = ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "33333333-3333-3333-3333-333333333333"];
    for (const id of ids) {
      await ds.query(
        `INSERT INTO generation_history (id, user_id, diff_hash, provider, model, tokens_used, suggestions, created_at) VALUES ($1, $2, 'h', 'openai', 'gpt', 0, '[]'::jsonb, $3)`,
        [id, USER_ID, stamp.toISOString()],
      );
    }

    const page1 = await repo.listByUser({ userId: USER_ID, limit: 2 });
    expect(page1.map((r) => r.id)).toEqual([ids[2], ids[1]]);

    const page2 = await repo.listByUser({
      userId: USER_ID,
      limit: 2,
      cursor: {
        createdAt: page1[1]!.createdAt.toISOString(),
        id: page1[1]!.id,
      },
    });
    expect(page2.map((r) => r.id)).toEqual([ids[0]]);
  });

  it("cursor encode/decode round-trips", () => {
    const row = { id: "11111111-1111-1111-1111-111111111111", createdAt: new Date("2026-04-22T12:34:56.789Z") } as const;
    const encoded = encodeGenerationHistoryCursor(row);
    const decoded = decodeGenerationHistoryCursor(encoded);
    expect(decoded.id).toBe(row.id);
    expect(new Date(decoded.createdAt).getTime()).toBe(row.createdAt.getTime());
    expect(() => decodeGenerationHistoryCursor("nosep")).toThrow();
  });
});
