import { describe, expect, it } from "vitest";

import {
  llmApiKeySchema,
  llmKeysContract,
  upsertLlmKeyRequestSchema,
} from "./llm-keys.contract.js";

const validKey = {
  id: "a1b2c3d4-e5f6-4789-9abc-def012345678",
  provider: "openai" as const,
  maskedKey: "sk-p•••••••••xyz",
  status: "ok" as const,
  createdAt: "2026-04-14T10:00:00.000Z",
};

describe("llmApiKeySchema", () => {
  it("parses a valid masked key record", () => {
    expect(llmApiKeySchema.parse(validKey)).toEqual(validKey);
  });

  it("rejects an unknown provider", () => {
    expect(() =>
      llmApiKeySchema.parse({ ...validKey, provider: "cohere" }),
    ).toThrow();
  });

  it("rejects an unknown status", () => {
    expect(() =>
      llmApiKeySchema.parse({ ...validKey, status: "expired" }),
    ).toThrow();
  });
});

describe("upsertLlmKeyRequestSchema", () => {
  it("accepts a reasonable provider + key", () => {
    const parsed = upsertLlmKeyRequestSchema.parse({
      provider: "anthropic",
      apiKey: "sk-ant-validlookingkey0123",
    });
    expect(parsed.provider).toBe("anthropic");
  });

  it("rejects an empty key", () => {
    expect(() =>
      upsertLlmKeyRequestSchema.parse({ provider: "openai", apiKey: "" }),
    ).toThrow();
  });

  it("rejects a suspiciously short key", () => {
    expect(() =>
      upsertLlmKeyRequestSchema.parse({ provider: "openai", apiKey: "short" }),
    ).toThrow();
  });
});

describe("llmKeysContract", () => {
  it("declares list / upsert / remove endpoints", () => {
    expect(llmKeysContract.list.method).toBe("GET");
    expect(llmKeysContract.list.path).toBe("/llm-keys");
    expect(llmKeysContract.upsert.method).toBe("PUT");
    expect(llmKeysContract.upsert.path).toBe("/llm-keys");
    expect(llmKeysContract.remove.method).toBe("DELETE");
    expect(llmKeysContract.remove.path).toBe("/llm-keys/:provider");
  });

  it("tags jwt + throttle tiers", () => {
    expect(llmKeysContract.list.metadata).toEqual({
      auth: "jwt",
      rateLimit: "default",
    });
    expect(llmKeysContract.upsert.metadata).toEqual({
      auth: "jwt",
      rateLimit: "auth",
    });
    expect(llmKeysContract.remove.metadata).toEqual({
      auth: "jwt",
      rateLimit: "default",
    });
  });
});
