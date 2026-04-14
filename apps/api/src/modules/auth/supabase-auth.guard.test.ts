import "reflect-metadata";

import type { Server } from "node:http";

import { Controller, Get, INestApplication, UseGuards } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ClsModule } from "nestjs-cls";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthKind } from "../../common/request-context.js";

import { CurrentUser } from "./current-user.decorator.js";
import {
  SUPABASE_CLIENT,
  SupabaseAuthGuard,
} from "./supabase-auth.guard.js";

@Controller("probe")
@UseGuards(SupabaseAuthGuard)
class ProbeController {
  @Get()
  handle(@CurrentUser() userId: string): { userId: string; kind: string | undefined } {
    return { userId, kind: getAuthKind() };
  }
}

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

  it("200 and handler sees resolved user id", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "u-42" } }, error: null });
    const res = await request(server())
      .get("/probe")
      .set("Authorization", "Bearer good-token")
      .expect(200);
    expect(res.body).toEqual({ userId: "u-42", kind: "session" });
    expect(getUser).toHaveBeenCalledWith("good-token");
  });
});
