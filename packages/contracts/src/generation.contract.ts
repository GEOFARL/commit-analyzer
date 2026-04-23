import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ruleResultSchema } from "./policies.contract.js";
import { errorEnvelopeSchema } from "./shared/error.js";
import type { RouteMetadata } from "./shared/metadata.js";

const c = initContract();

const llmProviderSchema = z.enum(["openai", "anthropic"]);

export const generateRequestSchema = z.object({
  diff: z.string().min(1),
  provider: llmProviderSchema,
  model: z.string().min(1).max(128),
  repositoryId: z.string().uuid().optional(),
  policyId: z.string().uuid().optional(),
  count: z.number().int().min(1).max(5).optional(),
});
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const suggestionFrameSchema = z.object({
  index: z.number().int().nonnegative(),
  type: z.string(),
  scope: z.string().nullable(),
  subject: z.string(),
  body: z.string().nullable(),
  footer: z.string().nullable(),
  compliant: z.boolean(),
  validation: z
    .object({
      passed: z.boolean(),
      results: z.array(ruleResultSchema),
    })
    .nullable(),
});
export type SuggestionFrame = z.infer<typeof suggestionFrameSchema>;

export const tokenFrameSchema = z.object({
  index: z.number().int().nonnegative(),
  delta: z.string(),
});
export type TokenFrame = z.infer<typeof tokenFrameSchema>;

export const doneFrameSchema = z.object({
  historyId: z.string().uuid().nullable(),
  tokensUsed: z.number().int().nonnegative(),
});
export type DoneFrame = z.infer<typeof doneFrameSchema>;

export const errorFrameSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ErrorFrame = z.infer<typeof errorFrameSchema>;

export const generationContract = c.router(
  {
    // SSE stream — frames (suggestion/token/done/error) + headers per Module C
    // §2 and 05-api-contracts §6. `200: z.void()` because ts-rest has no SSE
    // primitive; consume via fetch streaming or EventSource, not initClient.
    generate: {
      method: "POST",
      path: "/generate",
      body: generateRequestSchema,
      responses: {
        200: z.void(),
        400: errorEnvelopeSchema,
        401: errorEnvelopeSchema,
        412: errorEnvelopeSchema,
        429: errorEnvelopeSchema,
        500: errorEnvelopeSchema,
      },
      summary: "Generate commit messages (SSE stream — see Module C §2)",
      metadata: {
        auth: "jwtOrApiKey",
        rateLimit: "generate",
      } satisfies RouteMetadata,
    },
  },
  { strictStatusCodes: true },
);
