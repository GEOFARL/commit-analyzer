import type {
  CommitRepository,
  RepositoryRepository,
  SyncJobRepository,
  UpsertCommitInput,
  UpsertScoreInput,
} from "@commit-analyzer/database";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import type { Job } from "bullmq";

import {
  COMMIT_REPOSITORY,
  REPOSITORY_REPOSITORY,
  SYNC_JOB_REPOSITORY,
} from "../../../common/database/tokens.js";
import { parseConventionalCommit } from "../../../shared/cc-parser.js";
import { scoreCommit } from "../../../shared/quality-scorer.js";
import { OctokitFactory } from "../../octokit/octokit-factory.service.js";
import { RepoSyncedEvent } from "../events/repo-synced.event.js";
import { SyncFailedEvent } from "../events/sync-failed.event.js";
import { SyncProgressEvent } from "../events/sync-progress.event.js";
import { SYNC_QUEUE, type SyncJobData } from "../queues/sync.queue.js";

const COMMITS_PER_PAGE = 100;
const UPSERT_BATCH_SIZE = 500;

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

    try {
      const repo = await this.repos.findOne({ where: { id: repositoryId } });
      if (!repo) {
        throw new Error(`repository not found: ${repositoryId}`);
      }

      const [owner, repoName] = repo.fullName.split("/") as [string, string];
      const octokit = await this.octokitFactory.forUser(userId);

      const allCommits: UpsertCommitInput[] = [];
      let page = 1;

      while (true) {
        const { data: pageData } = await octokit.rest.repos.listCommits({
          owner,
          repo: repoName,
          per_page: COMMITS_PER_PAGE,
          page,
        });

        if (pageData.length === 0) break;

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
          const subject = parsed.ok ? parsed.subject : null;
          const body = parsed.ok ? (parsed.body ?? null) : null;
          const footer = parsed.ok ? (parsed.footer ?? null) : null;

          allCommits.push({
            repositoryId,
            sha: c.sha,
            authorName,
            authorEmail,
            message,
            subject,
            body,
            footer,
            insertions: 0,
            deletions: 0,
            filesChanged: 0,
            authoredAt,
          });
        }

        const totalEstimate = page * COMMITS_PER_PAGE;
        await this.syncJobs.updateProgress(
          syncJob.id,
          allCommits.length,
          totalEstimate,
        );
        this.eventBus.publish(
          new SyncProgressEvent(
            repositoryId,
            syncJob.id,
            allCommits.length,
            totalEstimate,
          ),
        );

        if (pageData.length < COMMITS_PER_PAGE) break;
        page += 1;
      }

      const scoreInputs: UpsertScoreInput[] = [];
      for (let i = 0; i < allCommits.length; i += UPSERT_BATCH_SIZE) {
        const batch = allCommits.slice(i, i + UPSERT_BATCH_SIZE);
        const saved = await this.commits.upsertBatch(batch);

        for (const savedCommit of saved) {
          const original = batch.find((b) => b.sha === savedCommit.sha);
          if (!original) continue;
          const parsed = parseConventionalCommit(original.message);
          const scored = scoreCommit(parsed, {
            message: original.message,
            subject: original.subject,
            body: original.body,
            footer: original.footer,
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
        }
      }

      await this.commits.upsertScores(scoreInputs);

      const total = allCommits.length;
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

  @OnWorkerEvent("failed")
  onFailed(job: Job<SyncJobData>, error: Error): void {
    this.logger.error(
      `sync job failed jobId=${job.id} repositoryId=${job.data.repositoryId} attempt=${job.attemptsMade}: ${error.message}`,
    );
  }
}
