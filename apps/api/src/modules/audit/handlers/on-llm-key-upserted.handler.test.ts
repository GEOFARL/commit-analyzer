import "reflect-metadata";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { LlmKeyUpsertedEvent } from "../../auth/events/llm-key-upserted.event.js";
import { AuditService } from "../audit.service.js";

import { OnLlmKeyUpsertedHandler } from "./on-llm-key-upserted.handler.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";

describe("OnLlmKeyUpsertedHandler", () => {
  const record = vi.fn();
  let handler: OnLlmKeyUpsertedHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new OnLlmKeyUpsertedHandler({ record } as unknown as AuditService);
  });

  it("calls AuditService.record with llmkey.upserted", async () => {
    await handler.handle(new LlmKeyUpsertedEvent(USER_ID, "openai"));

    expect(record).toHaveBeenCalledWith({
      userId: USER_ID,
      eventType: "llmkey.upserted",
      payload: { provider: "openai" },
    });
  });
});
