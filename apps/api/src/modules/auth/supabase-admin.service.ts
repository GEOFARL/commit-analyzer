import { Injectable, Logger } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "../../common/config.js";

import { toSupabaseAuthIdentity } from "./supabase-admin.mappers.js";
import type { SupabaseAuthIdentity } from "./supabase-admin.types.js";

@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);
  private readonly client: SupabaseClient;

  constructor() {
    const env = getServerEnv();
    this.client = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ) as SupabaseClient;
  }

  async getUserById(userId: string): Promise<SupabaseAuthIdentity | null> {
    const { data, error } = await this.client.auth.admin.getUserById(userId);
    if (error || !data?.user) {
      if (error) {
        this.logger.warn(`supabase.admin.getUserById failed: ${error.message}`);
      }
      return null;
    }
    return toSupabaseAuthIdentity(data.user);
  }
}
