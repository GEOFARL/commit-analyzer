import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { AuthLoggedOutEvent } from "../../auth/events/auth-logged-out.event.js";
import { AuditService } from "../audit.service.js";

@Injectable()
@EventsHandler(AuthLoggedOutEvent)
export class OnAuthLoggedOutHandler
  implements IEventHandler<AuthLoggedOutEvent>
{
  constructor(private readonly audit: AuditService) {}

  async handle(event: AuthLoggedOutEvent): Promise<void> {
    await this.audit.record({
      userId: event.userId,
      eventType: "auth.logout",
      payload: {},
    });
  }
}
