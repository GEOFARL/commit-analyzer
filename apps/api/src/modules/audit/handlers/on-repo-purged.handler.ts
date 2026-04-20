import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { RepoPurgedEvent } from "../../../shared/events/repo-purged.event.js";
import { AuditService } from "../audit.service.js";

@Injectable()
@EventsHandler(RepoPurgedEvent)
export class OnRepoPurgedAuditHandler
  implements IEventHandler<RepoPurgedEvent>
{
  constructor(private readonly audit: AuditService) {}

  async handle(event: RepoPurgedEvent): Promise<void> {
    await this.audit.record({
      userId: event.userId,
      eventType: "repo.purged",
      payload: {
        repository_id: event.repositoryId,
        github_repo_id: event.githubRepoId,
        deleted_commits: event.deletedCommits,
      },
    });
  }
}
