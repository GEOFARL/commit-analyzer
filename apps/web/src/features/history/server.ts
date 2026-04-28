import "server-only";

import { createServerTsRestClient } from "@/lib/api/tsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { HISTORY_PAGE_SIZE, type HistoryPageData } from "./types";

export const getHistoryPageData = async (): Promise<HistoryPageData> => {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;

  const client = createServerTsRestClient(accessToken);
  const res = await client.generation.history.list({
    query: { limit: HISTORY_PAGE_SIZE },
  });

  if (res.status !== 200) {
    throw new Error(`Failed to load history (status ${res.status})`);
  }

  return {
    initialItems: res.body.items,
    initialNextCursor: res.body.nextCursor,
  };
};
