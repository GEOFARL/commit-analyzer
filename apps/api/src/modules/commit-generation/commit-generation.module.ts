import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { GenerateMessageHandler } from "./commands/generate-message.handler.js";
import { AnthropicProvider } from "./providers/anthropic.provider.js";
import { LLMProviderFactory } from "./providers/llm-provider.factory.js";
import { OpenAIProvider } from "./providers/openai.provider.js";
import { DiffParserService } from "./services/diff-parser.service.js";
import { PromptBuilderService } from "./services/prompt-builder.service.js";

const COMMAND_HANDLERS = [GenerateMessageHandler];

@Module({
  imports: [CqrsModule],
  providers: [
    DiffParserService,
    PromptBuilderService,
    OpenAIProvider,
    AnthropicProvider,
    LLMProviderFactory,
    ...COMMAND_HANDLERS,
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
