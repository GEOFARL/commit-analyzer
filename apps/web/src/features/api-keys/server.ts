import "server-only";

import { createServerTsRestClient } from "@/lib/api/tsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ApiKeysPageData } from "./types";

export const getApiKeysPageData = async (): Promise<ApiKeysPageData> => {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;
  const userId = sessionData.session?.user.id ?? "anonymous";

  const client = createServerTsRestClient(accessToken);
  const res = await client.auth.apiKeys.list();

  if (res.status !== 200) {
    throw new Error(`Failed to load API keys (status ${res.status})`);
  }

  return {
    userId,
    initialItems: res.body.items,
  };
};
