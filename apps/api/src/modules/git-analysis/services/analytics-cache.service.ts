import { Injectable } from "@nestjs/common";

import { CacheService } from "../../../common/cache/cache.service.js";

import {
  ANALYTICS_CACHE_PREFIX,
  ANALYTICS_CACHE_TTL_SECONDS,
} from "./analytics-cache.constants.js";
import type { AnalyticsCacheKind } from "./analytics-cache.types.js";

@Injectable()
export class AnalyticsCacheService {
  constructor(private readonly cache: CacheService) {}

  private key(kind: AnalyticsCacheKind, repoId: string, suffix?: string): string {
    return suffix
      ? `${ANALYTICS_CACHE_PREFIX}:${kind}:${repoId}:${suffix}`
      : `${ANALYTICS_CACHE_PREFIX}:${kind}:${repoId}`;
  }

  async get<T>(kind: AnalyticsCacheKind, repoId: string, suffix?: string): Promise<T | null> {
    return this.cache.getJson<T>(this.key(kind, repoId, suffix));
  }

  async set(kind: AnalyticsCacheKind, repoId: string, value: unknown, suffix?: string): Promise<void> {
    await this.cache.setJson(
      this.key(kind, repoId, suffix),
      value,
      ANALYTICS_CACHE_TTL_SECONDS,
    );
  }

  async invalidateRepo(repoId: string): Promise<number> {
    return this.cache.delByPattern(`${ANALYTICS_CACHE_PREFIX}:*:${repoId}*`);
  }
}
