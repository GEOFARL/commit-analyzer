import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { ClsServiceManager } from "nestjs-cls";

import { getServerEnv } from "../../common/config.js";
import {
  CLS_AUTH_KIND,
  CLS_USER_ID,
} from "../../common/request-context.js";

/**
 * Verifies `Authorization: Bearer <jwt>` via Supabase and writes the resolved
 * user id into the CLS request store for `@CurrentUser()` to read.
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
    const req = context.switchToHttp().getRequest<Request>();
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

    const cls = ClsServiceManager.getClsService();
    cls.set(CLS_USER_ID, data.user.id);
    cls.set(CLS_AUTH_KIND, "session");
    return true;
  }
}
