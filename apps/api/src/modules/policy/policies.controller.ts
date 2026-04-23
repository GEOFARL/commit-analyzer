import { policiesContract } from "@commit-analyzer/contracts";
import { Controller, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { ThrottleTierDecorator } from "../../common/throttler/throttle-tier.decorator.js";
import { ValidatorService } from "../../shared/policy-validation/validator.service.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";

import { toPolicyDto } from "./policy.mappers.js";
import { PolicyService } from "./policy.service.js";

@Controller()
@UseGuards(SupabaseAuthGuard)
@ThrottleTierDecorator("default")
export class PoliciesController {
  constructor(
    private readonly policies: PolicyService,
    private readonly validator: ValidatorService,
  ) {}

  @TsRestHandler(policiesContract.list)
  list(@CurrentUser() userId: string): unknown {
    return tsRestHandler(policiesContract.list, async ({ params }) => {
      const items = await this.policies.list(userId, params.repoId);
      return { status: 200, body: { items: items.map(toPolicyDto) } };
    });
  }

  @TsRestHandler(policiesContract.get)
  get(@CurrentUser() userId: string): unknown {
    return tsRestHandler(policiesContract.get, async ({ params }) => {
      const policy = await this.policies.get(userId, params.repoId, params.id);
      return { status: 200, body: toPolicyDto(policy) };
    });
  }

  @TsRestHandler(policiesContract.create)
  create(@CurrentUser() userId: string): unknown {
    return tsRestHandler(
      policiesContract.create,
      async ({ params, body }) => {
        const policy = await this.policies.create(
          userId,
          params.repoId,
          body,
        );
        return { status: 201, body: toPolicyDto(policy) };
      },
    );
  }

  @TsRestHandler(policiesContract.update)
  update(@CurrentUser() userId: string): unknown {
    return tsRestHandler(
      policiesContract.update,
      async ({ params, body }) => {
        const policy = await this.policies.update(
          userId,
          params.repoId,
          params.id,
          body,
        );
        return { status: 200, body: toPolicyDto(policy) };
      },
    );
  }

  @TsRestHandler(policiesContract.delete as never)
  delete(@CurrentUser() userId: string): unknown {
    return tsRestHandler(
      policiesContract.delete as never,
      (async ({ params }: { params: { repoId: string; id: string } }) => {
        await this.policies.delete(userId, params.repoId, params.id);
        return { status: 204, body: undefined };
      }) as never,
    );
  }

  @TsRestHandler(policiesContract.activate)
  activate(@CurrentUser() userId: string): unknown {
    return tsRestHandler(policiesContract.activate, async ({ params }) => {
      const policy = await this.policies.activate(
        userId,
        params.repoId,
        params.id,
      );
      return { status: 200, body: toPolicyDto(policy) };
    });
  }

  @TsRestHandler(policiesContract.validate)
  validate(@CurrentUser() userId: string): unknown {
    return tsRestHandler(
      policiesContract.validate,
      async ({ params, body }) => {
        const policy = await this.policies.get(
          userId,
          params.repoId,
          params.id,
        );
        const result = this.validator.validate(body.message, {
          rules: policy.rules.map((r) => ({
            ruleType: r.ruleType,
            ruleValue: r.ruleValue,
          })),
        });
        return { status: 200, body: result };
      },
    );
  }
}
