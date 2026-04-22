import { Module } from "@nestjs/common";

import { CacheModule } from "./common/cache/cache.module.js";
import { RequestClsModule } from "./common/cls.js";
import { DatabaseModule } from "./common/database/database.module.js";
import { ThrottlerConfigModule } from "./common/throttler/throttler.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { CommitGenerationModule } from "./modules/commit-generation/commit-generation.module.js";
import { GitAnalysisModule } from "./modules/git-analysis/git-analysis.module.js";
import { HealthController } from "./modules/health/health.controller.js";
import { JobsModule } from "./modules/jobs/jobs.module.js";
import { PolicyModule } from "./modules/policy/policy.module.js";
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
    GitAnalysisModule,
    ReposModule,
    PolicyModule,
    CommitGenerationModule,
    JobsModule,
    WsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
