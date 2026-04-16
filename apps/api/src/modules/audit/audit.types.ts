import type { AuditEventType } from "@commit-analyzer/contracts";

export interface RecordOptions {
  userId?: string;
  eventType: AuditEventType;
  payload: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

export interface ListOptions {
  userId: string;
  limit: number;
  cursor?: string;
  eventType?: string;
}
