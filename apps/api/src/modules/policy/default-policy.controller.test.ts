import "reflect-metadata";

import type { Server } from "node:http";

import { type INestApplication, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { ClsModule, ClsServiceManager } from "nestjs-cls";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THROTTLE_TIERS } from "../../common/throttler/tiers.js";
import { UserThrottlerGuard } from "../../common/throttler/user-throttler.guard.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";

import { DefaultPolicyController } from "./default-policy.controller.js";
import { DefaultPolicyService } from "./default-policy.service.js";
import { PolicyRuleInvalidError } from "./policy.errors.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";

const buildApp = async (
  serviceStub: Partial<DefaultPolicyService>,
  options: { authorize: boolean } = { authorize: true },
): Promise<INestApplication> => {
  @Module({
    imports: [
      ClsModule.forRoot({ global: true, middleware: { mount: true } }),
      ThrottlerModule.forRoot([
        THROTTLE_TIERS.default,
        THROTTLE_TIERS.auth,
        THROTTLE_TIERS.generate,
        THROTTLE_TIERS.analytics,
      ]),
    ],
    controllers: [DefaultPolicyController],
    providers: [
      { provide: APP_GUARD, useClass: UserThrottlerGuard },
      { provide: DefaultPolicyService, useValue: serviceStub },
    ],
  })
  class TestModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [TestModule],
  })
    .overrideGuard(SupabaseAuthGuard)
    .useValue({
      canActivate: (ctx: { switchToHttp: () => unknown }) => {
        if (!options.authorize) return false;
        const cls = ClsServiceManager.getClsService();
        cls.set("auth.userId", USER_ID);
        cls.set("auth.kind", "session");
        // Touch ctx so the param isn't flagged unused.
        void ctx;
        return true;
      },
    })
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
};

describe("DefaultPolicyController", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  describe("GET /settings/default-policy", () => {
    it("returns the stored template", async () => {
      const stub = {
        getDefaultPolicyTemplate: vi.fn().mockResolvedValue({
          enabled: true,
          rules: [{ ruleType: "bodyRequired", ruleValue: true }],
        }),
        setDefaultPolicyTemplate: vi.fn(),
        clearDefaultPolicyTemplate: vi.fn(),
      };
      app = await buildApp(stub);

      const res = await request(app.getHttpServer() as Server)
        .get("/settings/default-policy")
        .set("authorization", "Bearer stub-jwt");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        template: {
          enabled: true,
          rules: [{ ruleType: "bodyRequired", ruleValue: true }],
        },
      });
      expect(stub.getDefaultPolicyTemplate).toHaveBeenCalledWith(USER_ID);
    });

    it("returns null template when none stored", async () => {
      const stub = {
        getDefaultPolicyTemplate: vi.fn().mockResolvedValue(null),
        setDefaultPolicyTemplate: vi.fn(),
        clearDefaultPolicyTemplate: vi.fn(),
      };
      app = await buildApp(stub);

      const res = await request(app.getHttpServer() as Server)
        .get("/settings/default-policy")
        .set("authorization", "Bearer stub-jwt");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ template: null });
    });
  });

  describe("PUT /settings/default-policy", () => {
    it("persists a valid template and echoes it back", async () => {
      const stub = {
        getDefaultPolicyTemplate: vi.fn(),
        setDefaultPolicyTemplate: vi
          .fn()
          .mockImplementation((_userId: string, input: unknown) =>
            Promise.resolve(input),
          ),
        clearDefaultPolicyTemplate: vi.fn(),
      };
      app = await buildApp(stub);

      const body = {
        enabled: true,
        rules: [{ ruleType: "maxSubjectLength", ruleValue: 72 }],
      };
      const res = await request(app.getHttpServer() as Server)
        .put("/settings/default-policy")
        .set("authorization", "Bearer stub-jwt")
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ template: body });
      expect(stub.setDefaultPolicyTemplate).toHaveBeenCalledWith(USER_ID, body);
    });

    it("surfaces 400 on invalid rule shape", async () => {
      const stub = {
        getDefaultPolicyTemplate: vi.fn(),
        setDefaultPolicyTemplate: vi.fn().mockImplementation(() => {
          throw new PolicyRuleInvalidError("rules.0: invalid");
        }),
        clearDefaultPolicyTemplate: vi.fn(),
      };
      app = await buildApp(stub);

      const res = await request(app.getHttpServer() as Server)
        .put("/settings/default-policy")
        .set("authorization", "Bearer stub-jwt")
        .send({ enabled: true, rules: [{ ruleType: "broken", ruleValue: 1 }] });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /settings/default-policy", () => {
    it("clears the stored template and returns 204", async () => {
      const stub = {
        getDefaultPolicyTemplate: vi.fn(),
        setDefaultPolicyTemplate: vi.fn(),
        clearDefaultPolicyTemplate: vi.fn().mockResolvedValue(undefined),
      };
      app = await buildApp(stub);

      const res = await request(app.getHttpServer() as Server)
        .delete("/settings/default-policy")
        .set("authorization", "Bearer stub-jwt");

      expect(res.status).toBe(204);
      expect(stub.clearDefaultPolicyTemplate).toHaveBeenCalledWith(USER_ID);
    });
  });
});

describe("DefaultPolicyController auth", () => {
  let app: INestApplication | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("rejects when guard denies", async () => {
    const stub = {
      getDefaultPolicyTemplate: vi.fn(),
      setDefaultPolicyTemplate: vi.fn(),
      clearDefaultPolicyTemplate: vi.fn(),
    };
    app = await buildApp(stub, { authorize: false });

    const res = await request(app.getHttpServer() as Server).get(
      "/settings/default-policy",
    );
    expect(res.status).toBe(403);
    expect(stub.getDefaultPolicyTemplate).not.toHaveBeenCalled();
  });
});
