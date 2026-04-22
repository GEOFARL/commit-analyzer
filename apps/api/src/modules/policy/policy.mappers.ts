import type { PolicyDto, PolicyRuleDto } from "@commit-analyzer/contracts";
import type { Policy, PolicyRule } from "@commit-analyzer/database";

// The { ruleType, ruleValue } pair is validated by the Zod `policyRuleSchema`
// on every create/update path, so the discriminant is already correct in the DB.
const toRuleDto = (rule: PolicyRule): PolicyRuleDto =>
  ({
    id: rule.id,
    ruleType: rule.ruleType,
    ruleValue: rule.ruleValue,
  }) as PolicyRuleDto;

export const toPolicyDto = (policy: Policy): PolicyDto => ({
  id: policy.id,
  repositoryId: policy.repositoryId,
  name: policy.name,
  isActive: policy.isActive,
  rules: (policy.rules ?? []).map(toRuleDto),
  createdAt: policy.createdAt.toISOString(),
  updatedAt: policy.updatedAt.toISOString(),
});
