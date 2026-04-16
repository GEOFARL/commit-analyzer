import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { SYNC_QUEUE, type SyncJobData } from "../queues/sync.queue.js";

@Processor(SYNC_QUEUE)
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  async process(job: Job<SyncJobData>): Promise<void> {
    this.logger.log(
      `sync job start jobId=${job.id} repoId=${job.data.repoId} userId=${job.data.userId}`,
    );

    // placeholder — real implementation wired in T-2.2
    await Promise.resolve();

    this.logger.log(`sync job finish jobId=${job.id} repoId=${job.data.repoId}`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<SyncJobData>, error: Error): void {
    this.logger.error(
      `sync job failed jobId=${job.id} repoId=${job.data.repoId} attempt=${job.attemptsMade}: ${error.message}`,
    );
  }
}
