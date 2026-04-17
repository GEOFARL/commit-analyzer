import type { JobState } from "bullmq";

import type { RescoreJobName } from "../queues/rescore.queue.js";
import type { SyncJobName } from "../queues/sync.queue.js";

export const SYNC_JOB_NAME: SyncJobName = "sync-repo";

export const SYNC_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
} as const;

export const RESCORE_JOB_NAME: RescoreJobName = "rescore-repo";

export const RESCORE_JOB_OPTS = {
  attempts: 1,
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 20 },
} as const;

export const DEFAULT_RESCORE_BATCH_SIZE = 500;

/** BullMQ states that indicate a job is still pending — skip enqueue. */
export const ACTIVE_JOB_STATES = new Set<JobState | "unknown">([
  "active",
  "waiting",
  "delayed",
  "waiting-children",
  "prioritized",
]);
