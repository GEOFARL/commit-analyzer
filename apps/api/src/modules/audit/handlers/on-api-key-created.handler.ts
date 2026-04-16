import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { ClsService } from "nestjs-cls";

import { CLS_USER_ID } from "../../../common/request-context.js";
import { ApiKeyCreatedEvent } from "../../auth/events/api-key-created.event.js";
import { AuditService } from "../audit.service.js";

@Injectable()
@EventsHandler(ApiKeyCreatedEvent)
export class OnApiKeyCreatedHandler
  implements IEventHandler<ApiKeyCreatedEvent>
{
  constructor(
    private readonly audit: AuditService,
    private readonly cls: ClsService,
  ) {}

  async handle(event: ApiKeyCreatedEvent): Promise<void> {
    const userId = this.cls.get<string>(CLS_USER_ID);
    if (!userId) return;
    await this.audit.record({
      userId,
      eventType: "apikey.created",
      payload: {
        api_key_id: event.apiKeyId,
        name: event.name,
        key_prefix: event.keyPrefix,
      },
    });
  }
}
