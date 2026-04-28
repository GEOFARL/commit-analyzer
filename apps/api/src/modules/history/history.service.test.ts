import "reflect-metadata";

import type {
  GenerationHistory,
  GenerationHistoryRepository,
  Policy,
  PolicyRepository,
  Repository as RepoEntity,
  RepositoryRepository,
} from "@commit-analyzer/database";
import { encodeGenerationHistoryCursor } from "@commit-analyzer/database";
import { describe, expect, it, vi } from "vitest";

import { ValidatorService } from "../../shared/policy-validation/validator.service.js";

import { HistoryService } from "./history.service.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";

const row = (
  overrides: Partial<GenerationHistory> & {
    id: string;
    createdAt: Date;
  },
): GenerationHistory =>
  ({
    userId: USER_ID,
    repositoryId: null,
    diffHash: "h",
    provider: "openai",
    model: "gpt-4o-mini",
    tokensUsed: 0,
    status: "completed",
    suggestions: [],
    policyId: null,
    repository: null,
    policy: null,
    user: null,
    ...overrides,
  }) as unknown as GenerationHistory;

interface MakeServiceArgs {
  rows: GenerationHistory[];
  repos?: RepoEntity[];
  policies?: Policy[];
}

const makeService = ({
  rows,
  repos = [],
  policies = [],
}: MakeServiceArgs) => {
  const listByUser = vi.fn(
    (opts: { userId: string; limit: number; cursor?: unknown }) => {
      let scoped = rows.filter((r) => r.userId === opts.userId);
      if (opts.cursor) {
        const c = opts.cursor as { createdAt: string; id: string };
        const cAt = new Date(c.createdAt).getTime();
        scoped = scoped.filter((r) => {
          const at = r.createdAt.getTime();
          return at < cAt || (at === cAt && r.id < c.id);
        });
      }
      scoped.sort((a, b) => {
        const diff = b.createdAt.getTime() - a.createdAt.getTime();
        return diff !== 0 ? diff : b.id > a.id ? 1 : -1;
      });
      return Promise.resolve(scoped.slice(0, opts.limit));
    },
  );
  const repoFindOneBy = vi.fn(({ id }: { id: string }) =>
    Promise.resolve(repos.find((r) => r.id === id) ?? null),
  );
  const findWithRules = vi.fn((id: string) =>
    Promise.resolve(policies.find((p) => p.id === id) ?? null),
  );

  const history = { listByUser } as unknown as GenerationHistoryRepository;
  const repositories = {
    findOneBy: repoFindOneBy,
  } as unknown as RepositoryRepository;
  const policiesRepo = {
    findWithRules,
  } as unknown as PolicyRepository;

  const validator = new ValidatorService();
  return {
    service: new HistoryService(history, policiesRepo, repositories, validator),
    listByUser,
    repoFindOneBy,
    findWithRules,
  };
};

describe("HistoryService", () => {
  it("paginates with cursor and reports nextCursor when more rows exist", async () => {
    const rows = [
      row({ id: "a", createdAt: new Date("2026-04-01T00:00:00Z") }),
      row({ id: "b", createdAt: new Date("2026-04-02T00:00:00Z") }),
      row({ id: "c", createdAt: new Date("2026-04-03T00:00:00Z") }),
    ];
    const { service } = makeService({ rows });

    const page1 = await service.list({ userId: USER_ID, limit: 2 });
    expect(page1.items.map((i) => i.id)).toEqual(["c", "b"]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await service.list({
      userId: USER_ID,
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.items.map((i) => i.id)).toEqual(["a"]);
    expect(page2.nextCursor).toBeNull();
  });

  it("excludes other users' rows", async () => {
    const rows = [
      row({ id: "mine", createdAt: new Date("2026-04-01T00:00:00Z") }),
      row({
        id: "theirs",
        userId: "22222222-2222-2222-2222-222222222222",
        createdAt: new Date("2026-04-02T00:00:00Z"),
      }),
    ];
    const { service, listByUser } = makeService({ rows });

    const page = await service.list({ userId: USER_ID, limit: 10 });

    expect(page.items.map((i) => i.id)).toEqual(["mine"]);
    expect(listByUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID }),
    );
  });

  it("hydrates repositoryFullName from repositoryId via batch lookup", async () => {
    const REPO_ID = "33333333-3333-3333-3333-333333333333";
    const repo = {
      id: REPO_ID,
      fullName: "octocat/hello-world",
    } as unknown as RepoEntity;
    const rows = [
      row({
        id: "a",
        repositoryId: REPO_ID,
        createdAt: new Date("2026-04-01T00:00:00Z"),
      }),
    ];
    const { service, repoFindOneBy } = makeService({ rows, repos: [repo] });

    const page = await service.list({ userId: USER_ID, limit: 5 });

    expect(page.items[0]!.repositoryFullName).toBe("octocat/hello-world");
    expect(repoFindOneBy).toHaveBeenCalledWith({ id: REPO_ID });
  });

  it("revalidates suggestions against the linked policy", async () => {
    const POLICY_ID = "44444444-4444-4444-4444-444444444444";
    const policy = {
      id: POLICY_ID,
      name: "Strict",
      rules: [
        {
          ruleType: "allowedTypes",
          ruleValue: ["feat", "fix"],
        },
      ],
    } as unknown as Policy;

    const rows = [
      row({
        id: "a",
        policyId: POLICY_ID,
        createdAt: new Date("2026-04-01T00:00:00Z"),
        suggestions: [
          {
            type: "chore",
            scope: null,
            subject: "tweak readme",
            body: null,
            footer: null,
            compliant: true,
          },
        ],
      }),
    ];
    const { service, findWithRules } = makeService({
      rows,
      policies: [policy],
    });

    const page = await service.list({ userId: USER_ID, limit: 5 });
    const suggestion = page.items[0]!.suggestions[0]!;

    expect(suggestion.compliant).toBe(false);
    expect(suggestion.validation?.passed).toBe(false);
    expect(page.items[0]!.policyName).toBe("Strict");
    expect(findWithRules).toHaveBeenCalledWith(POLICY_ID);
  });

  it("rejects invalid cursor with a clear error", async () => {
    const { service } = makeService({ rows: [] });

    await expect(
      service.list({ userId: USER_ID, limit: 5, cursor: "garbage" }),
    ).rejects.toThrow(/invalid generation history cursor/);
  });

  it("encodes nextCursor consistent with helper", async () => {
    const second = row({
      id: "b",
      createdAt: new Date("2026-04-02T00:00:00Z"),
    });
    const rows = [
      row({ id: "a", createdAt: new Date("2026-04-01T00:00:00Z") }),
      second,
      row({ id: "c", createdAt: new Date("2026-04-03T00:00:00Z") }),
    ];
    const { service } = makeService({ rows });

    const page1 = await service.list({ userId: USER_ID, limit: 2 });
    expect(page1.nextCursor).toBe(encodeGenerationHistoryCursor(second));
  });
});
