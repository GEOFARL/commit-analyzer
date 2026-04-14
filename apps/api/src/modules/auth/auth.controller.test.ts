import "reflect-metadata";

import { EventBus } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthController } from "./auth.controller.js";
import { AuthLoggedInEvent } from "./events/auth-logged-in.event.js";
import { AuthLoggedOutEvent } from "./events/auth-logged-out.event.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";

describe("AuthController", () => {
  const publish = vi.fn();
  const canActivate = vi.fn().mockResolvedValue(true);
  let controller: AuthController;

  const fakeReq = { authUserId: "user-123" } as Parameters<
    AuthController["signInEvent"]
  >[0];

  beforeEach(async () => {
    publish.mockReset();
    canActivate.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: EventBus, useValue: { publish } },
        { provide: SupabaseAuthGuard, useValue: { canActivate } },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate })
      .compile();
    controller = moduleRef.get(AuthController);
  });

  it("publishes auth.login with userId + provider", () => {
    expect(controller.signInEvent(fakeReq, { provider: "github" })).toEqual({ ok: true });
    expect(publish).toHaveBeenCalledTimes(1);
    const [event] = publish.mock.calls[0] as [AuthLoggedInEvent];
    expect(event).toBeInstanceOf(AuthLoggedInEvent);
    expect(event.provider).toBe("github");
    expect(event.userId).toBe("user-123");
  });

  it("rejects unknown provider", () => {
    expect(() => controller.signInEvent(fakeReq, { provider: "google" })).toThrow();
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes auth.logout with userId", () => {
    expect(controller.signOut(fakeReq)).toEqual({ ok: true });
    expect(publish).toHaveBeenCalledTimes(1);
    const [event] = publish.mock.calls[0] as [AuthLoggedOutEvent];
    expect(event).toBeInstanceOf(AuthLoggedOutEvent);
    expect(event.userId).toBe("user-123");
  });
});
