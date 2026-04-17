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

  if (connectedRes.status !== 200) {
    throw new Error(
      `Failed to load connected repositories (status ${connectedRes.status})`,
    );
  }

  const repo: ConnectedRepo | undefined = connectedRes.body.items.find(
    (r) => r.id === repoId,
  );
  if (!repo) notFound();

  if (summaryRes.status === 404) notFound();
  if (summaryRes.status !== 200) {
    throw new Error(`Failed to load analytics summary (status ${summaryRes.status})`);
  }
  if (timelineRes.status !== 200) {
    throw new Error(`Failed to load timeline (status ${timelineRes.status})`);
  }
  if (heatmapRes.status !== 200) {
    throw new Error(`Failed to load heatmap (status ${heatmapRes.status})`);
  }
  if (qualityRes.status !== 200) {
    throw new Error(
      `Failed to load quality distribution (status ${qualityRes.status})`,
    );
  }
  if (trendsRes.status !== 200) {
    throw new Error(
      `Failed to load quality trends (status ${trendsRes.status})`,
    );
  }
  if (contributorsRes.status !== 200) {
    throw new Error(
      `Failed to load contributors (status ${contributorsRes.status})`,
    );
  }
  if (filesRes.status !== 200) {
    throw new Error(
      `Failed to load files churn (status ${filesRes.status})`,
    );
  }

  return {
    repo,
    granularity: DEFAULT_GRANULARITY,
    contributorsLimit: CONTRIBUTORS_LIMIT,
    fileFrequencyLimit: FILE_FREQUENCY_LIMIT,
    initialSummary: summaryRes.body,
    initialTimeline: timelineRes.body.items,
    initialHeatmap: heatmapRes.body.items,
    initialQualityDistribution: qualityRes.body.items,
    initialQualityTrend: trendsRes.body.items,
    initialContributors: contributorsRes.body.items,
    initialFileFrequency: filesRes.body.items,
  };
};
