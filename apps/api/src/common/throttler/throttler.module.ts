import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";

import { THROTTLE_TIERS } from "./tiers.js";
import { UserThrottlerGuard } from "./user-throttler.guard.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      THROTTLE_TIERS.default,
      THROTTLE_TIERS.auth,
      THROTTLE_TIERS.generate,
      THROTTLE_TIERS.analytics,
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class ThrottlerConfigModule {}
