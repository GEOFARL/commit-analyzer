import "reflect-metadata";

import {
  ApiKey,
  LLMApiKey,
  Repository,
  User,
  buildDataSourceOptions,
  createApiKeyRepository,
  createUserRepository,
} from "@commit-analyzer/database";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import argon2 from "argon2";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AuthService } from "./auth.service.js";

// Integration test for T-1.7: mint → list → revoke round-trip against a
// real Postgres. Uses Testcontainers so we don't depend on a shared dev DB.
// Skip locally with `SKIP_INTEGRATION=1 pnpm test`.
const SKIP = process.env.SKIP_INTEGRATION === "1";

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe.skipIf(SKIP)("AuthService (integration)", () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  let service: AuthService;
  const publish = vi.fn();

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16").start();

    // Use explicit entity classes (not the glob) so the module identity
    // matches the classes imported in repositories — otherwise TypeORM loads
    // entities via file glob and `getRepository(ApiKey)` looks up a different
    // class instance than the one registered.
    const baseOptions = buildDataSourceOptions({
      url: container.getConnectionUri(),
    });
    ds = new DataSource({
      ...baseOptions,
      entities: [ApiKey, LLMApiKey, Repository, User],
    });
    await ds.initialize();

    // The production migration assumes Supabase's `auth` schema exists.
    // Create a minimal stub so FK + trigger targets resolve, then run
    // migrations, then strip RLS/trigger so tests can seed directly.
    await ds.query(`CREATE SCHEMA IF NOT EXISTS auth`);
    await ds.query(
      `CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb)`,
    );
    await ds.query(
      `CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT NULL::uuid $$ LANGUAGE sql STABLE`,
    );

    await ds.runMigrations();

    await ds.query(`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users`);
    for (const table of ["users", "repositories", "api_keys", "llm_api_keys"]) {
      await ds.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }

    await ds.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, '{}'::jsonb)`,
      [USER_ID, "user@example.com"],
    );
    await ds.query(
      `INSERT INTO public.users (id, email, username) VALUES ($1, $2, $3)`,
      [USER_ID, "user@example.com", "user"],
    );

    const userRepo = createUserRepository(ds);
    const apiKeyRepo = createApiKeyRepository(ds);
    service = new AuthService(
      userRepo,
      apiKeyRepo,
      { publish } as never,
      { getUserById: () => Promise.resolve(null) } as never,
      { encryptParts: () => ({ ciphertext: Buffer.alloc(0), iv: Buffer.alloc(12), tag: Buffer.alloc(16) }) } as never,
    );
  }, 120_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (container) await container.stop();
  }, 30_000);

  it("mint → list → revoke round-trip hits real postgres", async () => {
    const { key, record } = await service.mintApiKey(USER_ID, "ci-bot");

    // Plaintext is returned once and matches the stored argon2 hash.
    expect(key.startsWith("git_")).toBe(true);
    expect(await argon2.verify(record.keyHash, key)).toBe(true);

    // List sees the active key.
    const listed = await service.listApiKeys(USER_ID);
    expect(listed.map((k) => k.id)).toContain(record.id);

    // Revoke sets revokedAt and the guard's active-prefix lookup returns null.
    await service.revokeApiKey(USER_ID, record.id);

    const apiKeyRepo = createApiKeyRepository(ds);
    expect(await apiKeyRepo.findActiveByPrefix(record.keyPrefix)).toBeNull();

    const afterRevoke = await service.listApiKeys(USER_ID);
    expect(afterRevoke.map((k) => k.id)).not.toContain(record.id);

    // Both events fired on the bus.
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it("revoking a non-owned key throws 404", async () => {
    const { record } = await service.mintApiKey(USER_ID, "orphan");
    const otherUser = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    await expect(
      service.revokeApiKey(otherUser, record.id),
    ).rejects.toThrow(/not found/);
  });
});
