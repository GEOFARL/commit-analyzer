import type { AnalyticsCacheKind } from "./analytics-cache.types.js";

export const ANALYTICS_CACHE_PREFIX = "analytics";

const TEN_MINUTES = 600;

/** Per-query TTL (seconds). Defaults to 10 min; override per kind as needed. */
export const ANALYTICS_CACHE_TTL: Record<AnalyticsCacheKind, number> = {
  timeline: TEN_MINUTES,
  heatmap: TEN_MINUTES,
  qualityScores: TEN_MINUTES,
  qualityTrends: TEN_MINUTES,
  contributors: TEN_MINUTES,
  fileFrequency: TEN_MINUTES,
  summary: TEN_MINUTES,
};
