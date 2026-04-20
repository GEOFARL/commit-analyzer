import "reflect-metadata";

import type { Policy } from "@commit-analyzer/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RepoConnectedEvent } from "../../shared/events/repo-connected.event.js";

import { ApplyDefaultPolicyOnRepoConnected } from "./apply-default-policy.handler.js";
import { DefaultPolicyService } from "./default-policy.service.js";
import type { DefaultPolicyTemplate } from "./policy.schemas.js";

const USER_ID = "user-1";
const REPO_ID = "repo-1";
const POLICY_ID = "policy-1";

const event = () =>
  new RepoConnectedEvent(REPO_ID, USER_ID, "12345", "octocat/hello-world");

const policy = (overrides: Partial<Policy> = {}): Policy =>
  ({
    id: POLICY_ID,
    repositoryId: REPO_ID,
    name: "Default",
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    rules: [],
    ...overrides,
  }) as unknown as Policy;

describe("ApplyDefaultPolicyOnRepoConnected", () => {
  let getTemplate: ReturnType<typeof vi.fn>;
  let listByRepository: ReturnType<typeof vi.fn>;
  let createWithRules: ReturnType<typeof vi.fn>;
  let activate: ReturnType<typeof vi.fn>;
  let handler: ApplyDefaultPolicyOnRepoConnected;

  beforeEach(() => {
    getTemplate = vi.fn();
    listByRepository = vi.fn().mockResolvedValue([]);
    createWithRules = vi.fn();
    activate = vi.fn();

    const defaults = {
      getDefaultPolicyTemplate: getTemplate,
    } as unknown as DefaultPolicyService;
    const policies = {
      listByRepository,
      createWithRules,
      activate,
    } as never;
    handler = new ApplyDefaultPolicyOnRepoConnected(defaults, policies);
  });

  it("does nothing when the user has no template", async () => {
    getTemplate.mockResolvedValue(null);

    await handler.handle(event());

    expect(listByRepository).not.toHaveBeenCalled();
    expect(createWithRules).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });

  it("does nothing when the template is disabled", async () => {
    const template: DefaultPolicyTemplate = { enabled: false, rules: [] };
    getTemplate.mockResolvedValue(template);

    await handler.handle(event());

    expect(createWithRules).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });

  it("creates and activates a Default policy when enabled and repo has no policies", async () => {
    const template: DefaultPolicyTemplate = {
      enabled: true,
      rules: [
        { ruleType: "allowedTypes", ruleValue: ["feat", "fix"] },
        { ruleType: "maxSubjectLength", ruleValue: 72 },
      ],
    };
    getTemplate.mockResolvedValue(template);
    const created = policy();
    createWithRules.mockResolvedValue(created);
    activate.mockResolvedValue(policy({ isActive: true }));

    await handler.handle(event());

    expect(getTemplate).toHaveBeenCalledWith(USER_ID);
    expect(listByRepository).toHaveBeenCalledWith(REPO_ID);
    expect(createWithRules).toHaveBeenCalledWith({
      repositoryId: REPO_ID,
      name: "Default",
      rules: template.rules,
    });
    expect(activate).toHaveBeenCalledWith(REPO_ID, POLICY_ID);
  });

  it("creates a policy with no rules when the template rule list is empty", async () => {
    const template: DefaultPolicyTemplate = { enabled: true, rules: [] };
    getTemplate.mockResolvedValue(template);
    createWithRules.mockResolvedValue(policy());
    activate.mockResolvedValue(policy({ isActive: true }));

    await handler.handle(event());

    expect(createWithRules).toHaveBeenCalledWith({
      repositoryId: REPO_ID,
      name: "Default",
      rules: [],
    });
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it("skips creation when the repo already has policies (idempotent on re-connect)", async () => {
    const template: DefaultPolicyTemplate = { enabled: true, rules: [] };
    getTemplate.mockResolvedValue(template);
    listByRepository.mockResolvedValue([policy({ name: "custom" })]);

    await handler.handle(event());

    expect(createWithRules).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });

  it("swallows create errors so repo connect is not interrupted", async () => {
    const template: DefaultPolicyTemplate = { enabled: true, rules: [] };
    getTemplate.mockResolvedValue(template);
    createWithRules.mockRejectedValue(new Error("db down"));

    await expect(handler.handle(event())).resolves.toBeUndefined();
    expect(activate).not.toHaveBeenCalled();
  });

  it("swallows activate errors after creation", async () => {
    const template: DefaultPolicyTemplate = { enabled: true, rules: [] };
    getTemplate.mockResolvedValue(template);
    createWithRules.mockResolvedValue(policy());
    activate.mockRejectedValue(new Error("conflict"));

    await expect(handler.handle(event())).resolves.toBeUndefined();
  });
});
