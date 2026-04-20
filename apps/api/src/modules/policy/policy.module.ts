import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AuthModule } from "../auth/auth.module.js";

import { PolicyService } from "./policy.service.js";

@Module({
  imports: [CqrsModule, AuthModule],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}
