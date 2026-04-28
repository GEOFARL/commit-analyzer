import { forwardRef, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AuthModule } from "../auth/auth.module.js";

import { GenerateMessageHandler } from "./commands/generate-message.handler.js";
import { GenerateController } from "./controllers/generate.controller.js";
import { GenerationHistoryController } from "./controllers/generation-history.controller.js";
import { AnthropicProvider } from "./providers/anthropic.provider.js";
import { LLMProviderFactory } from "./providers/llm-provider.factory.js";
import { OpenAIProvider } from "./providers/openai.provider.js";
import { DiffParserService } from "./services/diff-parser.service.js";
import { GenerationHistoryService } from "./services/generation-history.service.js";
import { GenerationStreamService } from "./services/generation-stream.service.js";
import { LlmKeyService } from "./services/llm-key.service.js";
import { PromptBuilderService } from "./services/prompt-builder.service.js";

const COMMAND_HANDLERS = [GenerateMessageHandler];

@Module({
  imports: [CqrsModule, forwardRef(() => AuthModule)],
  controllers: [GenerateController, GenerationHistoryController],
  providers: [
    DiffParserService,
    PromptBuilderService,
    OpenAIProvider,
    AnthropicProvider,
    LLMProviderFactory,
    LlmKeyService,
    GenerationStreamService,
    GenerationHistoryService,
    ...COMMAND_HANDLERS,
  ],
  exports: [
    DiffParserService,
    PromptBuilderService,
    OpenAIProvider,
    AnthropicProvider,
    LLMProviderFactory,
    LlmKeyService,
    GenerationStreamService,
  ],
})
export class CommitGenerationModule {}
