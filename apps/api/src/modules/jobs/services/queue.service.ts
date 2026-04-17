import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";

import {
  RESCORE_QUEUE,
  type RescoreJobData,
} from "../queues/rescore.queue.js";
import { SYNC_QUEUE, type SyncJobData } from "../queues/sync.queue.js";

import {
  ACTIVE_JOB_STATES,
  RESCORE_JOB_NAME,
  RESCORE_JOB_OPTS,
  SYNC_JOB_NAME,
  SYNC_JOB_OPTS,
} from "./queue.constants.js";

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(SYNC_QUEUE) private readonly syncQueue: Queue<SyncJobData>,
    @InjectQueue(RESCORE_QUEUE)
    private readonly rescoreQueue: Queue<RescoreJobData>,
  ) {}

  /**
   * Enqueue a sync job for the given repository.
   * Idempotent: if a job for this repositoryId is already active, waiting, or
   * delayed, no duplicate is added.  Returns the existing job id in that case.
   */
  async enqueueSync(repositoryId: string, userId: string): Promise<string> {
    const jobId = `sync-${repositoryId}`;

    const existing = await this.syncQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (ACTIVE_JOB_STATES.has(state)) {
        this.logger.log(
          `sync job already ${state}, skipping enqueue repositoryId=${repositoryId} jobId=${jobId}`,
        );
        return jobId;
      }
    }

    await this.syncQueue.add(SYNC_JOB_NAME, { repositoryId, userId }, {
      ...SYNC_JOB_OPTS,
      jobId,
    });

    this.logger.log(`sync job enqueued repositoryId=${repositoryId} jobId=${jobId}`);
    return jobId;
  }

  /**
   * Enqueue a rescore job for the given repository.
   * Recomputes quality scores for all commits without re-fetching from GitHub.
   * Idempotent: skips if a rescore job is already in progress.
   */
  async enqueueRescore(
    repositoryId: string,
    batchSize?: number,
  ): Promise<string> {
    const jobId = `rescore-${repositoryId}`;

    const existing = await this.rescoreQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (ACTIVE_JOB_STATES.has(state)) {
        this.logger.log(
          `rescore job already ${state}, skipping repositoryId=${repositoryId} jobId=${jobId}`,
        );
        return jobId;
      }
    }

    const data: RescoreJobData = { repositoryId };
    if (batchSize !== undefined) data.batchSize = batchSize;

    await this.rescoreQueue.add(RESCORE_JOB_NAME, data, {
      ...RESCORE_JOB_OPTS,
      jobId,
    });

    this.logger.log(
      `rescore job enqueued repositoryId=${repositoryId} jobId=${jobId}`,
    );
    return jobId;
  }
}
