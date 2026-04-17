import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { SyncFailedEvent } from "../../../shared/events/sync-failed.event.js";
import { SyncGateway } from "../sync.gateway.js";

@EventsHandler(SyncFailedEvent)
export class SyncFailedHandler implements IEventHandler<SyncFailedEvent> {
  constructor(private readonly gateway: SyncGateway) {}

  handle(event: SyncFailedEvent): void {
    this.gateway.emitFailed(event.repositoryId, event.syncJobId, event.errorMessage);
  }
}
