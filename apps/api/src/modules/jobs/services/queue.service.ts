import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";

import { SYNC_QUEUE, type SyncJobData } from "../queues/sync.queue.js";

import { SYNC_JOB_NAME, SYNC_JOB_OPTS } from "./queue.constants.js";

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(SYNC_QUEUE) private readonly syncQueue: Queue<SyncJobData>,
  ) {}

  /**
   * Enqueue a sync job for the given repository.
   * Idempotent: if a job for this repositoryId is already active, waiting, or
   * delayed, no duplicate is added.  Returns the existing job id in that case.
   */
  async enqueueSync(repositoryId: string, userId: string): Promise<string> {
    const jobId = `sync:${repositoryId}`;

    const existing = await this.syncQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "active" || state === "waiting" || state === "delayed") {
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
}
