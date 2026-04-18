import { z } from "zod";

export const SYNC_WS_NAMESPACE = "/sync";

export const SYNC_EVENT_NAMES = {
  progress: "sync.progress",
  completed: "sync.completed",
  failed: "sync.failed",
} as const;

export const syncProgressPayloadSchema = z.object({
  repositoryId: z.string().uuid(),
  syncJobId: z.string(),
  commitsProcessed: z.number().int().nonnegative(),
  totalCommits: z.number().int().nonnegative(),
});
export type SyncProgressPayload = z.infer<typeof syncProgressPayloadSchema>;

export const syncCompletedPayloadSchema = z.object({
  repositoryId: z.string().uuid(),
  syncJobId: z.string(),
  commitsProcessed: z.number().int().nonnegative(),
});
export type SyncCompletedPayload = z.infer<typeof syncCompletedPayloadSchema>;

export const syncFailedPayloadSchema = z.object({
  repositoryId: z.string().uuid(),
  syncJobId: z.string(),
  errorMessage: z.string(),
});
export type SyncFailedPayload = z.infer<typeof syncFailedPayloadSchema>;
