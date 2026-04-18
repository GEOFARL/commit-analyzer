import type {
  CommitFileRepository,
  CommitRepository,
  RepositoryRepository,
  SyncJobRepository,
  UpsertCommitFileInput,
  UpsertCommitInput,
  UpsertScoreInput,
} from "@commit-analyzer/database";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import type { Job } from "bullmq";

import {
  COMMIT_FILE_REPOSITORY,
  COMMIT_REPOSITORY,
  REPOSITORY_REPOSITORY,
  SYNC_JOB_REPOSITORY,
} from "../../../common/database/tokens.js";
import { type ParsedCC, parseConventionalCommit } from "../../../shared/cc-parser.js";
import { RepoSyncedEvent } from "../../../shared/events/repo-synced.event.js";
import { SyncFailedEvent } from "../../../shared/events/sync-failed.event.js";
import { SyncProgressEvent } from "../../../shared/events/sync-progress.event.js";
import { SyncStartedEvent } from "../../../shared/events/sync-started.event.js";
import { scoreCommit } from "../../../shared/quality-scorer.js";
import { OctokitFactory } from "../../octokit/octokit-factory.service.js";
import { SYNC_QUEUE, type SyncJobData } from "../queues/sync.queue.js";
import { type CommitFileStats, mapGithubFileStatus } from "../utils/commit-file-stats.js";
import { runWithConcurrency } from "../utils/concurrency.js";

const COMMITS_PER_PAGE = 100;
const UPSERT_BATCH_SIZE = 500;
const PER_COMMIT_FETCH_CONCURRENCY = 5;

type CommitEntry = {
  input: UpsertCommitInput;
  parsed: ParsedCC;
  files: UpsertCommitFileInput[];
};

type PendingEntry = {
  sha: string;
  authorName: string;
  authorEmail: string;
  authoredAt: Date;
  message: string;
  parsed: ParsedCC;
  subject: string | null;
  body: string | null;
  footer: string | null;
};

