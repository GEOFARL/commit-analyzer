export const generationQueryKeys = {
  policies: (repoId: string) => ["generation", "policies", repoId] as const,
};

// Must match features/llm-keys/queries.ts `llmKeyQueryKeys.all` — shared cache.
export const llmKeysSharedQueryKey = (userId: string) =>
  ["llm-keys", userId] as const;
