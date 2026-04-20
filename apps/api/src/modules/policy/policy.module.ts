import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { DefaultPolicyService } from "./default-policy.service.js";
import { OnRepoConnectedPolicyHandler } from "./on-repo-connected.handler.js";
import { PolicyService } from "./policy.service.js";

@Module({
  imports: [CqrsModule],
  providers: [PolicyService, DefaultPolicyService, OnRepoConnectedPolicyHandler],
  exports: [PolicyService, DefaultPolicyService],
})
export class PolicyModule {}
