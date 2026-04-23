import { Module } from "@nestjs/common";

import { DiffParserService } from "./services/diff-parser.service.js";
import { PromptBuilderService } from "./services/prompt-builder.service.js";

@Module({
  providers: [DiffParserService, PromptBuilderService],
  exports: [DiffParserService, PromptBuilderService],
})
export class CommitGenerationModule {}
