import type { MigrationInterface, QueryRunner } from "typeorm";

export class AuditEvents1713000002000 implements MigrationInterface {
  name = "AuditEvents1713000002000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "event_type" text NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "ip" inet,
        "user_agent" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "audit_events_user_created_idx" ON "audit_events" ("user_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "audit_events_user_type_created_idx" ON "audit_events" ("user_id", "event_type", "created_at" DESC) WHERE "event_type" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY`,
    );

    await queryRunner.query(`
      CREATE POLICY "audit_events_select_owner" ON "audit_events"
        FOR SELECT
        USING ("user_id" = auth.uid())
    `);
    await queryRunner.query(`
      CREATE POLICY "audit_events_insert_owner" ON "audit_events"
        FOR INSERT
        WITH CHECK ("user_id" = auth.uid())
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "audit_events_insert_owner" ON "audit_events"`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "audit_events_select_owner" ON "audit_events"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events"`);
  }
}
