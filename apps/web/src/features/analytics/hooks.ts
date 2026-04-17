"use client";

import type {
  Contributor,
  FileFrequency,
  Granularity,
  HeatmapCell,
  QualityBucket,
  QualityTrendPoint,
  Summary,
  TimelinePoint,
} from "@commit-analyzer/contracts";

import { tsr } from "@/lib/api/tsr";

import { analyticsQueryKeys } from "./queries";
import type { ListEnvelope, SummaryEnvelope } from "./types";

const STALE_MS = 60_000;

const makeListEnvelope = <T>(items: T[]): ListEnvelope<T> => ({
  status: 200,
  body: { items },
  headers: new Headers(),
});

export const useSummaryQuery = (repoId: string, initial: Summary) => {
  const initialData: SummaryEnvelope = {
    status: 200,
    body: initial,
    headers: new Headers(),
  };
  return tsr.analytics.summary.useQuery({
    queryKey: [...analyticsQueryKeys.summary(repoId)],
    queryData: { params: { repoId } },
    initialData,
    staleTime: STALE_MS,
    retry: 0,
  });
};

export const useTimelineQuery = (
  repoId: string,
  granularity: Granularity,
  initial: TimelinePoint[],
) =>
  tsr.analytics.timeline.useQuery({
    queryKey: [...analyticsQueryKeys.timeline(repoId, granularity)],
    queryData: { params: { repoId }, query: { granularity } },
    initialData: makeListEnvelope(initial),
    staleTime: STALE_MS,
    retry: 0,
  });

export const useHeatmapQuery = (repoId: string, initial: HeatmapCell[]) =>
  tsr.analytics.heatmap.useQuery({
    queryKey: [...analyticsQueryKeys.heatmap(repoId)],
    queryData: { params: { repoId } },
    initialData: makeListEnvelope(initial),
    staleTime: STALE_MS,
    retry: 0,
  });

export const useQualityDistributionQuery = (
  repoId: string,
  initial: QualityBucket[],
) =>
  tsr.analytics.qualityScores.useQuery({
    queryKey: [...analyticsQueryKeys.quality(repoId)],
    queryData: { params: { repoId } },
    initialData: makeListEnvelope(initial),
    staleTime: STALE_MS,
    retry: 0,
  });

export const useQualityTrendQuery = (
  repoId: string,
  granularity: Granularity,
  initial: QualityTrendPoint[],
) =>
  tsr.analytics.qualityTrends.useQuery({
    queryKey: [...analyticsQueryKeys.qualityTrends(repoId, granularity)],
    queryData: { params: { repoId }, query: { granularity } },
    initialData: makeListEnvelope(initial),
    staleTime: STALE_MS,
    retry: 0,
  });

export const useContributorsQuery = (
  repoId: string,
  limit: number,
  initial: Contributor[],
) =>
  tsr.analytics.contributors.useQuery({
    queryKey: [...analyticsQueryKeys.contributors(repoId, limit)],
    queryData: { params: { repoId }, query: { limit } },
    initialData: makeListEnvelope(initial),
    staleTime: STALE_MS,
    retry: 0,
  });

export const useFileFrequencyQuery = (
  repoId: string,
  limit: number,
  initial: FileFrequency[],
) =>
  tsr.analytics.fileFrequency.useQuery({
    queryKey: [...analyticsQueryKeys.fileFrequency(repoId, limit)],
    queryData: { params: { repoId }, query: { limit } },
    initialData: makeListEnvelope(initial),
    staleTime: STALE_MS,
    retry: 0,
  });
