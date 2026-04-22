import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AuthModule } from "../auth/auth.module.js";

import { ApplyDefaultPolicyOnRepoConnected } from "./apply-default-policy.handler.js";
import { DefaultPolicyService } from "./default-policy.service.js";
import { PoliciesController } from "./policies.controller.js";
import { PolicyService } from "./policy.service.js";
import { ValidatorService } from "./services/validator.service.js";

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [PoliciesController],
  providers: [
    PolicyService,
    DefaultPolicyService,
    ApplyDefaultPolicyOnRepoConnected,
    ValidatorService,
  ],
  exports: [PolicyService, DefaultPolicyService, ValidatorService],
})
export class PolicyModule {}
