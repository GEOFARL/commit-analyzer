import "reflect-metadata";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthLoggedOutEvent } from "../../auth/events/auth-logged-out.event.js";

import { OnAuthLoggedOutHandler } from "./on-auth-logged-out.handler.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";

describe("OnAuthLoggedOutHandler", () => {
  const record = vi.fn();
  let handler: OnAuthLoggedOutHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new OnAuthLoggedOutHandler({ record } as never);
  });

  it("calls AuditService.record with auth.logout", async () => {
    await handler.handle(new AuthLoggedOutEvent(USER_ID));

    expect(record).toHaveBeenCalledWith({
      userId: USER_ID,
      eventType: "auth.logout",
      payload: {},
    });
  });
});
