import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { errorEnvelopeSchema } from "./shared/error.js";

const c = initContract();

export const llmProviders = ["openai", "anthropic"] as const;
export const llmProviderSchema = z.enum(llmProviders);
export type LlmProviderName = z.infer<typeof llmProviderSchema>;

export const llmApiKeyStatuses = ["ok", "invalid", "unknown"] as const;
export const llmApiKeyStatusSchema = z.enum(llmApiKeyStatuses);
export type LlmApiKeyStatus = z.infer<typeof llmApiKeyStatusSchema>;

// Server never returns the plaintext key; only a masked prefix and status so
// the UI can show "configured" state without exposing material.
export const llmApiKeySchema = z.object({
  id: z.string().uuid(),
  provider: llmProviderSchema,
  maskedKey: z.string(),
  status: llmApiKeyStatusSchema,
  createdAt: z.string().datetime(),
});
export type LlmApiKey = z.infer<typeof llmApiKeySchema>;

export const upsertLlmKeyRequestSchema = z.object({
  provider: llmProviderSchema,
  apiKey: z.string().min(8).max(512),
});
export type UpsertLlmKeyRequest = z.infer<typeof upsertLlmKeyRequestSchema>;

export const llmKeysContract = c.router(
  {
    list: {
      method: "GET",
      path: "/llm-keys",
      responses: {
        200: z.object({ items: z.array(llmApiKeySchema) }),
        401: errorEnvelopeSchema,
      },
      summary: "List LLM API keys for the current user (masked)",
      metadata: { auth: "jwt", rateLimit: "default" } as const,
    },
    upsert: {
      method: "PUT",
      path: "/llm-keys",
      body: upsertLlmKeyRequestSchema,
      responses: {
        200: llmApiKeySchema,
        400: errorEnvelopeSchema,
        401: errorEnvelopeSchema,
        422: errorEnvelopeSchema,
      },
      summary:
        "Verify an LLM API key with the provider and store it on success",
      metadata: { auth: "jwt", rateLimit: "auth" } as const,
    },
    remove: {
      method: "DELETE",
      path: "/llm-keys/:provider",
      pathParams: z.object({ provider: llmProviderSchema }),
      body: c.noBody(),
      responses: {
        204: c.noBody(),
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Delete the LLM API key for a provider",
      metadata: { auth: "jwt", rateLimit: "default" } as const,
    },
  },
  { strictStatusCodes: true, pathPrefix: "" },
);
