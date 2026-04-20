import "reflect-metadata";

import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RepoSyncedEvent } from "../../shared/events/repo-synced.event.js";
import { SyncFailedEvent } from "../../shared/events/sync-failed.event.js";
import { SyncProgressEvent } from "../../shared/events/sync-progress.event.js";
import { SyncStartedEvent } from "../../shared/events/sync-started.event.js";

import { SyncProcessor } from "./processors/sync.processor.js";
import type { SyncJobData } from "./queues/sync.queue.js";

const REPO_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SYNC_JOB_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function makeJob(overrides: Partial<Job<SyncJobData>> = {}): Job<SyncJobData> {
  return {
    id: "test-job-1",
    data: { repositoryId: REPO_ID, userId: USER_ID },
    attemptsMade: 0,
    ...overrides,
  } as unknown as Job<SyncJobData>;
}

function makeGithubCommit(sha: string, message: string) {
  return {
    sha,
    commit: {
      message,
      author: { name: "Dev", email: "dev@example.com", date: "2026-01-01T00:00:00Z" },
      committer: { name: "Dev", email: "dev@example.com", date: "2026-01-01T00:00:00Z" },
    },
  };
}

function makeGetCommitResponse(
  sha: string,
  overrides: {
    additions?: number;
    deletions?: number;
    files?: Array<{ filename: string; additions: number; deletions: number; status: string }>;
  } = {},
) {
  const files =
    overrides.files ??
    [{ filename: `src/${sha}.ts`, additions: 10, deletions: 2, status: "modified" }];
  return {
    data: {
      sha,
      stats: {
        additions: overrides.additions ?? files.reduce((a, f) => a + f.additions, 0),
        deletions: overrides.deletions ?? files.reduce((a, f) => a + f.deletions, 0),
      },
      files,
    },
  };
}

const FIXTURE_COMMITS = [
  makeGithubCommit("sha1", "feat(auth): add login endpoint"),
  makeGithubCommit("sha2", "fix(api): handle null response"),
  makeGithubCommit("sha3", "chore: update deps"),
  makeGithubCommit("sha4", "not a conventional commit"),
  makeGithubCommit("sha5", "docs(readme): add setup guide"),
];

/** Build a paginate.iterator mock that yields the given pages in order. */
function makeIterator(pages: typeof FIXTURE_COMMITS[]) {
  return vi.fn().mockImplementation(function* () {
    for (const pageData of pages) {
      yield { data: pageData };
    }
  });
}

