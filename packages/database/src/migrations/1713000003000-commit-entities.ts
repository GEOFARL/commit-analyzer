import type { MigrationInterface, QueryRunner } from "typeorm";

export class CommitEntities1713000003000 implements MigrationInterface {
  name = "CommitEntities1713000003000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "sync_job_status" AS ENUM ('pending', 'running', 'done', 'failed')
    `);

    await queryRunner.query(`
      CREATE TABLE "commits" (
        "sha" text PRIMARY KEY,
        "repo_id" uuid NOT NULL REFERENCES "repositories"("id") ON DELETE CASCADE,
        "author_email" text NOT NULL,
        "author_name" text NOT NULL,
        "authored_at" timestamptz NOT NULL,
        "message" text NOT NULL,
        "additions" int NOT NULL DEFAULT 0,
        "deletions" int NOT NULL DEFAULT 0,
        "files_changed" int NOT NULL DEFAULT 0,
        "parent_count" smallint NOT NULL DEFAULT 1
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "commits_repo_authored_idx" ON "commits" ("repo_id", "authored_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "commits_repo_author_email_idx" ON "commits" ("repo_id", "author_email")`,
    );

    await queryRunner.query(`
      CREATE TABLE "commit_quality_scores" (
        "commit_sha" text PRIMARY KEY REFERENCES "commits"("sha") ON DELETE CASCADE,
        "cc_valid" bool NOT NULL DEFAULT false,
        "score" smallint NOT NULL,
        "breakdown" jsonb NOT NULL DEFAULT '{}',
        "scored_at" timestamptz NOT NULL,
        CONSTRAINT "commit_quality_scores_score_chk" CHECK ("score" >= 0 AND "score" <= 100)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sync_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "repo_id" uuid NOT NULL REFERENCES "repositories"("id") ON DELETE CASCADE,
        "status" sync_job_status NOT NULL DEFAULT 'pending',
        "started_at" timestamptz,
        "finished_at" timestamptz,
        "progress_pct" smallint,
        "error" text,
        CONSTRAINT "sync_jobs_progress_chk" CHECK ("progress_pct" IS NULL OR ("progress_pct" >= 0 AND "progress_pct" <= 100))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "sync_jobs_repo_id_idx" ON "sync_jobs" ("repo_id")`,
    );

    for (const table of ["commits", "commit_quality_scores", "sync_jobs"]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
      );
    }

    await queryRunner.query(`
      CREATE POLICY "commits_owner" ON "commits"
        USING (
          EXISTS (
            SELECT 1 FROM "repositories" r
            WHERE r."id" = "commits"."repo_id"
              AND r."user_id" = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM "repositories" r
            WHERE r."id" = "commits"."repo_id"
              AND r."user_id" = auth.uid()
          )
        )
    `);

    await queryRunner.query(`
      CREATE POLICY "commit_quality_scores_owner" ON "commit_quality_scores"
        USING (
          EXISTS (
            SELECT 1 FROM "commits" c
            JOIN "repositories" r ON r."id" = c."repo_id"
            WHERE c."sha" = "commit_quality_scores"."commit_sha"
              AND r."user_id" = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM "commits" c
            JOIN "repositories" r ON r."id" = c."repo_id"
            WHERE c."sha" = "commit_quality_scores"."commit_sha"
              AND r."user_id" = auth.uid()
          )
        )
    `);

    await queryRunner.query(`
      CREATE POLICY "sync_jobs_owner" ON "sync_jobs"
        USING (
          EXISTS (
            SELECT 1 FROM "repositories" r
            WHERE r."id" = "sync_jobs"."repo_id"
              AND r."user_id" = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM "repositories" r
            WHERE r."id" = "sync_jobs"."repo_id"
              AND r."user_id" = auth.uid()
          )
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "sync_jobs_owner" ON "sync_jobs"`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "commit_quality_scores_owner" ON "commit_quality_scores"`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "commits_owner" ON "commits"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "sync_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "commit_quality_scores"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "commits"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "sync_job_status"`);
  }
}
