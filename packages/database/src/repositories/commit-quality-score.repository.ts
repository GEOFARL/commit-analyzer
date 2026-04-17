import type {
  DataSource,
  QueryDeepPartialEntity,
  Repository as OrmRepository,
} from "typeorm";

import { CommitQualityScore } from "../entities/commit-quality-score.entity.js";

/** Plain object accepted by `upsertBatch` — decoupled from TypeORM entity. */
export type UpsertScoreRow = {
  commitId: string;
  isConventional: boolean;
  ccType: string | null;
  ccScope: string | null;
  subjectLength: number;
  hasBody: boolean;
  hasFooter: boolean;
  overallScore: number;
  /** Stored as JSONB; accepts any serialisable structure (e.g. ScoreDetail[]). */
  details: unknown;
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
      // TypeORM's _QueryDeepPartialEntity rejects Record<string, unknown>
      // for jsonb columns — cast each row to the expected partial type.
      const mapped = rows.map(
        (r) =>
          ({
            commitId: r.commitId,
            isConventional: r.isConventional,
            ccType: r.ccType,
            ccScope: r.ccScope,
            subjectLength: r.subjectLength,
            hasBody: r.hasBody,
            hasFooter: r.hasFooter,
            overallScore: r.overallScore,
            details: r.details,
          }) as QueryDeepPartialEntity<CommitQualityScore>,
      );
      await base.upsert(mapped, ["commitId"]);
    },
  };

  return base.extend(extensions) as CommitQualityScoreRepository;
};
