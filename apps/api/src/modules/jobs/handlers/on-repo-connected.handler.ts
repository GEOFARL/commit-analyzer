import { Injectable, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { RepoConnectedEvent } from "../../../shared/events/repo-connected.event.js";
import { QueueService } from "../services/queue.service.js";

@Injectable()
@EventsHandler(RepoConnectedEvent)
export class OnRepoConnectedHandler
  implements IEventHandler<RepoConnectedEvent>
{
  private readonly logger = new Logger(OnRepoConnectedHandler.name);

  constructor(private readonly queues: QueueService) {}

  async handle(event: RepoConnectedEvent): Promise<void> {
    try {
      const jobId = await this.queues.enqueueSync(
        event.repositoryId,
        event.userId,
      );
      this.logger.log(
        `sync enqueued on connect repositoryId=${event.repositoryId} userId=${event.userId} jobId=${jobId}`,
      );
    } catch (err) {
      this.logger.error(
        `failed to enqueue sync on connect repositoryId=${event.repositoryId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }
}
