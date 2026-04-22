import type {
  Policy,
  PolicyRepository,
  RepositoryRepository,
} from "@commit-analyzer/database";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { ZodError } from "zod";

import {
  POLICY_REPOSITORY,
  REPOSITORY_REPOSITORY,
} from "../../common/database/tokens.js";
import { PolicyActivatedEvent } from "../../shared/events/policy-activated.event.js";
import { PolicyChangedEvent } from "../../shared/events/policy-changed.event.js";

import {
  isUniqueViolation,
  PolicyActivationConflictError,
  PolicyActiveDeleteError,
  PolicyNotFoundError,
  PolicyRepoNotFoundError,
  PolicyRuleInvalidError,
  PolicyUpdateEmptyError,
} from "./policy.errors.js";
import {
  createPolicySchema,
  type CreatePolicyInputParsed,
  type UpdatePolicyInputParsed,
  updatePolicySchema,
} from "./policy.schemas.js";

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(
    @Inject(POLICY_REPOSITORY) private readonly policies: PolicyRepository,
    @Inject(REPOSITORY_REPOSITORY) private readonly repos: RepositoryRepository,
    private readonly eventBus: EventBus,
  ) {}

  async list(userId: string, repositoryId: string): Promise<Policy[]> {
    await this.ensureRepoOwned(userId, repositoryId);
    return this.policies.listByRepositoryWithRules(repositoryId);
  }

  async get(
    userId: string,
    repositoryId: string,
    policyId: string,
  ): Promise<Policy> {
    await this.ensureRepoOwned(userId, repositoryId);
    const policy = await this.policies.findWithRules(policyId);
    if (!policy || policy.repositoryId !== repositoryId) {
      throw new PolicyNotFoundError();
    }
    return policy;
  }

  async getActiveForRepo(
    userId: string,
    repositoryId: string,
  ): Promise<Policy | null> {
    await this.ensureRepoOwned(userId, repositoryId);
    return this.policies.getActiveForRepo(repositoryId);
  }

  async create(
    userId: string,
    repositoryId: string,
    input: unknown,
  ): Promise<Policy> {
    await this.ensureRepoOwned(userId, repositoryId);
    const parsed = this.parseCreate(input);
    return this.policies.createWithRules({
      repositoryId,
      name: parsed.name,
      rules: parsed.rules,
    });
  }

  async update(
    userId: string,
    repositoryId: string,
    policyId: string,
    input: unknown,
  ): Promise<Policy> {
    const parsed = this.parseUpdate(input);
    if (parsed.name === undefined && parsed.rules === undefined) {
      throw new PolicyUpdateEmptyError();
    }
    await this.ensureRepoOwned(userId, repositoryId);
    const existing = await this.policies.findWithRules(policyId);
    if (!existing || existing.repositoryId !== repositoryId) {
      throw new PolicyNotFoundError();
    }
    const updated = await this.policies.updateWithRules(policyId, parsed);
    this.eventBus.publish(
      new PolicyChangedEvent(userId, repositoryId, policyId),
    );
    return updated;
  }

  async delete(
    userId: string,
    repositoryId: string,
    policyId: string,
  ): Promise<void> {
    await this.ensureRepoOwned(userId, repositoryId);
    const existing = await this.policies.findWithRules(policyId);
    if (!existing || existing.repositoryId !== repositoryId) {
      throw new PolicyNotFoundError();
    }
    if (existing.isActive) throw new PolicyActiveDeleteError();
    await this.policies.deleteById(policyId);
  }

  async activate(
    userId: string,
    repositoryId: string,
    policyId: string,
  ): Promise<Policy> {
    await this.ensureRepoOwned(userId, repositoryId);
    const existing = await this.policies.findWithRules(policyId);
    if (!existing || existing.repositoryId !== repositoryId) {
      throw new PolicyNotFoundError();
    }
    const activated = await this.activateOrConflict(repositoryId, policyId);
    this.eventBus.publish(
      new PolicyActivatedEvent(userId, repositoryId, policyId),
    );
    this.logger.log(
      `policy activated userId=${userId} repositoryId=${repositoryId} policyId=${policyId}`,
    );
    return activated;
  }

  private async activateOrConflict(
    repositoryId: string,
    policyId: string,
  ): Promise<Policy> {
    try {
      return await this.policies.activate(repositoryId, policyId);
    } catch (err) {
      if (isUniqueViolation(err)) {
        this.logger.warn(
          `policy activation conflict repositoryId=${repositoryId} policyId=${policyId}`,
        );
        throw new PolicyActivationConflictError();
      }
      throw err;
    }
  }

  private async ensureRepoOwned(
    userId: string,
    repositoryId: string,
  ): Promise<void> {
    const repo = await this.repos.findByIdForUser(repositoryId, userId);
    if (!repo) throw new PolicyRepoNotFoundError();
  }

  private parseCreate(input: unknown): CreatePolicyInputParsed {
    try {
      return createPolicySchema.parse(input);
    } catch (err) {
      throw this.toRuleInvalid(err);
    }
  }

  private parseUpdate(input: unknown): UpdatePolicyInputParsed {
    try {
      return updatePolicySchema.parse(input);
    } catch (err) {
      throw this.toRuleInvalid(err);
    }
  }

  private toRuleInvalid(err: unknown): PolicyRuleInvalidError {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      const path = first?.path.join(".") ?? "input";
      const message = first?.message ?? "invalid input";
      return new PolicyRuleInvalidError(`${path}: ${message}`);
    }
    return new PolicyRuleInvalidError("invalid input");
  }
}