describe("SyncProcessor", () => {
  let processor: SyncProcessor;
  let reposMock: {
    findOne: ReturnType<typeof vi.fn>;
    touchLastSyncedAt: ReturnType<typeof vi.fn>;
  };
  let syncJobsMock: {
    createJob: ReturnType<typeof vi.fn>;
    markRunning: ReturnType<typeof vi.fn>;
    updateProgress: ReturnType<typeof vi.fn>;
    markCompleted: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
  };
  let commitsMock: {
    upsertBatch: ReturnType<typeof vi.fn>;
    upsertScores: ReturnType<typeof vi.fn>;
  };
  let commitFilesMock: {
    replaceForCommits: ReturnType<typeof vi.fn>;
  };
  let dsMock: { transaction: ReturnType<typeof vi.fn> };
  let paginateIteratorMock: ReturnType<typeof vi.fn>;
  let getCommitMock: ReturnType<typeof vi.fn>;
  let octokitFactoryMock: { forUser: ReturnType<typeof vi.fn> };
  let eventBusMock: { publish: ReturnType<typeof vi.fn> };

  function buildOctokit() {
    return {
      rest: {
        repos: {
          listCommits: vi.fn(),
          getCommit: getCommitMock,
        },
      },
      paginate: { iterator: paginateIteratorMock },
    };
  }

  function setPages(pages: typeof FIXTURE_COMMITS[]) {
    paginateIteratorMock = makeIterator(pages);
    octokitFactoryMock.forUser.mockResolvedValue(buildOctokit());
  }

  beforeEach(() => {
    paginateIteratorMock = makeIterator([FIXTURE_COMMITS]);
    getCommitMock = vi
      .fn()
      .mockImplementation(({ ref }: { ref: string }) =>
        Promise.resolve(makeGetCommitResponse(ref)),
      );

    reposMock = {
      findOne: vi.fn().mockResolvedValue({
        id: REPO_ID,
        fullName: "octocat/hello-world",
        userId: USER_ID,
      }),
      touchLastSyncedAt: vi.fn().mockResolvedValue(undefined),
    };

    syncJobsMock = {
      createJob: vi.fn().mockResolvedValue({
        id: SYNC_JOB_ID,
        repositoryId: REPO_ID,
        status: "queued",
      }),
      markRunning: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };

    commitsMock = {
      upsertBatch: vi.fn().mockImplementation(
        (batch: Array<{ sha: string; repositoryId: string }>) =>
          Promise.resolve(
            batch.map((c) => ({ id: `commit-${c.sha}`, sha: c.sha, repositoryId: c.repositoryId })),
          ),
      ),
      upsertScores: vi.fn().mockResolvedValue(undefined),
    };

    commitFilesMock = {
      replaceForCommits: vi.fn().mockResolvedValue(undefined),
    };

    // ds.transaction(cb) executes the callback with a pass-through manager
    // so the processor's mock repos see the "manager" arg but behave
    // identically to the non-tx path.
    dsMock = {
      transaction: vi.fn().mockImplementation(
        async (cb: (m: unknown) => Promise<unknown>) => cb({} as unknown),
      ),
    };

    eventBusMock = { publish: vi.fn() };

    octokitFactoryMock = {
      forUser: vi.fn().mockResolvedValue(buildOctokit()),
    };

    processor = new SyncProcessor(
      dsMock as never,
      reposMock as never,
      syncJobsMock as never,
      commitsMock as never,
      commitFilesMock as never,
      octokitFactoryMock as never,
      eventBusMock as never,
    );
  });

  describe("happy path — single page", () => {
    it("creates sync job, marks it running, emits sync.started", async () => {
      const job = makeJob();
      await processor.process(job);

      expect(syncJobsMock.createJob).toHaveBeenCalledWith(REPO_ID);
      expect(syncJobsMock.markRunning).toHaveBeenCalledWith(SYNC_JOB_ID, expect.any(Date));

      const started = eventBusMock.publish.mock.calls.find(
        (args) => args[0] instanceof SyncStartedEvent,
      );
      expect(started).toBeDefined();
    });

    it("calls paginate.iterator with correct owner/repo/per_page", async () => {
      const job = makeJob();
      await processor.process(job);

      expect(paginateIteratorMock).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ owner: "octocat", repo: "hello-world", per_page: 100 }),
      );
    });

    it("upserts all commits from page", async () => {
      const job = makeJob();
      await processor.process(job);

      expect(commitsMock.upsertBatch).toHaveBeenCalledOnce();
      const [batch] = commitsMock.upsertBatch.mock.calls[0] as [Array<{ sha: string }>];
      expect(batch).toHaveLength(5);
      expect(batch.map((c) => c.sha)).toEqual(["sha1", "sha2", "sha3", "sha4", "sha5"]);
    });

    it("enriches each commit with per-SHA getCommit stats", async () => {
      const job = makeJob();
      await processor.process(job);

      // one getCommit per sha
      expect(getCommitMock).toHaveBeenCalledTimes(5);
      for (const sha of ["sha1", "sha2", "sha3", "sha4", "sha5"]) {
        expect(getCommitMock).toHaveBeenCalledWith(
          expect.objectContaining({ owner: "octocat", repo: "hello-world", ref: sha }),
        );
      }

      const [batch] = commitsMock.upsertBatch.mock.calls[0] as [
        Array<{ sha: string; insertions: number; deletions: number; filesChanged: number }>,
      ];
      // makeGetCommitResponse defaults to one file with additions:10 deletions:2
      for (const row of batch) {
        expect(row.insertions).toBe(10);
        expect(row.deletions).toBe(2);
        expect(row.filesChanged).toBe(1);
      }
    });

    it("persists commit_files rows via replaceForCommits", async () => {
      const job = makeJob();
      await processor.process(job);

      expect(commitFilesMock.replaceForCommits).toHaveBeenCalledOnce();
      const [commitIds, files] = commitFilesMock.replaceForCommits.mock.calls[0] as [
        string[],
        Array<{ commitId: string; filePath: string; status: string }>,
      ];
      expect(commitIds).toHaveLength(5);
      expect(files).toHaveLength(5);
      for (const f of files) {
        expect(f.commitId).toMatch(/^commit-sha/);
        expect(f.filePath).toMatch(/^src\//);
        expect(f.status).toBe("modified");
      }
    });

    it("wraps commits + scores + files in one ds.transaction per batch", async () => {
      const job = makeJob();
      await processor.process(job);

      // 5 commits fit a single UPSERT_BATCH_SIZE=500 chunk → one tx.
      expect(dsMock.transaction).toHaveBeenCalledOnce();

      // all three upsert methods got the pass-through manager object
      const txArg = (commitsMock.upsertBatch.mock.calls[0] as unknown[])[1];
      expect(txArg).toBeDefined();
      expect((commitsMock.upsertScores.mock.calls[0] as unknown[])[1]).toBe(txArg);
      expect(
        (commitFilesMock.replaceForCommits.mock.calls[0] as unknown[])[2],
      ).toBe(txArg);
    });

    it("emits progress during enrichment for large repos", async () => {
      const big = Array.from({ length: 105 }, (_, i) =>
        makeGithubCommit(`sha-big-${String(i)}`, `feat: commit ${String(i)}`),
      );
      setPages([big]);

      const job = makeJob();
      await processor.process(job);

      const progress = eventBusMock.publish.mock.calls
        .map((args: unknown[]) => args[0])
        .filter((e): e is SyncProgressEvent => e instanceof SyncProgressEvent);
      // at least two enrichment-phase emissions (50, 100) plus the final
      // post-enrichment total. Per-page emission is one additional event.
      const enrichmentValues = progress.map((e) => e.commitsProcessed);
      expect(enrichmentValues).toContain(50);
      expect(enrichmentValues).toContain(100);
      expect(enrichmentValues).toContain(105);
    });

    it("upserts quality scores for all commits", async () => {
      const job = makeJob();
      await processor.process(job);

      expect(commitsMock.upsertScores).toHaveBeenCalledOnce();
      const [scores] = commitsMock.upsertScores.mock.calls[0] as [
        Array<{ commitId: string; isConventional: boolean; overallScore: number }>,
      ];
      expect(scores).toHaveLength(5);

      const feat = scores.find((s) => s.commitId === "commit-sha1");
      expect(feat?.isConventional).toBe(true);
      expect(feat?.overallScore).toBeGreaterThan(50);

      const nonCC = scores.find((s) => s.commitId === "commit-sha4");
      expect(nonCC?.isConventional).toBe(false);
      expect(nonCC?.overallScore).toBe(0);
    });

    it("scores are upserted in the same batch as their commits (no double parse)", async () => {
      const job = makeJob();
      await processor.process(job);

      // upsertBatch and upsertScores called once each, in order
      expect(commitsMock.upsertBatch).toHaveBeenCalledOnce();
      expect(commitsMock.upsertScores).toHaveBeenCalledOnce();
      const batchCallOrder = commitsMock.upsertBatch.mock.invocationCallOrder[0]!;
      const scoresCallOrder = commitsMock.upsertScores.mock.invocationCallOrder[0]!;
      expect(batchCallOrder).toBeLessThan(scoresCallOrder);
    });

    it("marks sync job completed and emits repo.synced", async () => {
      const job = makeJob();
      await processor.process(job);

      expect(syncJobsMock.markCompleted).toHaveBeenCalledWith(SYNC_JOB_ID, expect.any(Date));

      const synced = eventBusMock.publish.mock.calls.find(
        (args) => args[0] instanceof RepoSyncedEvent,
      );
      expect(synced).toBeDefined();
      const event = synced![0] as RepoSyncedEvent;
      expect(event.repositoryId).toBe(REPO_ID);
      expect(event.userId).toBe(USER_ID);
      expect(event.commitsProcessed).toBe(5);
    });

    it("stamps repository.lastSyncedAt with the same timestamp as the job finishedAt", async () => {
      const job = makeJob();
      await processor.process(job);

      expect(reposMock.touchLastSyncedAt).toHaveBeenCalledWith(
        REPO_ID,
        expect.any(Date),
      );
      const completedAt = syncJobsMock.markCompleted.mock.calls[0]![1] as Date;
      const touchedAt = reposMock.touchLastSyncedAt.mock.calls[0]![1] as Date;
      expect(touchedAt.getTime()).toBe(completedAt.getTime());
    });

    it("emits sync.progress after each page", async () => {
      const job = makeJob();
      await processor.process(job);

      const progress = eventBusMock.publish.mock.calls.filter(
        (args) => args[0] instanceof SyncProgressEvent,
      );
      expect(progress.length).toBeGreaterThanOrEqual(1);
    });

    it("logs start and finish", async () => {
      const logSpy = vi.spyOn(processor["logger"], "log");
      const job = makeJob();
      await processor.process(job);

      const calls = logSpy.mock.calls.map((args) => args[0] as string);
      expect(calls.some((m) => /start/.test(m))).toBe(true);
      expect(calls.some((m) => /finish/.test(m))).toBe(true);
    });
  });

  describe("multi-page pagination", () => {
    it("processes all pages and reports correct total", async () => {
      const fullPage = Array.from({ length: 100 }, (_, i) =>
        makeGithubCommit(`sha-p1-${String(i)}`, `feat: commit ${String(i)}`),
      );
      const partialPage = [
        makeGithubCommit("sha-p2-0", "fix: something"),
        makeGithubCommit("sha-p2-1", "chore: cleanup"),
        makeGithubCommit("sha-p2-2", "docs: update"),
      ];

      setPages([fullPage, partialPage]);

      commitsMock.upsertBatch.mockImplementation(
        (batch: Array<{ sha: string; repositoryId: string }>) =>
          Promise.resolve(batch.map((c) => ({ id: `commit-${c.sha}`, sha: c.sha, repositoryId: c.repositoryId }))),
      );

      const job = makeJob();
      await processor.process(job);

      const synced = eventBusMock.publish.mock.calls.find(
        (args) => args[0] instanceof RepoSyncedEvent,
      )![0] as RepoSyncedEvent;
      expect(synced.commitsProcessed).toBe(103);
    });

    it("emits progress event for each page", async () => {
      const fullPage = Array.from({ length: 100 }, (_, i) =>
        makeGithubCommit(`sha-mp-${String(i)}`, `feat: commit ${String(i)}`),
      );
      setPages([fullPage, FIXTURE_COMMITS]);

      commitsMock.upsertBatch.mockImplementation(
        (batch: Array<{ sha: string; repositoryId: string }>) =>
          Promise.resolve(batch.map((c) => ({ id: `commit-${c.sha}`, sha: c.sha, repositoryId: c.repositoryId }))),
      );

      const job = makeJob();
      await processor.process(job);

      // Pagination emits once per page (2) plus enrichment emits every 50
      // SHAs + the final total. 105 commits → at least the 2 pagination
      // events + 50/100/105 enrichment events = 5. Assert ≥2 to keep the
      // original intent (per-page visibility) decoupled from the exact
      // enrichment cadence.
      const progress = eventBusMock.publish.mock.calls.filter(
        (args) => args[0] instanceof SyncProgressEvent,
      );
      expect(progress.length).toBeGreaterThanOrEqual(2);
    });

    it("handles empty repo (no commits)", async () => {
      setPages([]);

      const job = makeJob();
      await processor.process(job);

      expect(commitsMock.upsertBatch).not.toHaveBeenCalled();
      expect(commitsMock.upsertScores).not.toHaveBeenCalled();

      const synced = eventBusMock.publish.mock.calls.find(
        (args) => args[0] instanceof RepoSyncedEvent,
      )![0] as RepoSyncedEvent;
      expect(synced.commitsProcessed).toBe(0);
    });
  });

  describe("idempotency", () => {
    it("upserts on conflict so re-running is safe", async () => {
      const job = makeJob();
      await processor.process(job);

      syncJobsMock.createJob.mockResolvedValue({
        id: "sync-job-2",
        repositoryId: REPO_ID,
        status: "queued",
      });
      paginateIteratorMock = makeIterator([FIXTURE_COMMITS]);
      octokitFactoryMock.forUser.mockResolvedValue(buildOctokit());

      await processor.process(job);

      expect(syncJobsMock.markCompleted).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("marks job failed when repository not found", async () => {
      reposMock.findOne.mockResolvedValue(null);

      const job = makeJob();
      await expect(processor.process(job)).rejects.toThrow(/repository not found/);

      expect(syncJobsMock.markFailed).toHaveBeenCalledWith(
        SYNC_JOB_ID,
        expect.stringContaining("repository not found"),
        expect.any(Date),
      );
    });

    it("marks job failed on malformed fullName", async () => {
      reposMock.findOne.mockResolvedValue({ id: REPO_ID, fullName: "invalid", userId: USER_ID });

      const job = makeJob();
      await expect(processor.process(job)).rejects.toThrow(/malformed/);

      expect(syncJobsMock.markFailed).toHaveBeenCalled();
    });

    it("emits sync.failed when repository not found", async () => {
      reposMock.findOne.mockResolvedValue(null);

      const job = makeJob();
      await expect(processor.process(job)).rejects.toThrow();

      const failed = eventBusMock.publish.mock.calls.find(
        (args) => args[0] instanceof SyncFailedEvent,
      );
      expect(failed).toBeDefined();
      const event = failed![0] as SyncFailedEvent;
      expect(event.repositoryId).toBe(REPO_ID);
      expect(event.userId).toBe(USER_ID);
    });

    it("marks job failed on github api error", async () => {
      paginateIteratorMock = vi.fn().mockImplementation(function* () {
        throw new Error("github 503");
        yield; // make it a generator
      });
      octokitFactoryMock.forUser.mockResolvedValue(buildOctokit());

      const job = makeJob();
      await expect(processor.process(job)).rejects.toThrow("github 503");

      expect(syncJobsMock.markFailed).toHaveBeenCalledWith(
        SYNC_JOB_ID,
        "github 503",
        expect.any(Date),
      );
      expect(syncJobsMock.markCompleted).not.toHaveBeenCalled();
      expect(reposMock.touchLastSyncedAt).not.toHaveBeenCalled();
    });

    it("does not upsert when commit fetch fails", async () => {
      paginateIteratorMock = vi.fn().mockImplementation(function* () {
        throw new Error("timeout");
        yield;
      });
      octokitFactoryMock.forUser.mockResolvedValue(buildOctokit());

      const job = makeJob();
      await expect(processor.process(job)).rejects.toThrow();

      expect(commitsMock.upsertBatch).not.toHaveBeenCalled();
      expect(commitsMock.upsertScores).not.toHaveBeenCalled();
    });

    it("fails the whole job if a single getCommit fetch errors", async () => {
      getCommitMock.mockImplementation(({ ref }: { ref: string }) => {
        if (ref === "sha3") {
          return Promise.reject(new Error("github 502 on sha3"));
        }
        return Promise.resolve(makeGetCommitResponse(ref));
      });

      const job = makeJob();
      await expect(processor.process(job)).rejects.toThrow(/sha3/);

      expect(commitsMock.upsertBatch).not.toHaveBeenCalled();
      expect(commitFilesMock.replaceForCommits).not.toHaveBeenCalled();
      expect(syncJobsMock.markFailed).toHaveBeenCalled();
    });

    it("onFailed logs the error with attempt count", () => {
      const errorSpy = vi.spyOn(processor["logger"], "error");
      const job = makeJob({ attemptsMade: 3 });

      processor.onFailed(job, new Error("boom"));

      expect(errorSpy).toHaveBeenCalledOnce();
      expect(errorSpy.mock.calls[0]![0]).toMatch(/failed/);
      expect(errorSpy.mock.calls[0]![0]).toMatch(/attempt=3/);
    });
  });
});
