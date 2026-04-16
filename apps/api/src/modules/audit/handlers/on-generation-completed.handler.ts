import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { AuditService } from "../audit.service.js";
import { GenerationCompletedEvent } from "../events/generation-completed.event.js";

@Injectable()
@EventsHandler(GenerationCompletedEvent)
export class OnGenerationCompletedHandler
  implements IEventHandler<GenerationCompletedEvent>
{
  constructor(private readonly audit: AuditService) {}

  async handle(event: GenerationCompletedEvent): Promise<void> {
    await this.audit.record({
      userId: event.userId,
      eventType: "generation.completed",
      payload: {
        generation_id: event.generationId,
        provider: event.provider,
        model: event.model,
        tokens_used: event.tokensUsed,
      },
    });
  }
}
