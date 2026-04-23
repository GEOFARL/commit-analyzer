import type { LlmProvider as LlmProviderName } from "@commit-analyzer/shared-types";
import { Injectable } from "@nestjs/common";

import { AnthropicProvider } from "./anthropic.provider.js";
import type { LLMProvider } from "./llm-provider.interface.js";
import { OpenAIProvider } from "./openai.provider.js";

@Injectable()
export class LLMProviderFactory {
  constructor(
    private readonly openai: OpenAIProvider,
    private readonly anthropic: AnthropicProvider,
  ) {}

  get(name: LlmProviderName): LLMProvider {
    switch (name) {
      case "openai":
        return this.openai;
      case "anthropic":
        return this.anthropic;
      default: {
        const exhaustive: never = name;
        throw new Error(`Unknown LLM provider: ${exhaustive as string}`);
      }
    }
  }
}
