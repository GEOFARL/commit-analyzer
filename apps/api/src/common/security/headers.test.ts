import type { Server } from "node:http";

import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const validKey = Buffer.alloc(32, 1).toString("base64");

const baseEnv: Record<string, string> = {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
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
};

const applyEnv = (overrides: Record<string, string> = {}): void => {
  for (const [key, value] of Object.entries({ ...baseEnv, ...overrides })) {
    process.env[key] = value;
  }
};

describe("security headers on /health", () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;

  beforeAll(async () => {
    applyEnv({ CSP_CONNECT_SRC: "https://api.example.com wss://api.example.com" });
    const { createApp } = await import("../../main.js");
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("responds 200", async () => {
    const res = await request(server()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("sets Content-Security-Policy exactly per §7 with no leaked directives", async () => {
    const res = await request(server()).get("/health");
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeDefined();

    const directives = new Map(
      (csp as string)
        .split(";")
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.length > 0)
        .map((chunk) => {
          const [name, ...tokens] = chunk.split(/\s+/u);
          return [name, tokens.join(" ")] as const;
        }),
    );

    expect([...directives.keys()].sort()).toEqual([
      "connect-src",
      "default-src",
      "img-src",
      "script-src",
      "style-src",
    ]);
    expect(directives.get("default-src")).toBe("'self'");
    expect(directives.get("img-src")).toBe(
      "'self' https://avatars.githubusercontent.com data:",
    );
    expect(directives.get("connect-src")).toBe(
      "'self' https://*.supabase.co wss://*.supabase.co https://api.example.com wss://api.example.com",
    );
    expect(directives.get("script-src")).toBe("'self' 'unsafe-inline'");
    expect(directives.get("style-src")).toBe("'self' 'unsafe-inline'");
  });

  it("sets Strict-Transport-Security to 2 years, includeSubDomains, preload", async () => {
    const res = await request(server()).get("/health");
    expect(res.headers["strict-transport-security"]).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
  });

  it("sets X-Content-Type-Options: nosniff", async () => {
    const res = await request(server()).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("sets Referrer-Policy: strict-origin-when-cross-origin", async () => {
    const res = await request(server()).get("/health");
    expect(res.headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("allows the WEB_ORIGIN via CORS", async () => {
    const res = await request(server())
      .get("/health")
      .set("Origin", "http://localhost:3000");
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not echo non-allowlisted origins", async () => {
    const res = await request(server())
      .get("/health")
      .set("Origin", "https://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://evil.example.com",
    );
  });

  it("does not echo a non-allowlisted origin on CORS preflight", async () => {
    const res = await request(server())
      .options("/health")
      .set("Origin", "https://evil.example.com")
      .set("Access-Control-Request-Method", "POST");
    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://evil.example.com",
    );
  });

  it("allows a preflight from WEB_ORIGIN", async () => {
    const res = await request(server())
      .options("/health")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST");
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});
