import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { type AppSupabaseClient } from "./browser";
import { getClientEnv } from "./env";

export const createSupabaseServerClient = async (): Promise<AppSupabaseClient> => {
  const env = getClientEnv();
  const cookieStore = await cookies();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { flowType: "pkce" },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
};
