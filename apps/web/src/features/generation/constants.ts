import type { LlmProviderName } from "@commit-analyzer/contracts";

// Curated shortlist surfaced in the provider/model dropdown. The first entry
// for each provider is the default; anything the provider itself accepts can
// still be sent — the API forwards the `model` string as-is.
export const MODELS_BY_PROVIDER: Record<LlmProviderName, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  anthropic: [
    "claude-haiku-4-5",
    "claude-sonnet-4-5",
    "claude-3-5-haiku-latest",
  ],
};
