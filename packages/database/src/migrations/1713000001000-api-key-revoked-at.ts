import type { MigrationInterface, QueryRunner } from "typeorm";

export class ApiKeyRevokedAt1713000001000 implements MigrationInterface {
  name = "ApiKeyRevokedAt1713000001000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD COLUMN "revoked_at" timestamptz`,
    );
    await queryRunner.query(
      `CREATE INDEX "api_keys_active_prefix_idx" ON "api_keys" ("key_prefix") WHERE "revoked_at" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "api_keys_active_prefix_idx"`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" DROP COLUMN "revoked_at"`,
    );
  }
}
