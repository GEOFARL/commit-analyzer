import { auditContract } from "@commit-analyzer/contracts";
import { Controller, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";

import { toAuditEventDto } from "./audit.mappers.js";
import { AuditService } from "./audit.service.js";

@Controller()
@UseGuards(SupabaseAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @TsRestHandler(auditContract.list)
  list(@CurrentUser() userId: string): unknown {
    return tsRestHandler(auditContract.list, async ({ query }) => {
      const result = await this.auditService.list({
        userId,
        limit: query.limit,
        cursor: query.cursor,
        eventType: query.eventType,
      });
      return {
        status: 200,
        body: {
          items: result.items.map(toAuditEventDto),
          nextCursor: result.nextCursor,
        },
      };
    });
  }
}
