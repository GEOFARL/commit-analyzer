import type { MigrationInterface, QueryRunner } from "typeorm";

export class CommitEntities1713000003000 implements MigrationInterface {
  name = "CommitEntities1713000003000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "commits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "repository_id" uuid NOT NULL REFERENCES "repositories"("id") ON DELETE CASCADE,
        "sha" text NOT NULL,
        "author_name" text NOT NULL,
        "author_email" text NOT NULL,
        "message" text NOT NULL,
        "subject" text,
        "body" text,
        "footer" text,
        "insertions" int NOT NULL DEFAULT 0,
        "deletions" int NOT NULL DEFAULT 0,
        "files_changed" int NOT NULL DEFAULT 0,
        "authored_at" timestamptz NOT NULL,
        CONSTRAINT "commits_repo_sha_uk" UNIQUE ("repository_id", "sha")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "commits_repo_authored_idx" ON "commits" ("repository_id", "authored_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "commits_author_email_idx" ON "commits" ("author_email")`,
    );

    await queryRunner.query(`
      CREATE TABLE "commit_quality_scores" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "commit_id" uuid NOT NULL UNIQUE REFERENCES "commits"("id") ON DELETE CASCADE,
        "is_conventional" bool NOT NULL DEFAULT false,
        "cc_type" text,
        "cc_scope" text,
        "subject_length" int,
        "has_body" bool NOT NULL DEFAULT false,
        "has_footer" bool NOT NULL DEFAULT false,
        "overall_score" int NOT NULL,
        "details" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "commit_quality_scores_score_chk" CHECK ("overall_score" >= 0 AND "overall_score" <= 100)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "commit_quality_scores_overall_score_idx" ON "commit_quality_scores" ("overall_score")`,
    );

    await queryRunner.query(`
      CREATE TABLE "sync_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "repository_id" uuid NOT NULL REFERENCES "repositories"("id") ON DELETE CASCADE,
        "status" text NOT NULL DEFAULT 'queued',
        "commits_processed" int,
        "total_commits" int,
        "error_message" text,
        "started_at" timestamptz,
        "finished_at" timestamptz,
        CONSTRAINT "sync_jobs_status_chk" CHECK ("status" IN ('queued', 'running', 'completed', 'failed'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "sync_jobs_repo_status_idx" ON "sync_jobs" ("repository_id", "status")`,
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
            WHERE r."id" = "commits"."repository_id"
              AND r."user_id" = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM "repositories" r
            WHERE r."id" = "commits"."repository_id"
              AND r."user_id" = auth.uid()
          )
        )
    `);

    await queryRunner.query(`
      CREATE POLICY "commit_quality_scores_owner" ON "commit_quality_scores"
        USING (
          EXISTS (
            SELECT 1 FROM "commits" c
            JOIN "repositories" r ON r."id" = c."repository_id"
            WHERE c."id" = "commit_quality_scores"."commit_id"
              AND r."user_id" = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM "commits" c
            JOIN "repositories" r ON r."id" = c."repository_id"
            WHERE c."id" = "commit_quality_scores"."commit_id"
              AND r."user_id" = auth.uid()
          )
        )
    `);

    await queryRunner.query(`
      CREATE POLICY "sync_jobs_owner" ON "sync_jobs"
        USING (
          EXISTS (
            SELECT 1 FROM "repositories" r
            WHERE r."id" = "sync_jobs"."repository_id"
              AND r."user_id" = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM "repositories" r
            WHERE r."id" = "sync_jobs"."repository_id"
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
  }
}
