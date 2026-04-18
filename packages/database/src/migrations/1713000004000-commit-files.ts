import type { MigrationInterface, QueryRunner } from "typeorm";

export class CommitFiles1713000004000 implements MigrationInterface {
  name = "CommitFiles1713000004000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "commit_files" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "commit_id" uuid NOT NULL REFERENCES "commits"("id") ON DELETE CASCADE,
        "file_path" text NOT NULL,
        "additions" int NOT NULL DEFAULT 0,
        "deletions" int NOT NULL DEFAULT 0,
        "status" text NOT NULL,
        CONSTRAINT "commit_files_status_chk" CHECK (
          "status" IN ('added', 'modified', 'removed', 'renamed')
        )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "commit_files_commit_idx" ON "commit_files" ("commit_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "commit_files_file_path_idx" ON "commit_files" ("file_path")`,
    );

    await queryRunner.query(
      `ALTER TABLE "commit_files" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "commit_files" FORCE ROW LEVEL SECURITY`,
    );

    await queryRunner.query(`
      CREATE POLICY "commit_files_owner" ON "commit_files"
        USING (
          EXISTS (
            SELECT 1 FROM "commits" c
            JOIN "repositories" r ON r."id" = c."repository_id"
            WHERE c."id" = "commit_files"."commit_id"
              AND r."user_id" = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM "commits" c
            JOIN "repositories" r ON r."id" = c."repository_id"
            WHERE c."id" = "commit_files"."commit_id"
              AND r."user_id" = auth.uid()
          )
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "commit_files_owner" ON "commit_files"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "commit_files"`);
  }
}
