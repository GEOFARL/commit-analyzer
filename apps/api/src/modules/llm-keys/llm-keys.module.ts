import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AuthModule } from "../auth/auth.module.js";
import { CommitGenerationModule } from "../commit-generation/commit-generation.module.js";

import { LlmKeysController } from "./llm-keys.controller.js";
import { LlmKeysService } from "./llm-keys.service.js";

@Module({
  imports: [CqrsModule, AuthModule, CommitGenerationModule],
  controllers: [LlmKeysController],
  providers: [LlmKeysService],
  exports: [LlmKeysService],
})
export class LlmKeysModule {}
