import type { AnalyticsCacheKind } from "./analytics-cache.types.js";

export const ANALYTICS_CACHE_TTL_SECONDS = 600; // 10 minutes
export const ANALYTICS_CACHE_PREFIX = "analytics";

/** Per-query TTL overrides (seconds). Falls back to ANALYTICS_CACHE_TTL_SECONDS. */
export const ANALYTICS_CACHE_TTL: Record<AnalyticsCacheKind, number> = {
  timeline: ANALYTICS_CACHE_TTL_SECONDS,
  heatmap: ANALYTICS_CACHE_TTL_SECONDS,
  qualityScores: ANALYTICS_CACHE_TTL_SECONDS,
  qualityTrends: ANALYTICS_CACHE_TTL_SECONDS,
  contributors: ANALYTICS_CACHE_TTL_SECONDS,
  fileFrequency: ANALYTICS_CACHE_TTL_SECONDS,
  summary: ANALYTICS_CACHE_TTL_SECONDS,
};
