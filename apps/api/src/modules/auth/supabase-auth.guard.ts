import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";

import { getServerEnv } from "../../common/config.js";

export interface AuthenticatedRequest extends Request {
  authUserId?: string;
}

/**
 * Minimal token verifier for T-1.1. Supersedes by T-1.5 SupabaseAuthGuard (JWKS + CLS).
 * Calls `supabase.auth.getUser(token)` server-side so the token is verified against
 * the Supabase backend before the controller runs.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private client: SupabaseClient | undefined;

  private getClient(): SupabaseClient {
    if (!this.client) {
      const env = getServerEnv();
      this.client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.client;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("missing bearer token");
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) throw new UnauthorizedException("empty bearer token");

    const { data, error } = await this.getClient().auth.getUser(token);
    if (error || !data?.user) {
      throw new UnauthorizedException("invalid token");
    }
    req.authUserId = data.user.id;
    return true;
  }
}
