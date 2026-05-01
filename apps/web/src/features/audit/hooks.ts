"use client";

import type { AuditEventType } from "@commit-analyzer/contracts";
import { useEffect } from "react";

import { tsr } from "@/lib/api/tsr";

import { auditQueryKeys } from "./queries";
import { AUDIT_PAGE_SIZE, type AuditListEnvelope } from "./types";

interface UseAuditListArgs {
  cursor: string | null;
  eventType: AuditEventType | null;
  initial?: AuditListEnvelope;
}

export const useAuditListQuery = ({
  cursor,
  eventType,
  initial,
}: UseAuditListArgs) => {
  const query = tsr.audit.list.useQuery({
    queryKey: [
      ...auditQueryKeys.list("self", eventType),
      { cursor: cursor ?? null },
    ],
    queryData: {
      query: {
        limit: AUDIT_PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
        ...(eventType ? { eventType } : {}),
      },
    },
    initialData: initial,
    staleTime: 0,
    retry: 0,
  });

  useEffect(() => {
    if (query.error) {
      console.error("[audit] list error", query.error);
    }
  }, [query.error]);

  return query;
};
