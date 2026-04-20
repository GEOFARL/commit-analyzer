import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { PolicyActivatedEvent } from "../../../shared/events/policy-activated.event.js";
import { AuditService } from "../audit.service.js";

@Injectable()
@EventsHandler(PolicyActivatedEvent)
export class OnPolicyActivatedHandler
  implements IEventHandler<PolicyActivatedEvent>
{
  constructor(private readonly audit: AuditService) {}

  async handle(event: PolicyActivatedEvent): Promise<void> {
    await this.audit.record({
      userId: event.userId,
      eventType: "policy.activated",
      payload: {
        repository_id: event.repositoryId,
        policy_id: event.policyId,
      },
    });
  }
}
