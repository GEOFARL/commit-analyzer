import { describe, expect, it } from "vitest";

import {
  apiKeySchema,
  authContract,
  createApiKeyRequestSchema,
  createApiKeyResponseSchema,
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
    expect(authContract.me.metadata).toEqual({ auth: "jwt" });
    expect(authContract.apiKeys.list.metadata).toEqual({ auth: "jwt" });
    expect(authContract.apiKeys.create.metadata).toEqual({ auth: "jwt" });
    expect(authContract.apiKeys.revoke.metadata).toEqual({ auth: "jwt" });
  });
});
