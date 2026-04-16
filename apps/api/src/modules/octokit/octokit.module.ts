import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";

import { OctokitFactory } from "./octokit-factory.service.js";

@Module({
  imports: [AuthModule],
  providers: [OctokitFactory],
  exports: [OctokitFactory],
})
export class OctokitModule {}
