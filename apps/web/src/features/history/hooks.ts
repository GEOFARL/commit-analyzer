"use client";

import { useEffect } from "react";

import { tsr } from "@/lib/api/tsr";

import { historyQueryKeys } from "./queries";
import { HISTORY_PAGE_SIZE, type HistoryListEnvelope } from "./types";

interface UseHistoryListArgs {
  cursor: string | null;
  initial?: HistoryListEnvelope;
}

export const useHistoryListQuery = ({ cursor, initial }: UseHistoryListArgs) => {
  const query = tsr.history.list.useQuery({
    queryKey: [...historyQueryKeys.list(cursor)],
    queryData: {
      query: {
        limit: HISTORY_PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      },
    },
    initialData: initial,
    staleTime: 0,
    retry: 0,
  });

  useEffect(() => {
    if (query.error) {
      console.error("[history] list error", query.error);
    }
  }, [query.error]);

  return query;
};
