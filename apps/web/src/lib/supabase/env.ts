import { loadClientEnv, type ClientEnv } from "@commit-analyzer/shared-types/env";

let cached: ClientEnv | undefined;

/**
 * Next.js only inlines `process.env.NEXT_PUBLIC_*` into the client bundle when
 * the reference is a literal `process.env.NEXT_PUBLIC_FOO` access. Passing
 * `process.env` as an object into a helper defeats the static analyzer: the
 * client bundle ends up with `process.env === {}`, `loadClientEnv()` throws
 * "NEXT_PUBLIC_* is required", and every downstream browser Supabase + ts-rest
 * call fails with "invalid credentials" because no Authorization header is
 * attached.
 *
 * The literal property accesses below are what lets Next inline each value at
 * build time for both server and client code paths.
 */
export const getClientEnv = (): ClientEnv => {
  cached ??= loadClientEnv({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return cached;
};
