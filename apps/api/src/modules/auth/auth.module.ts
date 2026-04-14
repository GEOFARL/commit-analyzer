import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { ApiKeyGuard } from "./api-key.guard.js";
import { AuthController } from "./auth.controller.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";

@Module({
  imports: [CqrsModule],
  controllers: [AuthController],
  providers: [SupabaseAuthGuard, ApiKeyGuard],
  exports: [SupabaseAuthGuard, ApiKeyGuard],
})
export class AuthModule {}
