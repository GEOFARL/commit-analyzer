import type {
  CommitQualityScoreRepository,
  UpsertScoreRow,
} from "@commit-analyzer/database";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import type { DataSource } from "typeorm";

import {
  COMMIT_QUALITY_SCORE_REPOSITORY,
  DATA_SOURCE,
} from "../../../common/database/tokens.js";
import { parseConventionalCommit } from "../../../shared/cc-parser.js";
import { scoreCommit } from "../../../shared/quality-scorer.js";
import { RESCORE_QUEUE, type RescoreJobData } from "../queues/rescore.queue.js";
import { DEFAULT_RESCORE_BATCH_SIZE } from "../services/queue.constants.js";

@Processor(RESCORE_QUEUE)
export class RescoreProcessor extends WorkerHost {
  private readonly logger = new Logger(RescoreProcessor.name);

  constructor(
    @Inject(DATA_SOURCE) private readonly dataSource: DataSource,
    @Inject(COMMIT_QUALITY_SCORE_REPOSITORY)
    private readonly qualityScoreRepo: CommitQualityScoreRepository,
  ) {
    super();
  }

  async process(job: Job<RescoreJobData>): Promise<void> {
    const { repositoryId, batchSize = DEFAULT_RESCORE_BATCH_SIZE } = job.data;

    this.logger.log(
      `rescore start jobId=${job.id} repositoryId=${repositoryId} batchSize=${batchSize}`,
    );

    let processed = 0;
    let offset = 0;

    for (;;) {
      const commits: { id: string; message: string }[] =
        await this.dataSource.query(
          `SELECT id, message FROM commits WHERE repository_id = $1 ORDER BY authored_at ASC LIMIT $2 OFFSET $3`,
          [repositoryId, batchSize, offset],
        );

      if (commits.length === 0) break;

      const rows: UpsertScoreRow[] = commits.map((c) => {
        const parsed = parseConventionalCommit(c.message);
        const score = scoreCommit(parsed, { message: c.message });
        return {
          commitId: c.id,
          isConventional: score.isConventional,
          ccType: score.ccType ?? null,
          ccScope: score.ccScope ?? null,
          subjectLength: score.subjectLength,
          hasBody: score.hasBody,
          hasFooter: score.hasFooter,
          overallScore: score.overallScore,
          details: score.details as unknown as Record<string, unknown>,
        };
      });

      await this.qualityScoreRepo.upsertBatch(rows);

      processed += commits.length;
      offset += batchSize;

      await job.updateProgress(processed);

      this.logger.debug(
        `rescore progress jobId=${job.id} processed=${processed}`,
      );
    }

    this.logger.log(
      `rescore finish jobId=${job.id} repositoryId=${repositoryId} total=${processed}`,
    );
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<RescoreJobData>, error: Error): void {
    this.logger.error(
      `rescore failed jobId=${job.id} repositoryId=${job.data.repositoryId} attempt=${job.attemptsMade}: ${error.message}`,
    );
  }
}
