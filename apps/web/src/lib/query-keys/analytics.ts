/**
 * Single source of truth for the analytics react-query key namespace. Both
 * `features/analytics` (owner of the keys) and `features/sync` (which
 * invalidates them when a sync completes) depend on this so that a rename
 * can't silently break invalidation across the feature boundary.
 */
export const analyticsQueryKeyPrefix = (repoId: string) =>
  ["analytics", repoId] as const;
