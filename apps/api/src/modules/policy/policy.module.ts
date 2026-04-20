import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { PolicyService } from "./policy.service.js";

@Module({
  imports: [CqrsModule],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}
