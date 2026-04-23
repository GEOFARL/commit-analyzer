import { Module } from "@nestjs/common";

import { AnthropicProvider } from "./providers/anthropic.provider.js";
import { LLMProviderFactory } from "./providers/llm-provider.factory.js";
import { OpenAIProvider } from "./providers/openai.provider.js";
import { DiffParserService } from "./services/diff-parser.service.js";
import { PromptBuilderService } from "./services/prompt-builder.service.js";

@Module({
  providers: [
    DiffParserService,
    PromptBuilderService,
    OpenAIProvider,
    AnthropicProvider,
    LLMProviderFactory,
  ],
  exports: [
    DiffParserService,
    PromptBuilderService,
    OpenAIProvider,
    AnthropicProvider,
    LLMProviderFactory,
  ],
})
export class CommitGenerationModule {}
