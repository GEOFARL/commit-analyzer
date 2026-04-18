import { beforeEach, describe, expect, it, vi } from "vitest";

import { SyncRequestedEvent } from "../../../shared/events/sync-requested.event.js";
import { QueueService } from "../services/queue.service.js";

import { OnSyncRequestedHandler } from "./on-sync-requested.handler.js";

describe("OnSyncRequestedHandler", () => {
  let enqueueSync: ReturnType<typeof vi.fn>;
  let handler: OnSyncRequestedHandler;

  beforeEach(() => {
    enqueueSync = vi.fn().mockResolvedValue("sync-repo-1");
    const queues = { enqueueSync } as unknown as QueueService;
    handler = new OnSyncRequestedHandler(queues);
  });

  it("enqueues a sync job with the repositoryId and userId from the event", async () => {
    await handler.handle(new SyncRequestedEvent("repo-1", "user-1"));

    expect(enqueueSync).toHaveBeenCalledTimes(1);
    expect(enqueueSync).toHaveBeenCalledWith("repo-1", "user-1");
  });

  it("propagates enqueue errors so Nest logs the CQRS failure", async () => {
    enqueueSync.mockRejectedValueOnce(new Error("redis down"));

    await expect(
      handler.handle(new SyncRequestedEvent("repo-1", "user-1")),
    ).rejects.toThrow("redis down");
  });
});
