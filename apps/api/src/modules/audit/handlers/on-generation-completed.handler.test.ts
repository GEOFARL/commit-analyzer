import "reflect-metadata";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenerationCompletedEvent } from "../../../shared/events/generation-completed.event.js";
import { AuditService } from "../audit.service.js";

import { OnGenerationCompletedHandler } from "./on-generation-completed.handler.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const GEN_ID = "22222222-2222-2222-2222-222222222222";

describe("OnGenerationCompletedHandler", () => {
  const record = vi.fn();
  let handler: OnGenerationCompletedHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new OnGenerationCompletedHandler({
      record,
    } as unknown as AuditService);
  });

  it("calls AuditService.record with generation.completed", async () => {
    await handler.handle(
      new GenerationCompletedEvent(USER_ID, GEN_ID, "openai", "gpt-4", 150),
    );

    expect(record).toHaveBeenCalledWith({
      userId: USER_ID,
      eventType: "generation.completed",
      payload: {
        generation_id: GEN_ID,
        provider: "openai",
        model: "gpt-4",
        tokens_used: 150,
      },
    });
  });
});
