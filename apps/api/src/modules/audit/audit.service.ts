import type { AuditEventRepository } from "@commit-analyzer/database";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClsService } from "nestjs-cls";

import { AUDIT_EVENT_REPOSITORY } from "../../common/database/tokens.js";
import { CLS_USER_ID } from "../../common/request-context.js";

import { auditEventTypeSchema, validatePayload } from "./audit.schemas.js";
import type { ListOptions, RecordOptions } from "./audit.types.js";

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(AUDIT_EVENT_REPOSITORY)
    private readonly auditEvents: AuditEventRepository,
    private readonly cls: ClsService,
  ) {}

  async record(options: RecordOptions): Promise<void> {
    const { eventType, payload, ip, userAgent } = options;
    const userId = options.userId ?? this.cls.get<string>(CLS_USER_ID);
    if (!userId) throw new Error("audit: no userId available");

    auditEventTypeSchema.parse(eventType);
    const validated = validatePayload(eventType, payload);

    const entity = this.auditEvents.create({
      userId,
      eventType,
      payload: validated,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
    });

    await this.auditEvents.save(entity);
    this.logger.debug(`audit: ${eventType} user=${userId}`);
  }

  async list(options: ListOptions) {
    const { userId, limit, cursor, eventType } = options;

    const items = await this.auditEvents.list({
      userId,
      limit: limit + 1,
      cursor,
      eventType,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore
      ? page[page.length - 1]!.createdAt.toISOString()
      : null;

    return { items: page, nextCursor };
  }
}
