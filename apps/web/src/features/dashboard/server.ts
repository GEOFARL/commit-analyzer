import "server-only";

import { createServerTsRestClient } from "@/lib/api/tsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { RECENT_REPOS_LIMIT } from "./constants";
import type { DashboardPageData } from "./types";

const sortByLastSyncedDesc = <T extends { lastSyncedAt: string | null }>(
  items: T[],
): T[] =>
  [...items].sort((a, b) => {
    const aTs = a.lastSyncedAt ? Date.parse(a.lastSyncedAt) : 0;
    const bTs = b.lastSyncedAt ? Date.parse(b.lastSyncedAt) : 0;
    return bTs - aTs;
  });

export const getDashboardPageData = async (): Promise<DashboardPageData> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const metadata = (user?.user_metadata ?? {}) as {
    full_name?: string;
    user_name?: string;
    name?: string;
  };
  const userName =
    metadata.full_name ??
    metadata.name ??
    metadata.user_name ??
    user?.email ??
    null;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;
  const client = createServerTsRestClient(accessToken);

  const [connectedRes, keysRes] = await Promise.all([
    client.repos.listConnected(),
    client.auth.llmKeys.list(),
  ]);

  if (connectedRes.status !== 200) {
    throw new Error(
      `Failed to load connected repositories (status ${connectedRes.status})`,
    );
  }

  const connected = connectedRes.body.items;
  const recentRepos = sortByLastSyncedDesc(connected).slice(
    0,
    RECENT_REPOS_LIMIT,
  );

  const hasLlmKey =
    keysRes.status === 200 && keysRes.body.items.some((k) => k.status === "ok");

  return {
    userName,
    recentRepos,
    connectedCount: connected.length,
    hasLlmKey,
  };
};
