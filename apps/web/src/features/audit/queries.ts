import type { AuditEventType } from "@commit-analyzer/contracts";

export const auditQueryKeys = {
  all: (userId: string) => ["audit-events", userId] as const,
  list: (userId: string, eventType: AuditEventType | null) =>
    ["audit-events", userId, { eventType: eventType ?? null }] as const,
};
