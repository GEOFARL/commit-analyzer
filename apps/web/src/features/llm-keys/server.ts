import "server-only";

import { createServerTsRestClient } from "@/lib/api/tsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { LlmKeysPageData } from "./types";

export const getLlmKeysPageData = async (): Promise<LlmKeysPageData> => {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;
  const userId = sessionData.session?.user.id ?? "anonymous";

  const client = createServerTsRestClient(accessToken);
  const res = await client.auth.llmKeys.list();

  if (res.status !== 200) {
    throw new Error(`Failed to load LLM keys (status ${res.status})`);
  }

  return {
    userId,
    initialItems: res.body.items,
  };
};
