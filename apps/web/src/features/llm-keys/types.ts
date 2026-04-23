import type { LlmApiKey, LlmProviderName } from "@commit-analyzer/contracts";

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

export const LLM_PROVIDERS: readonly LlmProviderName[] = [
  "openai",
  "anthropic",
] as const;
