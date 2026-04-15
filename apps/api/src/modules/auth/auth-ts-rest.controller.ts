import { authContract } from "@commit-analyzer/contracts";
import { Controller, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { toApiKeyDto, toUserDto } from "./auth.mappers.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser } from "./current-user.decorator.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";

@Controller()
@UseGuards(SupabaseAuthGuard)
export class AuthTsRestController {
  constructor(private readonly authService: AuthService) {}

  @TsRestHandler(authContract.me)
  me(@CurrentUser() userId: string): unknown {
    return tsRestHandler(authContract.me, async () => {
      const user = await this.authService.me(userId);
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
}
