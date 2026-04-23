export const generationQueryKeys = {
  policies: (repoId: string) => ["generation", "policies", repoId] as const,
};
