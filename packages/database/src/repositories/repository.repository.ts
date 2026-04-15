import type { DataSource, Repository as OrmRepository } from "typeorm";

import { Repository } from "../entities/repository.entity.js";

export interface RepositoryRepository extends OrmRepository<Repository> {
  listConnectedByUser(userId: string): Promise<Repository[]>;
  findByUserAndGithubId(
    userId: string,
    githubRepoId: string,
  ): Promise<Repository | null>;
  findByIdForUser(id: string, userId: string): Promise<Repository | null>;
  setConnected(id: string, isConnected: boolean): Promise<void>;
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
  };
  return base.extend(extensions) as RepositoryRepository;
};
