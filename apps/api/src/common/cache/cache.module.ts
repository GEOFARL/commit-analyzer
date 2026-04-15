import { Global, Logger, Module } from "@nestjs/common";
import { Redis } from "ioredis";

import { getServerEnv } from "../config.js";

import { CacheService } from "./cache.service.js";
import { REDIS_CLIENT } from "./tokens.js";

const logger = new Logger("CacheModule");

// In test, the full app is bootstrapped without a live Redis; returning a
// noop stub lets unit/integration tests that hit /health boot cleanly without
// the ioredis client trying to reach localhost.
const createNoopRedis = (): Redis =>
  ({
    get: () => Promise.resolve(null),
    set: () => Promise.resolve("OK"),
    del: () => Promise.resolve(0),
    on: () => undefined,
    quit: () => Promise.resolve("OK"),
    disconnect: () => undefined,
  }) as unknown as Redis;

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => {
        const env = getServerEnv();
        if (env.NODE_ENV === "test") {
          return createNoopRedis();
        }
        const client = new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false,
        });
        client.on("error", (err: Error) => {
          logger.warn(`redis error: ${err.message}`);
        });
        return client;
      },
    },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class CacheModule {}
