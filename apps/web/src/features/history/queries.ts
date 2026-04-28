export const historyQueryKeys = {
  list: (cursor: string | null) => ["history", "list", cursor] as const,
};
