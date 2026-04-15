import { contracts } from "@commit-analyzer/contracts";
import { initClient } from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";

import { getClientEnv } from "@/lib/supabase/env";

const getBaseUrl = (): string => getClientEnv().NEXT_PUBLIC_API_URL;

/**
 * Client-side ts-rest + React Query bindings.
 * Browser requests ride Supabase auth cookies via credentials: "include".
 */
export const tsr = initTsrReactQuery(contracts, {
  baseUrl: getBaseUrl(),
  baseHeaders: {},
  credentials: "include",
});

/**
 * Server-side fetch client — used from Server Components / route handlers
 * where we already have the incoming cookie header and can forward it.
 */
export const createServerClient = (headers: Record<string, string> = {}) =>
  initClient(contracts, {
    baseUrl: getBaseUrl(),
    baseHeaders: headers,
  });
