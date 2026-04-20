import type { MigrationInterface, QueryRunner } from "typeorm";

export class UserDefaultPolicyTemplate1713000006000
  implements MigrationInterface
{
  name = "UserDefaultPolicyTemplate1713000006000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "default_policy_template" jsonb`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "default_policy_template"`,
    );
  }
}
