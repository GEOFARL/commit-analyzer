import "reflect-metadata";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthLoggedInEvent } from "../../auth/events/auth-logged-in.event.js";

import { OnAuthLoggedInHandler } from "./on-auth-logged-in.handler.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";

describe("OnAuthLoggedInHandler", () => {
  const record = vi.fn();
  let handler: OnAuthLoggedInHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new OnAuthLoggedInHandler({ record } as never);
  });

  it("calls AuditService.record with auth.login", async () => {
    await handler.handle(new AuthLoggedInEvent(USER_ID, "github"));

    expect(record).toHaveBeenCalledWith({
      userId: USER_ID,
      eventType: "auth.login",
      payload: { provider: "github" },
    });
  });
});
