import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { LlmKeyDeletedEvent } from "../../auth/events/llm-key-deleted.event.js";
import { AuditService } from "../audit.service.js";

@Injectable()
@EventsHandler(LlmKeyDeletedEvent)
export class OnLlmKeyDeletedHandler
  implements IEventHandler<LlmKeyDeletedEvent>
{
  constructor(private readonly audit: AuditService) {}

  async handle(event: LlmKeyDeletedEvent): Promise<void> {
    await this.audit.record({
      userId: event.userId,
      eventType: "llmkey.deleted",
      payload: { provider: event.provider },
    });
  }
}
