export const repositoryQueryKeys = {
  all: (userId: string) => ["repos", userId] as const,
  github: (userId: string) => ["repos", "github", userId] as const,
  connected: (userId: string) => ["repos", "connected", userId] as const,
};
