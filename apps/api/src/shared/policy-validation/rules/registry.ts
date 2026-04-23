import type { PolicyRuleType } from "@commit-analyzer/database";

import { allowedScopes } from "./allowed-scopes.rule.js";
import { allowedTypes } from "./allowed-types.rule.js";
import { bodyRequired } from "./body-required.rule.js";
import { footerRequired } from "./footer-required.rule.js";
import { maxSubjectLength } from "./max-subject-length.rule.js";
import type { RuleFn } from "./types.js";

export const RULE_REGISTRY: Record<PolicyRuleType, RuleFn> = {
  allowedTypes: allowedTypes as RuleFn,
  allowedScopes: allowedScopes as RuleFn,
  maxSubjectLength: maxSubjectLength as RuleFn,
  bodyRequired: bodyRequired as RuleFn,
  footerRequired: footerRequired as RuleFn,
};

export { UnknownPolicyRuleError } from "./types.js";
