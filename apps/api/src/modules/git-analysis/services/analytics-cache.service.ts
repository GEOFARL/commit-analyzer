import { Injectable, Logger } from "@nestjs/common";

import { CacheService } from "../../../common/cache/cache.service.js";

import {
  ANALYTICS_CACHE_PREFIX,
  ANALYTICS_CACHE_STATS_HITS,
  ANALYTICS_CACHE_STATS_MISSES,
  ANALYTICS_CACHE_TTL,
} from "./analytics-cache.constants.js";
import type { AnalyticsCacheKind } from "./analytics-cache.types.js";

@Injectable()
export class AnalyticsCacheService {
  private readonly logger = new Logger(AnalyticsCacheService.name);

  constructor(private readonly cache: CacheService) {}

  private key(repoId: string, kind: AnalyticsCacheKind, suffix?: string): string {
    return suffix
      ? `${ANALYTICS_CACHE_PREFIX}:${repoId}:${kind}:${suffix}`
      : `${ANALYTICS_CACHE_PREFIX}:${repoId}:${kind}`;
  }

  /**
   * Read-through helper: returns cached value if present, otherwise calls
   * `loader`, stores the result under `analytics:<repoId>:<kind>[:<suffix>]`
   * with the per-query TTL, and returns it. Hit/miss tallies are INCR'd in
   * Redis so `metrics()` aggregates across instances.
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
      const hits = await this.cache.incr(ANALYTICS_CACHE_STATS_HITS);
      this.logger.debug(`cache hit  key=${k} hits=${hits}`);
      return cached;
    }
    const misses = await this.cache.incr(ANALYTICS_CACHE_STATS_MISSES);
    this.logger.debug(`cache miss key=${k} misses=${misses}`);
    const result = await loader();
    await this.cache.setJson(k, result, ANALYTICS_CACHE_TTL[kind]);
    return result;
  }

  /** Cross-instance hit/miss counters (read from Redis). */
  async metrics(): Promise<{ hits: number; misses: number; hitRate: number }> {
    const [hits, misses] = await Promise.all([
      this.cache.getNumber(ANALYTICS_CACHE_STATS_HITS),
      this.cache.getNumber(ANALYTICS_CACHE_STATS_MISSES),
    ]);
    const total = hits + misses;
    return { hits, misses, hitRate: total === 0 ? 0 : hits / total };
  }

  async invalidateRepo(repoId: string): Promise<number> {
    return this.cache.delByPattern(`${ANALYTICS_CACHE_PREFIX}:${repoId}:*`);
  }
}
