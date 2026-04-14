import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AuthController } from "./auth.controller.js";

@Module({
  imports: [CqrsModule],
  controllers: [AuthController],
})
export class AuthModule {}
