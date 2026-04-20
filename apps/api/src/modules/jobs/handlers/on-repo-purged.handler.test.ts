import { beforeEach, describe, expect, it, vi } from "vitest";

import { RepoPurgedEvent } from "../../../shared/events/repo-purged.event.js";
import { QueueService } from "../services/queue.service.js";

import { OnRepoPurgedHandler } from "./on-repo-purged.handler.js";

describe("OnRepoPurgedHandler", () => {
  let removeJobsForRepo: ReturnType<typeof vi.fn>;
  let handler: OnRepoPurgedHandler;

  beforeEach(() => {
    removeJobsForRepo = vi.fn().mockResolvedValue(undefined);
    const queues = { removeJobsForRepo } as unknown as QueueService;
    handler = new OnRepoPurgedHandler(queues);
  });

  it("removes sync and rescore jobs for the purged repo", async () => {
    await handler.handle(
      new RepoPurgedEvent("repo-1", "user-1", "12345", 7),
    );

    expect(removeJobsForRepo).toHaveBeenCalledTimes(1);
    expect(removeJobsForRepo).toHaveBeenCalledWith("repo-1");
  });

  it("swallows queue errors so audit + cache invalidation still happen", async () => {
    removeJobsForRepo.mockRejectedValueOnce(new Error("redis down"));

    await expect(
      handler.handle(new RepoPurgedEvent("repo-1", "user-1", "12345", 0)),
    ).resolves.toBeUndefined();
  });
});
