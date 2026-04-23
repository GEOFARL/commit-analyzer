import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

import { ApiKeyGuard } from "./api-key.guard.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";

/**
 * Composite guard for `/generate`: accepts either a Supabase JWT via
 * `Authorization: Bearer …` or an API key via `x-api-key`. The first header
 * that is present determines which child guard runs — no ambiguous
 * best-effort chains, and a failing header returns the 401 from that guard
 * rather than masking it as a generic fallback.
 */
@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    @Inject(SupabaseAuthGuard) private readonly jwt: SupabaseAuthGuard,
    @Inject(ApiKeyGuard) private readonly apiKey: ApiKeyGuard,
  ) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const hasBearer = req.headers.authorization?.startsWith("Bearer ") ?? false;
    const apiKeyHeader = req.headers["x-api-key"];
    const hasApiKey = typeof apiKeyHeader === "string" && apiKeyHeader.length > 0;

    if (hasBearer) return this.jwt.canActivate(context);
    if (hasApiKey) return this.apiKey.canActivate(context);
    throw new UnauthorizedException("missing credentials");
  }
}
