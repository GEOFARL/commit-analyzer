import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { GenerationFailedEvent } from "../../../shared/events/generation-failed.event.js";
import { AuditService } from "../audit.service.js";

@Injectable()
@EventsHandler(GenerationFailedEvent)
export class OnGenerationFailedHandler
  implements IEventHandler<GenerationFailedEvent>
{
  constructor(private readonly audit: AuditService) {}

  async handle(event: GenerationFailedEvent): Promise<void> {
    await this.audit.record({
      userId: event.userId,
      eventType: "generation.failed",
      payload: {
        generation_id: event.generationId,
        reason: event.reason,
      },
    });
  }
}
