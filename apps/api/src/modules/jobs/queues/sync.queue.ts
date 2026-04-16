export const SYNC_QUEUE = "sync";

export interface SyncJobData {
  repositoryId: string;
  userId: string;
}

export type SyncJobName = "sync-repo";
