import { beforeEach, describe, expect, it, vi } from "vitest";

import { RepoConnectedEvent } from "../../../shared/events/repo-connected.event.js";
import { QueueService } from "../services/queue.service.js";

import { OnRepoConnectedHandler } from "./on-repo-connected.handler.js";

describe("OnRepoConnectedHandler", () => {
  let enqueueSync: ReturnType<typeof vi.fn>;
  let handler: OnRepoConnectedHandler;

  beforeEach(() => {
    enqueueSync = vi.fn().mockResolvedValue("sync:repo-1");
    const queues = { enqueueSync } as unknown as QueueService;
    handler = new OnRepoConnectedHandler(queues);
  });

  it("enqueues a sync job with the repositoryId and userId from the event", async () => {
    await handler.handle(
      new RepoConnectedEvent("repo-1", "user-1", "123456", "owner/repo"),
    );

    expect(enqueueSync).toHaveBeenCalledTimes(1);
    expect(enqueueSync).toHaveBeenCalledWith("repo-1", "user-1");
  });

  it("propagates enqueue errors so Nest logs the CQRS failure", async () => {
    enqueueSync.mockRejectedValueOnce(new Error("redis down"));

    await expect(
      handler.handle(
        new RepoConnectedEvent("repo-1", "user-1", "123456", "owner/repo"),
      ),
    ).rejects.toThrow("redis down");
  });
});
