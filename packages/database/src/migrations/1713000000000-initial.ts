import type { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1713000000000 implements MigrationInterface {
  name = "Initial1713000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // pgcrypto powers gen_random_uuid(); intentionally not dropped in down()
    // because it is shared infrastructure that other migrations may rely on.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        "github_id" text UNIQUE,
        "email" text,
        "username" text,
        "avatar_url" text,
        "access_token_enc" bytea,
        "access_token_iv" bytea,
        "access_token_tag" bytea,
        "default_policy_template" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "repositories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "github_repo_id" bigint NOT NULL,
        "full_name" text NOT NULL,
        "description" text,
        "default_branch" text,
        "language" text,
        "stars" int NOT NULL DEFAULT 0,
        "is_connected" bool NOT NULL DEFAULT false,
        "last_synced_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "repositories_user_github_repo_uk" UNIQUE ("user_id", "github_repo_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "repositories_user_id_idx" ON "repositories" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "key_prefix" text NOT NULL UNIQUE,
        "key_hash" text NOT NULL,
        "last_used_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "api_keys_user_id_idx" ON "api_keys" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "llm_api_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "provider" text NOT NULL,
        "key_enc" bytea NOT NULL,
        "key_iv" bytea NOT NULL,
        "key_tag" bytea NOT NULL,
        "status" text NOT NULL DEFAULT 'unknown',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "llm_api_keys_user_provider_uk" UNIQUE ("user_id", "provider"),
        CONSTRAINT "llm_api_keys_provider_chk" CHECK ("provider" IN ('openai', 'anthropic')),
        CONSTRAINT "llm_api_keys_status_chk" CHECK ("status" IN ('ok', 'invalid', 'unknown'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "llm_api_keys_user_id_idx" ON "llm_api_keys" ("user_id")`,
    );

    for (const table of ["users", "repositories", "api_keys", "llm_api_keys"]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
      );
    }

    await queryRunner.query(`
      CREATE POLICY "users_owner" ON "users"
        USING ("id" = auth.uid())
        WITH CHECK ("id" = auth.uid())
    `);
    await queryRunner.query(`
      CREATE POLICY "repositories_owner" ON "repositories"
        USING ("user_id" = auth.uid())
        WITH CHECK ("user_id" = auth.uid())
    `);
    await queryRunner.query(`
      CREATE POLICY "api_keys_owner" ON "api_keys"
        USING ("user_id" = auth.uid())
        WITH CHECK ("user_id" = auth.uid())
    `);
    await queryRunner.query(`
      CREATE POLICY "llm_api_keys_owner" ON "llm_api_keys"
        USING ("user_id" = auth.uid())
        WITH CHECK ("user_id" = auth.uid())
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        INSERT INTO public.users (id, email, github_id, username, avatar_url)
        VALUES (
          NEW.id,
          NEW.email,
          NEW.raw_user_meta_data->>'provider_id',
          NEW.raw_user_meta_data->>'user_name',
          NEW.raw_user_meta_data->>'avatar_url'
        )
        ON CONFLICT (id) DO NOTHING;
        RETURN NEW;
      END;
      $$;
    `);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users`,
    );
    await queryRunner.query(`
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.handle_new_user()`);

    await queryRunner.query(
      `DROP POLICY IF EXISTS "llm_api_keys_owner" ON "llm_api_keys"`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "api_keys_owner" ON "api_keys"`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "repositories_owner" ON "repositories"`,
    );
    await queryRunner.query(`DROP POLICY IF EXISTS "users_owner" ON "users"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "llm_api_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "repositories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
