import { policiesContract } from "@commit-analyzer/contracts";
import { Controller, Inject, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { ThrottleTierDecorator } from "../../common/throttler/throttle-tier.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";

import { DefaultPolicyService } from "./default-policy.service.js";

// @Inject is explicit because esbuild (used by vitest) drops decorator
// metadata, breaking constructor-type DI in tests. See generate.controller.ts
// for the same pattern.
@Controller()
@UseGuards(SupabaseAuthGuard)
@ThrottleTierDecorator("default")
export class DefaultPolicyController {
  constructor(
    @Inject(DefaultPolicyService)
    private readonly defaults: DefaultPolicyService,
  ) {}

  @TsRestHandler(policiesContract.defaults.get)
  get(@CurrentUser() userId: string): unknown {
    return tsRestHandler(policiesContract.defaults.get, async () => {
      const template = await this.defaults.getDefaultPolicyTemplate(userId);
      return { status: 200, body: { template } };
    });
  }

  @TsRestHandler(policiesContract.defaults.update)
  update(@CurrentUser() userId: string): unknown {
    return tsRestHandler(
      policiesContract.defaults.update,
      async ({ body }) => {
        const template = await this.defaults.setDefaultPolicyTemplate(
          userId,
          body,
        );
        return { status: 200, body: { template } };
      },
    );
  }

  // `as never` mirrors PoliciesController.delete: ts-rest's @TsRestHandler
  // doesn't infer the no-body / 204-empty-body shape produced by `c.noBody()`,
  // so the cast is the project-wide workaround for DELETE endpoints.
  @TsRestHandler(policiesContract.defaults.clear as never)
  clear(@CurrentUser() userId: string): unknown {
    return tsRestHandler(
      policiesContract.defaults.clear as never,
      (async () => {
        await this.defaults.clearDefaultPolicyTemplate(userId);
        return { status: 204, body: undefined };
      }) as never,
    );
  }
}
