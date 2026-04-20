import { Injectable, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { RepoPurgedEvent } from "../../../shared/events/repo-purged.event.js";
import { RepoRescoredEvent } from "../../../shared/events/repo-rescored.event.js";
import { RepoSyncedEvent } from "../../../shared/events/repo-synced.event.js";
import { AnalyticsCacheService } from "../services/analytics-cache.service.js";

type InvalidationEvent = RepoSyncedEvent | RepoRescoredEvent | RepoPurgedEvent;

const triggerOf = (event: InvalidationEvent): string => {
  if (event instanceof RepoRescoredEvent) return "rescored";
  if (event instanceof RepoPurgedEvent) return "purged";
  return "synced";
};

@Injectable()
@EventsHandler(RepoSyncedEvent, RepoRescoredEvent, RepoPurgedEvent)
export class OnRepositorySyncedHandler
  implements IEventHandler<InvalidationEvent>
{
  private readonly logger = new Logger(OnRepositorySyncedHandler.name);

  constructor(private readonly analyticsCache: AnalyticsCacheService) {}

  async handle(event: InvalidationEvent): Promise<void> {
    const trigger = triggerOf(event);
    const deleted = await this.analyticsCache.invalidateRepo(
      event.repositoryId,
    );
    this.logger.debug(
      `invalidated ${deleted} analytics cache keys for repo=${event.repositoryId} trigger=${trigger}`,
    );
  }
}
