import type { AuditEventDto, AuditEventType } from "@commit-analyzer/contracts";

export const AUDIT_PAGE_SIZE = 50;

export type AuditPage = {
  items: AuditEventDto[];
  nextCursor: string | null;
};

export type AuditListEnvelope = {
  status: 200;
  body: AuditPage;
  headers: Headers;
};

export type ActivityPageData = {
  userId: string;
  initial: AuditPage;
  initialEventType: AuditEventType | null;
};
