export const GITHUB_LIST_TTL_SECONDS = 60;

export const GITHUB_LIST_PER_PAGE = 100;

// Cap the authenticated-user listing so a power user with thousands of repos
// can't explode the Redis blob or the response body. 5 pages × 100 per_page =
// up to 500 repos returned; anything past that is truncated and logged.
export const GITHUB_LIST_MAX_PAGES = 5;

export const GITHUB_REQUEST_TIMEOUT_MS = 10_000;

export const githubListCacheKey = (userId: string): string =>
  `repos:github:list:${userId}`;
