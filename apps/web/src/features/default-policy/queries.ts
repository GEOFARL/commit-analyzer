export const defaultPolicyQueryKeys = {
  template: (userId: string) => ["default-policy", userId] as const,
};
