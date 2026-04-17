import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { DatabaseModule } from "../../common/database/database.module.js";
import { AuthModule } from "../auth/auth.module.js";

import { SyncCompletedHandler } from "./handlers/sync-completed.handler.js";
import { SyncFailedHandler } from "./handlers/sync-failed.handler.js";
import { SyncProgressHandler } from "./handlers/sync-progress.handler.js";
import { SyncGateway } from "./sync.gateway.js";

@Module({
  imports: [CqrsModule, AuthModule, DatabaseModule],
  providers: [SyncGateway, SyncProgressHandler, SyncCompletedHandler, SyncFailedHandler],
})
export class WsModule {}
