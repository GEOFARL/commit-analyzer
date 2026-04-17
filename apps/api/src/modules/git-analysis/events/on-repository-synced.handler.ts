import { Injectable, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { RepoSyncedEvent } from "../../../shared/events/repo-synced.event.js";
import { AnalyticsCacheService } from "../services/analytics-cache.service.js";

@Injectable()
@EventsHandler(RepoSyncedEvent)
export class OnRepositorySyncedHandler
  implements IEventHandler<RepoSyncedEvent>
{
  private readonly logger = new Logger(OnRepositorySyncedHandler.name);

  constructor(private readonly analyticsCache: AnalyticsCacheService) {}

  async handle(event: RepoSyncedEvent): Promise<void> {
    const deleted = await this.analyticsCache.invalidateRepo(
      event.repositoryId,
    );
    this.logger.debug(
      `invalidated ${deleted} analytics cache keys for repo=${event.repositoryId}`,
    );
  }
}
