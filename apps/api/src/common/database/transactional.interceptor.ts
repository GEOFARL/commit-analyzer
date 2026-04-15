import type { DataSource } from "@commit-analyzer/database";
import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ClsService } from "nestjs-cls";
import { from, lastValueFrom, type Observable } from "rxjs";

import {
  CLS_TX_MANAGER,
  CLS_USER_ID,
} from "../request-context.js";

import { DATA_SOURCE } from "./tokens.js";
import { TRANSACTIONAL_META } from "./transactional.decorator.js";

/**
 * Wraps a request in a TypeORM transaction and injects the authenticated
 * user's claims into the connection via
 * `SELECT set_config('request.jwt.claims', $1, true)` so Supabase RLS
 * policies (which read `auth.uid()`) apply to every ORM query executed on
 * the CLS-provided EntityManager.
 *
 * `is_local = true` scopes the GUC to the current transaction, so the
 * connection returns to the pool free of any claims — preventing leakage
 * across requests.
 */
@Injectable()
export class TransactionalInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TransactionalInterceptor.name);

  constructor(
    @Inject(DATA_SOURCE) private readonly dataSource: DataSource,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ClsService) private readonly cls: ClsService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const applies = this.reflector.getAllAndOverride<boolean>(
      TRANSACTIONAL_META,
      [context.getHandler(), context.getClass()],
    );
    if (!applies) return next.handle();
    return from(this.runInTransaction(next));
  }

  private async runInTransaction(next: CallHandler): Promise<unknown> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const userId = this.cls.isActive()
        ? this.cls.get<string>(CLS_USER_ID)
        : undefined;
      const claims = JSON.stringify(userId ? { sub: userId } : {});
      await qr.manager.query(
        `SELECT set_config('request.jwt.claims', $1, true)`,
        [claims],
      );
      this.cls.set(CLS_TX_MANAGER, qr.manager);
      const result: unknown = await lastValueFrom(next.handle());
      await qr.commitTransaction();
      return result;
    } catch (err) {
      try {
        await qr.rollbackTransaction();
      } catch (rollbackErr) {
        this.logger.warn(`rollback failed: ${String(rollbackErr)}`);
      }
      throw err;
    } finally {
      this.cls.set(CLS_TX_MANAGER, undefined);
      await qr.release();
    }
  }
}
