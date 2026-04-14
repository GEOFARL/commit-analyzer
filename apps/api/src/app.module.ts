import { Module } from "@nestjs/common";

import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthController } from "./modules/health/health.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
