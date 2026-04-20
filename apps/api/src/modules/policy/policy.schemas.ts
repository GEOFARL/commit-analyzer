import { z } from "zod";

const isValidRegex = (pattern: string): boolean => {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

const allowedTypesRule = z.object({
  ruleType: z.literal("allowedTypes"),
  ruleValue: z.array(z.string().min(1)).min(1),
});

const allowedScopesRule = z.object({
  ruleType: z.literal("allowedScopes"),
  ruleValue: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("list"),
      values: z.array(z.string().min(1)).min(1),
    }),
    z.object({
      kind: z.literal("regex"),
      pattern: z.string().refine(isValidRegex, "invalid regex"),
    }),
  ]),
});

const maxSubjectLengthRule = z.object({
  ruleType: z.literal("maxSubjectLength"),
  ruleValue: z.number().int().positive().max(500),
});

const bodyRequiredRule = z.object({
  ruleType: z.literal("bodyRequired"),
  ruleValue: z.boolean(),
});

const footerRequiredRule = z.object({
  ruleType: z.literal("footerRequired"),
  ruleValue: z.boolean(),
});

export const policyRuleSchema = z.discriminatedUnion("ruleType", [
  allowedTypesRule,
  allowedScopesRule,
  maxSubjectLengthRule,
  bodyRequiredRule,
  footerRequiredRule,
]);

export const createPolicySchema = z.object({
  name: z.string().min(1).max(100),
  rules: z.array(policyRuleSchema).default([]),
});

export const updatePolicySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  rules: z.array(policyRuleSchema).optional(),
});

export type CreatePolicyInputParsed = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInputParsed = z.infer<typeof updatePolicySchema>;

export const defaultPolicyTemplateSchema = z.object({
  enabled: z.boolean(),
  rules: z.array(policyRuleSchema).default([]),
});

export type DefaultPolicyTemplate = z.infer<typeof defaultPolicyTemplateSchema>;
