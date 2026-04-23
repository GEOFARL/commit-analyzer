import type { LlmProvider } from "@commit-analyzer/shared-types";

import type { BuiltPrompt } from "../services/prompt-builder.types.js";

import type { LlmSuggestion } from "./suggestion.schema.js";

export type SuggestionEvent =
  | { kind: "suggestion"; index: number; value: LlmSuggestion }
  | { kind: "done"; tokensUsed: number };

export interface VerifyOptions {
  model?: string;
  signal?: AbortSignal;
}

export interface GenerateArgs {
  apiKey: string;
  model: string;
  prompt: BuiltPrompt;
  count: number;
  signal?: AbortSignal;
}

export interface LLMProvider {
  readonly name: LlmProvider;
  verify(apiKey: string, options?: VerifyOptions): Promise<boolean>;
  generateSuggestions(args: GenerateArgs): AsyncIterable<SuggestionEvent>;
}
