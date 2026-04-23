import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { LlmKeyUpsertedEvent } from "../../auth/events/llm-key-upserted.event.js";
import { AuditService } from "../audit.service.js";

@Injectable()
@EventsHandler(LlmKeyUpsertedEvent)
export class OnLlmKeyUpsertedHandler
  implements IEventHandler<LlmKeyUpsertedEvent>
{
  constructor(private readonly audit: AuditService) {}

  async handle(event: LlmKeyUpsertedEvent): Promise<void> {
    await this.audit.record({
      userId: event.userId,
      eventType: "llmkey.upserted",
      payload: { provider: event.provider },
    });
  }
}
