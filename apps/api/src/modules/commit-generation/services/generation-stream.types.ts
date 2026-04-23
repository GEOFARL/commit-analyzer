import type { LlmProvider } from "@commit-analyzer/shared-types";

export interface SuggestionFramePayload {
  index: number;
  type: string;
  scope: string | null;
  subject: string;
  body: string | null;
  footer: string | null;
  compliant: boolean;
  validation: {
    passed: boolean;
    results: Array<{
      ruleType: string;
      passed: boolean;
      message?: string;
    }>;
  } | null;
}

export interface DoneFramePayload {
  historyId: string | null;
  tokensUsed: number;
}

export interface ErrorFramePayload {
  code: string;
  message: string;
}

export type StreamEvent =
  | { kind: "suggestion"; data: SuggestionFramePayload }
  | { kind: "done"; data: DoneFramePayload }
  | { kind: "error"; data: ErrorFramePayload };

export interface StreamInputOptions {
  repositoryId?: string;
  policyId?: string;
  count?: number;
  signal?: AbortSignal;
}

export interface StreamInput {
  userId: string;
  diff: string;
  provider: LlmProvider;
  model: string;
  apiKey: string;
  options?: StreamInputOptions;
}
