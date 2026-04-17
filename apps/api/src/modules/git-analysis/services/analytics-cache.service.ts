import { Injectable, Logger } from "@nestjs/common";

import { CacheService } from "../../../common/cache/cache.service.js";

import {
  ANALYTICS_CACHE_PREFIX,
  ANALYTICS_CACHE_TTL,
} from "./analytics-cache.constants.js";
import type { AnalyticsCacheKind } from "./analytics-cache.types.js";

@Injectable()
export class AnalyticsCacheService {
  private readonly logger = new Logger(AnalyticsCacheService.name);
  private hits = 0;
  private misses = 0;

  constructor(private readonly cache: CacheService) {}

  private key(repoId: string, kind: AnalyticsCacheKind, suffix?: string): string {
    return suffix
      ? `${ANALYTICS_CACHE_PREFIX}:${repoId}:${kind}:${suffix}`
      : `${ANALYTICS_CACHE_PREFIX}:${repoId}:${kind}`;
  }

  /**
   * Read-through helper: returns cached value if present, otherwise calls
   * `loader`, stores the result under `analytics:<repoId>:<kind>[:<suffix>]`
   * with the per-query TTL, and returns it.
   */
  async getOrSet<T>(
    kind: AnalyticsCacheKind,
    repoId: string,
    loader: () => Promise<T>,
    suffix?: string,
  ): Promise<T> {
    const k = this.key(repoId, kind, suffix);
    const cached = await this.cache.getJson<T>(k);
    if (cached !== null) {
      this.hits++;
      this.logger.debug(
        `cache hit  key=${k} hits=${this.hits} misses=${this.misses}`,
      );
      return cached;
    }
    this.misses++;
    this.logger.debug(
      `cache miss key=${k} hits=${this.hits} misses=${this.misses}`,
    );
    const result = await loader();
    await this.cache.setJson(k, result, ANALYTICS_CACHE_TTL[kind]);
    return result;
  }

  /** Hit/miss counters for debugging (e.g. health endpoint or logs). */
  metrics(): { hits: number; misses: number } {
    return { hits: this.hits, misses: this.misses };
  }

  async invalidateRepo(repoId: string): Promise<number> {
    return this.cache.delByPattern(`${ANALYTICS_CACHE_PREFIX}:${repoId}:*`);
  }
}
