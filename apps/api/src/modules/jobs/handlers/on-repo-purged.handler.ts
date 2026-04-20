import { Injectable, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { RepoPurgedEvent } from "../../../shared/events/repo-purged.event.js";
import { QueueService } from "../services/queue.service.js";

@Injectable()
@EventsHandler(RepoPurgedEvent)
export class OnRepoPurgedHandler implements IEventHandler<RepoPurgedEvent> {
  private readonly logger = new Logger(OnRepoPurgedHandler.name);

  constructor(private readonly queues: QueueService) {}

  async handle(event: RepoPurgedEvent): Promise<void> {
    try {
      await this.queues.removeJobsForRepo(event.repositoryId);
    } catch (err) {
      this.logger.error(
        `failed to clear queues on purge repositoryId=${event.repositoryId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
