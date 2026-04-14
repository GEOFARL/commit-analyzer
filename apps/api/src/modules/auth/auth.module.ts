import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AuthController } from "./auth.controller.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";

@Module({
  imports: [CqrsModule],
  controllers: [AuthController],
  providers: [SupabaseAuthGuard],
})
export class AuthModule {}
