import type { LlmApiKey } from "@commit-analyzer/contracts";

export type LlmKeysEnvelope = {
  status: 200;
  body: { items: LlmApiKey[] };
  headers: Headers;
};

export type LlmKeysPageData = {
  userId: string;
  initialItems: LlmApiKey[];
};

export type UpsertError = {
  code: string;
  message: string;
};
