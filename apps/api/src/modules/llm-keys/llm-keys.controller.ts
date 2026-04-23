import { llmKeysContract } from "@commit-analyzer/contracts";
import { Controller, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { ThrottleTierDecorator } from "../../common/throttler/throttle-tier.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";

import { toLlmApiKeyDto } from "./llm-keys.mappers.js";
import { LlmKeysService } from "./llm-keys.service.js";

@Controller()
@UseGuards(SupabaseAuthGuard)
@ThrottleTierDecorator("default")
export class LlmKeysController {
  constructor(private readonly service: LlmKeysService) {}

  @TsRestHandler(llmKeysContract.list)
  list(@CurrentUser() userId: string): unknown {
    return tsRestHandler(llmKeysContract.list, async () => {
      const items = await this.service.list(userId);
      return { status: 200, body: { items: items.map(toLlmApiKeyDto) } };
    });
  }

  @ThrottleTierDecorator("auth")
  @TsRestHandler(llmKeysContract.upsert)
  upsert(@CurrentUser() userId: string): unknown {
    return tsRestHandler(llmKeysContract.upsert, async ({ body }) => {
      const saved = await this.service.upsert(userId, body);
      return { status: 200, body: toLlmApiKeyDto(saved) };
    });
  }

  // Same `c.noBody()` typing quirk as auth.apiKeys.revoke — see that handler
  // for the explanation of the cast.
  @TsRestHandler(llmKeysContract.remove as never)
  remove(@CurrentUser() userId: string): unknown {
    return tsRestHandler(
      llmKeysContract.remove as never,
      (async ({ params }: { params: { provider: "openai" | "anthropic" } }) => {
        await this.service.remove(userId, params.provider);
        return { status: 204, body: undefined };
      }) as never,
    );
  }
}
