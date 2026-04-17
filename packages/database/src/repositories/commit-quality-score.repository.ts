import type { DataSource, Repository as OrmRepository } from "typeorm";

import { CommitQualityScore } from "../entities/commit-quality-score.entity.js";

export type UpsertScoreRow = {
  commitId: string;
  isConventional: boolean;
  ccType: string | null;
  ccScope: string | null;
  subjectLength: number;
  hasBody: boolean;
  hasFooter: boolean;
  overallScore: number;
  details: Record<string, unknown>;
};

export interface CommitQualityScoreRepository
  extends OrmRepository<CommitQualityScore> {
  /**
   * Upsert a batch of quality score rows.
   * Uses ON CONFLICT (commit_id) DO UPDATE so existing rows are overwritten.
   */
  upsertBatch(rows: UpsertScoreRow[]): Promise<void>;
}

export const createCommitQualityScoreRepository = (
  dataSource: DataSource,
): CommitQualityScoreRepository => {
  const base = dataSource.getRepository(CommitQualityScore);

  const extensions: Pick<CommitQualityScoreRepository, "upsertBatch"> = {
    async upsertBatch(rows: UpsertScoreRow[]): Promise<void> {
      if (rows.length === 0) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await base.upsert(rows as any[], ["commitId"]);
    },
  };

  return base.extend(extensions) as CommitQualityScoreRepository;
};
