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

// JWT wins when both headers are sent (see `09-security.md §8`).
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
