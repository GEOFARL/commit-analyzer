import "server-only";

import { createServerTsRestClient } from "@/lib/api/tsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { DefaultPolicyPageData } from "./types";

export const getDefaultPolicyPageData =
  async (): Promise<DefaultPolicyPageData> => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? null;
    const userId = data.session?.user.id ?? "anonymous";

    const client = createServerTsRestClient(accessToken);
    const res = await client.policies.defaults.get();
    if (res.status !== 200) {
      throw new Error(
        `Failed to load default policy template (status ${res.status})`,
      );
    }
    return { userId, initialTemplate: res.body.template };
  };
