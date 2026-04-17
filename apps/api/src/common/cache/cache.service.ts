import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Redis } from "ioredis";

import { REDIS_CLIENT } from "./tokens.js";

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`cache.get failed key=${key}: ${String(err)}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
      this.logger.warn(`cache.set failed key=${key}: ${String(err)}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`cache.del failed key=${key}: ${String(err)}`);
    }
  }

  /** Delete all keys matching a glob `pattern` using SCAN (non-blocking). */
  async delByPattern(pattern: string): Promise<number> {
    let deleted = 0;
    let cursor = "0";
    try {
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = next;
        if (keys.length > 0) {
          await this.redis.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== "0");
    } catch (err) {
      this.logger.warn(
        `cache.delByPattern failed pattern=${pattern}: ${String(err)}`,
      );
    }
    return deleted;
  }
}
