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
  let reposMock: { findOne: ReturnType<typeof vi.fn> };
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
  let paginateIteratorMock: ReturnType<typeof vi.fn>;
  let octokitFactoryMock: { forUser: ReturnType<typeof vi.fn> };
  let eventBusMock: { publish: ReturnType<typeof vi.fn> };

  function setPages(pages: typeof FIXTURE_COMMITS[]) {
    paginateIteratorMock = makeIterator(pages);
    octokitFactoryMock.forUser.mockResolvedValue({
      rest: { repos: { listCommits: vi.fn() } },
      paginate: { iterator: paginateIteratorMock },
    });
  }

  beforeEach(() => {
    paginateIteratorMock = makeIterator([FIXTURE_COMMITS]);

    reposMock = {
      findOne: vi.fn().mockResolvedValue({
        id: REPO_ID,
        fullName: "octocat/hello-world",
        userId: USER_ID,
      }),
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

    eventBusMock = { publish: vi.fn() };

    octokitFactoryMock = {
      forUser: vi.fn().mockResolvedValue({
        rest: { repos: { listCommits: vi.fn() } },
        paginate: { iterator: paginateIteratorMock },
      }),
    };

    processor = new SyncProcessor(
      reposMock as never,
      syncJobsMock as never,
      commitsMock as never,
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

      const progress = eventBusMock.publish.mock.calls.filter(
        (args) => args[0] instanceof SyncProgressEvent,
      );
      expect(progress.length).toBe(2);
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
      octokitFactoryMock.forUser.mockResolvedValue({
        rest: { repos: { listCommits: vi.fn() } },
        paginate: { iterator: paginateIteratorMock },
      });

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
      octokitFactoryMock.forUser.mockResolvedValue({
        rest: { repos: { listCommits: vi.fn() } },
        paginate: { iterator: paginateIteratorMock },
      });

      const job = makeJob();
      await expect(processor.process(job)).rejects.toThrow("github 503");

      expect(syncJobsMock.markFailed).toHaveBeenCalledWith(
        SYNC_JOB_ID,
        "github 503",
        expect.any(Date),
      );
      expect(syncJobsMock.markCompleted).not.toHaveBeenCalled();
    });

    it("does not upsert when commit fetch fails", async () => {
      paginateIteratorMock = vi.fn().mockImplementation(function* () {
        throw new Error("timeout");
        yield;
      });
      octokitFactoryMock.forUser.mockResolvedValue({
        rest: { repos: { listCommits: vi.fn() } },
        paginate: { iterator: paginateIteratorMock },
      });

      const job = makeJob();
      await expect(processor.process(job)).rejects.toThrow();

      expect(commitsMock.upsertBatch).not.toHaveBeenCalled();
      expect(commitsMock.upsertScores).not.toHaveBeenCalled();
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
