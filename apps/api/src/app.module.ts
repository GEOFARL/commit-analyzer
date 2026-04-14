import type { IncomingMessage } from "node:http";

import { Module } from "@nestjs/common";
import { ClsModule } from "nestjs-cls";

import {
  generateRequestId,
  REQUEST_ID_HEADER,
  REQUEST_ID_KEY,
} from "./common/cls.js";
import { DatabaseModule } from "./common/database/database.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthController } from "./modules/health/health.controller.js";

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: IncomingMessage) => generateRequestId(req),
        setup: (cls, _req, res) => {
          cls.set(REQUEST_ID_KEY, cls.getId());
          if (res && typeof (res as { setHeader?: unknown }).setHeader === "function") {
            (res as { setHeader: (k: string, v: string) => void }).setHeader(
              REQUEST_ID_HEADER,
              cls.getId(),
            );
          }
        },
      },
    }),
    DatabaseModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
