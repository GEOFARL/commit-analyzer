import assert from "node:assert/strict";

import type { DataSource, Repository as OrmRepository } from "typeorm";

import { PolicyRule, type PolicyRuleType } from "../entities/policy-rule.entity.js";
import { Policy } from "../entities/policy.entity.js";

export interface PolicyRuleInput {
  ruleType: PolicyRuleType;
  ruleValue: unknown;
}

export interface CreatePolicyInput {
  repositoryId: string;
  name: string;
  rules: PolicyRuleInput[];
}

export interface UpdatePolicyInput {
  name?: string;
  rules?: PolicyRuleInput[];
}

export interface PolicyRepository extends OrmRepository<Policy> {
  listByRepository(repositoryId: string): Promise<Policy[]>;
  findWithRules(id: string): Promise<Policy | null>;
  getActiveForRepo(repositoryId: string): Promise<Policy | null>;
  createWithRules(input: CreatePolicyInput): Promise<Policy>;
  updateWithRules(id: string, input: UpdatePolicyInput): Promise<Policy>;
  deleteById(id: string): Promise<void>;
  /**
   * Atomically swap the active policy for the given repository. Within one tx:
   *   1. Deactivate the currently active policy (if any).
   *   2. Activate the target policy.
   * The partial unique index `policies_active_per_repo_idx` guarantees that
   * no window exists with zero or two active policies once the tx commits.
   */
  activate(repositoryId: string, policyId: string): Promise<Policy>;
}

export const createPolicyRepository = (
  dataSource: DataSource,
): PolicyRepository => {
  const base = dataSource.getRepository(Policy);
  const extensions: Pick<
    PolicyRepository,
    | "listByRepository"
    | "findWithRules"
    | "getActiveForRepo"
    | "createWithRules"
    | "updateWithRules"
    | "deleteById"
    | "activate"
  > = {
    listByRepository(repositoryId: string): Promise<Policy[]> {
      return base.find({
        where: { repositoryId },
        order: { createdAt: "DESC" },
      });
    },
    findWithRules(id: string): Promise<Policy | null> {
      return base.findOne({ where: { id }, relations: { rules: true } });
    },
    getActiveForRepo(repositoryId: string): Promise<Policy | null> {
      return base.findOne({
        where: { repositoryId, isActive: true },
        relations: { rules: true },
      });
    },
    async createWithRules(input: CreatePolicyInput): Promise<Policy> {
      return dataSource.transaction(async (m) => {
        const policyRepo = m.getRepository(Policy);
        const ruleRepo = m.getRepository(PolicyRule);
        const saved = await policyRepo.save(
          policyRepo.create({
            repositoryId: input.repositoryId,
            name: input.name,
            isActive: false,
          }),
        );
        if (input.rules.length > 0) {
          await ruleRepo.save(
            input.rules.map((r) =>
              ruleRepo.create({
                policyId: saved.id,
                ruleType: r.ruleType,
                ruleValue: r.ruleValue,
              }),
            ),
          );
        }
        const full = await policyRepo.findOne({
          where: { id: saved.id },
          relations: { rules: true },
        });
        assert(full, "policy not found after create");
        return full;
      });
    },
    async updateWithRules(
      id: string,
      input: UpdatePolicyInput,
    ): Promise<Policy> {
      return dataSource.transaction(async (m) => {
        const policyRepo = m.getRepository(Policy);
        const ruleRepo = m.getRepository(PolicyRule);
        if (input.name !== undefined) {
          const existing = await policyRepo.findOne({ where: { id } });
          assert(existing, "policy not found before update");
          existing.name = input.name;
          await policyRepo.save(existing);
        }
        if (input.rules !== undefined) {
          await ruleRepo.delete({ policyId: id });
          if (input.rules.length > 0) {
            await ruleRepo.save(
              input.rules.map((r) =>
                ruleRepo.create({
                  policyId: id,
                  ruleType: r.ruleType,
                  ruleValue: r.ruleValue,
                }),
              ),
            );
          }
        }
        const full = await policyRepo.findOne({
          where: { id },
          relations: { rules: true },
        });
        assert(full, "policy not found after update");
        return full;
      });
    },
    async deleteById(id: string): Promise<void> {
      await base.delete({ id });
    },
    async activate(repositoryId: string, policyId: string): Promise<Policy> {
      return dataSource.transaction(async (m) => {
        const policyRepo = m.getRepository(Policy);
        await policyRepo.update(
          { repositoryId, isActive: true },
          { isActive: false },
        );
        const target = await policyRepo.findOne({
          where: { id: policyId, repositoryId },
        });
        assert(target, "policy not found in repository during activation");
        target.isActive = true;
        await policyRepo.save(target);
        const full = await policyRepo.findOne({
          where: { id: policyId },
          relations: { rules: true },
        });
        assert(full, "policy not found after activate");
        return full;
      });
    },
  };
  return base.extend(extensions) as PolicyRepository;
};
