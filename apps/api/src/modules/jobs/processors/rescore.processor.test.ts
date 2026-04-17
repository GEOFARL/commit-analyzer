import type { CommitQualityScoreRepository } from "@commit-analyzer/database";
import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CacheService } from "../../../common/cache/cache.service.js";
import type { RescoreJobData } from "../queues/rescore.queue.js";

import { RescoreProcessor } from "./rescore.processor.js";

const updateProgressMock = vi.fn();

function makeJob(
  overrides: Partial<Job<RescoreJobData>> = {},
): Job<RescoreJobData> {
  return {
    id: "rescore-job-1",
    data: { repositoryId: "repo-1" },
    attemptsMade: 0,
    updateProgress: updateProgressMock,
    ...overrides,
  } as unknown as Job<RescoreJobData>;
}

function makeCommit(id: string, message: string) {
  return { id, message };
}

describe("RescoreProcessor", () => {
  let processor: RescoreProcessor;
  let queryMock: ReturnType<typeof vi.fn>;
  let upsertBatchMock: ReturnType<typeof vi.fn>;
  let delByPrefixMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateProgressMock.mockReset();
    queryMock = vi.fn().mockResolvedValue([]);
    upsertBatchMock = vi.fn().mockResolvedValue(undefined);
    delByPrefixMock = vi.fn().mockResolvedValue(0);

    const dataSource = { query: queryMock } as unknown as InstanceType<
      typeof import("typeorm").DataSource
    >;
    const qualityScoreRepo = {
      upsertBatch: upsertBatchMock,
    } as unknown as CommitQualityScoreRepository;
    const cacheService = {
      delByPrefix: delByPrefixMock,
    } as unknown as CacheService;

    processor = new RescoreProcessor(dataSource, qualityScoreRepo, cacheService);
  });

  it("processes empty repo without errors", async () => {
    const job = makeJob();
    await processor.process(job);
    expect(queryMock).toHaveBeenCalledOnce();
    expect(upsertBatchMock).not.toHaveBeenCalled();
    expect(delByPrefixMock).not.toHaveBeenCalled();
  });

  it("scores commits in batches and upserts results", async () => {
    const batch1 = [
      makeCommit("c1", "feat(auth): add login"),
      makeCommit("c2", "random message"),
    ];

    queryMock.mockResolvedValueOnce(batch1).mockResolvedValueOnce([]);

    const job = makeJob({ data: { repositoryId: "repo-1", batchSize: 2 } });
    await processor.process(job);

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(upsertBatchMock).toHaveBeenCalledOnce();

    const rows = upsertBatchMock.mock.calls[0]![0] as Array<
      Record<string, unknown>
    >;
    expect(rows).toHaveLength(2);

    // first commit is conventional
    expect(rows[0]).toMatchObject({
      commitId: "c1",
      isConventional: true,
      ccType: "feat",
      ccScope: "auth",
    });
    expect(rows[0]!.overallScore).toBeGreaterThan(0);

    // second commit is non-conventional
    expect(rows[1]).toMatchObject({
      commitId: "c2",
      isConventional: false,
      ccType: null,
      ccScope: null,
      overallScore: 0,
    });
  });

  it("iterates multiple batches", async () => {
    const batch1 = [makeCommit("c1", "fix: patch")];
    const batch2 = [makeCommit("c2", "docs: readme")];

    queryMock
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockResolvedValueOnce([]);

    const job = makeJob({ data: { repositoryId: "repo-1", batchSize: 1 } });
    await processor.process(job);

    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(upsertBatchMock).toHaveBeenCalledTimes(2);
    expect(updateProgressMock).toHaveBeenCalledTimes(2);
    expect(updateProgressMock).toHaveBeenLastCalledWith(2);
  });

  it("uses default batch size when not specified", async () => {
    const job = makeJob();
    await processor.process(job);

    const query = queryMock.mock.calls[0]!;
    // default batch size = 500
    expect(query[1]).toEqual(["repo-1", 500, 0]);
  });

  it("invalidates analytics cache after scoring", async () => {
    queryMock
      .mockResolvedValueOnce([makeCommit("c1", "fix: patch")])
      .mockResolvedValueOnce([]);

    const job = makeJob();
    await processor.process(job);

    expect(delByPrefixMock).toHaveBeenCalledOnce();
    expect(delByPrefixMock).toHaveBeenCalledWith("analytics:repo-1");
  });

  it("logs error on failure event", () => {
    const errorSpy = vi.spyOn(processor["logger"], "error");
    const job = makeJob({ attemptsMade: 1 });
    const err = new Error("db down");

    processor.onFailed(job, err);

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]![0]).toMatch(/failed/);
  });
});
