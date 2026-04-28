import { historyContract } from "@commit-analyzer/contracts";
import { BadRequestException, Controller, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { ThrottleTierDecorator } from "../../common/throttler/throttle-tier.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtOrApiKeyGuard } from "../auth/jwt-or-api-key.guard.js";

import { HistoryService } from "./history.service.js";

@Controller()
@UseGuards(JwtOrApiKeyGuard)
@ThrottleTierDecorator("default")
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @TsRestHandler(historyContract.list)
  list(@CurrentUser() userId: string): unknown {
    return tsRestHandler(historyContract.list, async ({ query }) => {
      try {
        const result = await this.history.list({
          userId,
          limit: query.limit,
          cursor: query.cursor,
        });
        return { status: 200, body: result };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "invalid generation history cursor"
        ) {
          throw new BadRequestException({
            code: "INVALID_CURSOR",
            message: "invalid cursor",
          });
        }
        throw error;
      }
    });
  }
}
