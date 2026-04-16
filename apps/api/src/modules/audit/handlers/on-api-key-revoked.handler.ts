import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { ClsService } from "nestjs-cls";

import { CLS_USER_ID } from "../../../common/request-context.js";
import { ApiKeyRevokedEvent } from "../../auth/events/api-key-revoked.event.js";
import { AuditService } from "../audit.service.js";

@Injectable()
@EventsHandler(ApiKeyRevokedEvent)
export class OnApiKeyRevokedHandler
  implements IEventHandler<ApiKeyRevokedEvent>
{
  constructor(
    private readonly audit: AuditService,
    private readonly cls: ClsService,
  ) {}

  async handle(event: ApiKeyRevokedEvent): Promise<void> {
    const userId = this.cls.get<string>(CLS_USER_ID);
    if (!userId) return;
    await this.audit.record({
      userId,
      eventType: "apikey.revoked",
      payload: {
        api_key_id: event.apiKeyId,
        key_prefix: event.keyPrefix,
      },
    });
  }
}
