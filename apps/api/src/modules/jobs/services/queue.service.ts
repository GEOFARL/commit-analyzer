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
   * Enqueue a sync job for the given repo.
   * Idempotent: if a job for this repoId is already active or waiting, no
   * duplicate is added.  Returns the existing job id in that case.
   */
  async enqueueSync(repoId: string, userId: string): Promise<string> {
    const jobId = `sync:${repoId}`;

    const existing = await this.syncQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "active" || state === "waiting" || state === "delayed") {
        this.logger.log(
          `sync job already ${state}, skipping enqueue repoId=${repoId} jobId=${jobId}`,
        );
        return jobId;
      }
    }

    await this.syncQueue.add(SYNC_JOB_NAME, { repoId, userId }, {
      ...SYNC_JOB_OPTS,
      jobId,
    });

    this.logger.log(`sync job enqueued repoId=${repoId} jobId=${jobId}`);
    return jobId;
  }
}
