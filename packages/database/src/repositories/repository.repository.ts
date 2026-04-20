import type { DataSource, Repository as OrmRepository } from "typeorm";

import { Commit } from "../entities/commit.entity.js";
import { Repository } from "../entities/repository.entity.js";

export interface PurgeResult {
  deletedCommits: number;
}

export interface RepositoryRepository extends OrmRepository<Repository> {
  listConnectedByUser(userId: string): Promise<Repository[]>;
  findByUserAndGithubId(
    userId: string,
    githubRepoId: string,
  ): Promise<Repository | null>;
  findByIdForUser(id: string, userId: string): Promise<Repository | null>;
  setConnected(id: string, isConnected: boolean): Promise<void>;
  touchLastSyncedAt(id: string, at: Date): Promise<void>;
  /**
   * Delete all commits for `id` (cascade drops commit_files + quality_scores)
   * and soft-reset the repo row (isConnected=false, lastSyncedAt=null) in one
   * transaction. Returns the count of deleted commits for audit logging.
   */
  purge(id: string): Promise<PurgeResult>;
}

export const createRepositoryRepository = (
  dataSource: DataSource,
): RepositoryRepository => {
  const base = dataSource.getRepository(Repository);
  const extensions: Pick<
    RepositoryRepository,
    | "listConnectedByUser"
    | "findByUserAndGithubId"
    | "findByIdForUser"
    | "setConnected"
    | "touchLastSyncedAt"
    | "purge"
  > = {
    listConnectedByUser(userId: string): Promise<Repository[]> {
      return base.find({
        where: { userId, isConnected: true },
        order: { createdAt: "DESC" },
      });
    },
    findByUserAndGithubId(
      userId: string,
      githubRepoId: string,
    ): Promise<Repository | null> {
      return base.findOne({ where: { userId, githubRepoId } });
    },
    findByIdForUser(id: string, userId: string): Promise<Repository | null> {
      return base.findOne({ where: { id, userId } });
    },
    async setConnected(id: string, isConnected: boolean): Promise<void> {
      await base.update({ id }, { isConnected });
    },
    async touchLastSyncedAt(id: string, at: Date): Promise<void> {
      await base.update({ id }, { lastSyncedAt: at });
    },
    async purge(id: string): Promise<PurgeResult> {
      return dataSource.transaction(async (m) => {
        const deleteResult = await m
          .createQueryBuilder()
          .delete()
          .from(Commit)
          .where("repository_id = :id", { id })
          .execute();
        await m
          .getRepository(Repository)
          .update({ id }, { isConnected: false, lastSyncedAt: null });
        return { deletedCommits: deleteResult.affected ?? 0 };
      });
    },
  };
  return base.extend(extensions) as RepositoryRepository;
};
