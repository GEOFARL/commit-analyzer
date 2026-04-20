import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { ApplyDefaultPolicyOnRepoConnected } from "./apply-default-policy.handler.js";
import { DefaultPolicyService } from "./default-policy.service.js";
import { PolicyService } from "./policy.service.js";

@Module({
  imports: [CqrsModule],
  providers: [
    PolicyService,
    DefaultPolicyService,
    ApplyDefaultPolicyOnRepoConnected,
  ],
  exports: [PolicyService, DefaultPolicyService],
})
export class PolicyModule {}
