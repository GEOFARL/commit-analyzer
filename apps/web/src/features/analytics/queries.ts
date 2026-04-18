import type { Granularity } from "@commit-analyzer/contracts";

import { analyticsQueryKeyPrefix } from "@/lib/query-keys/analytics";

export const analyticsQueryKeys = {
  all: analyticsQueryKeyPrefix,
  summary: (repoId: string) =>
    [...analyticsQueryKeyPrefix(repoId), "summary"] as const,
  timeline: (repoId: string, granularity: Granularity) =>
    [...analyticsQueryKeyPrefix(repoId), "timeline", granularity] as const,
  heatmap: (repoId: string) =>
    [...analyticsQueryKeyPrefix(repoId), "heatmap"] as const,
  quality: (repoId: string) =>
    [...analyticsQueryKeyPrefix(repoId), "quality"] as const,
  qualityTrends: (repoId: string, granularity: Granularity) =>
    [
      ...analyticsQueryKeyPrefix(repoId),
      "quality-trends",
      granularity,
    ] as const,
  contributors: (repoId: string, limit: number) =>
    [...analyticsQueryKeyPrefix(repoId), "contributors", limit] as const,
  fileFrequency: (repoId: string, limit: number) =>
    [...analyticsQueryKeyPrefix(repoId), "files", limit] as const,
};
