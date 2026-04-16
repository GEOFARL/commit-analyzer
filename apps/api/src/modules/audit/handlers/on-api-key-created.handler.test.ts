import "reflect-metadata";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiKeyCreatedEvent } from "../../auth/events/api-key-created.event.js";

import { OnApiKeyCreatedHandler } from "./on-api-key-created.handler.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const API_KEY_ID = "22222222-2222-2222-2222-222222222222";

describe("OnApiKeyCreatedHandler", () => {
  const record = vi.fn();
  const cls = { get: vi.fn(() => USER_ID) };
  let handler: OnApiKeyCreatedHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    cls.get.mockReturnValue(USER_ID);
    handler = new OnApiKeyCreatedHandler(
      { record } as never,
      cls as never,
    );
  });

  it("calls AuditService.record with apikey.created", async () => {
    await handler.handle(new ApiKeyCreatedEvent(API_KEY_ID, "cli", "git_abcd"));

    expect(record).toHaveBeenCalledWith({
      userId: USER_ID,
      eventType: "apikey.created",
      payload: {
        api_key_id: API_KEY_ID,
        name: "cli",
        key_prefix: "git_abcd",
      },
    });
  });

  it("skips when no userId in CLS", async () => {
    cls.get.mockReturnValue(undefined as unknown as string);
    await handler.handle(new ApiKeyCreatedEvent(API_KEY_ID, "cli", "git_abcd"));
    expect(record).not.toHaveBeenCalled();
  });
});
