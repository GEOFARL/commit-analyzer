"use client";

import dynamic from "next/dynamic";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { AnalyticsPageData } from "../types";

import { ContributorsTable } from "./contributors-table";
import { FilesChurnTable } from "./files-churn-table";
import { SummaryCards } from "./summary-cards";

const ChartSkeleton = () => (
  <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
    <div className="h-[260px] w-full animate-pulse rounded bg-muted/40" />
  </div>
);

const HeatmapSkeleton = () => (
  <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
    <div className="h-[180px] w-full animate-pulse rounded bg-muted/40" />
  </div>
);

const TimelineChart = dynamic(
  () => import("./timeline-chart").then((m) => m.TimelineChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const QualityTrendChart = dynamic(
  () => import("./quality-trend-chart").then((m) => m.QualityTrendChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const QualityDistributionChart = dynamic(
  () => import("./quality-distribution-chart").then((m) => m.QualityDistributionChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const ActivityHeatmap = dynamic(
  () => import("./activity-heatmap").then((m) => m.ActivityHeatmap),
  { ssr: false, loading: () => <HeatmapSkeleton /> },
);

type AnalyticsViewProps = AnalyticsPageData;

const STAGGER_MS = 40;

const Reveal = ({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) => {
  const style: CSSProperties = {
    animationDelay: `${index * STAGGER_MS}ms`,
    animationFillMode: "backwards",
  };
  return (
    <div
      className={cn(
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
};

export const AnalyticsView = ({
  repo,
  granularity,
  contributorsLimit,
  fileFrequencyLimit,
  initialSummary,
  initialTimeline,
  initialHeatmap,
  initialQualityDistribution,
  initialQualityTrend,
  initialContributors,
  initialFileFrequency,
}: AnalyticsViewProps) => (
  <div className="flex flex-col gap-6">
    <Reveal index={0}>
      <SummaryCards repoId={repo.id} initial={initialSummary} />
    </Reveal>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Reveal index={1}>
        <TimelineChart
          repoId={repo.id}
          granularity={granularity}
          initial={initialTimeline}
        />
      </Reveal>
      <Reveal index={2}>
        <QualityTrendChart
          repoId={repo.id}
          granularity={granularity}
          initial={initialQualityTrend}
        />
      </Reveal>
    </div>

    <Reveal index={3}>
      <ActivityHeatmap repoId={repo.id} initial={initialHeatmap} />
    </Reveal>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Reveal index={4}>
        <QualityDistributionChart
          repoId={repo.id}
          initial={initialQualityDistribution}
        />
      </Reveal>
      <Reveal index={5}>
        <ContributorsTable
          repoId={repo.id}
          limit={contributorsLimit}
          initial={initialContributors}
        />
      </Reveal>
    </div>

    <Reveal index={6}>
      <FilesChurnTable
        repoId={repo.id}
        limit={fileFrequencyLimit}
        initial={initialFileFrequency}
      />
    </Reveal>
  </div>
);
