import type { LlmApiKey } from "@commit-analyzer/contracts";
import type { LLMApiKey } from "@commit-analyzer/database";

// The raw plaintext key is never surfaced — we render a provider-agnostic
// placeholder so the UI can show that a key is configured without leaking any
// key material, even in request/response logs.
export const MASKED_PLACEHOLDER = "••••••••";

export const toLlmApiKeyDto = (record: LLMApiKey): LlmApiKey => ({
  id: record.id,
  provider: record.provider,
  maskedKey: MASKED_PLACEHOLDER,
  status: record.status,
  createdAt: record.createdAt.toISOString(),
});
