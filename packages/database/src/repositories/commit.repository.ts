import type { DataSource, Repository as OrmRepository } from "typeorm";

import { Commit } from "../entities/commit.entity.js";
import { CommitQualityScore } from "../entities/commit-quality-score.entity.js";

export interface UpsertCommitInput {
  repositoryId: string;
  sha: string;
  authorName: string;
  authorEmail: string;
  message: string;
  subject: string | null;
  body: string | null;
  footer: string | null;
  insertions: number;
  deletions: number;
  filesChanged: number;
  authoredAt: Date;
}

export interface UpsertScoreInput {
  commitId: string;
  isConventional: boolean;
  ccType: string | null;
  ccScope: string | null;
  subjectLength: number | null;
  hasBody: boolean;
  hasFooter: boolean;
  overallScore: number;
  details: Record<string, unknown>;
}

export interface CommitRepository extends OrmRepository<Commit> {
  upsertBatch(commits: UpsertCommitInput[]): Promise<Commit[]>;
  upsertScores(scores: UpsertScoreInput[]): Promise<void>;
}

export const createCommitRepository = (
  dataSource: DataSource,
): CommitRepository => {
  const base = dataSource.getRepository(Commit);
  const extensions: Pick<CommitRepository, "upsertBatch" | "upsertScores"> = {
    async upsertBatch(commits: UpsertCommitInput[]): Promise<Commit[]> {
      if (commits.length === 0) return [];
      await base
        .createQueryBuilder()
        .insert()
        .into(Commit)
        .values(commits)
        .orUpdate(
          [
            "author_name",
            "author_email",
            "message",
            "subject",
            "body",
            "footer",
            "insertions",
            "deletions",
            "files_changed",
            "authored_at",
          ],
          ["repository_id", "sha"],
        )
        .execute();
      const shas = commits.map((c) => c.sha);
      return base.find({
        where: commits.map((c) => ({
          repositoryId: c.repositoryId,
          sha: c.sha,
        })),
        select: { id: true, sha: true, repositoryId: true },
        order: { authoredAt: "DESC" },
      }) as Promise<Commit[]>;
    },

    async upsertScores(scores: UpsertScoreInput[]): Promise<void> {
      if (scores.length === 0) return;
      const scoreRepo = dataSource.getRepository(CommitQualityScore);
      await scoreRepo
        .createQueryBuilder()
        .insert()
        .into(CommitQualityScore)
        .values(scores as never)
        .orUpdate(
          [
            "is_conventional",
            "cc_type",
            "cc_scope",
            "subject_length",
            "has_body",
            "has_footer",
            "overall_score",
            "details",
          ],
          ["commit_id"],
        )
        .execute();
    },
  };
  return base.extend(extensions) as CommitRepository;
};
