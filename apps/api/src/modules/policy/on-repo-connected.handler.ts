import type { PolicyRepository } from "@commit-analyzer/database";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { POLICY_REPOSITORY } from "../../common/database/tokens.js";
import { RepoConnectedEvent } from "../../shared/events/repo-connected.event.js";

import { DefaultPolicyService } from "./default-policy.service.js";

@Injectable()
@EventsHandler(RepoConnectedEvent)
export class OnRepoConnectedPolicyHandler
  implements IEventHandler<RepoConnectedEvent>
{
  private readonly logger = new Logger(OnRepoConnectedPolicyHandler.name);

  constructor(
    private readonly defaults: DefaultPolicyService,
    @Inject(POLICY_REPOSITORY) private readonly policies: PolicyRepository,
  ) {}

  async handle(event: RepoConnectedEvent): Promise<void> {
    const template = await this.defaults.getDefaultPolicyTemplate(event.userId);
    if (!template?.enabled) return;

    try {
      const created = await this.policies.createWithRules({
        repositoryId: event.repositoryId,
        name: "Default",
        rules: template.rules,
      });
      await this.policies.activate(event.repositoryId, created.id);
      this.logger.log(
        `default policy applied repositoryId=${event.repositoryId} userId=${event.userId} policyId=${created.id}`,
      );
    } catch (err) {
      this.logger.error(
        `failed to apply default policy repositoryId=${event.repositoryId} userId=${event.userId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
