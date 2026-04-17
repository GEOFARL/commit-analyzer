import "server-only";

import type { ConnectedRepo } from "@commit-analyzer/contracts";
import { notFound } from "next/navigation";

import { createServerTsRestClient } from "@/lib/api/tsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  CONTRIBUTORS_LIMIT,
  DEFAULT_GRANULARITY,
  FILE_FREQUENCY_LIMIT,
} from "./constants";
import type { AnalyticsPageData } from "./types";

type OkBody<Res> = Res extends { status: 200; body: infer B } ? B : never;

const unwrap = <Res extends { status: number; body: unknown }>(
  label: string,
  res: Res,
): OkBody<Res> => {
  if (res.status === 404) notFound();
  if (res.status !== 200) {
    throw new Error(`Failed to load ${label} (status ${res.status})`);
  }
  return res.body as OkBody<Res>;
};

export const getAnalyticsPageData = async (
  repoId: string,
): Promise<AnalyticsPageData> => {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;

  const client = createServerTsRestClient(accessToken);

  const [
    connectedRes,
    summaryRes,
    timelineRes,
    heatmapRes,
    qualityRes,
    trendsRes,
    contributorsRes,
    filesRes,
  ] = await Promise.all([
    client.repos.listConnected(),
    client.analytics.summary({ params: { repoId } }),
    client.analytics.timeline({
      params: { repoId },
      query: { granularity: DEFAULT_GRANULARITY },
    }),
    client.analytics.heatmap({ params: { repoId } }),
    client.analytics.qualityScores({ params: { repoId } }),
    client.analytics.qualityTrends({
      params: { repoId },
      query: { granularity: DEFAULT_GRANULARITY },
    }),
    client.analytics.contributors({
      params: { repoId },
      query: { limit: CONTRIBUTORS_LIMIT },
    }),
    client.analytics.fileFrequency({
      params: { repoId },
      query: { limit: FILE_FREQUENCY_LIMIT },
    }),
  ]);

  const connectedBody = unwrap("connected repositories", connectedRes);
  const repo: ConnectedRepo | undefined = connectedBody.items.find(
    (r) => r.id === repoId,
  );
  if (!repo) notFound();

  return {
    repo,
    granularity: DEFAULT_GRANULARITY,
    contributorsLimit: CONTRIBUTORS_LIMIT,
    fileFrequencyLimit: FILE_FREQUENCY_LIMIT,
    initialSummary: unwrap("analytics summary", summaryRes),
    initialTimeline: unwrap("timeline", timelineRes).items,
    initialHeatmap: unwrap("heatmap", heatmapRes).items,
    initialQualityDistribution: unwrap("quality distribution", qualityRes)
      .items,
    initialQualityTrend: unwrap("quality trends", trendsRes).items,
    initialContributors: unwrap("contributors", contributorsRes).items,
    initialFileFrequency: unwrap("files churn", filesRes).items,
  };
};
