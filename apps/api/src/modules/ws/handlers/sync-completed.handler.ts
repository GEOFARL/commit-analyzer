import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { RepoSyncedEvent } from "../../../shared/events/repo-synced.event.js";
import { SyncGateway } from "../sync.gateway.js";

@EventsHandler(RepoSyncedEvent)
export class SyncCompletedHandler implements IEventHandler<RepoSyncedEvent> {
  constructor(private readonly gateway: SyncGateway) {}

  handle(event: RepoSyncedEvent): void {
    this.gateway.emitCompleted(event.repositoryId, event.syncJobId, event.commitsProcessed);
  }
}
