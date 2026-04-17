import type {
  ConnectedRepo,
  Contributor,
  FileFrequency,
  Granularity,
  HeatmapCell,
  QualityBucket,
  QualityTrendPoint,
  Summary,
  TimelinePoint,
} from "@commit-analyzer/contracts";

export type ListEnvelope<T> = {
  status: 200;
  body: { items: T[] };
  headers: Headers;
};

export type SummaryEnvelope = {
  status: 200;
  body: Summary;
  headers: Headers;
};

export type AnalyticsPageData = {
  repo: ConnectedRepo;
  granularity: Granularity;
  contributorsLimit: number;
  fileFrequencyLimit: number;
  initialSummary: Summary;
  initialTimeline: TimelinePoint[];
  initialHeatmap: HeatmapCell[];
  initialQualityDistribution: QualityBucket[];
  initialQualityTrend: QualityTrendPoint[];
  initialContributors: Contributor[];
  initialFileFrequency: FileFrequency[];
};
