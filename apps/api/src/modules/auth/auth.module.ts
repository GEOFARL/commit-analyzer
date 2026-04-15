import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { ApiKeyGuard } from "./api-key.guard.js";
import { AuthTsRestController } from "./auth-ts-rest.controller.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import {
  SupabaseAuthGuard,
  supabaseClientProvider,
} from "./supabase-auth.guard.js";

@Module({
  imports: [CqrsModule],
  controllers: [AuthController, AuthTsRestController],
  providers: [supabaseClientProvider, SupabaseAuthGuard, ApiKeyGuard, AuthService],
  exports: [SupabaseAuthGuard, ApiKeyGuard, AuthService],
})
export class AuthModule {}
