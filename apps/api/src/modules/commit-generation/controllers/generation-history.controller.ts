import { generationContract } from "@commit-analyzer/contracts";
import { InvalidGenerationHistoryCursorError } from "@commit-analyzer/database";
import {
  BadRequestException,
  Controller,
  NotFoundException,
  UseGuards,
} from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { ThrottleTierDecorator } from "../../../common/throttler/throttle-tier.decorator.js";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../../auth/supabase-auth.guard.js";
import { GenerationHistoryService } from "../services/generation-history.service.js";

@Controller()
@UseGuards(SupabaseAuthGuard)
@ThrottleTierDecorator("default")
export class GenerationHistoryController {
  constructor(private readonly history: GenerationHistoryService) {}

  @TsRestHandler(generationContract.history.list)
  list(@CurrentUser() userId: string): unknown {
    return tsRestHandler(generationContract.history.list, async ({ query }) => {
      try {
        const result = await this.history.list({
          userId,
          limit: query.limit,
          cursor: query.cursor,
          repositoryId: query.repoId,
        });
        return { status: 200, body: result };
      } catch (error) {
        if (error instanceof InvalidGenerationHistoryCursorError) {
          throw new BadRequestException({
            code: "INVALID_CURSOR",
            message: "invalid cursor",
          });
        }
        throw error;
      }
    });
  }

  @TsRestHandler(generationContract.history.get)
  get(@CurrentUser() userId: string): unknown {
    return tsRestHandler(generationContract.history.get, async ({ params }) => {
      const entry = await this.history.findById(userId, params.id);
      if (!entry) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "history entry not found",
        });
      }
      return { status: 200, body: entry };
    });
  }
}
