import "server-only";

import { redirect } from "next/navigation";

import { createServerTsRestClient } from "@/lib/api/tsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { DefaultPolicyPageData } from "./types";

export const getDefaultPolicyPageData =
  async (): Promise<DefaultPolicyPageData> => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) redirect("/login");

    const client = createServerTsRestClient(session.access_token);
    const res = await client.policies.defaults.get();
    if (res.status !== 200) {
      throw new Error(
        `Failed to load default policy template (status ${res.status})`,
      );
    }
    return { userId: session.user.id, initialTemplate: res.body.template };
  };
