import "reflect-metadata";

import {
  ApiKey,
  AuditEvent,
  Commit,
  CommitFile,
  CommitQualityScore,
  LLMApiKey,
  Policy,
  PolicyRule,
  Repository,
  SyncJob,
  User,
  buildDataSourceOptions,
  createPolicyRepository,
  createRepositoryRepository,
  type PolicyRepository as PolicyRepo,
  type RepositoryRepository as RepoRepo,
} from "@commit-analyzer/database";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PolicyActivatedEvent } from "../../shared/events/policy-activated.event.js";

import {
  PolicyActiveDeleteError,
  PolicyNotFoundError,
} from "./policy.errors.js";
import { PolicyService } from "./policy.service.js";

const SKIP = process.env.SKIP_INTEGRATION === "1";

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const REPO_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

describe.skipIf(SKIP)("PolicyService (integration)", () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  let policyRepo: PolicyRepo;
  let repoRepo: RepoRepo;
  let service: PolicyService;
  const publish = vi.fn();

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
      "policies",
      "policy_rules",
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
    await ds.query(
      `INSERT INTO repositories (id, user_id, github_repo_id, full_name, is_connected) VALUES ($1, $2, '42', 'u/r', true)`,
      [REPO_ID, USER_ID],
    );

    policyRepo = createPolicyRepository(ds);
    repoRepo = createRepositoryRepository(ds);
    service = new PolicyService(policyRepo, repoRepo, { publish } as never);
  }, 120_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (container) await container.stop();
  }, 30_000);

  beforeEach(async () => {
    publish.mockReset();
    await ds.query(`DELETE FROM policies WHERE repository_id = $1`, [REPO_ID]);
  });

  async function countActive(): Promise<number> {
    const rows: Array<{ count: string }> = await ds.query(
      `SELECT COUNT(*)::text AS count FROM policies WHERE repository_id = $1 AND is_active = true`,
      [REPO_ID],
    );
    return Number(rows[0]!.count);
  }

  it("creates a policy with rules stored in the same transaction", async () => {
    const policy = await service.create(USER_ID, REPO_ID, {
      name: "cc strict",
      rules: [
        { ruleType: "allowedTypes", ruleValue: ["feat", "fix"] },
        { ruleType: "maxSubjectLength", ruleValue: 72 },
      ],
    });

    expect(policy.isActive).toBe(false);
    expect(policy.rules).toHaveLength(2);
    expect(policy.rules.map((r) => r.ruleType).sort()).toEqual([
      "allowedTypes",
      "maxSubjectLength",
    ]);
  });

  it("activation is atomic: never ends with 0 or 2 active", async () => {
    const first = await service.create(USER_ID, REPO_ID, {
      name: "first",
      rules: [],
    });
    const second = await service.create(USER_ID, REPO_ID, {
      name: "second",
      rules: [],
    });

    await service.activate(USER_ID, REPO_ID, first.id);
    expect(await countActive()).toBe(1);

    await service.activate(USER_ID, REPO_ID, second.id);
    expect(await countActive()).toBe(1);

    const active = await service.getActiveForRepo(USER_ID, REPO_ID);
    expect(active?.id).toBe(second.id);
  });

  it("publishes PolicyActivatedEvent on successful activation", async () => {
    const policy = await service.create(USER_ID, REPO_ID, {
      name: "p",
      rules: [],
    });

    await service.activate(USER_ID, REPO_ID, policy.id);

    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0]?.[0] as PolicyActivatedEvent;
    expect(event).toBeInstanceOf(PolicyActivatedEvent);
    expect(event.userId).toBe(USER_ID);
    expect(event.repositoryId).toBe(REPO_ID);
    expect(event.policyId).toBe(policy.id);
  });

  it("refuses to delete an active policy", async () => {
    const policy = await service.create(USER_ID, REPO_ID, {
      name: "keep",
      rules: [],
    });
    await service.activate(USER_ID, REPO_ID, policy.id);

    await expect(
      service.delete(USER_ID, REPO_ID, policy.id),
    ).rejects.toBeInstanceOf(PolicyActiveDeleteError);

    expect(await countActive()).toBe(1);
  });

  it("allows deletion after deactivation via activating another policy", async () => {
    const a = await service.create(USER_ID, REPO_ID, {
      name: "a",
      rules: [],
    });
    const b = await service.create(USER_ID, REPO_ID, {
      name: "b",
      rules: [],
    });

    await service.activate(USER_ID, REPO_ID, a.id);
    await service.activate(USER_ID, REPO_ID, b.id);

    await service.delete(USER_ID, REPO_ID, a.id);

    const list = await service.list(USER_ID, REPO_ID);
    expect(list.map((p) => p.id)).toEqual([b.id]);
  });

  it("update replaces rule set", async () => {
    const policy = await service.create(USER_ID, REPO_ID, {
      name: "p",
      rules: [{ ruleType: "allowedTypes", ruleValue: ["feat"] }],
    });

    const updated = await service.update(USER_ID, REPO_ID, policy.id, {
      rules: [{ ruleType: "bodyRequired", ruleValue: true }],
    });

    expect(updated.rules).toHaveLength(1);
    expect(updated.rules[0]!.ruleType).toBe("bodyRequired");
  });

  it("throws PolicyNotFoundError on cross-repo access", async () => {
    const policy = await service.create(USER_ID, REPO_ID, {
      name: "p",
      rules: [],
    });
    const OTHER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    await ds.query(
      `INSERT INTO repositories (id, user_id, github_repo_id, full_name, is_connected) VALUES ($1, $2, '99', 'u/other', true)`,
      [OTHER, USER_ID],
    );

    await expect(
      service.get(USER_ID, OTHER, policy.id),
    ).rejects.toBeInstanceOf(PolicyNotFoundError);

    await ds.query(`DELETE FROM repositories WHERE id = $1`, [OTHER]);
  });
});
