import "server-only";

import { createServerTsRestClient } from "@/lib/api/tsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ProfilePageData } from "./types";

export const getProfilePageData = async (): Promise<ProfilePageData> => {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;

  const client = createServerTsRestClient(accessToken);
  const res = await client.auth.me();

  if (res.status !== 200) {
    throw new Error(`Failed to load profile (status ${res.status})`);
  }

  return { user: res.body };
};
