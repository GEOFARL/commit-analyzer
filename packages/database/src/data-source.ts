import "reflect-metadata";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DataSource, type DataSourceOptions } from "typeorm";
import { SnakeNamingStrategy } from "typeorm-naming-strategies";

const here = dirname(fileURLToPath(import.meta.url));
const ext = import.meta.url.endsWith(".ts") ? "ts" : "js";

export interface CreateDataSourceOptions {
  url?: string;
  ssl?: boolean;
}

export const buildDataSourceOptions = (
  options: CreateDataSourceOptions = {},
): DataSourceOptions => {
  const url = options.url ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required to construct the @commit-analyzer/database DataSource",
    );
  }

  const ssl = options.ssl ?? process.env.DATABASE_SSL === "true";

  return {
    type: "postgres",
    url,
    // Supabase's pooler presents a cert chain that Node's default store
    // doesn't trust; disabling verification here matches Supabase's own
    // client defaults and only affects transport verification, not auth.
    ssl: ssl ? { rejectUnauthorized: false } : false,
    entities: [join(here, `entities/*.entity.${ext}`)],
    migrations: [join(here, `migrations/*.${ext}`)],
    migrationsTableName: "typeorm_migrations",
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: false,
  };
};

export const createDataSource = (
  options: CreateDataSourceOptions = {},
): DataSource => new DataSource(buildDataSourceOptions(options));
