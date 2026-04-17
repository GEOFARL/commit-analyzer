import {
  createApiKeyRepository,
  createAuditEventRepository,
  createCommitRepository,
  createDataSource,
  createRepositoryRepository,
  createSyncJobRepository,
  createUserRepository,
  type DataSource,
} from "@commit-analyzer/database";
import { Global, Logger, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { getServerEnv } from "../config.js";

import {
  API_KEY_REPOSITORY,
  AUDIT_EVENT_REPOSITORY,
  COMMIT_REPOSITORY,
  DATA_SOURCE,
  REPOSITORY_REPOSITORY,
  SYNC_JOB_REPOSITORY,
  USER_REPOSITORY,
} from "./tokens.js";
import { TransactionalInterceptor } from "./transactional.interceptor.js";

const dbLogger = new Logger("DatabaseModule");

@Global()
@Module({
  providers: [
    {
      provide: DATA_SOURCE,
      useFactory: async (): Promise<DataSource> => {
        const env = getServerEnv();
        const ds = createDataSource({ url: env.DATABASE_URL });
        try {
          if (!ds.isInitialized) await ds.initialize();
        } catch (err) {
          if (env.NODE_ENV === "test") {
            dbLogger.warn(
              `data source initialize failed (test), deferring: ${String(err)}`,
            );
          } else {
            throw err;
          }
        }
        return ds;
      },
    },
    {
      provide: API_KEY_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (ds: DataSource) => createApiKeyRepository(ds),
    },
    {
      provide: USER_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (ds: DataSource) => createUserRepository(ds),
    },
    {
      provide: REPOSITORY_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (ds: DataSource) => createRepositoryRepository(ds),
    },
    {
      provide: AUDIT_EVENT_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (ds: DataSource) => createAuditEventRepository(ds),
    },
    {
      provide: COMMIT_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (ds: DataSource) => createCommitRepository(ds),
    },
    {
      provide: SYNC_JOB_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (ds: DataSource) => createSyncJobRepository(ds),
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransactionalInterceptor,
    },
  ],
  exports: [
    DATA_SOURCE,
    API_KEY_REPOSITORY,
    AUDIT_EVENT_REPOSITORY,
    USER_REPOSITORY,
    REPOSITORY_REPOSITORY,
    COMMIT_REPOSITORY,
    SYNC_JOB_REPOSITORY,
  ],
})
export class DatabaseModule {}
