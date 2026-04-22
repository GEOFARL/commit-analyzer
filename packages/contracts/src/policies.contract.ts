import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { errorEnvelopeSchema } from "./shared/error.js";
import type { RouteMetadata } from "./shared/metadata.js";

const c = initContract();

const isValidRegex = (pattern: string): boolean => {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

export const policyRuleTypes = [
  "allowedTypes",
  "allowedScopes",
  "maxSubjectLength",
  "bodyRequired",
  "footerRequired",
] as const;

export const policyRuleTypeSchema = z.enum(policyRuleTypes);
export type PolicyRuleTypeName = z.infer<typeof policyRuleTypeSchema>;

export const allowedTypesRuleSchema = z.object({
  ruleType: z.literal("allowedTypes"),
  ruleValue: z.array(z.string().min(1)).min(1),
});

export const allowedScopesRuleSchema = z.object({
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

export const maxSubjectLengthRuleSchema = z.object({
  ruleType: z.literal("maxSubjectLength"),
  ruleValue: z.number().int().positive().max(500),
});

export const bodyRequiredRuleSchema = z.object({
  ruleType: z.literal("bodyRequired"),
  ruleValue: z.boolean(),
});

export const footerRequiredRuleSchema = z.object({
  ruleType: z.literal("footerRequired"),
  ruleValue: z.boolean(),
});

export const policyRuleSchema = z.discriminatedUnion("ruleType", [
  allowedTypesRuleSchema,
  allowedScopesRuleSchema,
  maxSubjectLengthRuleSchema,
  bodyRequiredRuleSchema,
  footerRequiredRuleSchema,
]);
export type PolicyRuleInput = z.infer<typeof policyRuleSchema>;

export const createPolicySchema = z.object({
  name: z.string().min(1).max(100),
  rules: z.array(policyRuleSchema).default([]),
});
export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

export const updatePolicySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  rules: z.array(policyRuleSchema).optional(),
});
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;

const ruleIdShape = { id: z.string().uuid() };

export const policyRuleDtoSchema = z.discriminatedUnion("ruleType", [
  allowedTypesRuleSchema.extend(ruleIdShape),
  allowedScopesRuleSchema.extend(ruleIdShape),
  maxSubjectLengthRuleSchema.extend(ruleIdShape),
  bodyRequiredRuleSchema.extend(ruleIdShape),
  footerRequiredRuleSchema.extend(ruleIdShape),
]);
export type PolicyRuleDto = z.infer<typeof policyRuleDtoSchema>;

export const policyDtoSchema = z.object({
  id: z.string().uuid(),
  repositoryId: z.string().uuid(),
  name: z.string(),
  isActive: z.boolean(),
  rules: z.array(policyRuleDtoSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PolicyDto = z.infer<typeof policyDtoSchema>;

export const ruleResultSchema = z.object({
  ruleType: z.union([policyRuleTypeSchema, z.literal("format")]),
  passed: z.boolean(),
  message: z.string().optional(),
});
export type RuleResultDto = z.infer<typeof ruleResultSchema>;

export const validationResultSchema = z.object({
  passed: z.boolean(),
  results: z.array(ruleResultSchema),
});
export type ValidationResultDto = z.infer<typeof validationResultSchema>;

export const validatePolicyInputSchema = z.object({
  message: z.string().min(1),
});
export type ValidatePolicyInput = z.infer<typeof validatePolicyInputSchema>;

const repoPathParams = z.object({ repoId: z.string().uuid() });
const repoAndPolicyPathParams = z.object({
  repoId: z.string().uuid(),
  id: z.string().uuid(),
});

export const policiesContract = c.router(
  {
    list: {
      method: "GET",
      path: "/repos/:repoId/policies",
      pathParams: repoPathParams,
      responses: {
        200: z.object({ items: z.array(policyDtoSchema) }),
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "List policies for a repository",
      metadata: { auth: "jwt", rateLimit: "default" } satisfies RouteMetadata,
    },
    get: {
      method: "GET",
      path: "/repos/:repoId/policies/:id",
      pathParams: repoAndPolicyPathParams,
      responses: {
        200: policyDtoSchema,
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Get a policy by id",
      metadata: { auth: "jwt", rateLimit: "default" } satisfies RouteMetadata,
    },
    create: {
      method: "POST",
      path: "/repos/:repoId/policies",
      pathParams: repoPathParams,
      body: createPolicySchema,
      responses: {
        201: policyDtoSchema,
        400: errorEnvelopeSchema,
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Create a policy for a repository",
      metadata: { auth: "jwt", rateLimit: "default" } satisfies RouteMetadata,
    },
    update: {
      method: "PATCH",
      path: "/repos/:repoId/policies/:id",
      pathParams: repoAndPolicyPathParams,
      body: updatePolicySchema,
      responses: {
        200: policyDtoSchema,
        400: errorEnvelopeSchema,
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Update a policy",
      metadata: { auth: "jwt", rateLimit: "default" } satisfies RouteMetadata,
    },
    delete: {
      method: "DELETE",
      path: "/repos/:repoId/policies/:id",
      pathParams: repoAndPolicyPathParams,
      body: c.noBody(),
      responses: {
        204: c.noBody(),
        400: errorEnvelopeSchema,
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Delete a policy (inactive only)",
      metadata: { auth: "jwt", rateLimit: "default" } satisfies RouteMetadata,
    },
    activate: {
      method: "POST",
      path: "/repos/:repoId/policies/:id/activate",
      pathParams: repoAndPolicyPathParams,
      body: z.object({}).strict(),
      responses: {
        200: policyDtoSchema,
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
        409: errorEnvelopeSchema,
      },
      summary: "Activate a policy for its repository (atomic swap)",
      metadata: { auth: "jwt", rateLimit: "default" } satisfies RouteMetadata,
    },
    validate: {
      method: "POST",
      path: "/repos/:repoId/policies/:id/validate",
      pathParams: repoAndPolicyPathParams,
      body: validatePolicyInputSchema,
      responses: {
        200: validationResultSchema,
        400: errorEnvelopeSchema,
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Validate a commit message against a policy",
      metadata: { auth: "jwt", rateLimit: "default" } satisfies RouteMetadata,
    },
  },
  { strictStatusCodes: true },
);
