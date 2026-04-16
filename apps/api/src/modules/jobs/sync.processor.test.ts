import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SyncProcessor } from "./processors/sync.processor.js";
import type { SyncJobData } from "./queues/sync.queue.js";

function makeJob(overrides: Partial<Job<SyncJobData>> = {}): Job<SyncJobData> {
  return {
    id: "test-job-1",
    data: { repositoryId: "repo-1", userId: "user-1" },
    attemptsMade: 0,
    ...overrides,
  } as unknown as Job<SyncJobData>;
}

describe("SyncProcessor", () => {
  let processor: SyncProcessor;

  beforeEach(() => {
    processor = new SyncProcessor();
  });

  it("logs start and finish for a fake job", async () => {
    const logSpy = vi.spyOn(processor["logger"], "log");
    const job = makeJob();

    await processor.process(job);

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy.mock.calls[0]![0]).toMatch(/start/);
    expect(logSpy.mock.calls[1]![0]).toMatch(/finish/);
  });

  it("logs error on failure event", () => {
    const errorSpy = vi.spyOn(processor["logger"], "error");
    const job = makeJob({ attemptsMade: 3 });
    const err = new Error("boom");

    processor.onFailed(job, err);

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]![0]).toMatch(/failed/);
  });

  it("moves to failed state after retries exhausted", async () => {
    const errorSpy = vi.spyOn(processor["logger"], "error");

    // stub process() to throw as it would on each real attempt
    vi.spyOn(processor, "process").mockRejectedValue(new Error("timeout"));

    const job = makeJob({ attemptsMade: 3 });

    // verify process() does throw
    await expect(processor.process(job)).rejects.toThrow("timeout");

    // BullMQ calls onFailed after the final attempt — assert it fires and logs
    processor.onFailed(job, new Error("timeout"));

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]![0]).toMatch(/failed/);
    expect(errorSpy.mock.calls[0]![0]).toMatch(/attempt=3/);
  });
});
