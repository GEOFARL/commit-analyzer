export type RateLimitTier = "default" | "auth" | "generate" | "analytics";

export interface RouteMetadata {
  readonly auth: "jwt" | "apiKey" | "jwtOrApiKey" | "public";
  readonly rateLimit: RateLimitTier;
}
