import { auditEventTypeSchema, type AuditEventType } from "@commit-analyzer/contracts";
import { z } from "zod";

const authLoginPayload = z.object({ provider: z.literal("github") });
const authLogoutPayload = z.object({});
const apikeyCreatedPayload = z.object({
  api_key_id: z.string().uuid(),
  name: z.string(),
  key_prefix: z.string(),
});
const apikeyRevokedPayload = z.object({
  api_key_id: z.string().uuid(),
  key_prefix: z.string(),
});
const llmkeyUpsertedPayload = z.object({ provider: z.string() });
const llmkeyDeletedPayload = z.object({ provider: z.string() });
const policyActivatedPayload = z.object({
  repository_id: z.string().uuid(),
  policy_id: z.string().uuid(),
});
const generationCompletedPayload = z.object({
  generation_id: z.string().uuid(),
  provider: z.string(),
  model: z.string(),
  tokens_used: z.number().int().nonnegative(),
});
const generationFailedPayload = z.object({
  generation_id: z.string().uuid(),
  reason: z.string(),
});

const payloadSchemaMap: Record<AuditEventType, z.ZodTypeAny> = {
  "auth.login": authLoginPayload,
  "auth.logout": authLogoutPayload,
  "apikey.created": apikeyCreatedPayload,
  "apikey.revoked": apikeyRevokedPayload,
  "llmkey.upserted": llmkeyUpsertedPayload,
  "llmkey.deleted": llmkeyDeletedPayload,
  "policy.activated": policyActivatedPayload,
  "generation.completed": generationCompletedPayload,
  "generation.failed": generationFailedPayload,
};

export { auditEventTypeSchema };

export const validatePayload = (
  eventType: AuditEventType,
  payload: unknown,
): Record<string, unknown> => {
  const schema = payloadSchemaMap[eventType];
  return schema.parse(payload) as Record<string, unknown>;
};
