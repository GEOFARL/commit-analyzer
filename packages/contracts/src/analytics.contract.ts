import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { errorEnvelopeSchema } from "./shared/error.js";

const c = initContract();

// ── Query params ───────────────────────────────────────────────

export const granularitySchema = z.enum(["day", "week"]);
export type Granularity = z.infer<typeof granularitySchema>;

const repoIdParam = z.object({ repoId: z.string().uuid() });

// ── Response DTOs ──────────────────────────────────────────────

export const timelinePointSchema = z.object({
  date: z.string(),
  count: z.number().int().nonnegative(),
});
export type TimelinePoint = z.infer<typeof timelinePointSchema>;

export const heatmapCellSchema = z.object({
  day: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  count: z.number().int().nonnegative(),
});
export type HeatmapCell = z.infer<typeof heatmapCellSchema>;

export const qualityBucketSchema = z.object({
  bucket: z.string(),
  count: z.number().int().nonnegative(),
});
export type QualityBucket = z.infer<typeof qualityBucketSchema>;

export const qualityTrendPointSchema = z.object({
  date: z.string(),
  avgScore: z.number().nonnegative(),
});
export type QualityTrendPoint = z.infer<typeof qualityTrendPointSchema>;

export const contributorSchema = z.object({
  authorName: z.string(),
  authorEmail: z.string(),
  commitCount: z.number().int().nonnegative(),
  avgQuality: z.number().nonnegative(),
});
export type Contributor = z.infer<typeof contributorSchema>;

export const fileChurnSchema = z.object({
  filePath: z.string(),
  changeCount: z.number().int().nonnegative(),
});
export type FileChurn = z.infer<typeof fileChurnSchema>;

export const summarySchema = z.object({
  totalCommits: z.number().int().nonnegative(),
  totalContributors: z.number().int().nonnegative(),
  avgQuality: z.number().nonnegative(),
  ccCompliancePercent: z.number().nonnegative(),
});
export type Summary = z.infer<typeof summarySchema>;

// ── Contract ───────────────────────────────────────────────────

export const analyticsContract = c.router(
  {
    timeline: {
      method: "GET",
      path: "/repos/:repoId/analytics/timeline",
      pathParams: repoIdParam,
      query: z.object({
        granularity: granularitySchema.default("day"),
      }),
      responses: {
        200: z.object({ items: z.array(timelinePointSchema) }),
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Commits per day or week",
      metadata: { auth: "jwt", rateLimit: "analytics" } as const,
    },
    heatmap: {
      method: "GET",
      path: "/repos/:repoId/analytics/heatmap",
      pathParams: repoIdParam,
      responses: {
        200: z.object({ items: z.array(heatmapCellSchema) }),
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Day-of-week × hour heatmap",
      metadata: { auth: "jwt", rateLimit: "analytics" } as const,
    },
    qualityDistribution: {
      method: "GET",
      path: "/repos/:repoId/analytics/quality",
      pathParams: repoIdParam,
      responses: {
        200: z.object({ items: z.array(qualityBucketSchema) }),
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Quality score distribution in buckets",
      metadata: { auth: "jwt", rateLimit: "analytics" } as const,
    },
    qualityTrend: {
      method: "GET",
      path: "/repos/:repoId/analytics/quality/trends",
      pathParams: repoIdParam,
      query: z.object({
        granularity: granularitySchema.default("day"),
      }),
      responses: {
        200: z.object({ items: z.array(qualityTrendPointSchema) }),
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Rolling average quality over time",
      metadata: { auth: "jwt", rateLimit: "analytics" } as const,
    },
    contributors: {
      method: "GET",
      path: "/repos/:repoId/analytics/contributors",
      pathParams: repoIdParam,
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(10),
      }),
      responses: {
        200: z.object({ items: z.array(contributorSchema) }),
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Top authors by commit count with avg quality",
      metadata: { auth: "jwt", rateLimit: "analytics" } as const,
    },
    filesChurn: {
      method: "GET",
      path: "/repos/:repoId/analytics/files",
      pathParams: repoIdParam,
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(10),
      }),
      responses: {
        200: z.object({ items: z.array(fileChurnSchema) }),
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Top files by change frequency",
      metadata: { auth: "jwt", rateLimit: "analytics" } as const,
    },
    summary: {
      method: "GET",
      path: "/repos/:repoId/analytics/summary",
      pathParams: repoIdParam,
      responses: {
        200: summarySchema,
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Totals: commits, contributors, avg quality, CC compliance %",
      metadata: { auth: "jwt", rateLimit: "analytics" } as const,
    },
  },
  { strictStatusCodes: true },
);
