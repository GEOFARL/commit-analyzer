import { contracts } from "@commit-analyzer/contracts";
import {
  initClient,
  tsRestFetchApi,
  type ApiFetcher,
} from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";

import {
  createSupabaseBrowserClient,
  type AppSupabaseClient,
} from "@/lib/supabase/browser";
import { getClientEnv } from "@/lib/supabase/env";

const getBaseUrl = (): string => getClientEnv().NEXT_PUBLIC_API_URL;

let browserSupabase: AppSupabaseClient | null = null;
const getBrowserSupabase = (): AppSupabaseClient => {
  browserSupabase ??= createSupabaseBrowserClient();
  return browserSupabase;
};

/**
 * Browser fetcher: resolves the current Supabase session and injects
 * `Authorization: Bearer <access_token>` into every request. The Nest API's
 * SupabaseAuthGuard rejects cookie-only requests, so the token must ride as a
 * header.
 */
const browserApi: ApiFetcher = async (args) => {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return tsRestFetchApi({
    ...args,
    headers: {
      ...args.headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
};

/**
 * Client-side ts-rest + React Query bindings. All hooks route through
 * `browserApi` so each call picks up the freshest Supabase access token.
 */
export const tsr = initTsrReactQuery(contracts, {
  baseUrl: getBaseUrl(),
  baseHeaders: {},
  api: browserApi,
});

/**
 * Server-side ts-rest client for Server Components / Route Handlers. The
 * caller forwards the Supabase access token it already read from cookies
 * (see `createSupabaseServerClient().auth.getSession()`).
 */
export const createServerTsRestClient = (accessToken: string | null) =>
  initClient(contracts, {
    baseUrl: getBaseUrl(),
    baseHeaders: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
