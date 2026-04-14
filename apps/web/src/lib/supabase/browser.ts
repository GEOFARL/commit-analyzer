import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getClientEnv } from "./env";

// @supabase/ssr returns SupabaseClient<any, any, any, any, any>; match that so
// downstream code keeps concrete method typings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppSupabaseClient = SupabaseClient<any, any, any, any, any>;

export const createSupabaseBrowserClient = (): AppSupabaseClient => {
  const env = getClientEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { flowType: "pkce" } },
  );
};
