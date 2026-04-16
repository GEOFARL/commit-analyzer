import type { ApiKey } from "@commit-analyzer/contracts";

export type ApiKeysEnvelope = {
  status: 200;
  body: { items: ApiKey[] };
  headers: Headers;
};

export type ApiKeysPageData = {
  userId: string;
  initialItems: ApiKey[];
};
