import { authContract } from "@commit-analyzer/contracts";
import { Controller, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { ThrottleTierDecorator } from "../../common/throttler/throttle-tier.decorator.js";

import { toApiKeyDto, toLlmApiKeyDto, toUserDto } from "./auth.mappers.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser } from "./current-user.decorator.js";
import { LlmKeysService } from "./llm-keys.service.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";

@Controller()
@UseGuards(SupabaseAuthGuard)
@ThrottleTierDecorator("default")
export class AuthTsRestController {
  constructor(
    private readonly authService: AuthService,
    private readonly llmKeysService: LlmKeysService,
  ) {}

  // GET /me — default tier (not auth), per 05-api-contracts.md §5
  @TsRestHandler(authContract.me)
  me(@CurrentUser() userId: string): unknown {
    return tsRestHandler(authContract.me, async () => {
      const user = await this.authService.me(userId);
      return { status: 200, body: toUserDto(user) };
    });
  }

  @TsRestHandler(authContract.sync)
  sync(@CurrentUser() userId: string): unknown {
    return tsRestHandler(authContract.sync, async ({ body }) => {
      const user = await this.authService.sync(
        userId,
        body.providerToken ?? null,
      );
      return { status: 200, body: toUserDto(user) };
    });
  }

  @TsRestHandler(authContract.apiKeys.list)
  listApiKeys(@CurrentUser() userId: string): unknown {
    return tsRestHandler(authContract.apiKeys.list, async () => {
      const items = await this.authService.listApiKeys(userId);
      return { status: 200, body: { items: items.map(toApiKeyDto) } };
    });
  }

  @ThrottleTierDecorator("auth")
  @TsRestHandler(authContract.apiKeys.create)
  createApiKey(@CurrentUser() userId: string): unknown {
    return tsRestHandler(authContract.apiKeys.create, async ({ body }) => {
      const { key, record } = await this.authService.mintApiKey(
        userId,
        body.name,
      );
      return {
        status: 201,
        body: { ...toApiKeyDto(record), key },
      };
    });
  }

  // `c.noBody()` on the 204 response produces a unique-symbol type that the
  // current @ts-rest/nest `tsRestHandler` generic rejects; runtime shape is
  // correct, so we cast through the contract for this one route.
  @TsRestHandler(authContract.apiKeys.revoke as never)
  revokeApiKey(@CurrentUser() userId: string): unknown {
    return tsRestHandler(
      authContract.apiKeys.revoke as never,
      (async ({ params }: { params: { id: string } }) => {
        await this.authService.revokeApiKey(userId, params.id);
        return { status: 204, body: undefined };
      }) as never,
    );
  }

  @TsRestHandler(authContract.llmKeys.list)
  listLlmKeys(@CurrentUser() userId: string): unknown {
    return tsRestHandler(authContract.llmKeys.list, async () => {
      const items = await this.llmKeysService.list(userId);
      return { status: 200, body: { items: items.map(toLlmApiKeyDto) } };
    });
  }

  @ThrottleTierDecorator("auth")
  @TsRestHandler(authContract.llmKeys.upsert)
  upsertLlmKey(@CurrentUser() userId: string): unknown {
    return tsRestHandler(
      authContract.llmKeys.upsert,
      async ({ params, body }) => {
        const saved = await this.llmKeysService.upsert(
          userId,
          params.provider,
          body.key,
        );
        return { status: 200, body: toLlmApiKeyDto(saved) };
      },
    );
  }

  // Same `c.noBody()` typing quirk as apiKeys.revoke — see that handler above.
  @TsRestHandler(authContract.llmKeys.delete as never)
  deleteLlmKey(@CurrentUser() userId: string): unknown {
    return tsRestHandler(
      authContract.llmKeys.delete as never,
      (async ({
        params,
      }: {
        params: { provider: "openai" | "anthropic" };
      }) => {
        await this.llmKeysService.remove(userId, params.provider);
        return { status: 204, body: undefined };
      }) as never,
    );
  }
}
