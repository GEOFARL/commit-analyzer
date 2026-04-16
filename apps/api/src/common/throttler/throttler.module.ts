import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";

import { THROTTLE_TIERS } from "./tiers.js";
import { UserThrottlerGuard } from "./user-throttler.guard.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: THROTTLE_TIERS.default.name,
        limit: THROTTLE_TIERS.default.limit,
        ttl: THROTTLE_TIERS.default.ttl,
      },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class ThrottlerConfigModule {}
