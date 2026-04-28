import type { Policy } from "@commit-analyzer/database";
import type { SuggestionRecord } from "@commit-analyzer/shared-types";

import type { ValidatorPolicy } from "../../shared/policy-validation/validator.service.types.js";

export const formatSuggestionAsCommitMessage = (
  suggestion: SuggestionRecord,
): string => {
  const scope = suggestion.scope?.trim();
  const header = scope
    ? `${suggestion.type}(${scope}): ${suggestion.subject}`
    : `${suggestion.type}: ${suggestion.subject}`;
  const body = suggestion.body?.trim();
  const footer = suggestion.footer?.trim();
  const parts = [header];
  if (body) parts.push("", body);
  if (footer) parts.push("", footer);
  return parts.join("\n");
};

export const toValidatorPolicy = (policy: Policy): ValidatorPolicy => ({
  rules: policy.rules.map((rule) => ({
    ruleType: rule.ruleType,
    ruleValue: rule.ruleValue,
  })),
});
