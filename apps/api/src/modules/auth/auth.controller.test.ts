import "reflect-metadata";

import { EventBus } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthController } from "./auth.controller.js";
import { AuthLoggedInEvent } from "./events/auth-logged-in.event.js";
import { AuthLoggedOutEvent } from "./events/auth-logged-out.event.js";

describe("AuthController", () => {
  const publish = vi.fn();
  let controller: AuthController;

  beforeEach(async () => {
    publish.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: EventBus, useValue: { publish } }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  it("publishes auth.login on sign-in-event", () => {
    expect(controller.signInEvent({ provider: "github" })).toEqual({ ok: true });
    expect(publish).toHaveBeenCalledTimes(1);
    const [event] = publish.mock.calls[0] as [AuthLoggedInEvent];
    expect(event).toBeInstanceOf(AuthLoggedInEvent);
    expect(event.provider).toBe("github");
  });

  it("rejects unknown provider", () => {
    expect(() => controller.signInEvent({ provider: "google" })).toThrow();
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes auth.logout on sign-out", () => {
    expect(controller.signOut()).toEqual({ ok: true });
    expect(publish).toHaveBeenCalledTimes(1);
    const [event] = publish.mock.calls[0] as [AuthLoggedOutEvent];
    expect(event).toBeInstanceOf(AuthLoggedOutEvent);
  });
});
