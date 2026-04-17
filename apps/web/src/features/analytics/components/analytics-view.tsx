"use client";

import type { AnalyticsPageData } from "../types";

import { ActivityHeatmap } from "./activity-heatmap";
import { ContributorsTable } from "./contributors-table";
import { FilesChurnTable } from "./files-churn-table";
import { QualityDistributionChart } from "./quality-distribution-chart";
import { QualityTrendChart } from "./quality-trend-chart";
import { SummaryCards } from "./summary-cards";
import { TimelineChart } from "./timeline-chart";

type AnalyticsViewProps = AnalyticsPageData;

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
    <SummaryCards repoId={repo.id} initial={initialSummary} />

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <TimelineChart
        repoId={repo.id}
        granularity={granularity}
        initial={initialTimeline}
      />
      <QualityTrendChart
        repoId={repo.id}
        granularity={granularity}
        initial={initialQualityTrend}
      />
    </div>

    <ActivityHeatmap repoId={repo.id} initial={initialHeatmap} />

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <QualityDistributionChart
        repoId={repo.id}
        initial={initialQualityDistribution}
      />
      <ContributorsTable
        repoId={repo.id}
        limit={contributorsLimit}
        initial={initialContributors}
      />
    </div>

    <FilesChurnTable
      repoId={repo.id}
      limit={fileFrequencyLimit}
      initial={initialFileFrequency}
    />
  </div>
);
