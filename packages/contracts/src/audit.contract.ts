import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { errorEnvelopeSchema } from "./shared/error.js";

const c = initContract();

export const auditEventTypes = [
  "auth.login",
  "auth.logout",
  "apikey.created",
  "apikey.revoked",
  "llmkey.upserted",
  "llmkey.deleted",
  "policy.activated",
  "generation.completed",
  "generation.failed",
] as const;

export const auditEventTypeSchema = z.enum(auditEventTypes);
export type AuditEventType = z.infer<typeof auditEventTypeSchema>;

export const auditEventSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  payload: z.record(z.unknown()),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type AuditEventDto = z.infer<typeof auditEventSchema>;

export const auditContract = c.router(
  {
    list: {
      method: "GET",
      path: "/audit-events",
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
        eventType: auditEventTypeSchema.optional(),
      }),
      responses: {
        200: z.object({
          items: z.array(auditEventSchema),
          nextCursor: z.string().nullable(),
        }),
        401: errorEnvelopeSchema,
      },
      summary: "List audit events for the current user",
      metadata: { auth: "jwt" } as const,
    },
  },
  { strictStatusCodes: true },
);
