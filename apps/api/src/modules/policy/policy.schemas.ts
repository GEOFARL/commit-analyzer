import {
  createPolicySchema,
  updatePolicySchema,
} from "@commit-analyzer/contracts";
import { z } from "zod";

export {
  createPolicySchema,
  defaultPolicyTemplateSchema,
  updatePolicySchema,
} from "@commit-analyzer/contracts";
export type { DefaultPolicyTemplate } from "@commit-analyzer/contracts";

export type CreatePolicyInputParsed = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInputParsed = z.infer<typeof updatePolicySchema>;
