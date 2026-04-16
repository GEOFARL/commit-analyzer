import type { AuditEventDto } from "@commit-analyzer/contracts";
import type { AuditEvent } from "@commit-analyzer/database";

export const toAuditEventDto = (event: AuditEvent): AuditEventDto => ({
  id: event.id,
  eventType: event.eventType,
  payload: event.payload,
  ip: event.ip,
  userAgent: event.userAgent,
  createdAt: event.createdAt.toISOString(),
});
