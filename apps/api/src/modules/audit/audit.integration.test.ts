import "reflect-metadata";

import {
  AuditEvent,
  ApiKey,
  LLMApiKey,
  Repository,
  User,
  buildDataSourceOptions,
  createAuditEventRepository,
} from "@commit-analyzer/database";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AuditService } from "./audit.service.js";

const SKIP = process.env.SKIP_INTEGRATION === "1";

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe.skipIf(SKIP)("AuditService (integration)", () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  let service: AuditService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16").start();

    const baseOptions = buildDataSourceOptions({
      url: container.getConnectionUri(),
    });
    ds = new DataSource({
      ...baseOptions,
      entities: [AuditEvent, ApiKey, LLMApiKey, Repository, User],
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
      "api_keys",
      "llm_api_keys",
      "audit_events",
    ]) {
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

    const auditRepo = createAuditEventRepository(ds);
    const cls = { get: vi.fn(() => USER_ID) };
    service = new AuditService(auditRepo, cls as never);
  }, 120_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (container) await container.stop();
  }, 30_000);

  it("record auth.login then list returns the event", async () => {
    await service.record({
      userId: USER_ID,
      eventType: "auth.login",
      payload: { provider: "github" },
      ip: "127.0.0.1",
      userAgent: "test-agent",
    });

    const result = await service.list({ userId: USER_ID, limit: 50 });

    expect(result.items.length).toBeGreaterThanOrEqual(1);
    const event = result.items.find((e) => e.eventType === "auth.login");
    expect(event).toBeDefined();
    expect(event!.userId).toBe(USER_ID);
    expect(event!.payload).toEqual({ provider: "github" });
    expect(event!.ip).toBe("127.0.0.1");
    expect(event!.userAgent).toBe("test-agent");
  });

  it("list filters by eventType", async () => {
    await service.record({
      userId: USER_ID,
      eventType: "auth.logout",
      payload: {},
    });

    const filtered = await service.list({
      userId: USER_ID,
      limit: 50,
      eventType: "auth.logout",
    });

    expect(filtered.items.length).toBeGreaterThanOrEqual(1);
    expect(filtered.items.every((e) => e.eventType === "auth.logout")).toBe(
      true,
    );
  });

  it("cursor pagination returns next page", async () => {
    // Insert 3 events
    for (let i = 0; i < 3; i++) {
      await service.record({
        userId: USER_ID,
        eventType: "auth.login",
        payload: { provider: "github" },
      });
    }

    const page1 = await service.list({ userId: USER_ID, limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await service.list({
      userId: USER_ID,
      limit: 50,
      cursor: page1.nextCursor!,
    });
    expect(page2.items.length).toBeGreaterThanOrEqual(1);
    // No overlap
    const page1Ids = new Set(page1.items.map((e) => e.id));
    for (const item of page2.items) {
      expect(page1Ids.has(item.id)).toBe(false);
    }
  });
});
