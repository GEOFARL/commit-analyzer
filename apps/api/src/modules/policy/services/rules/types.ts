import type { ParsedCC } from "../../../../shared/cc-parser.js";

export type ParsedOk = Extract<ParsedCC, { ok: true }>;

export type RuleOutcome = { passed: boolean; message?: string };

export type RuleFn<TValue = unknown> = (
  parsed: ParsedOk,
  value: TValue,
) => RuleOutcome;

export class UnknownPolicyRuleError extends Error {
  constructor(public readonly ruleType: string) {
    super(`Unknown policy rule type: ${ruleType}`);
    this.name = "UnknownPolicyRuleError";
  }
}
