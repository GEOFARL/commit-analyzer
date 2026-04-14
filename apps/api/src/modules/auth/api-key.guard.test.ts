import "reflect-metadata";

import type { Server } from "node:http";

import { Controller, Get, INestApplication, UseGuards } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import argon2 from "argon2";
import { ClsModule } from "nestjs-cls";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_KEY_REPOSITORY } from "../../common/database/tokens.js";
import { getAuthKind } from "../../common/request-context.js";

import { ApiKeyGuard } from "./api-key.guard.js";
import { CurrentUser } from "./current-user.decorator.js";

@Controller("probe")
@UseGuards(ApiKeyGuard)
class ProbeController {
  @Get()
  handle(@CurrentUser() userId: string): { userId: string; kind: string | undefined } {
    return { userId, kind: getAuthKind() };
  }
}

describe("ApiKeyGuard", () => {
  const findByPrefix = vi.fn();
  const touchLastUsed = vi.fn().mockResolvedValue(undefined);
  let app: INestApplication;
  let validHash: string;
  const server = (): Server => app.getHttpServer() as Server;

  beforeEach(async () => {
    validHash = await argon2.hash("s3cret");
    findByPrefix.mockReset();
    touchLastUsed.mockClear();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot({
          global: true,
          middleware: { mount: true, generateId: true },
        }),
      ],
      controllers: [ProbeController],
      providers: [
        ApiKeyGuard,
        {
          provide: API_KEY_REPOSITORY,
          useValue: { findByPrefix, touchLastUsed },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("401 when header missing", async () => {
    await request(server()).get("/probe").expect(401);
    expect(findByPrefix).not.toHaveBeenCalled();
  });

  it("401 when prefix not found (revoked/unknown)", async () => {
    findByPrefix.mockResolvedValueOnce(null);
    await request(server())
      .get("/probe")
      .set("x-api-key", "pfx.s3cret")
      .expect(401);
    expect(findByPrefix).toHaveBeenCalledWith("pfx");
  });

  it("401 when secret does not verify against stored hash", async () => {
    findByPrefix.mockResolvedValueOnce({
      id: "k-1",
      userId: "u-1",
      keyPrefix: "pfx",
      keyHash: validHash,
    });
    await request(server())
      .get("/probe")
      .set("x-api-key", "pfx.wrong")
      .expect(401);
    expect(touchLastUsed).not.toHaveBeenCalled();
  });

  it("200 with valid key: handler sees user id, last_used_at updated", async () => {
    findByPrefix.mockResolvedValueOnce({
      id: "k-1",
      userId: "u-1",
      keyPrefix: "pfx",
      keyHash: validHash,
    });
    const res = await request(server())
      .get("/probe")
      .set("x-api-key", "pfx.s3cret")
      .expect(200);
    expect(res.body).toEqual({ userId: "u-1", kind: "api-key" });
    // fire-and-forget — wait a tick
    await new Promise((r) => setImmediate(r));
    expect(touchLastUsed).toHaveBeenCalledWith("k-1");
  });

  it("401 on malformed key (no delimiter)", async () => {
    await request(server())
      .get("/probe")
      .set("x-api-key", "nodelimiter")
      .expect(401);
    expect(findByPrefix).not.toHaveBeenCalled();
  });
});
