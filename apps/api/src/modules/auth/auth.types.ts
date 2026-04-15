import type { ApiKey } from "@commit-analyzer/database";

export interface MintedApiKey {
  key: string;
  record: ApiKey;
}
