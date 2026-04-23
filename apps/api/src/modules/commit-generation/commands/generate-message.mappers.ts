import type { Policy } from "@commit-analyzer/database";

import type { ValidatorPolicy } from "../../../shared/policy-validation/validator.service.types.js";
import {
  AuthError,
  QuotaError,
  QuotaExhaustedError,
  TimeoutError,
  UpstreamError,
} from "../providers/llm-provider.errors.js";
import type { PromptPolicy } from "../services/prompt-builder.types.js";

export const regenSystemSuffix = (failures: string[]): string =>
  [
    "",
    "Your previous suggestions failed these policy rules:",
    ...failures.map((line) => `- ${line}`),
    "Regenerate all suggestions so every one satisfies the rules above.",
  ].join("\n");

export const toPromptPolicy = (
  policy: Policy | null,
): PromptPolicy | undefined => {
  if (!policy) return undefined;
  return {
    rules: policy.rules.map((rule) => ({
      ruleType: rule.ruleType,
      ruleValue: rule.ruleValue,
    })) as PromptPolicy["rules"],
  };
};

export const toValidatorPolicy = (policy: Policy): ValidatorPolicy => ({
  rules: policy.rules.map((rule) => ({
    ruleType: rule.ruleType,
    ruleValue: rule.ruleValue,
  })),
});

export const classifyGenerationError = (error: unknown): string => {
  if (error instanceof AuthError) return "LLM_AUTH";
  if (error instanceof QuotaExhaustedError) return "LLM_QUOTA_EXHAUSTED";
  if (error instanceof QuotaError) return "LLM_RATE_LIMIT";
  if (error instanceof TimeoutError) return "LLM_TIMEOUT";
  if (error instanceof UpstreamError) return "LLM_UPSTREAM";
  if (error instanceof Error && error.constructor.name !== "Error") {
    return error.constructor.name;
  }
  return "UNKNOWN";
};
