import { loadServerEnv, type ServerEnv } from "@commit-analyzer/shared-types/env";

let cached: ServerEnv | undefined;

export const getServerEnv = (): ServerEnv => {
  cached ??= loadServerEnv();
  return cached;
};
