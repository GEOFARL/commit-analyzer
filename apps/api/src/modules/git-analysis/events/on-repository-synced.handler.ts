import { Injectable, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { RepoRescoredEvent } from "../../../shared/events/repo-rescored.event.js";
import { RepoSyncedEvent } from "../../../shared/events/repo-synced.event.js";
import { AnalyticsCacheService } from "../services/analytics-cache.service.js";

type InvalidationEvent = RepoSyncedEvent | RepoRescoredEvent;

@Injectable()
@EventsHandler(RepoSyncedEvent, RepoRescoredEvent)
export class OnRepositorySyncedHandler
  implements IEventHandler<InvalidationEvent>
{
  private readonly logger = new Logger(OnRepositorySyncedHandler.name);

  constructor(private readonly analyticsCache: AnalyticsCacheService) {}

  async handle(event: InvalidationEvent): Promise<void> {
    const kind = event instanceof RepoRescoredEvent ? "rescored" : "synced";
    const deleted = await this.analyticsCache.invalidateRepo(
      event.repositoryId,
    );
    this.logger.debug(
      `invalidated ${deleted} analytics cache keys for repo=${event.repositoryId} trigger=${kind}`,
    );
  }
}
