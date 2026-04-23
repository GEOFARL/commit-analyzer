import type {
  ConnectedRepo,
  DoneFrame,
  ErrorFrame,
  LlmApiKey,
  LlmProviderName,
  SuggestionFrame,
} from "@commit-analyzer/contracts";

export type GeneratePageData = {
  userId: string;
  configuredKeys: LlmApiKey[];
  repos: ConnectedRepo[];
};

export type StreamStatus =
  | "idle"
  | "streaming"
  | "done"
  | "cancelled"
  | "error";

export type StreamState = {
  status: StreamStatus;
  suggestions: SuggestionFrame[];
  error: ErrorFrame | null;
  done: DoneFrame | null;
};

export type GenerateInput = {
  diff: string;
  provider: LlmProviderName;
  model: string;
  repositoryId?: string;
  policyId?: string;
  count?: number;
};
