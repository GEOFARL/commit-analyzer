import { llmProviders } from "@commit-analyzer/shared-types";
import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { errorEnvelopeSchema } from "./shared/error.js";

const c = initContract();

export const llmProviderSchema = z.enum(llmProviders);
export type LlmProviderName = z.infer<typeof llmProviderSchema>;

export const llmApiKeyStatuses = ["ok", "invalid", "unknown"] as const;
export const llmApiKeyStatusSchema = z.enum(llmApiKeyStatuses);
export type LlmApiKeyStatus = z.infer<typeof llmApiKeyStatusSchema>;

// Response shape per docs/03-modules/F-settings.md §2 — no plaintext and no
// prefix is exposed. The UI renders a fixed placeholder to show "configured".
export const llmApiKeySchema = z.object({
  id: z.string().uuid(),
  provider: llmProviderSchema,
  status: llmApiKeyStatusSchema,
  createdAt: z.string().datetime(),
});
export type LlmApiKey = z.infer<typeof llmApiKeySchema>;

export const upsertLlmKeyBodySchema = z.object({
  key: z.string().min(8).max(512),
});
export type UpsertLlmKeyBody = z.infer<typeof upsertLlmKeyBodySchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof userSchema>;

export const apiKeySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  prefix: z.string(),
  lastUsedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type ApiKey = z.infer<typeof apiKeySchema>;

export const createApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(100),
});
export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;

export const createApiKeyResponseSchema = apiKeySchema.extend({
  key: z.string(),
});
export type CreateApiKeyResponse = z.infer<typeof createApiKeyResponseSchema>;

const authSyncRequestSchema = z.object({
  providerToken: z.string().min(1).nullable().optional(),
});

export const authContract = c.router(
  {
    me: {
      method: "GET",
      path: "/me",
      responses: {
        200: userSchema,
        401: errorEnvelopeSchema,
      },
      summary: "Get the currently authenticated user",
      metadata: { auth: "jwt", rateLimit: "default" } as const,
    },
    sync: {
      method: "POST",
      path: "/auth/sync",
      body: authSyncRequestSchema,
      responses: {
        200: userSchema,
        401: errorEnvelopeSchema,
      },
      summary:
        "Mirror the authenticated Supabase user into public.users and store the encrypted GitHub provider token",
      metadata: { auth: "jwt", rateLimit: "default" } as const,
    },
    deleteAccount: {
      method: "DELETE",
      path: "/me",
      body: c.noBody(),
      responses: {
        204: c.noBody(),
        401: errorEnvelopeSchema,
      },
      summary:
        "Delete the authenticated user; cascades from auth.users → public.users and downstream tables",
      metadata: { auth: "jwt", rateLimit: "auth" } as const,
    },
    apiKeys: c.router(
      {
        list: {
          method: "GET",
          path: "/api-keys",
          responses: {
            200: z.object({ items: z.array(apiKeySchema) }),
            401: errorEnvelopeSchema,
          },
          summary: "List API keys for the current user",
          metadata: { auth: "jwt", rateLimit: "default" } as const,
        },
        create: {
          method: "POST",
          path: "/api-keys",
          body: createApiKeyRequestSchema,
          responses: {
            201: createApiKeyResponseSchema,
            400: errorEnvelopeSchema,
            401: errorEnvelopeSchema,
          },
          summary: "Create a new API key (plaintext returned once)",
          metadata: { auth: "jwt", rateLimit: "auth" } as const,
        },
        revoke: {
          method: "DELETE",
          path: "/api-keys/:id",
          pathParams: z.object({ id: z.string().uuid() }),
          body: c.noBody(),
          responses: {
            204: c.noBody(),
            401: errorEnvelopeSchema,
            404: errorEnvelopeSchema,
          },
          summary: "Revoke an API key",
          metadata: { auth: "jwt", rateLimit: "default" } as const,
        },
      },
      { pathPrefix: "" },
    ),
    llmKeys: c.router(
      {
        list: {
          method: "GET",
          path: "/llm-keys",
          responses: {
            200: z.object({ items: z.array(llmApiKeySchema) }),
            401: errorEnvelopeSchema,
          },
          summary: "List LLM API keys for the current user",
          metadata: { auth: "jwt", rateLimit: "default" } as const,
        },
        upsert: {
          method: "PUT",
          path: "/llm-keys/:provider",
          pathParams: z.object({ provider: llmProviderSchema }),
          body: upsertLlmKeyBodySchema,
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
        delete: {
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
      { pathPrefix: "" },
    ),
  },
  {
    strictStatusCodes: true,
  },
);
