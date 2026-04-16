import type { Server } from "node:http";

import { Controller, Get, type INestApplication, Module, Post } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Throttle, ThrottlerModule } from "@nestjs/throttler";
import { ClsModule } from "nestjs-cls";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { THROTTLE_TIERS } from "./tiers.js";
import { UserThrottlerGuard } from "./user-throttler.guard.js";

// ── Stub controllers ──────────────────────────────────────────────

@Controller()
class DefaultController {
  @Get("me")
  me(): { ok: true } {
    return { ok: true };
  }
}

@Controller()
class AuthController {
  @Throttle({
    default: {
      limit: THROTTLE_TIERS.auth.limit,
      ttl: THROTTLE_TIERS.auth.ttl,
    },
  })
  @Post("api-keys")
  create(): { ok: true } {
    return { ok: true };
  }
}

@Controller()
class GenerateController {
  @Throttle({
    default: {
      limit: THROTTLE_TIERS.generate.limit,
      ttl: THROTTLE_TIERS.generate.ttl,
    },
  })
  @Post("generate")
  generate(): { ok: true } {
    return { ok: true };
  }
}

// ── Test module ───────────────────────────────────────────────────

@Module({
  imports: [
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    ThrottlerModule.forRoot([
      {
        name: THROTTLE_TIERS.default.name,
        limit: THROTTLE_TIERS.default.limit,
        ttl: THROTTLE_TIERS.default.ttl,
      },
    ]),
  ],
  controllers: [DefaultController, AuthController, GenerateController],
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
class TestAppModule {}

// ── Tests ─────────────────────────────────────────────────────────

describe("throttler integration", () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns rate-limit headers on 2xx", async () => {
    const res = await request(server)
      .get("/me")
      .set("x-forwarded-for", "10.99.0.1");
    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty("x-ratelimit-limit");
    expect(res.headers).toHaveProperty("x-ratelimit-remaining");
  });

  it("11th POST /api-keys within 60s returns 429", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(server)
        .post("/api-keys")
        .set("x-forwarded-for", "10.0.0.42");
      expect(res.status).toBe(201);
    }

    const blocked = await request(server)
      .post("/api-keys")
      .set("x-forwarded-for", "10.0.0.42");
    expect(blocked.status).toBe(429);
    expect(blocked.headers).toHaveProperty("retry-after");
  });

  it("21st POST /generate within 60s returns 429; 20th succeeds", async () => {
    for (let i = 0; i < 20; i++) {
      const res = await request(server)
        .post("/generate")
        .set("x-forwarded-for", "10.0.0.99");
      expect(res.status).toBe(201);
    }

    const blocked = await request(server)
      .post("/generate")
      .set("x-forwarded-for", "10.0.0.99");
    expect(blocked.status).toBe(429);
  });

  it("GET /me under default tier allows 60 requests", async () => {
    for (let i = 0; i < 60; i++) {
      const res = await request(server)
        .get("/me")
        .set("x-forwarded-for", "10.0.0.200");
      expect(res.status).toBe(200);
    }

    const blocked = await request(server)
      .get("/me")
      .set("x-forwarded-for", "10.0.0.200");
    expect(blocked.status).toBe(429);
  });

  it("keying falls back to IP — different IPs are independent", async () => {
    for (let i = 0; i < 10; i++) {
      await request(server)
        .post("/api-keys")
        .set("x-forwarded-for", "10.0.0.1");
    }

    const blocked = await request(server)
      .post("/api-keys")
      .set("x-forwarded-for", "10.0.0.1");
    expect(blocked.status).toBe(429);

    const ok = await request(server)
      .post("/api-keys")
      .set("x-forwarded-for", "10.0.0.2");
    expect(ok.status).toBe(201);
  });
});
