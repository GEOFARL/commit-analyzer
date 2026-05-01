import "server-only";

import {
  auditEventTypeSchema,
  type AuditEventType,
} from "@commit-analyzer/contracts";

import { createServerTsRestClient } from "@/lib/api/tsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ActivityPageData } from "./types";

const PAGE_SIZE = 50;

const parseEventType = (raw: string | undefined): AuditEventType | null => {
  if (!raw) return null;
  const result = auditEventTypeSchema.safeParse(raw);
  return result.success ? result.data : null;
};

export const getActivityPageData = async (params: {
  rawEventType?: string;
}): Promise<ActivityPageData> => {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;
  const userId = sessionData.session?.user.id ?? "anonymous";

  const eventType = parseEventType(params.rawEventType);

  const client = createServerTsRestClient(accessToken);
  const res = await client.audit.list({
    query: {
      limit: PAGE_SIZE,
      ...(eventType ? { eventType } : {}),
    },
  });

  if (res.status !== 200) {
    throw new Error(`Failed to load audit events (status ${res.status})`);
  }

  return {
    userId,
    initialEventType: eventType,
    initial: {
      items: res.body.items,
      nextCursor: res.body.nextCursor,
    },
  };
};
