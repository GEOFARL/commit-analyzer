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
  CLS_JWT_CLAIMS,
  CLS_USER_ID,
  type JwtClaims,
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
    // Supabase already verified the JWT; decode (no re-verify) to surface the
    // full claim set to RLS. Falls back to a minimal `{sub}` on decode errors
    // so auth still works even if the token format changes unexpectedly.
    this.cls.set(
      CLS_JWT_CLAIMS,
      decodeJwtClaims(token) ?? ({ sub: data.user.id } satisfies JwtClaims),
    );
    return true;
  }
}

const decodeJwtClaims = (token: string): JwtClaims | undefined => {
  const [, payload] = token.split(".");
  if (!payload) return undefined;
  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    if (typeof parsed !== "object" || parsed === null) return undefined;
    return parsed as JwtClaims;
  } catch {
    return undefined;
  }
};
