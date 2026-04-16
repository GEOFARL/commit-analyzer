export const apiKeyQueryKeys = {
  all: (userId: string) => ["api-keys", userId] as const,
};
