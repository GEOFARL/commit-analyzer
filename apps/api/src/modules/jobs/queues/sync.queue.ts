export const SYNC_QUEUE = "sync";

export interface SyncJobData {
  repoId: string;
  userId: string;
}

export type SyncJobName = "sync-repo";
