import { Injectable } from "@nestjs/common";

import { parseConventionalCommit } from "../../../shared/cc-parser.js";

import { RULE_REGISTRY, UnknownPolicyRuleError } from "./rules/registry.js";
import type {
  RuleResult,
  ValidationResult,
  ValidatorPolicy,
} from "./validator.service.types.js";

@Injectable()
export class ValidatorService {
  validate(message: string, policy: ValidatorPolicy): ValidationResult {
    const parsed = parseConventionalCommit(message);

    if (!parsed.ok) {
      return {
        passed: false,
        results: [
          { ruleType: "format", passed: false, message: parsed.reason },
        ],
      };
    }

    const results: RuleResult[] = [];

    for (const rule of policy.rules) {
      const fn = RULE_REGISTRY[rule.ruleType];
      if (!fn) throw new UnknownPolicyRuleError(rule.ruleType);

      const outcome = fn(parsed, rule.ruleValue);
      results.push({
        ruleType: rule.ruleType,
        passed: outcome.passed,
        ...(outcome.message !== undefined ? { message: outcome.message } : {}),
      });
    }

    return { passed: results.every((r) => r.passed), results };
  }
}
