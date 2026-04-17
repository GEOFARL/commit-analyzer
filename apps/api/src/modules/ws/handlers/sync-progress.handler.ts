import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { SyncProgressEvent } from "../../../shared/events/sync-progress.event.js";
import { SyncGateway } from "../sync.gateway.js";

@EventsHandler(SyncProgressEvent)
export class SyncProgressHandler implements IEventHandler<SyncProgressEvent> {
  constructor(private readonly gateway: SyncGateway) {}

  handle(event: SyncProgressEvent): void {
    this.gateway.emitProgress(
      event.repositoryId,
      event.syncJobId,
      event.commitsProcessed,
      event.totalCommits,
    );
  }
}
