import type { HistoryEntry } from "@commit-analyzer/contracts";

export interface ListHistoryOptions {
  userId: string;
  limit: number;
  cursor?: string;
  repositoryId?: string;
}

export interface ListHistoryResult {
  items: HistoryEntry[];
  nextCursor: string | null;
}
