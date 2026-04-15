import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { CryptoService } from "../../shared/crypto.service.js";

import { ApiKeyGuard } from "./api-key.guard.js";
import { AuthTsRestController } from "./auth-ts-rest.controller.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { SupabaseAdminService } from "./supabase-admin.service.js";
import {
  SUPABASE_CLIENT,
  SupabaseAuthGuard,
  supabaseClientProvider,
} from "./supabase-auth.guard.js";

@Module({
  imports: [CqrsModule],
  controllers: [AuthController, AuthTsRestController],
  providers: [
    supabaseClientProvider,
    SupabaseAuthGuard,
    ApiKeyGuard,
    AuthService,
    SupabaseAdminService,
    CryptoService,
  ],
  exports: [
    SupabaseAuthGuard,
    ApiKeyGuard,
    AuthService,
    SUPABASE_CLIENT,
    CryptoService,
  ],
})
export class AuthModule {}
