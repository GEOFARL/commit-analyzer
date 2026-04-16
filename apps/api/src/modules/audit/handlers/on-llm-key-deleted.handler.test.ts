import "reflect-metadata";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuditService } from "../audit.service.js";
import { LlmKeyDeletedEvent } from "../events/llm-key-deleted.event.js";

import { OnLlmKeyDeletedHandler } from "./on-llm-key-deleted.handler.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";

describe("OnLlmKeyDeletedHandler", () => {
  const record = vi.fn();
  let handler: OnLlmKeyDeletedHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new OnLlmKeyDeletedHandler({ record } as unknown as AuditService);
  });

  it("calls AuditService.record with llmkey.deleted", async () => {
    await handler.handle(new LlmKeyDeletedEvent(USER_ID, "anthropic"));

    expect(record).toHaveBeenCalledWith({
      userId: USER_ID,
      eventType: "llmkey.deleted",
      payload: { provider: "anthropic" },
    });
  });
});
