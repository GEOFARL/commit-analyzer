import { loadClientEnv, type ClientEnv } from "@commit-analyzer/shared-types/env";

let cached: ClientEnv | undefined;

export const getClientEnv = (): ClientEnv => {
  cached ??= loadClientEnv();
  return cached;
};
