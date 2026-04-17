export const RESCORE_QUEUE = "rescore";

export interface RescoreJobData {
  repositoryId: string;
  batchSize?: number;
}

export type RescoreJobName = "rescore-repo";
