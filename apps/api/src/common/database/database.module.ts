import {
  createApiKeyRepository,
  createDataSource,
} from "@commit-analyzer/database";
import { Global, Logger, Module } from "@nestjs/common";

import { getServerEnv } from "../config.js";

import { API_KEY_REPOSITORY, DATA_SOURCE } from "./tokens.js";

type AppDataSource = ReturnType<typeof createDataSource>;

const dbLogger = new Logger("DatabaseModule");

@Global()
@Module({
  providers: [
    {
      provide: DATA_SOURCE,
      useFactory: async (): Promise<AppDataSource> => {
        const env = getServerEnv();
        const ds = createDataSource({ url: env.DATABASE_URL });
        try {
          if (!ds.isInitialized) await ds.initialize();
        } catch (err) {
          dbLogger.warn(
            `data source initialize failed, deferring: ${String(err)}`,
          );
        }
        return ds;
      },
    },
    {
      provide: API_KEY_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (ds: AppDataSource) => createApiKeyRepository(ds),
    },
  ],
  exports: [DATA_SOURCE, API_KEY_REPOSITORY],
})
export class DatabaseModule {}
