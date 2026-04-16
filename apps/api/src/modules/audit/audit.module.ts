import { Global, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AuditController } from "./audit.controller.js";
import { AuditService } from "./audit.service.js";
import { OnApiKeyCreatedHandler } from "./handlers/on-api-key-created.handler.js";
import { OnApiKeyRevokedHandler } from "./handlers/on-api-key-revoked.handler.js";
import { OnAuthLoggedInHandler } from "./handlers/on-auth-logged-in.handler.js";
import { OnAuthLoggedOutHandler } from "./handlers/on-auth-logged-out.handler.js";
import { OnGenerationCompletedHandler } from "./handlers/on-generation-completed.handler.js";
import { OnGenerationFailedHandler } from "./handlers/on-generation-failed.handler.js";
import { OnLlmKeyDeletedHandler } from "./handlers/on-llm-key-deleted.handler.js";
import { OnLlmKeyUpsertedHandler } from "./handlers/on-llm-key-upserted.handler.js";
import { OnPolicyActivatedHandler } from "./handlers/on-policy-activated.handler.js";

const EVENT_HANDLERS = [
  OnAuthLoggedInHandler,
  OnAuthLoggedOutHandler,
  OnApiKeyCreatedHandler,
  OnApiKeyRevokedHandler,
  OnLlmKeyUpsertedHandler,
  OnLlmKeyDeletedHandler,
  OnPolicyActivatedHandler,
  OnGenerationCompletedHandler,
  OnGenerationFailedHandler,
];

@Global()
@Module({
  imports: [CqrsModule],
  controllers: [AuditController],
  providers: [AuditService, ...EVENT_HANDLERS],
  exports: [AuditService],
})
export class AuditModule {}
