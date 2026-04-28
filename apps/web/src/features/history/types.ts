import type { HistoryEntry } from "@commit-analyzer/contracts";

export const HISTORY_PAGE_SIZE = 20;

export type HistoryListEnvelope = {
  status: 200;
  body: { items: HistoryEntry[]; nextCursor: string | null };
  headers: Headers;
};

export type HistoryPageData = {
  initialItems: HistoryEntry[];
  initialNextCursor: string | null;
};
