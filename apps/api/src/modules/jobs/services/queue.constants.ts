import type { SyncJobName } from "../queues/sync.queue.js";

export const SYNC_JOB_NAME: SyncJobName = "sync-repo";

export const SYNC_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
} as const;
