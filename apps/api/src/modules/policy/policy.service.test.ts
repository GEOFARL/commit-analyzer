import "reflect-metadata";

import type { Policy, Repository as RepoEntity } from "@commit-analyzer/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PolicyActivatedEvent } from "../../shared/events/policy-activated.event.js";
import { PolicyChangedEvent } from "../../shared/events/policy-changed.event.js";

import {
  PolicyActivationConflictError,
  PolicyActiveDeleteError,
  PolicyNotFoundError,
  PolicyRepoNotFoundError,
  PolicyRuleInvalidError,
  PolicyUpdateEmptyError,
} from "./policy.errors.js";
import { PolicyService } from "./policy.service.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const REPO_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_REPO_ID = "99999999-9999-9999-9999-999999999999";
const POLICY_ID = "33333333-3333-3333-3333-333333333333";

const repoEntity = (overrides: Partial<RepoEntity> = {}): RepoEntity =>
  ({
    id: REPO_ID,
    userId: USER_ID,
    githubRepoId: "42",
    fullName: "octocat/hello-world",
    isConnected: true,
    ...overrides,
  }) as unknown as RepoEntity;

const policyEntity = (overrides: Partial<Policy> = {}): Policy =>
  ({
    id: POLICY_ID,
    repositoryId: REPO_ID,
    name: "strict",
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    rules: [],
    ...overrides,
  }) as unknown as Policy;

