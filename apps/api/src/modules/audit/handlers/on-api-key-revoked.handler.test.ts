import "reflect-metadata";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiKeyRevokedEvent } from "../../auth/events/api-key-revoked.event.js";

import { OnApiKeyRevokedHandler } from "./on-api-key-revoked.handler.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const API_KEY_ID = "22222222-2222-2222-2222-222222222222";

describe("OnApiKeyRevokedHandler", () => {
  const record = vi.fn();
  const cls = { get: vi.fn(() => USER_ID) };
  let handler: OnApiKeyRevokedHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    cls.get.mockReturnValue(USER_ID);
    handler = new OnApiKeyRevokedHandler(
      { record } as never,
      cls as never,
    );
  });

  it("calls AuditService.record with apikey.revoked", async () => {
    await handler.handle(new ApiKeyRevokedEvent(API_KEY_ID, "git_abcd"));

    expect(record).toHaveBeenCalledWith({
      userId: USER_ID,
      eventType: "apikey.revoked",
      payload: {
        api_key_id: API_KEY_ID,
        key_prefix: "git_abcd",
      },
    });
  });

  it("skips when no userId in CLS", async () => {
    cls.get.mockReturnValue(undefined as unknown as string);
    await handler.handle(new ApiKeyRevokedEvent(API_KEY_ID, "git_abcd"));
    expect(record).not.toHaveBeenCalled();
  });
});
