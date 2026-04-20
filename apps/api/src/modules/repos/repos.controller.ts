import { reposContract } from "@commit-analyzer/contracts";
import { Controller, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { ThrottleTierDecorator } from "../../common/throttler/throttle-tier.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";

import { toConnectedRepoDto, toGithubRepoDto } from "./repos.mappers.js";
import { ReposService } from "./repos.service.js";

@Controller()
@UseGuards(SupabaseAuthGuard)
@ThrottleTierDecorator("default")
export class ReposController {
  constructor(private readonly repos: ReposService) {}

  @TsRestHandler(reposContract.listGithub)
  listGithub(@CurrentUser() userId: string): unknown {
    return tsRestHandler(reposContract.listGithub, async () => {
      const { raws, connectedIds } = await this.repos.listGithubRepos(userId);
      return {
        status: 200,
        body: { items: raws.map((r) => toGithubRepoDto(r, connectedIds)) },
      };
    });
  }

  @TsRestHandler(reposContract.listConnected)
  listConnected(@CurrentUser() userId: string): unknown {
    return tsRestHandler(reposContract.listConnected, async () => {
      const items = await this.repos.listConnected(userId);
      return {
        status: 200,
        body: { items: items.map(toConnectedRepoDto) },
      };
    });
  }

  // `c.noBody()` on the POST request body produces a unique-symbol type that
  // the current @ts-rest/nest `tsRestHandler` generic rejects; runtime shape is
  // correct, so we cast through the contract for this one route.
  @TsRestHandler(reposContract.connect as never)
  connect(@CurrentUser() userId: string): unknown {
    return tsRestHandler(
      reposContract.connect as never,
      (async ({ params }: { params: { githubRepoId: number } }) => {
        const saved = await this.repos.connect(userId, params.githubRepoId);
        return { status: 201, body: toConnectedRepoDto(saved) };
      }) as never,
    );
  }

  @TsRestHandler(reposContract.disconnect as never)
  disconnect(@CurrentUser() userId: string): unknown {
    return tsRestHandler(
      reposContract.disconnect as never,
      (async ({ params }: { params: { repoId: string } }) => {
        await this.repos.disconnect(userId, params.repoId);
        return { status: 204, body: undefined };
      }) as never,
    );
  }

  @TsRestHandler(reposContract.resync)
  resync(@CurrentUser() userId: string): unknown {
    return tsRestHandler(reposContract.resync, async ({ params }) => {
      await this.repos.resync(userId, params.repoId);
      return { status: 202, body: {} };
    });
  }

  @TsRestHandler(reposContract.purge as never)
  purge(@CurrentUser() userId: string): unknown {
    return tsRestHandler(
      reposContract.purge as never,
      (async ({ params }: { params: { repoId: string } }) => {
        await this.repos.purge(userId, params.repoId);
        return { status: 204, body: undefined };
      }) as never,
    );
  }
}