describe("PolicyService", () => {
  const policies = {
    listByRepository: vi.fn(),
    listByRepositoryWithRules: vi.fn(),
    findWithRules: vi.fn(),
    getActiveForRepo: vi.fn(),
    createWithRules: vi.fn(),
    updateWithRules: vi.fn(),
    deleteById: vi.fn(),
    activate: vi.fn(),
  };
  const repos = {
    findByIdForUser: vi.fn(),
  };
  const publish = vi.fn();
  let service: PolicyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PolicyService(
      policies as never,
      repos as never,
      { publish } as never,
    );
  });

  describe("ensureRepoOwned", () => {
    it("list: 404 when repo not owned", async () => {
      repos.findByIdForUser.mockResolvedValue(null);
      await expect(service.list(USER_ID, REPO_ID)).rejects.toBeInstanceOf(
        PolicyRepoNotFoundError,
      );
      expect(policies.listByRepositoryWithRules).not.toHaveBeenCalled();
    });

    it("get: 404 when repo not owned", async () => {
      repos.findByIdForUser.mockResolvedValue(null);
      await expect(
        service.get(USER_ID, REPO_ID, POLICY_ID),
      ).rejects.toBeInstanceOf(PolicyRepoNotFoundError);
    });

    it("create: 404 when repo not owned", async () => {
      repos.findByIdForUser.mockResolvedValue(null);
      await expect(
        service.create(USER_ID, REPO_ID, { name: "x", rules: [] }),
      ).rejects.toBeInstanceOf(PolicyRepoNotFoundError);
    });
  });

  describe("list", () => {
    it("returns policies with rules for repo when owned", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.listByRepositoryWithRules.mockResolvedValue([policyEntity()]);

      const result = await service.list(USER_ID, REPO_ID);

      expect(repos.findByIdForUser).toHaveBeenCalledWith(REPO_ID, USER_ID);
      expect(policies.listByRepositoryWithRules).toHaveBeenCalledWith(REPO_ID);
      expect(result).toHaveLength(1);
    });
  });

  describe("get", () => {
    it("returns policy with rules", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(policyEntity());

      const result = await service.get(USER_ID, REPO_ID, POLICY_ID);

      expect(result.id).toBe(POLICY_ID);
    });

    it("throws PolicyNotFoundError when policy belongs to a different repo", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(
        policyEntity({ repositoryId: OTHER_REPO_ID }),
      );

      await expect(
        service.get(USER_ID, REPO_ID, POLICY_ID),
      ).rejects.toBeInstanceOf(PolicyNotFoundError);
    });

    it("throws PolicyNotFoundError when missing", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(null);

      await expect(
        service.get(USER_ID, REPO_ID, POLICY_ID),
      ).rejects.toBeInstanceOf(PolicyNotFoundError);
    });
  });

  describe("getActiveForRepo", () => {
    it("returns null when no active policy", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.getActiveForRepo.mockResolvedValue(null);

      const result = await service.getActiveForRepo(USER_ID, REPO_ID);

      expect(result).toBeNull();
    });

    it("returns active policy when present", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.getActiveForRepo.mockResolvedValue(
        policyEntity({ isActive: true }),
      );

      const result = await service.getActiveForRepo(USER_ID, REPO_ID);

      expect(result?.isActive).toBe(true);
    });
  });

  describe("create", () => {
    it("validates and creates policy with rules", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      const created = policyEntity({ name: "strict" });
      policies.createWithRules.mockResolvedValue(created);

      const result = await service.create(USER_ID, REPO_ID, {
        name: "strict",
        rules: [
          { ruleType: "allowedTypes", ruleValue: ["feat", "fix"] },
          { ruleType: "maxSubjectLength", ruleValue: 72 },
        ],
      });

      expect(policies.createWithRules).toHaveBeenCalledTimes(1);
      const call = policies.createWithRules.mock.calls[0]?.[0] as {
        repositoryId: string;
        name: string;
        rules: Array<{ ruleType: string; ruleValue: unknown }>;
      };
      expect(call.repositoryId).toBe(REPO_ID);
      expect(call.name).toBe("strict");
      expect(call.rules.map((r) => r.ruleType)).toEqual([
        "allowedTypes",
        "maxSubjectLength",
      ]);
      expect(result).toBe(created);
    });

    it("accepts policy with no rules", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.createWithRules.mockResolvedValue(policyEntity());

      await service.create(USER_ID, REPO_ID, { name: "empty" });

      expect(policies.createWithRules).toHaveBeenCalledWith({
        repositoryId: REPO_ID,
        name: "empty",
        rules: [],
      });
    });

    it("rejects invalid rule via zod with PolicyRuleInvalidError", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());

      await expect(
        service.create(USER_ID, REPO_ID, {
          name: "bad",
          rules: [{ ruleType: "maxSubjectLength", ruleValue: -1 }],
        }),
      ).rejects.toBeInstanceOf(PolicyRuleInvalidError);
      expect(policies.createWithRules).not.toHaveBeenCalled();
    });

    it("rejects invalid regex scope", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());

      await expect(
        service.create(USER_ID, REPO_ID, {
          name: "regex",
          rules: [
            {
              ruleType: "allowedScopes",
              ruleValue: { kind: "regex", pattern: "([unterminated" },
            },
          ],
        }),
      ).rejects.toBeInstanceOf(PolicyRuleInvalidError);
    });

    it("rejects missing name", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());

      await expect(
        service.create(USER_ID, REPO_ID, { rules: [] }),
      ).rejects.toBeInstanceOf(PolicyRuleInvalidError);
    });
  });

  describe("update", () => {
    it("updates an existing policy and publishes PolicyChangedEvent", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(policyEntity());
      const updated = policyEntity({ name: "new" });
      policies.updateWithRules.mockResolvedValue(updated);

      const result = await service.update(USER_ID, REPO_ID, POLICY_ID, {
        name: "new",
      });

      expect(policies.updateWithRules).toHaveBeenCalledWith(POLICY_ID, {
        name: "new",
      });
      expect(publish).toHaveBeenCalledTimes(1);
      const event = publish.mock.calls[0]?.[0] as PolicyChangedEvent;
      expect(event).toBeInstanceOf(PolicyChangedEvent);
      expect(event.userId).toBe(USER_ID);
      expect(event.repositoryId).toBe(REPO_ID);
      expect(event.policyId).toBe(POLICY_ID);
      expect(result).toBe(updated);
    });

    it("throws PolicyNotFoundError when policy belongs to another repo", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(
        policyEntity({ repositoryId: OTHER_REPO_ID }),
      );

      await expect(
        service.update(USER_ID, REPO_ID, POLICY_ID, { name: "new" }),
      ).rejects.toBeInstanceOf(PolicyNotFoundError);
      expect(publish).not.toHaveBeenCalled();
    });

    it("rejects update with no fields with PolicyUpdateEmptyError", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(policyEntity());

      await expect(
        service.update(USER_ID, REPO_ID, POLICY_ID, {}),
      ).rejects.toBeInstanceOf(PolicyUpdateEmptyError);
      expect(policies.updateWithRules).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it("still routes invalid rule shapes to PolicyRuleInvalidError", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(policyEntity());

      await expect(
        service.update(USER_ID, REPO_ID, POLICY_ID, {
          rules: [{ ruleType: "allowedTypes", ruleValue: [] }],
        }),
      ).rejects.toBeInstanceOf(PolicyRuleInvalidError);
    });
  });

  describe("delete", () => {
    it("deletes when policy is inactive", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(policyEntity({ isActive: false }));

      await service.delete(USER_ID, REPO_ID, POLICY_ID);

      expect(policies.deleteById).toHaveBeenCalledWith(POLICY_ID);
    });

    it("refuses to delete an active policy", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(policyEntity({ isActive: true }));

      await expect(
        service.delete(USER_ID, REPO_ID, POLICY_ID),
      ).rejects.toBeInstanceOf(PolicyActiveDeleteError);
      expect(policies.deleteById).not.toHaveBeenCalled();
    });

    it("throws 404 when policy not found", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(null);

      await expect(
        service.delete(USER_ID, REPO_ID, POLICY_ID),
      ).rejects.toBeInstanceOf(PolicyNotFoundError);
    });
  });

  describe("activate", () => {
    it("activates the policy and publishes PolicyActivatedEvent", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(policyEntity());
      const activated = policyEntity({ isActive: true });
      policies.activate.mockResolvedValue(activated);

      const result = await service.activate(USER_ID, REPO_ID, POLICY_ID);

      expect(policies.activate).toHaveBeenCalledWith(REPO_ID, POLICY_ID);
      expect(publish).toHaveBeenCalledTimes(1);
      const event = publish.mock.calls[0]?.[0] as PolicyActivatedEvent;
      expect(event).toBeInstanceOf(PolicyActivatedEvent);
      expect(event.userId).toBe(USER_ID);
      expect(event.repositoryId).toBe(REPO_ID);
      expect(event.policyId).toBe(POLICY_ID);
      expect(result).toBe(activated);
    });

    it("does not publish event when repo-scoped policy is missing", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(null);

      await expect(
        service.activate(USER_ID, REPO_ID, POLICY_ID),
      ).rejects.toBeInstanceOf(PolicyNotFoundError);
      expect(policies.activate).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it("does not publish event when activation fails in the repo layer", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(policyEntity());
      const boom = new Error("db failure");
      policies.activate.mockRejectedValue(boom);

      await expect(
        service.activate(USER_ID, REPO_ID, POLICY_ID),
      ).rejects.toBe(boom);
      expect(publish).not.toHaveBeenCalled();
    });

    it("maps pg unique_violation (23505) to PolicyActivationConflictError", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(policyEntity());
      policies.activate.mockRejectedValue({ code: "23505" });

      await expect(
        service.activate(USER_ID, REPO_ID, POLICY_ID),
      ).rejects.toBeInstanceOf(PolicyActivationConflictError);
      expect(publish).not.toHaveBeenCalled();
    });

    it("maps TypeORM-wrapped 23505 via driverError to conflict", async () => {
      repos.findByIdForUser.mockResolvedValue(repoEntity());
      policies.findWithRules.mockResolvedValue(policyEntity());
      policies.activate.mockRejectedValue({
        code: "unrelated",
        driverError: { code: "23505" },
      });

      await expect(
        service.activate(USER_ID, REPO_ID, POLICY_ID),
      ).rejects.toBeInstanceOf(PolicyActivationConflictError);
    });
  });
});
