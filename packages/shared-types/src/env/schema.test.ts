import { describe, expect, it } from "vitest";

import { EnvValidationError, loadClientEnv, loadServerEnv } from "./index.js";

const validKey = Buffer.alloc(32, 1).toString("base64");

const validServer = {
  NODE_ENV: "test",
  LOG_LEVEL: "info",
  APP_URL: "http://localhost:3000",
  API_URL: "http://localhost:4000",
  WEB_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  GITHUB_CLIENT_ID: "cid",
  GITHUB_CLIENT_SECRET: "csecret",
  ENCRYPTION_KEY_BASE64: validKey,
} as const;

const validClient = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_API_URL: "http://localhost:4000",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
} as const;

describe("loadServerEnv", () => {
  it("accepts a fully-populated env", () => {
    const env = loadServerEnv({ ...validServer });
    expect(env.DATABASE_URL).toBe(validServer.DATABASE_URL);
    expect(env.NODE_ENV).toBe("test");
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it("applies defaults for NODE_ENV and LOG_LEVEL", () => {
    const { NODE_ENV: _n, LOG_LEVEL: _l, ...rest } = validServer;
    const env = loadServerEnv({ ...rest });
    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("throws when a required variable is missing", () => {
    const { DATABASE_URL: _d, ...rest } = validServer;
    expect(() => loadServerEnv({ ...rest })).toThrow(EnvValidationError);
    try {
      loadServerEnv({ ...rest });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as EnvValidationError).issues[0]?.path).toEqual([
        "DATABASE_URL",
      ]);
      expect((error as Error).message).toContain("DATABASE_URL");
    }
  });

  it("rejects a malformed URL", () => {
    expect(() =>
      loadServerEnv({ ...validServer, API_URL: "not-a-url" }),
    ).toThrow(/API_URL/);
  });

  it("rejects an encryption key that is not 32 raw bytes", () => {
    const shortKey = Buffer.alloc(16, 1).toString("base64");
    expect(() =>
      loadServerEnv({ ...validServer, ENCRYPTION_KEY_BASE64: shortKey }),
    ).toThrow(/ENCRYPTION_KEY_BASE64/);
    expect(() =>
      loadServerEnv({ ...validServer, ENCRYPTION_KEY_BASE64: "!!!not-b64!!!" }),
    ).toThrow(/ENCRYPTION_KEY_BASE64/);
  });

  it("rejects an invalid NODE_ENV value", () => {
    expect(() =>
      loadServerEnv({ ...validServer, NODE_ENV: "staging" }),
    ).toThrow(/NODE_ENV/);
  });
});

describe("loadClientEnv", () => {
  it("accepts valid client env", () => {
    const env = loadClientEnv({ ...validClient });
    expect(env.NEXT_PUBLIC_APP_URL).toBe(validClient.NEXT_PUBLIC_APP_URL);
  });

  it("throws on missing NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
    const { NEXT_PUBLIC_SUPABASE_ANON_KEY: _k, ...rest } = validClient;
    expect(() => loadClientEnv({ ...rest })).toThrow(EnvValidationError);
  });

  it("throws on malformed NEXT_PUBLIC_API_URL", () => {
    expect(() =>
      loadClientEnv({ ...validClient, NEXT_PUBLIC_API_URL: "nope" }),
    ).toThrow(/NEXT_PUBLIC_API_URL/);
  });
});
