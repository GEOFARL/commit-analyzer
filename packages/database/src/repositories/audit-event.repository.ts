import { LessThan, type DataSource, type Repository as OrmRepository } from "typeorm";

import { AuditEvent } from "../entities/audit-event.entity.js";

export interface AuditEventListOptions {
  userId: string;
  limit: number;
  cursor?: string;
  eventType?: string;
}

export interface AuditEventRepository extends OrmRepository<AuditEvent> {
  list(options: AuditEventListOptions): Promise<AuditEvent[]>;
}

export const createAuditEventRepository = (
  dataSource: DataSource,
): AuditEventRepository => {
  const base = dataSource.getRepository(AuditEvent);
  const extensions: Pick<AuditEventRepository, "list"> = {
    async list(options: AuditEventListOptions): Promise<AuditEvent[]> {
      const { userId, limit, cursor, eventType } = options;
      const where: Record<string, unknown> = { userId };

      if (eventType) {
        where.eventType = eventType;
      }

      if (cursor) {
        where.createdAt = LessThan(new Date(cursor));
      }

      return base.find({
        where,
        order: { createdAt: "DESC" },
        take: limit,
      });
    },
  };
  return base.extend(extensions) as AuditEventRepository;
};
