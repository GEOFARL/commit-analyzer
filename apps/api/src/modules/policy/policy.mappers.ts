import type { PolicyDto, PolicyRuleDto } from "@commit-analyzer/contracts";
import type { Policy, PolicyRule } from "@commit-analyzer/database";

const toRuleDto = (rule: PolicyRule): PolicyRuleDto => ({
  id: rule.id,
  ruleType: rule.ruleType,
  ruleValue: rule.ruleValue,
});

export const toPolicyDto = (policy: Policy): PolicyDto => ({
  id: policy.id,
  repositoryId: policy.repositoryId,
  name: policy.name,
  isActive: policy.isActive,
  rules: (policy.rules ?? []).map(toRuleDto),
  createdAt: policy.createdAt.toISOString(),
  updatedAt: policy.updatedAt.toISOString(),
});
