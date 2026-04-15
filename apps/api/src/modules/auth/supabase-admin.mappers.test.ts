import type { User as SupabaseUser } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { toSupabaseAuthIdentity } from "./supabase-admin.mappers.js";

const baseUser = (
  meta: Record<string, unknown> = {},
  email: string | null = "u@example.com",
): SupabaseUser =>
  ({
    id: "11111111-1111-1111-1111-111111111111",
    email,
    user_metadata: meta,
    app_metadata: {},
    aud: "authenticated",
    created_at: "",
  }) as unknown as SupabaseUser;

describe("toSupabaseAuthIdentity", () => {
  it("maps full github identity from user_metadata", () => {
    const id = toSupabaseAuthIdentity(
      baseUser({
        provider_id: "42",
        user_name: "octocat",
        avatar_url: "https://x/a.png",
      }),
    );
    expect(id).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      email: "u@example.com",
      githubId: "42",
      username: "octocat",
      avatarUrl: "https://x/a.png",
    });
  });

  it("falls back to login / preferred_username / github_id but never sub", () => {
    const id = toSupabaseAuthIdentity(
      baseUser({
        sub: "00000000-0000-0000-0000-000000000000",
        github_id: "99",
        login: "cat",
      }),
    );
    expect(id.githubId).toBe("99");
    expect(id.username).toBe("cat");
  });

  it("returns null fields when metadata is empty and email is missing", () => {
    const id = toSupabaseAuthIdentity(baseUser({}, null));
    expect(id).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      email: null,
      githubId: null,
      username: null,
      avatarUrl: null,
    });
  });

  it("treats empty strings as null", () => {
    const id = toSupabaseAuthIdentity(
      baseUser({ provider_id: "", user_name: "", avatar_url: "" }),
    );
    expect(id.githubId).toBeNull();
    expect(id.username).toBeNull();
    expect(id.avatarUrl).toBeNull();
  });
});
