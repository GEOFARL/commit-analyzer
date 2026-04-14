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
import { ClsService } from "nestjs-cls";

import { API_KEY_REPOSITORY } from "../../common/database/tokens.js";
import {
  CLS_AUTH_KIND,
  CLS_USER_ID,
} from "../../common/request-context.js";

const API_KEY_HEADER = "x-api-key";
const PREFIX_LENGTH = 8;
const INVALID_CREDENTIALS = "invalid credentials";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  // Real argon2 hash used as a timing-safe decoy when no record matches.
  // Lazily computed so construction stays cheap.
  private dummyHashPromise: Promise<string> | undefined;

  constructor(
    @Inject(ClsService) private readonly cls: ClsService,
    @Inject(API_KEY_REPOSITORY)
    private readonly apiKeys: ApiKeyRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.headers[API_KEY_HEADER];
    const header = Array.isArray(raw) ? raw[0] : raw;

    if (!header || header.length <= PREFIX_LENGTH) {
      await this.verifyAgainstDummy();
      this.logger.debug("auth.api_key.invalid reason=missing_or_short");
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const prefix = header.slice(0, PREFIX_LENGTH);
    const record = await this.apiKeys.findActiveByPrefix(prefix);

    // Always run argon2 verify regardless of record presence to keep the
    // response time flat across unknown-prefix and wrong-secret paths.
    const hash = record?.keyHash ?? (await this.getDummyHash());
    let ok = false;
    try {
      ok = await argon2.verify(hash, header);
    } catch {
      ok = false;
    }

    if (!record || !ok) {
      this.logger.debug(
        `auth.api_key.invalid reason=${record ? "hash_mismatch" : "unknown_prefix"}`,
      );
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    this.cls.set(CLS_USER_ID, record.userId);
    this.cls.set(CLS_AUTH_KIND, "api-key");

    void this.apiKeys.touchLastUsed(record.id).catch((err: unknown) => {
      this.logger.warn(`last_used_at update failed: ${String(err)}`);
    });

    return true;
  }

  private getDummyHash(): Promise<string> {
    this.dummyHashPromise ??= argon2.hash("timing-safe-decoy");
    return this.dummyHashPromise;
  }

  private async verifyAgainstDummy(): Promise<void> {
    try {
      await argon2.verify(await this.getDummyHash(), "__timing__");
    } catch {
      /* ignore */
    }
  }
}
