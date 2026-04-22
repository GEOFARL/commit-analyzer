export const policyQueryKeys = {
  list: (userId: string, repoId: string) =>
    ["policies", "list", userId, repoId] as const,
  detail: (userId: string, repoId: string, policyId: string) =>
    ["policies", "detail", userId, repoId, policyId] as const,
};
