import { Module } from "@nestjs/common";

import { CacheModule } from "./common/cache/cache.module.js";
import { RequestClsModule } from "./common/cls.js";
import { DatabaseModule } from "./common/database/database.module.js";
import { ThrottlerConfigModule } from "./common/throttler/throttler.module.js";
import { AnalyticsModule } from "./modules/analytics/analytics.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthController } from "./modules/health/health.controller.js";
import { JobsModule } from "./modules/jobs/jobs.module.js";
import { ReposModule } from "./modules/repos/repos.module.js";
import { WsModule } from "./modules/ws/ws.module.js";

@Module({
  imports: [
    RequestClsModule,
    DatabaseModule,
    CacheModule,
    ThrottlerConfigModule,
    AuthModule,
    AuditModule,
    AnalyticsModule,
    ReposModule,
    JobsModule,
    WsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
