import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { AuthLoggedInEvent } from "../../auth/events/auth-logged-in.event.js";
import { AuditService } from "../audit.service.js";

@Injectable()
@EventsHandler(AuthLoggedInEvent)
export class OnAuthLoggedInHandler implements IEventHandler<AuthLoggedInEvent> {
  constructor(private readonly audit: AuditService) {}

  async handle(event: AuthLoggedInEvent): Promise<void> {
    await this.audit.record({
      userId: event.userId,
      eventType: "auth.login",
      payload: { provider: event.provider },
    });
  }
}
