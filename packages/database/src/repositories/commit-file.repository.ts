import type {
  DataSource,
  EntityManager,
  Repository as OrmRepository,
} from "typeorm";

import {
  CommitFile,
  type CommitFileStatus,
} from "../entities/commit-file.entity.js";

export interface UpsertCommitFileInput {
  commitId: string;
  filePath: string;
  additions: number;
  deletions: number;
  status: CommitFileStatus;
}

export interface CommitFileRepository extends OrmRepository<CommitFile> {
  /**
   * Replace all rows for the given commit IDs with `files`. Sync runs as a
   * full refresh per commit — GitHub's `getCommit` response is the source of
   * truth, so old rows are dropped and re-inserted.
   *
   * Callers bound `commitIds.length` (SyncProcessor caps it at
   * UPSERT_BATCH_SIZE=500) so the `commit_id IN (:...)` list stays well
   * under Postgres's 32k parameter limit. If you grow that cap, shard the
   * delete.
   *
   * If `manager` is provided, both the DELETE and INSERT run on it so the
   * caller can wrap commits + scores + files in a single transaction.
   * Without a manager, a fresh transaction is opened here.
   */
  replaceForCommits(
    commitIds: string[],
    files: UpsertCommitFileInput[],
    manager?: EntityManager,
  ): Promise<void>;
}

export const createCommitFileRepository = (
  dataSource: DataSource,
): CommitFileRepository => {
  const base = dataSource.getRepository(CommitFile);

  const runReplace = async (
    manager: EntityManager,
    commitIds: string[],
    files: UpsertCommitFileInput[],
  ): Promise<void> => {
    await manager
      .createQueryBuilder()
      .delete()
      .from(CommitFile)
      .where("commit_id IN (:...commitIds)", { commitIds })
      .execute();

    if (files.length === 0) return;
    await manager
      .createQueryBuilder()
      .insert()
      .into(CommitFile)
      .values(files)
      .execute();
  };

  const extensions: Pick<CommitFileRepository, "replaceForCommits"> = {
    async replaceForCommits(
      commitIds: string[],
      files: UpsertCommitFileInput[],
      manager?: EntityManager,
    ): Promise<void> {
      if (commitIds.length === 0) return;
      if (manager) {
        await runReplace(manager, commitIds, files);
        return;
      }
      await dataSource.transaction((m) => runReplace(m, commitIds, files));
    },
  };
  return base.extend(extensions) as CommitFileRepository;
};
