import type { DataSource, Repository as OrmRepository } from "typeorm";

import { SyncJob, type SyncJobStatus } from "../entities/sync-job.entity.js";

export interface SyncJobRepository extends OrmRepository<SyncJob> {
  createJob(repositoryId: string): Promise<SyncJob>;
  findById(id: string): Promise<SyncJob | null>;
  markRunning(id: string, startedAt: Date): Promise<void>;
  updateProgress(
    id: string,
    commitsProcessed: number,
    totalCommits: number,
  ): Promise<void>;
  markCompleted(id: string, finishedAt: Date): Promise<void>;
  markFailed(id: string, errorMessage: string, finishedAt: Date): Promise<void>;
}

export const createSyncJobRepository = (
  dataSource: DataSource,
): SyncJobRepository => {
  const base = dataSource.getRepository(SyncJob);
  const extensions: Pick<
    SyncJobRepository,
    | "createJob"
    | "findById"
    | "markRunning"
    | "updateProgress"
    | "markCompleted"
    | "markFailed"
  > = {
    async createJob(repositoryId: string): Promise<SyncJob> {
      const job = base.create({
        repositoryId,
        status: "queued" as SyncJobStatus,
        commitsProcessed: null,
        totalCommits: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
      });
      return base.save(job);
    },

    findById(id: string): Promise<SyncJob | null> {
      return base.findOne({ where: { id } });
    },

    async markRunning(id: string, startedAt: Date): Promise<void> {
      await base.update({ id }, { status: "running", startedAt });
    },

    async updateProgress(
      id: string,
      commitsProcessed: number,
      totalCommits: number,
    ): Promise<void> {
      await base.update({ id }, { commitsProcessed, totalCommits });
    },

    async markCompleted(id: string, finishedAt: Date): Promise<void> {
      await base.update({ id }, { status: "completed", finishedAt });
    },

    async markFailed(
      id: string,
      errorMessage: string,
      finishedAt: Date,
    ): Promise<void> {
      await base.update(
        { id },
        { status: "failed", errorMessage, finishedAt },
      );
    },
  };
  return base.extend(extensions) as SyncJobRepository;
};
