export const THROTTLE_TIERS = {
  default: { name: "default", limit: 60, ttl: 60_000 },
  auth: { name: "auth", limit: 10, ttl: 60_000 },
  generate: { name: "generate", limit: 20, ttl: 60_000 },
  analytics: { name: "analytics", limit: 120, ttl: 60_000 },
} as const;

export type ThrottleTier = keyof typeof THROTTLE_TIERS;
