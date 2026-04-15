import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AuthModule } from "../auth/auth.module.js";

import { GithubService } from "./github.service.js";
import { ReposController } from "./repos.controller.js";
import { ReposService } from "./repos.service.js";

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [ReposController],
  providers: [ReposService, GithubService],
  exports: [ReposService],
})
export class ReposModule {}