@Processor(SYNC_QUEUE)
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(
    @Inject(REPOSITORY_REPOSITORY)
    private readonly repos: RepositoryRepository,
    @Inject(SYNC_JOB_REPOSITORY)
    private readonly syncJobs: SyncJobRepository,
    @Inject(COMMIT_REPOSITORY)
    private readonly commits: CommitRepository,
    @Inject(COMMIT_FILE_REPOSITORY)
    private readonly commitFiles: CommitFileRepository,
    private readonly octokitFactory: OctokitFactory,
    private readonly eventBus: EventBus,
  ) {
    super();
  }

  async process(job: Job<SyncJobData>): Promise<void> {
    const { repositoryId, userId } = job.data;
    this.logger.log(
      `sync job start jobId=${job.id} repositoryId=${repositoryId} userId=${userId}`,
    );

    const syncJob = await this.syncJobs.createJob(repositoryId);
    await this.syncJobs.markRunning(syncJob.id, new Date());

    this.eventBus.publish(new SyncStartedEvent(repositoryId, userId, syncJob.id));

    try {
      const repo = await this.repos.findOne({ where: { id: repositoryId } });
      if (!repo) {
        throw new Error(`repository not found: ${repositoryId}`);
      }

      const parts = repo.fullName.split("/");
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(`malformed repository fullName: ${repo.fullName}`);
      }
      const [owner, repoName] = parts as [string, string];

      const octokit = await this.octokitFactory.forUser(userId);

      const pending: PendingEntry[] = [];

      for await (const page of octokit.paginate.iterator(
        octokit.rest.repos.listCommits,
        { owner, repo: repoName, per_page: COMMITS_PER_PAGE },
      )) {
        const pageData = page.data;

        for (const c of pageData) {
          const authorName =
            c.commit.author?.name ?? c.commit.committer?.name ?? "unknown";
          const authorEmail =
            c.commit.author?.email ?? c.commit.committer?.email ?? "";
          const authoredAtRaw =
            c.commit.author?.date ?? c.commit.committer?.date;
          const authoredAt = authoredAtRaw ? new Date(authoredAtRaw) : new Date();
          const message = c.commit.message;
          const parsed = parseConventionalCommit(message);

          pending.push({
            sha: c.sha,
            authorName,
            authorEmail,
            authoredAt,
            message,
            parsed,
            subject: parsed.ok ? parsed.subject : null,
            body: parsed.ok ? (parsed.body ?? null) : null,
            footer: parsed.ok ? (parsed.footer ?? null) : null,
          });
        }

        await this.syncJobs.updateProgress(
          syncJob.id,
          pending.length,
          // estimate: may overshoot by <100 on the last partial page;
          // the final updateProgress call below corrects to exact total.
          pending.length + (pageData.length === COMMITS_PER_PAGE ? COMMITS_PER_PAGE : 0),
        );
        this.eventBus.publish(
          new SyncProgressEvent(
            repositoryId,
            syncJob.id,
            pending.length,
            pending.length,
          ),
        );
      }

      // Per-SHA enrichment: `listCommits` omits diff stats and file lists,
      // so every commit needs a `getCommit` call. Bounded concurrency keeps
      // the burst inside Octokit's secondary rate limit and memory flat on
      // large repos.
      const enrichedEntries = await runWithConcurrency(
        pending,
        PER_COMMIT_FETCH_CONCURRENCY,
        async (p): Promise<CommitEntry> => {
          const stats = await this.fetchCommitFileStats(
            octokit,
            owner,
            repoName,
            p.sha,
          );
          const input: UpsertCommitInput = {
            repositoryId,
            sha: p.sha,
            authorName: p.authorName,
            authorEmail: p.authorEmail,
            message: p.message,
            subject: p.subject,
            body: p.body,
            footer: p.footer,
            insertions: stats.additions,
            deletions: stats.deletions,
            filesChanged: stats.files.length,
            authoredAt: p.authoredAt,
          };
          return {
            parsed: p.parsed,
            input,
            files: stats.files,
          };
        },
      );

      // upsert commits + scores + files per-batch so each batch is consistent
      for (let i = 0; i < enrichedEntries.length; i += UPSERT_BATCH_SIZE) {
        const batch = enrichedEntries.slice(i, i + UPSERT_BATCH_SIZE);
        const saved = await this.commits.upsertBatch(batch.map((e) => e.input));

        const scoreInputs: UpsertScoreInput[] = [];
        const fileInputs: UpsertCommitFileInput[] = [];
        const commitIds: string[] = [];

        for (const savedCommit of saved) {
          const entry = batch.find((e) => e.input.sha === savedCommit.sha);
          if (!entry) continue;
          commitIds.push(savedCommit.id);
          const scored = scoreCommit(entry.parsed, {
            message: entry.input.message,
            subject: entry.input.subject,
            body: entry.input.body,
            footer: entry.input.footer,
          });
          scoreInputs.push({
            commitId: savedCommit.id,
            isConventional: scored.isConventional,
            ccType: scored.ccType ?? null,
            ccScope: scored.ccScope ?? null,
            subjectLength: scored.subjectLength,
            hasBody: scored.hasBody,
            hasFooter: scored.hasFooter,
            overallScore: scored.overallScore,
            details: scored.details as unknown as Record<string, unknown>,
          });
          for (const f of entry.files) {
            fileInputs.push({ ...f, commitId: savedCommit.id });
          }
        }
        await this.commits.upsertScores(scoreInputs);
        await this.commitFiles.replaceForCommits(commitIds, fileInputs);
      }

      const total = enrichedEntries.length;
      await this.syncJobs.updateProgress(syncJob.id, total, total);
      await this.syncJobs.markCompleted(syncJob.id, new Date());

      this.eventBus.publish(
        new RepoSyncedEvent(repositoryId, userId, syncJob.id, total),
      );

      this.logger.log(
        `sync job finish jobId=${job.id} repositoryId=${repositoryId} commits=${String(total)}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.syncJobs.markFailed(syncJob.id, msg, new Date());
      this.eventBus.publish(
        new SyncFailedEvent(repositoryId, userId, syncJob.id, msg),
      );
      throw err;
    }
  }

  private async fetchCommitFileStats(
    octokit: Awaited<ReturnType<OctokitFactory["forUser"]>>,
    owner: string,
    repo: string,
    sha: string,
  ): Promise<CommitFileStats> {
    const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref: sha });
    const additions = data.stats?.additions ?? 0;
    const deletions = data.stats?.deletions ?? 0;
    const files: UpsertCommitFileInput[] = (data.files ?? []).map((f) => ({
      commitId: "", // filled after commit upsert returns real ids
      filePath: f.filename,
      additions: f.additions ?? 0,
      deletions: f.deletions ?? 0,
      status: mapGithubFileStatus(f.status),
    }));
    return { additions, deletions, files };
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<SyncJobData>, error: Error): void {
    this.logger.error(
      `sync job failed jobId=${job.id} repositoryId=${job.data.repositoryId} attempt=${job.attemptsMade}: ${error.message}`,
    );
  }
}
