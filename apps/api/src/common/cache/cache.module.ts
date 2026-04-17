import { Global, Logger, Module } from "@nestjs/common";
import { Redis } from "ioredis";

import { getServerEnv } from "../config.js";

import { CacheService } from "./cache.service.js";
import { REDIS_CLIENT } from "./tokens.js";

const logger = new Logger("CacheModule");

// In test, the full app is bootstrapped without a live Redis; returning a
// noop stub lets unit/integration tests that hit /health boot cleanly without
// the ioredis client trying to reach localhost.
class NoopRedis {
  get(): Promise<string | null> {
    return Promise.resolve(null);
  }
  set(): Promise<"OK"> {
    return Promise.resolve("OK");
  }
  del(): Promise<number> {
    return Promise.resolve(0);
  }
  scan(): Promise<[string, string[]]> {
    return Promise.resolve(["0", []]);
  }
  on(): void {}
  quit(): Promise<"OK"> {
    return Promise.resolve("OK");
  }
  disconnect(): void {}
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => {
        const env = getServerEnv();
        if (env.NODE_ENV === "test") {
          return new NoopRedis() as unknown as Redis;
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
