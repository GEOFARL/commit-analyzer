import "reflect-metadata";

import type { Server } from "node:http";

import { Controller, Get, INestApplication, UseGuards } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ClsModule, ClsServiceManager } from "nestjs-cls";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CLS_JWT_CLAIMS,
  getAuthKind,
  type JwtClaims,
} from "../../common/request-context.js";

import { CurrentUser } from "./current-user.decorator.js";
import {
  SUPABASE_CLIENT,
  SupabaseAuthGuard,
} from "./supabase-auth.guard.js";

const getStoredClaims = (): JwtClaims | undefined => {
  const cls = ClsServiceManager.getClsService();
  return cls.isActive() ? cls.get<JwtClaims>(CLS_JWT_CLAIMS) : undefined;
};

interface ProbeResponse {
  userId: string;
  kind: string | undefined;
  claims: JwtClaims | undefined;
}

@Controller("probe")
@UseGuards(SupabaseAuthGuard)
class ProbeController {
  @Get()
  handle(@CurrentUser() userId: string): ProbeResponse {
    return { userId, kind: getAuthKind(), claims: getStoredClaims() };
  }
}

const encodeJwt = (claims: Record<string, unknown>): string => {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.sig`;
};

describe("SupabaseAuthGuard", () => {
  const getUser = vi.fn();
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;

  beforeEach(async () => {
    getUser.mockReset();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot({
          global: true,
          middleware: { mount: true, generateId: true },
        }),
      ],
      controllers: [ProbeController],
      providers: [
        SupabaseAuthGuard,
        { provide: SUPABASE_CLIENT, useValue: { auth: { getUser } } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("401 without Authorization header", async () => {
    const res = await request(server()).get("/probe").expect(401);
    expect((res.body as { message: string }).message).toBe("invalid credentials");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("401 on invalid token", async () => {
    getUser.mockResolvedValueOnce({ data: null, error: { message: "bad" } });
    const res = await request(server())
      .get("/probe")
      .set("Authorization", "Bearer nope")
      .expect(401);
    expect((res.body as { message: string }).message).toBe("invalid credentials");
  });

  it("200 and handler sees resolved user id + full decoded claims", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "u-42" } }, error: null });
    const token = encodeJwt({
      sub: "u-42",
      role: "authenticated",
      email: "u42@example.com",
      aud: "authenticated",
    });
    const res = await request(server())
      .get("/probe")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const body = res.body as ProbeResponse;
    expect(body.userId).toBe("u-42");
    expect(body.kind).toBe("session");
    expect(body.claims).toEqual({
      sub: "u-42",
      role: "authenticated",
      email: "u42@example.com",
      aud: "authenticated",
    });
    expect(getUser).toHaveBeenCalledWith(token);
  });

  it("falls back to minimal sub claim when token is not decodable", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "u-99" } }, error: null });
    await request(server())
      .get("/probe")
      .set("Authorization", "Bearer not-a-jwt")
      .expect(200);
  });
});
