import { Module } from "@nestjs/common";

import { RequestClsModule } from "./common/cls.js";
import { DatabaseModule } from "./common/database/database.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthController } from "./modules/health/health.controller.js";

@Module({
  imports: [RequestClsModule, DatabaseModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
