export const GITHUB_LIST_TTL_SECONDS = 60;

export const githubListCacheKey = (userId: string): string =>
  `repos:github:list:${userId}`;
