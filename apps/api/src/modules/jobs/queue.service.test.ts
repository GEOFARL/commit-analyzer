import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import type { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SYNC_QUEUE } from "./queues/sync.queue.js";
import { QueueService } from "./services/queue.service.js";

describe("QueueService", () => {
  let service: QueueService;
  let addMock: ReturnType<typeof vi.fn>;
  let getJobMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    addMock = vi.fn().mockResolvedValue({ id: "sync:repo-1" });
    getJobMock = vi.fn().mockResolvedValue(null);

    const queue = { add: addMock, getJob: getJobMock } as unknown as Queue;

    const module = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: getQueueToken(SYNC_QUEUE), useValue: queue },
      ],
    }).compile();

    service = module.get(QueueService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("enqueues a sync job and returns the job id", async () => {
    const id = await service.enqueueSync("repo-1", "user-1");

    expect(id).toBe("sync:repo-1");
    expect(addMock).toHaveBeenCalledOnce();
    expect(addMock).toHaveBeenCalledWith(
      "sync-repo",
      { repoId: "repo-1", userId: "user-1" },
      expect.objectContaining({
        jobId: "sync:repo-1",
        attempts: 3,
        backoff: { type: "exponential", delay: 2_000 },
      }),
    );
  });

  it("skips duplicate when job is already active", async () => {
    getJobMock.mockResolvedValue({
      id: "sync:repo-1",
      getState: vi.fn().mockResolvedValue("active"),
    });

    const id = await service.enqueueSync("repo-1", "user-1");

    expect(id).toBe("sync:repo-1");
    expect(addMock).not.toHaveBeenCalled();
  });

  it("skips duplicate when job is waiting", async () => {
    getJobMock.mockResolvedValue({
      id: "sync:repo-1",
      getState: vi.fn().mockResolvedValue("waiting"),
    });

    await service.enqueueSync("repo-1", "user-1");

    expect(addMock).not.toHaveBeenCalled();
  });

  it("re-enqueues when a prior job completed", async () => {
    getJobMock.mockResolvedValue({
      id: "sync:repo-1",
      getState: vi.fn().mockResolvedValue("completed"),
    });

    await service.enqueueSync("repo-1", "user-1");

    expect(addMock).toHaveBeenCalledOnce();
  });
});
