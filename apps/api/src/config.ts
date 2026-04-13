import { loadServerEnv, type ServerEnv } from "@commit-analyzer/shared-types/env";

let cached: ServerEnv | undefined;

// Lazy singleton — fail fast on first call, then reuse. Tests can override by
// passing a fresh source to `loadServerEnv` directly.
export const getServerEnv = (): ServerEnv => {
  cached ??= loadServerEnv();
  return cached;
};
