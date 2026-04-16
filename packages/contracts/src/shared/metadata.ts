export type RateLimitTier = "default" | "auth" | "generate" | "analytics";

export interface RouteMetadata {
  readonly auth: "jwt" | "jwtOrApiKey" | "none";
  readonly rateLimit: RateLimitTier;
}
