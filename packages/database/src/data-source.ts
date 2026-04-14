import "reflect-metadata";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DataSource } from "typeorm";
import { SnakeNamingStrategy } from "typeorm-naming-strategies";

const here = dirname(fileURLToPath(import.meta.url));
const compiled = here.includes(`${"/"}dist${"/"}`) || here.endsWith("/dist");
const ext = compiled ? "js" : "ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is required to construct the @commit-analyzer/database DataSource",
  );
}

export const AppDataSource = new DataSource({
  type: "postgres",
  url,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : false,
  entities: [join(here, `entities/*.entity.${ext}`)],
  migrations: [join(here, `migrations/*.${ext}`)],
  migrationsTableName: "typeorm_migrations",
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: false,
});

export default AppDataSource;
