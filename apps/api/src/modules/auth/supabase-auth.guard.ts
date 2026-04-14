import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { ClsService } from "nestjs-cls";

import { getServerEnv } from "../../common/config.js";
import {
  CLS_AUTH_KIND,
  CLS_USER_ID,
} from "../../common/request-context.js";

const INVALID_CREDENTIALS = "invalid credentials";

export const SUPABASE_CLIENT = Symbol("SUPABASE_CLIENT");

export const supabaseClientProvider = {
  provide: SUPABASE_CLIENT,
  useFactory: () => {
    const env = getServerEnv();
    return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  },
};

/**
 * Verifies `Authorization: Bearer <jwt>` via Supabase and writes the resolved
 * user id into the CLS request store for `@CurrentUser()` to read.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);

  constructor(
    @Inject(ClsService) private readonly cls: ClsService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      this.logger.debug("auth.session.invalid reason=missing_bearer");
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      this.logger.debug("auth.session.invalid reason=empty_bearer");
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data?.user) {
      this.logger.debug("auth.session.invalid reason=token_rejected");
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    this.cls.set(CLS_USER_ID, data.user.id);
    this.cls.set(CLS_AUTH_KIND, "session");
    return true;
  }
}
