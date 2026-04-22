import {
  createPolicySchema,
  policyRuleSchema,
  updatePolicySchema,
} from "@commit-analyzer/contracts";
import { z } from "zod";

export {
  createPolicySchema,
  policyRuleSchema,
  updatePolicySchema,
} from "@commit-analyzer/contracts";

export type CreatePolicyInputParsed = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInputParsed = z.infer<typeof updatePolicySchema>;

export const defaultPolicyTemplateSchema = z.object({
  enabled: z.boolean(),
  rules: z.array(policyRuleSchema).default([]),
});

export type DefaultPolicyTemplate = z.infer<typeof defaultPolicyTemplateSchema>;
