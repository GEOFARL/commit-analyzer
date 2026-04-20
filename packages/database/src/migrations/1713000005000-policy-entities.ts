import type { MigrationInterface, QueryRunner } from "typeorm";

export class PolicyEntities1713000005000 implements MigrationInterface {
  name = "PolicyEntities1713000005000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "policies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "repository_id" uuid NOT NULL REFERENCES "repositories"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "is_active" bool NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "policies_active_per_repo_idx" ON "policies" ("repository_id") WHERE "is_active"`,
    );

    await queryRunner.query(`
      CREATE TABLE "policy_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "policy_id" uuid NOT NULL REFERENCES "policies"("id") ON DELETE CASCADE,
        "rule_type" text NOT NULL,
        "rule_value" jsonb NOT NULL,
        CONSTRAINT "policy_rules_rule_type_chk" CHECK ("rule_type" IN ('allowedTypes', 'allowedScopes', 'maxSubjectLength', 'bodyRequired', 'footerRequired'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "policy_rules_policy_id_idx" ON "policy_rules" ("policy_id")`,
    );

    for (const table of ["policies", "policy_rules"]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
      );
    }

    await queryRunner.query(`
      CREATE POLICY "policies_owner" ON "policies"
        USING (
          EXISTS (
            SELECT 1 FROM "repositories" r
            WHERE r."id" = "policies"."repository_id"
              AND r."user_id" = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM "repositories" r
            WHERE r."id" = "policies"."repository_id"
              AND r."user_id" = auth.uid()
          )
        )
    `);

    await queryRunner.query(`
      CREATE POLICY "policy_rules_owner" ON "policy_rules"
        USING (
          EXISTS (
            SELECT 1 FROM "policies" p
            JOIN "repositories" r ON r."id" = p."repository_id"
            WHERE p."id" = "policy_rules"."policy_id"
              AND r."user_id" = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM "policies" p
            JOIN "repositories" r ON r."id" = p."repository_id"
            WHERE p."id" = "policy_rules"."policy_id"
              AND r."user_id" = auth.uid()
          )
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "policy_rules_owner" ON "policy_rules"`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "policies_owner" ON "policies"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "policy_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policies"`);
  }
}
