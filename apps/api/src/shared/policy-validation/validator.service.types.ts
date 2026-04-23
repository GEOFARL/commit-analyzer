import type { PolicyRuleType } from "@commit-analyzer/database";

export type RuleResult = {
  ruleType: PolicyRuleType | "format";
  passed: boolean;
  message?: string;
};

export type ValidationResult = {
  passed: boolean;
  results: RuleResult[];
};

export type ValidatorPolicyRule = {
  ruleType: PolicyRuleType;
  ruleValue: unknown;
};

export type ValidatorPolicy = {
  rules: ValidatorPolicyRule[];
};
