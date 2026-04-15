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

/**
 * Read NEXT_PUBLIC_API_URL directly from process.env instead of going through
 * the zod-validated `getClientEnv()` loader. The loader throws synchronously
 * on any missing NEXT_PUBLIC_* var, which would crash the React tree on every
 * page render (this module is imported by the root QueryProvider). Here we
 * tolerate an unset value at module eval — requests will simply fail at call
 * time, which is recoverable, and the auth pages can still render so the user
 * can sign in and report the misconfiguration.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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
  baseUrl: API_BASE_URL,
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
    baseUrl: API_BASE_URL,
    baseHeaders: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
