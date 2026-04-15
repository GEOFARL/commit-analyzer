import type { User as SupabaseUser } from "@supabase/supabase-js";

import type { SupabaseAuthIdentity } from "./supabase-admin.types.js";

const stringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

export const toSupabaseAuthIdentity = (
  user: SupabaseUser,
): SupabaseAuthIdentity => {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: user.id,
    email: user.email ?? null,
    // `user_metadata.sub` is Supabase's own auth id, NOT the GitHub user id —
    // only `provider_id` / `github_id` are safe fallbacks for `users.github_id`.
    githubId: stringOrNull(meta.provider_id ?? meta.github_id),
    username: stringOrNull(
      meta.user_name ?? meta.preferred_username ?? meta.login,
    ),
    avatarUrl: stringOrNull(meta.avatar_url ?? meta.picture),
  };
};
