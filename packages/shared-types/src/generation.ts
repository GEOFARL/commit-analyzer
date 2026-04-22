export const generationStatuses = [
  "pending",
  "streaming",
  "completed",
  "failed",
  "cancelled",
] as const;

export type GenerationStatus = (typeof generationStatuses)[number];

export const llmProviders = ["openai", "anthropic"] as const;

export type LlmProvider = (typeof llmProviders)[number];

export interface SuggestionRecord {
  type: string;
  scope?: string | null;
  subject: string;
  body?: string | null;
  footer?: string | null;
  compliant: boolean;
}
