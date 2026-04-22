import { Module } from "@nestjs/common";

import { DiffParserService } from "./services/diff-parser.service.js";

@Module({
  providers: [DiffParserService],
  exports: [DiffParserService],
})
export class CommitGenerationModule {}
