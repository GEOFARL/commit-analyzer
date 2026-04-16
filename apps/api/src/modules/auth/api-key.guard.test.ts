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
  const findActiveByPrefix = vi.fn();
  const touchLastUsed = vi.fn().mockResolvedValue(undefined);
  let app: INestApplication;
  // Full key: "git_abcd" (8-char prefix) + random secret suffix.
  const validKey = "git_abcdSECRETTAIL1234";
  let validHash: string;
  const server = (): Server => app.getHttpServer() as Server;

  beforeEach(async () => {
    validHash = await argon2.hash(validKey);
    findActiveByPrefix.mockReset();
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
          useValue: { findActiveByPrefix, touchLastUsed },
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
    const res = await request(server()).get("/probe").expect(401);
    expect((res.body as { message: string }).message).toBe("invalid credentials");
    expect(findActiveByPrefix).not.toHaveBeenCalled();
  });

  it("401 when key too short to contain a prefix", async () => {
    const res = await request(server())
      .get("/probe")
      .set("x-api-key", "short")
      .expect(401);
    expect((res.body as { message: string }).message).toBe("invalid credentials");
    expect(findActiveByPrefix).not.toHaveBeenCalled();
  });

  it("401 when prefix not found (revoked/unknown) — message identical", async () => {
    findActiveByPrefix.mockResolvedValueOnce(null);
    const res = await request(server())
      .get("/probe")
      .set("x-api-key", validKey)
      .expect(401);
    expect((res.body as { message: string }).message).toBe("invalid credentials");
    expect(findActiveByPrefix).toHaveBeenCalledWith("git_abcd");
    expect(touchLastUsed).not.toHaveBeenCalled();
  });

  it("401 when secret does not verify against stored hash", async () => {
    findActiveByPrefix.mockResolvedValueOnce({
      id: "k-1",
      userId: "u-1",
      keyPrefix: "git_abcd",
      keyHash: validHash,
    });
    await request(server())
      .get("/probe")
      .set("x-api-key", "git_abcdWRONGTAIL0000")
      .expect(401);
    expect(touchLastUsed).not.toHaveBeenCalled();
  });

  it("401 when key is exactly PREFIX_LENGTH (no secret part)", async () => {
    await request(server())
      .get("/probe")
      .set("x-api-key", "git_abcd")
      .expect(401);
    expect(findActiveByPrefix).not.toHaveBeenCalled();
  });

  it("401 when argon2.verify throws (corrupted hash)", async () => {
    findActiveByPrefix.mockResolvedValueOnce({
      id: "k-1",
      userId: "u-1",
      keyPrefix: "git_abcd",
      keyHash: "not-a-valid-hash",
    });
    await request(server())
      .get("/probe")
      .set("x-api-key", validKey)
      .expect(401);
    expect(touchLastUsed).not.toHaveBeenCalled();
  });

  it("200 with valid key: handler sees user id, last_used_at updated", async () => {
    findActiveByPrefix.mockResolvedValueOnce({
      id: "k-1",
      userId: "u-1",
      keyPrefix: "git_abcd",
      keyHash: validHash,
    });
    const res = await request(server())
      .get("/probe")
      .set("x-api-key", validKey)
      .expect(200);
    expect(res.body).toEqual({ userId: "u-1", kind: "api-key" });
    await new Promise((r) => setImmediate(r));
    expect(touchLastUsed).toHaveBeenCalledWith("k-1");
  });
});
