import type { MigrationInterface, QueryRunner } from "typeorm";

export class GenerationHistory1713000006000 implements MigrationInterface {
  name = "GenerationHistory1713000006000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "generation_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "repository_id" uuid REFERENCES "repositories"("id") ON DELETE SET NULL,
        "diff_hash" text NOT NULL,
        "provider" text NOT NULL,
        "model" text NOT NULL,
        "tokens_used" int NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "suggestions" jsonb NOT NULL,
        "policy_id" uuid REFERENCES "policies"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "generation_history_status_chk" CHECK ("status" IN ('pending', 'streaming', 'completed', 'failed', 'cancelled'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "generation_history_user_created_idx" ON "generation_history" ("user_id", "created_at" DESC)`,
    );

    await queryRunner.query(
      `ALTER TABLE "generation_history" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_history" FORCE ROW LEVEL SECURITY`,
    );

    await queryRunner.query(`
      CREATE POLICY "generation_history_owner" ON "generation_history"
        USING ("user_id" = auth.uid())
        WITH CHECK ("user_id" = auth.uid())
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "generation_history_owner" ON "generation_history"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "generation_history"`);
  }
}
