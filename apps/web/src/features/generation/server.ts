import "server-only";

import { createServerTsRestClient } from "@/lib/api/tsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { GeneratePageData } from "./types";

export const getGeneratePageData = async (): Promise<GeneratePageData> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token ?? null;
  const userId = data.session?.user.id ?? "anonymous";

  const client = createServerTsRestClient(accessToken);
  const [keysRes, reposRes] = await Promise.all([
    client.auth.llmKeys.list(),
    client.repos.listConnected(),
  ]);

  if (keysRes.status !== 200) {
    throw new Error(`Failed to load LLM keys (status ${keysRes.status})`);
  }
  if (reposRes.status !== 200) {
    throw new Error(
      `Failed to load connected repositories (status ${reposRes.status})`,
    );
  }

  return {
    userId,
    configuredKeys: keysRes.body.items,
    repos: reposRes.body.items,
  };
};
