import "server-only";

import { createServerTsRestClient } from "@/lib/api/tsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { RepositoriesPageData } from "./types";

export const getRepositoriesPageData =
  async (): Promise<RepositoriesPageData> => {
    const supabase = await createSupabaseServerClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? null;
    const userId = sessionData.session?.user.id ?? "anonymous";

    const client = createServerTsRestClient(accessToken);

    const [githubRes, connectedRes] = await Promise.all([
      client.repos.listGithub(),
      client.repos.listConnected(),
    ]);

    if (githubRes.status !== 200) {
      throw new Error(
        `Failed to load GitHub repositories (status ${githubRes.status})`,
      );
    }
    if (connectedRes.status !== 200) {
      throw new Error(
        `Failed to load connected repositories (status ${connectedRes.status})`,
      );
    }

    return {
      userId,
      initialGithub: githubRes.body.items,
      initialConnected: connectedRes.body.items,
    };
  };
