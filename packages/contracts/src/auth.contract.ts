import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { errorEnvelopeSchema } from "./shared/error.js";

const c = initContract();

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
      metadata: { auth: "jwt" } as const,
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
      metadata: { auth: "jwt" } as const,
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
          metadata: { auth: "jwt" } as const,
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
          metadata: { auth: "jwt" } as const,
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
          metadata: { auth: "jwt" } as const,
        },
      },
      { pathPrefix: "" },
    ),
  },
  {
    strictStatusCodes: true,
  },
);
