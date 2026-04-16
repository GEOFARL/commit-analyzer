import "reflect-metadata";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuditService } from "../audit.service.js";
import { GenerationFailedEvent } from "../events/generation-failed.event.js";

import { OnGenerationFailedHandler } from "./on-generation-failed.handler.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const GEN_ID = "22222222-2222-2222-2222-222222222222";

describe("OnGenerationFailedHandler", () => {
  const record = vi.fn();
  let handler: OnGenerationFailedHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new OnGenerationFailedHandler({
      record,
    } as unknown as AuditService);
  });

  it("calls AuditService.record with generation.failed", async () => {
    await handler.handle(
      new GenerationFailedEvent(USER_ID, GEN_ID, "rate_limited"),
    );

    expect(record).toHaveBeenCalledWith({
      userId: USER_ID,
      eventType: "generation.failed",
      payload: {
        generation_id: GEN_ID,
        reason: "rate_limited",
      },
    });
  });
});
