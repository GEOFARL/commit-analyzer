import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { ApiKeyGuard } from "./api-key.guard.js";
import { AuthController } from "./auth.controller.js";
import {
  SupabaseAuthGuard,
  supabaseClientProvider,
} from "./supabase-auth.guard.js";

@Module({
  imports: [CqrsModule],
  controllers: [AuthController],
  providers: [supabaseClientProvider, SupabaseAuthGuard, ApiKeyGuard],
  exports: [SupabaseAuthGuard, ApiKeyGuard],
})
export class AuthModule {}
