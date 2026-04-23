export const llmKeyQueryKeys = {
  all: (userId: string) => ["llm-keys", userId] as const,
};
