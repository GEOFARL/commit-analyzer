import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { validationResultSchema } from "./policies.contract.js";
import { errorEnvelopeSchema } from "./shared/error.js";
import type { RouteMetadata } from "./shared/metadata.js";

const c = initContract();

const llmProviderSchema = z.enum(["openai", "anthropic"]);

export const historySuggestionSchema = z.object({
  type: z.string(),
  scope: z.string().nullable(),
  subject: z.string(),
  body: z.string().nullable(),
  footer: z.string().nullable(),
  compliant: z.boolean(),
  validation: validationResultSchema.nullable(),
});
export type HistorySuggestion = z.infer<typeof historySuggestionSchema>;

export const generationStatusSchema = z.enum([
  "pending",
  "streaming",
  "completed",
  "failed",
  "cancelled",
]);

export const historyEntrySchema = z.object({
  id: z.string().uuid(),
  provider: llmProviderSchema,
  model: z.string(),
  status: generationStatusSchema,
  tokensUsed: z.number().int().nonnegative(),
  suggestions: z.array(historySuggestionSchema),
  policyId: z.string().uuid().nullable(),
  policyName: z.string().nullable(),
  repositoryId: z.string().uuid().nullable(),
  repositoryFullName: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const historyListResponseSchema = z.object({
  items: z.array(historyEntrySchema),
  nextCursor: z.string().nullable(),
});
export type HistoryListResponse = z.infer<typeof historyListResponseSchema>;

export const historyContract = c.router(
  {
    list: {
      method: "GET",
      path: "/history",
      query: z.object({
        limit: z.coerce.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
      responses: {
        200: historyListResponseSchema,
        401: errorEnvelopeSchema,
      },
      summary: "List the current user's generation history",
      metadata: {
        auth: "jwtOrApiKey",
        rateLimit: "default",
      } satisfies RouteMetadata,
    },
  },
  { strictStatusCodes: true },
);
