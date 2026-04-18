import { Injectable, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { SyncRequestedEvent } from "../../../shared/events/sync-requested.event.js";
import { QueueService } from "../services/queue.service.js";

@Injectable()
@EventsHandler(SyncRequestedEvent)
export class OnSyncRequestedHandler
  implements IEventHandler<SyncRequestedEvent>
{
  private readonly logger = new Logger(OnSyncRequestedHandler.name);

  constructor(private readonly queues: QueueService) {}

  async handle(event: SyncRequestedEvent): Promise<void> {
    try {
      const jobId = await this.queues.enqueueSync(
        event.repositoryId,
        event.userId,
      );
      this.logger.log(
        `sync enqueued on request repositoryId=${event.repositoryId} userId=${event.userId} jobId=${jobId}`,
      );
    } catch (err) {
      this.logger.error(
        `failed to enqueue sync on request repositoryId=${event.repositoryId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }
}
