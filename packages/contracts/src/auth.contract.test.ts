import { describe, expect, it } from "vitest";

import {
  apiKeySchema,
  authContract,
  createApiKeyRequestSchema,
  createApiKeyResponseSchema,
  llmApiKeySchema,
  upsertLlmKeyBodySchema,
  userSchema,
} from "./auth.contract.js";

const validUser = {
  id: "9b2d3f5a-1c4e-4b7a-9f0d-3a2b1c4d5e6f",
  email: "dev@example.com",
  name: "Dev User",
  avatarUrl: "https://example.com/a.png",
  createdAt: "2026-04-14T10:00:00.000Z",
};

const validApiKey = {
  id: "8b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
  name: "ci-bot",
  prefix: "ca_live_abcd",
  lastUsedAt: null,
  createdAt: "2026-04-14T10:00:00.000Z",
};

describe("userSchema", () => {
  it("parses a valid user", () => {
    expect(userSchema.parse(validUser)).toEqual(validUser);
  });

  it("rejects a bad email", () => {
    expect(() => userSchema.parse({ ...validUser, email: "not-an-email" })).toThrow();
  });

  it("accepts a null email", () => {
    expect(userSchema.parse({ ...validUser, email: null }).email).toBeNull();
  });
});

describe("apiKeySchema", () => {
  it("parses a valid api key", () => {
    expect(apiKeySchema.parse(validApiKey)).toEqual(validApiKey);
  });

  it("rejects when id is not a uuid", () => {
    expect(() => apiKeySchema.parse({ ...validApiKey, id: "nope" })).toThrow();
  });
});

describe("createApiKeyRequestSchema", () => {
  it("accepts a reasonable name", () => {
    expect(createApiKeyRequestSchema.parse({ name: "ci-bot" })).toEqual({ name: "ci-bot" });
  });

  it("rejects an empty name", () => {
    expect(() => createApiKeyRequestSchema.parse({ name: "" })).toThrow();
  });
});

describe("createApiKeyResponseSchema", () => {
  it("parses a key create response including plaintext key", () => {
    const parsed = createApiKeyResponseSchema.parse({
      ...validApiKey,
      key: "ca_live_abcd1234567890",
    });
    expect(parsed.key).toBe("ca_live_abcd1234567890");
  });
});

describe("authContract", () => {
  it("declares the four endpoints in scope", () => {
    expect(authContract.me.method).toBe("GET");
    expect(authContract.me.path).toBe("/me");
    expect(authContract.apiKeys.list.method).toBe("GET");
    expect(authContract.apiKeys.list.path).toBe("/api-keys");
    expect(authContract.apiKeys.create.method).toBe("POST");
    expect(authContract.apiKeys.create.path).toBe("/api-keys");
    expect(authContract.apiKeys.revoke.method).toBe("DELETE");
    expect(authContract.apiKeys.revoke.path).toBe("/api-keys/:id");
  });

  it("tags every auth endpoint with jwt", () => {
    expect(authContract.me.metadata).toEqual({ auth: "jwt", rateLimit: "default" });
    expect(authContract.apiKeys.list.metadata).toEqual({ auth: "jwt", rateLimit: "default" });
    expect(authContract.apiKeys.create.metadata).toEqual({ auth: "jwt", rateLimit: "auth" });
    expect(authContract.apiKeys.revoke.metadata).toEqual({ auth: "jwt", rateLimit: "default" });
  });

  it("declares deleteAccount on DELETE /me with auth-tier throttle", () => {
    expect(authContract.deleteAccount.method).toBe("DELETE");
    expect(authContract.deleteAccount.path).toBe("/me");
    expect(authContract.deleteAccount.metadata).toEqual({
      auth: "jwt",
      rateLimit: "auth",
    });
  });
});

const validLlmKey = {
  id: "a1b2c3d4-e5f6-4789-9abc-def012345678",
  provider: "openai" as const,
  status: "ok" as const,
  createdAt: "2026-04-14T10:00:00.000Z",
};

describe("llmApiKeySchema", () => {
  it("parses a valid record", () => {
    expect(llmApiKeySchema.parse(validLlmKey)).toEqual(validLlmKey);
  });

  it("rejects an unknown provider", () => {
    expect(() =>
      llmApiKeySchema.parse({ ...validLlmKey, provider: "cohere" }),
    ).toThrow();
  });

  it("rejects an unknown status", () => {
    expect(() =>
      llmApiKeySchema.parse({ ...validLlmKey, status: "expired" }),
    ).toThrow();
  });

  it("does not tolerate extra sensitive fields bleeding through", () => {
    // zod with `.strict()` would be ideal; default strip means unexpected
    // fields are silently dropped on parse. This asserts the parsed output
    // shape is exactly {id, provider, status, createdAt} — no key / iv / tag.
    const parsed = llmApiKeySchema.parse({
      ...validLlmKey,
      keyEnc: Buffer.from("nope"),
      keyIv: Buffer.from("nope"),
      keyTag: Buffer.from("nope"),
      plaintextKey: "sk-should-not-leak",
    });
    expect(Object.keys(parsed).sort()).toEqual(
      ["createdAt", "id", "provider", "status"].sort(),
    );
  });
});

describe("upsertLlmKeyBodySchema", () => {
  it("accepts a reasonable key", () => {
    expect(upsertLlmKeyBodySchema.parse({ key: "sk-validlookingkey" })).toEqual({
      key: "sk-validlookingkey",
    });
  });

  it("rejects an empty key", () => {
    expect(() => upsertLlmKeyBodySchema.parse({ key: "" })).toThrow();
  });

  it("rejects a suspiciously short key", () => {
    expect(() => upsertLlmKeyBodySchema.parse({ key: "short" })).toThrow();
  });
});

describe("authContract.llmKeys", () => {
  it("declares list / upsert / delete endpoints at the spec paths", () => {
    expect(authContract.llmKeys.list.method).toBe("GET");
    expect(authContract.llmKeys.list.path).toBe("/llm-keys");
    expect(authContract.llmKeys.upsert.method).toBe("PUT");
    expect(authContract.llmKeys.upsert.path).toBe("/llm-keys/:provider");
    expect(authContract.llmKeys.delete.method).toBe("DELETE");
    expect(authContract.llmKeys.delete.path).toBe("/llm-keys/:provider");
  });

  it("tags jwt + correct throttle tiers", () => {
    expect(authContract.llmKeys.list.metadata).toEqual({
      auth: "jwt",
      rateLimit: "default",
    });
    expect(authContract.llmKeys.upsert.metadata).toEqual({
      auth: "jwt",
      rateLimit: "auth",
    });
    expect(authContract.llmKeys.delete.metadata).toEqual({
      auth: "jwt",
      rateLimit: "default",
    });
  });
});
