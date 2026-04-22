import {
  policyRuleSchema,
  type PolicyRuleDto,
  type PolicyRuleInput,
  type PolicyRuleTypeName,
} from "@commit-analyzer/contracts";

export type RuleFormState =
  | { ruleType: "allowedTypes"; raw: string }
  | {
      ruleType: "allowedScopes";
      mode: "list" | "regex";
      raw: string;
      pattern: string;
    }
  | { ruleType: "maxSubjectLength"; value: string }
  | { ruleType: "bodyRequired"; value: boolean }
  | { ruleType: "footerRequired"; value: boolean };

export type RuleFormEntry = {
  /** Stable client id for React keys + add/remove tracking. */
  uid: string;
  state: RuleFormState;
};

const splitList = (raw: string): string[] =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const dtoToFormState = (rule: PolicyRuleDto): RuleFormState => {
  switch (rule.ruleType) {
    case "allowedTypes":
      return { ruleType: "allowedTypes", raw: rule.ruleValue.join(", ") };
    case "allowedScopes":
      return rule.ruleValue.kind === "list"
        ? {
            ruleType: "allowedScopes",
            mode: "list",
            raw: rule.ruleValue.values.join(", "),
            pattern: "",
          }
        : {
            ruleType: "allowedScopes",
            mode: "regex",
            raw: "",
            pattern: rule.ruleValue.pattern,
          };
    case "maxSubjectLength":
      return {
        ruleType: "maxSubjectLength",
        value: String(rule.ruleValue),
      };
    case "bodyRequired":
      return { ruleType: "bodyRequired", value: rule.ruleValue };
    case "footerRequired":
      return { ruleType: "footerRequired", value: rule.ruleValue };
  }
};

export const defaultFormState = (
  ruleType: PolicyRuleTypeName,
): RuleFormState => {
  switch (ruleType) {
    case "allowedTypes":
      return {
        ruleType: "allowedTypes",
        raw: "feat, fix, chore, docs, refactor, test",
      };
    case "allowedScopes":
      return { ruleType: "allowedScopes", mode: "list", raw: "", pattern: "" };
    case "maxSubjectLength":
      return { ruleType: "maxSubjectLength", value: "72" };
    case "bodyRequired":
      return { ruleType: "bodyRequired", value: true };
    case "footerRequired":
      return { ruleType: "footerRequired", value: false };
  }
};

type FormToInputResult =
  | { ok: true; value: PolicyRuleInput }
  | { ok: false; error: "typesRequired" | "scopesRequired" | "regexInvalid" | "subjectLengthRange" };

export const formStateToInput = (state: RuleFormState): FormToInputResult => {
  switch (state.ruleType) {
    case "allowedTypes": {
      const values = splitList(state.raw);
      if (values.length === 0) return { ok: false, error: "typesRequired" };
      const parsed = policyRuleSchema.safeParse({
        ruleType: "allowedTypes",
        ruleValue: values,
      });
      if (!parsed.success) return { ok: false, error: "typesRequired" };
      return { ok: true, value: parsed.data };
    }
    case "allowedScopes": {
      if (state.mode === "list") {
        const values = splitList(state.raw);
        if (values.length === 0)
          return { ok: false, error: "scopesRequired" };
        const parsed = policyRuleSchema.safeParse({
          ruleType: "allowedScopes",
          ruleValue: { kind: "list", values },
        });
        if (!parsed.success) return { ok: false, error: "scopesRequired" };
        return { ok: true, value: parsed.data };
      }
      const parsed = policyRuleSchema.safeParse({
        ruleType: "allowedScopes",
        ruleValue: { kind: "regex", pattern: state.pattern },
      });
      if (!parsed.success) return { ok: false, error: "regexInvalid" };
      return { ok: true, value: parsed.data };
    }
    case "maxSubjectLength": {
      const n = Number(state.value);
      if (!Number.isInteger(n) || n < 1 || n > 500) {
        return { ok: false, error: "subjectLengthRange" };
      }
      return {
        ok: true,
        value: { ruleType: "maxSubjectLength", ruleValue: n },
      };
    }
    case "bodyRequired":
      return {
        ok: true,
        value: { ruleType: "bodyRequired", ruleValue: state.value },
      };
    case "footerRequired":
      return {
        ok: true,
        value: { ruleType: "footerRequired", ruleValue: state.value },
      };
  }
};

let entryCounter = 0;
export const nextEntryUid = (): string => {
  entryCounter += 1;
  return `rule-${Date.now().toString(36)}-${entryCounter}`;
};
