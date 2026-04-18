import type { DataSource, Repository as OrmRepository } from "typeorm";

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
   * truth, so old rows are dropped and re-inserted in a single transaction.
   */
  replaceForCommits(
    commitIds: string[],
    files: UpsertCommitFileInput[],
  ): Promise<void>;
}

export const createCommitFileRepository = (
  dataSource: DataSource,
): CommitFileRepository => {
  const base = dataSource.getRepository(CommitFile);
  const extensions: Pick<CommitFileRepository, "replaceForCommits"> = {
    async replaceForCommits(
      commitIds: string[],
      files: UpsertCommitFileInput[],
    ): Promise<void> {
      if (commitIds.length === 0) return;
      await dataSource.transaction(async (manager) => {
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
      });
    },
  };
  return base.extend(extensions) as CommitFileRepository;
};
