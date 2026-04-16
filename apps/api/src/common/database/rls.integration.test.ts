import "reflect-metadata";

import {
  ApiKey,
  LLMApiKey,
  Repository,
  User,
  buildDataSourceOptions,
} from "@commit-analyzer/database";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import argon2 from "argon2";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SKIP = process.env.SKIP_INTEGRATION === "1";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const PHASE_1_TABLES = ["users", "repositories", "api_keys", "llm_api_keys"];

describe.skipIf(SKIP)("RLS isolation (integration)", () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16").start();

    const baseOptions = buildDataSourceOptions({
      url: container.getConnectionUri(),
    });
    ds = new DataSource({
      ...baseOptions,
      entities: [ApiKey, LLMApiKey, Repository, User],
    });
    await ds.initialize();

    await ds.query(`CREATE SCHEMA IF NOT EXISTS auth`);
    await ds.query(
      `CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb)`,
    );

    // Production-equivalent auth.uid(): reads sub from request.jwt.claims GUC.
    await ds.query(`
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE
      AS $$
        SELECT COALESCE(
          (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid,
          NULL
        )
      $$
    `);

    await ds.runMigrations();

    // Drop the trigger so we can seed directly.
    await ds.query(
      `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users`,
    );

    // Disable RLS temporarily to seed data as superuser.
    for (const table of PHASE_1_TABLES) {
      await ds.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }

    // Seed auth.users
    for (const [id, email] of [
      [USER_A, "alice@example.com"],
      [USER_B, "bob@example.com"],
    ] as const) {
      await ds.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, '{}'::jsonb)`,
        [id, email],
      );
      await ds.query(
        `INSERT INTO public.users (id, email, username) VALUES ($1, $2, $3)`,
        [id, email, email.split("@")[0]],
      );
    }

    // Seed repositories
    await ds.query(
      `INSERT INTO repositories (user_id, github_repo_id, full_name) VALUES ($1, 1001, 'alice/repo-a')`,
      [USER_A],
    );
    await ds.query(
      `INSERT INTO repositories (user_id, github_repo_id, full_name) VALUES ($1, 2001, 'bob/repo-b')`,
      [USER_B],
    );

    // Seed api_keys
    const hashA = await argon2.hash("git_AAAAsecretA");
    const hashB = await argon2.hash("git_BBBBsecretB");
    await ds.query(
      `INSERT INTO api_keys (user_id, name, key_prefix, key_hash) VALUES ($1, 'alice-key', 'git_AAAA', $2)`,
      [USER_A, hashA],
    );
    await ds.query(
      `INSERT INTO api_keys (user_id, name, key_prefix, key_hash) VALUES ($1, 'bob-key', 'git_BBBB', $2)`,
      [USER_B, hashB],
    );

    // Seed llm_api_keys
    const dummyEnc = Buffer.from("enc");
    const dummyIv = Buffer.from("iv");
    const dummyTag = Buffer.from("tag");
    await ds.query(
      `INSERT INTO llm_api_keys (user_id, provider, key_enc, key_iv, key_tag) VALUES ($1, 'openai', $2, $3, $4)`,
      [USER_A, dummyEnc, dummyIv, dummyTag],
    );
    await ds.query(
      `INSERT INTO llm_api_keys (user_id, provider, key_enc, key_iv, key_tag) VALUES ($1, 'anthropic', $2, $3, $4)`,
      [USER_B, dummyEnc, dummyIv, dummyTag],
    );

    // Re-enable RLS for test assertions.
    for (const table of PHASE_1_TABLES) {
      await ds.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }

    // Superuser bypasses RLS. Create a restricted role that respects policies.
    await ds.query(`CREATE ROLE app_user NOLOGIN`);
    for (const table of PHASE_1_TABLES) {
      await ds.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO app_user`);
    }
    await ds.query(`GRANT USAGE ON SCHEMA public TO app_user`);
    await ds.query(`GRANT USAGE ON SCHEMA auth TO app_user`);
    await ds.query(`GRANT EXECUTE ON FUNCTION auth.uid() TO app_user`);
  }, 120_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (container) await container.stop();
  }, 30_000);

  async function queryAs<T>(
    userId: string,
    sql: string,
    params?: unknown[],
  ): Promise<T[]> {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager.query(`SET LOCAL ROLE app_user`);
      await qr.manager.query(
        `SELECT set_config('request.jwt.claims', $1, true)`,
        [JSON.stringify({ sub: userId })],
      );
      return await qr.manager.query(sql, params);
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  }

  it("user A sees only own repositories", async () => {
    const rows = await queryAs<{ full_name: string }>(
      USER_A,
      `SELECT full_name FROM repositories`,
    );
    expect(rows.map((r) => r.full_name)).toEqual(["alice/repo-a"]);
  });

  it("user B sees only own repositories", async () => {
    const rows = await queryAs<{ full_name: string }>(
      USER_B,
      `SELECT full_name FROM repositories`,
    );
    expect(rows.map((r) => r.full_name)).toEqual(["bob/repo-b"]);
  });

  it("user B cannot select user A's repositories", async () => {
    const rows = await queryAs<{ full_name: string }>(
      USER_B,
      `SELECT full_name FROM repositories WHERE full_name = 'alice/repo-a'`,
    );
    expect(rows).toHaveLength(0);
  });

  it("user A cannot select user B's user row", async () => {
    const rows = await queryAs<{ id: string }>(
      USER_A,
      `SELECT id FROM users WHERE id = $1`,
      [USER_B],
    );
    expect(rows).toHaveLength(0);
  });

  it("user B cannot see user A's api_keys", async () => {
    const rows = await queryAs<{ name: string }>(
      USER_B,
      `SELECT name FROM api_keys WHERE key_prefix = $1`,
      ["git_AAAA"],
    );
    expect(rows).toHaveLength(0);
  });

  it("user A cannot see user B's llm_api_keys", async () => {
    const rows = await queryAs<{ provider: string }>(
      USER_A,
      `SELECT provider FROM llm_api_keys WHERE provider = 'anthropic'`,
    );
    expect(rows).toHaveLength(0);
  });

  it("unauthenticated session (no claims) sees no rows", async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager.query(`SET LOCAL ROLE app_user`);
      await qr.manager.query(
        `SELECT set_config('request.jwt.claims', '{}', true)`,
      );
      const repos: unknown[] = await qr.manager.query(
        `SELECT * FROM repositories`,
      );
      const users: unknown[] = await qr.manager.query(
        `SELECT * FROM users`,
      );
      expect(repos).toHaveLength(0);
      expect(users).toHaveLength(0);
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });

  describe("RLS must be enabled on all Phase-1 tables", () => {
    for (const table of PHASE_1_TABLES) {
      it(`${table} has RLS enabled`, async () => {
        const result: { relrowsecurity: boolean; relforcerowsecurity: boolean }[] =
          await ds.query(
            `SELECT relrowsecurity, relforcerowsecurity
             FROM pg_class WHERE relname = $1`,
            [table],
          );
        expect(result[0]!.relrowsecurity).toBe(true);
        expect(result[0]!.relforcerowsecurity).toBe(true);
      });
    }
  });

  describe("RLS policies exist on all Phase-1 tables", () => {
    for (const table of PHASE_1_TABLES) {
      it(`${table} has an owner policy`, async () => {
        const rows: { polname: string }[] = await ds.query(
          `SELECT polname FROM pg_policy
           WHERE polrelid = $1::regclass`,
          [table],
        );
        expect(rows.length).toBeGreaterThanOrEqual(1);
        expect(rows.some((r) => r.polname.includes("owner"))).toBe(true);
      });
    }
  });
});
