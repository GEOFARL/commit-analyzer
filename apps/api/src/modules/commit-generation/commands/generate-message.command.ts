import type { LlmProvider } from "@commit-analyzer/shared-types";

interface GenerateMessageOptions {
  repositoryId?: string;
  policyId?: string;
  count?: number;
  signal?: AbortSignal;
}

export class GenerateMessageCommand {
  constructor(
    public readonly userId: string,
    public readonly diff: string,
    public readonly provider: LlmProvider,
    public readonly model: string,
    public readonly apiKey: string,
    public readonly options: GenerateMessageOptions = {},
  ) {}
}
