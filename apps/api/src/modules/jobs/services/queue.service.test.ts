import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import type { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RESCORE_QUEUE } from "../queues/rescore.queue.js";
import { SYNC_QUEUE } from "../queues/sync.queue.js";

import { QueueService } from "./queue.service.js";

describe("QueueService", () => {
  let service: QueueService;
  let addMock: ReturnType<typeof vi.fn>;
  let getJobMock: ReturnType<typeof vi.fn>;
  let rescoreAddMock: ReturnType<typeof vi.fn>;
  let rescoreGetJobMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    addMock = vi.fn().mockResolvedValue({ id: "sync-repo-1" });
    getJobMock = vi.fn().mockResolvedValue(null);
    rescoreAddMock = vi.fn().mockResolvedValue({ id: "rescore-repo-1" });
    rescoreGetJobMock = vi.fn().mockResolvedValue(null);

    const syncQueue = {
      add: addMock,
      getJob: getJobMock,
    } as unknown as Queue;
    const rescoreQueue = {
      add: rescoreAddMock,
      getJob: rescoreGetJobMock,
    } as unknown as Queue;

    const module = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: getQueueToken(SYNC_QUEUE), useValue: syncQueue },
        { provide: getQueueToken(RESCORE_QUEUE), useValue: rescoreQueue },
      ],
    }).compile();

    service = module.get(QueueService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("enqueues a sync job and returns the job id", async () => {
    const id = await service.enqueueSync("repo-1", "user-1");

    expect(id).toBe("sync-repo-1");
    expect(addMock).toHaveBeenCalledOnce();
    expect(addMock).toHaveBeenCalledWith(
      "sync-repo",
      { repositoryId: "repo-1", userId: "user-1" },
      expect.objectContaining({
        jobId: "sync-repo-1",
        attempts: 3,
        backoff: { type: "exponential", delay: 2_000 },
      }),
    );
  });

  it("skips duplicate when job is already active", async () => {
    getJobMock.mockResolvedValue({
      id: "sync-repo-1",
      getState: vi.fn().mockResolvedValue("active"),
    });

    const id = await service.enqueueSync("repo-1", "user-1");

    expect(id).toBe("sync-repo-1");
    expect(addMock).not.toHaveBeenCalled();
  });

  it("skips duplicate when job is waiting", async () => {
    getJobMock.mockResolvedValue({
      id: "sync-repo-1",
      getState: vi.fn().mockResolvedValue("waiting"),
    });

    await service.enqueueSync("repo-1", "user-1");

    expect(addMock).not.toHaveBeenCalled();
  });

  it("skips duplicate when job is delayed", async () => {
    getJobMock.mockResolvedValue({
      id: "sync-repo-1",
      getState: vi.fn().mockResolvedValue("delayed"),
    });

    await service.enqueueSync("repo-1", "user-1");

    expect(addMock).not.toHaveBeenCalled();
  });

  it("removes and re-enqueues when a prior job completed", async () => {
    const removeMock = vi.fn().mockResolvedValue(undefined);
    getJobMock.mockResolvedValue({
      id: "sync-repo-1",
      getState: vi.fn().mockResolvedValue("completed"),
      remove: removeMock,
    });

    await service.enqueueSync("repo-1", "user-1");

    expect(removeMock).toHaveBeenCalledOnce();
    expect(addMock).toHaveBeenCalledOnce();
  });

  it("removes and re-enqueues when a prior job failed", async () => {
    const removeMock = vi.fn().mockResolvedValue(undefined);
    getJobMock.mockResolvedValue({
      id: "sync-repo-1",
      getState: vi.fn().mockResolvedValue("failed"),
      remove: removeMock,
    });

    await service.enqueueSync("repo-1", "user-1");

    expect(removeMock).toHaveBeenCalledOnce();
    expect(addMock).toHaveBeenCalledOnce();
  });

  describe("enqueueRescore", () => {
    it("enqueues a rescore job and returns the job id", async () => {
      const id = await service.enqueueRescore("repo-1");

      expect(id).toBe("rescore-repo-1");
      expect(rescoreAddMock).toHaveBeenCalledOnce();
      expect(rescoreAddMock).toHaveBeenCalledWith(
        "rescore-repo",
        { repositoryId: "repo-1" },
        expect.objectContaining({
          jobId: "rescore-repo-1",
          attempts: 1,
        }),
      );
    });

    it("passes batchSize when provided", async () => {
      await service.enqueueRescore("repo-1", 200);

      expect(rescoreAddMock).toHaveBeenCalledWith(
        "rescore-repo",
        { repositoryId: "repo-1", batchSize: 200 },
        expect.objectContaining({ jobId: "rescore-repo-1" }),
      );
    });

    it.each(["active", "waiting", "delayed", "waiting-children", "prioritized"] as const)(
      "skips duplicate when rescore job is %s",
      async (state) => {
        rescoreGetJobMock.mockResolvedValue({
          id: "rescore-repo-1",
          getState: vi.fn().mockResolvedValue(state),
        });

        const id = await service.enqueueRescore("repo-1");

        expect(id).toBe("rescore-repo-1");
        expect(rescoreAddMock).not.toHaveBeenCalled();
      },
    );

    it("removes and re-enqueues when prior rescore job completed", async () => {
      const removeMock = vi.fn().mockResolvedValue(undefined);
      rescoreGetJobMock.mockResolvedValue({
        id: "rescore-repo-1",
        getState: vi.fn().mockResolvedValue("completed"),
        remove: removeMock,
      });

      await service.enqueueRescore("repo-1");

      expect(removeMock).toHaveBeenCalledOnce();
      expect(rescoreAddMock).toHaveBeenCalledOnce();
    });

    it("removes and re-enqueues when prior rescore job failed", async () => {
      const removeMock = vi.fn().mockResolvedValue(undefined);
      rescoreGetJobMock.mockResolvedValue({
        id: "rescore-repo-1",
        getState: vi.fn().mockResolvedValue("failed"),
        remove: removeMock,
      });

      await service.enqueueRescore("repo-1");

      expect(removeMock).toHaveBeenCalledOnce();
      expect(rescoreAddMock).toHaveBeenCalledOnce();
    });
  });
});
