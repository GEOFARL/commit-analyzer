import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import { getAuthUserId } from "../request-context.js";

/**
 * Keys rate-limiting by authenticated userId (from CLS, populated by
 * SupabaseAuthGuard / ApiKeyGuard). Falls back to x-forwarded-for / IP
 * for pre-auth error paths.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  // Must match parent's async signature (returns Promise<string>)
  // eslint-disable-next-line @typescript-eslint/require-await
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const userId = getAuthUserId();
    if (userId) return `user:${userId}`;

    // NOTE: x-forwarded-for is spoofable without `trust proxy` configured in
    // Express. Acceptable for now — authenticated requests key by userId above;
    // IP fallback only applies to pre-auth error paths. Enable `trust proxy`
    // when deploying behind a reverse proxy (Railway / Vercel).
    const forwarded = req.headers
      ? (req.headers as Record<string, string | string[] | undefined>)[
          "x-forwarded-for"
        ]
      : undefined;
    if (typeof forwarded === "string") return forwarded.split(",")[0]!.trim();
    if (Array.isArray(forwarded) && forwarded.length > 0)
      return forwarded[0]!.trim();

    return (req as Record<string, string>).ip ?? "unknown";
  }
}
