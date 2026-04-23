import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { CryptoService } from "../../shared/crypto.service.js";
import { CommitGenerationModule } from "../commit-generation/commit-generation.module.js";

import { ApiKeyGuard } from "./api-key.guard.js";
import { AuthTsRestController } from "./auth-ts-rest.controller.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { LlmKeysService } from "./llm-keys.service.js";
import { SupabaseAdminService } from "./supabase-admin.service.js";
import {
  SUPABASE_CLIENT,
  SupabaseAuthGuard,
  supabaseClientProvider,
} from "./supabase-auth.guard.js";

@Module({
  imports: [CqrsModule, CommitGenerationModule],
  controllers: [AuthController, AuthTsRestController],
  providers: [
    supabaseClientProvider,
    SupabaseAuthGuard,
    ApiKeyGuard,
    AuthService,
    LlmKeysService,
    SupabaseAdminService,
    CryptoService,
  ],
  exports: [
    SupabaseAuthGuard,
    ApiKeyGuard,
    AuthService,
    LlmKeysService,
    SUPABASE_CLIENT,
    CryptoService,
  ],
})
export class AuthModule {}
