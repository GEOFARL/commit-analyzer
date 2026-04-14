import type { ApiKeyRepository } from "@commit-analyzer/database";
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import argon2 from "argon2";
import type { Request } from "express";
import { ClsServiceManager } from "nestjs-cls";

import { API_KEY_REPOSITORY } from "../../common/database/tokens.js";
import {
  CLS_AUTH_KIND,
  CLS_USER_ID,
} from "../../common/request-context.js";

const API_KEY_HEADER = "x-api-key";
const PREFIX_SECRET_DELIMITER = ".";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    @Inject(API_KEY_REPOSITORY)
    private readonly apiKeys: ApiKeyRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.headers[API_KEY_HEADER];
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (!header) throw new UnauthorizedException("missing api key");

    const idx = header.indexOf(PREFIX_SECRET_DELIMITER);
    if (idx <= 0 || idx >= header.length - 1) {
      throw new UnauthorizedException("malformed api key");
    }
    const prefix = header.slice(0, idx);
    const secret = header.slice(idx + 1);

    const record = await this.apiKeys.findByPrefix(prefix);
    if (!record) throw new UnauthorizedException("invalid api key");

    let ok = false;
    try {
      ok = await argon2.verify(record.keyHash, secret);
    } catch {
      ok = false;
    }
    if (!ok) throw new UnauthorizedException("invalid api key");

    const cls = ClsServiceManager.getClsService();
    cls.set(CLS_USER_ID, record.userId);
    cls.set(CLS_AUTH_KIND, "api-key");

    void this.apiKeys.touchLastUsed(record.id).catch((err: unknown) => {
      this.logger.warn(`last_used_at update failed: ${String(err)}`);
    });

    return true;
  }
}
