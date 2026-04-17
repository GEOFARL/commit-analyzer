import type { Granularity } from "@commit-analyzer/contracts";

export const analyticsQueryKeys = {
  all: (repoId: string) => ["analytics", repoId] as const,
  summary: (repoId: string) => ["analytics", repoId, "summary"] as const,
  timeline: (repoId: string, granularity: Granularity) =>
    ["analytics", repoId, "timeline", granularity] as const,
  heatmap: (repoId: string) => ["analytics", repoId, "heatmap"] as const,
  quality: (repoId: string) => ["analytics", repoId, "quality"] as const,
  qualityTrends: (repoId: string, granularity: Granularity) =>
    ["analytics", repoId, "quality-trends", granularity] as const,
  contributors: (repoId: string, limit: number) =>
    ["analytics", repoId, "contributors", limit] as const,
  fileFrequency: (repoId: string, limit: number) =>
    ["analytics", repoId, "files", limit] as const,
};
