import { type BrowserContext, type Page, test as base, expect } from "@playwright/test";

import { MOCK_ACCESS_TOKEN } from "./mock-server";

/**
 * The cookie name supabase-js derives from the Supabase project URL:
 *   `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`
 *
 * With NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 → "sb-127-auth-token".
 * Update this constant if the mock URL ever changes.
 */
export const SUPABASE_COOKIE_NAME = "sb-127-auth-token";

export const MOCK_SESSION = {
  access_token: MOCK_ACCESS_TOKEN,
  token_type: "bearer",
  expires_in: 3600,
  // Far-future expiry — the client will never attempt a token refresh.
  expires_at: 9_999_999_999,
  refresh_token: "mock-refresh-token",
  user: {
    id: "test-user-id",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    email_confirmed_at: "2024-01-01T00:00:00Z",
    user_metadata: { full_name: "Test User", avatar_url: null },
    app_metadata: { provider: "github" },
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
};

/**
 * Encodes a session into the cookie value format used by @supabase/ssr:
 * "base64-" + base64url(JSON.stringify(session))
 */
export function encodeSession(session: typeof MOCK_SESSION): string {
  return "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
}

/**
 * Injects the default mock session cookie into a Playwright browser context.
 * Call this before navigating to any authenticated route.
 */
export async function injectAuthCookie(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: SUPABASE_COOKIE_NAME,
      value: encodeSession(MOCK_SESSION),
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

type Fixtures = {
  /**
   * A page whose browser context already has the mock session cookie set.
   * Use this in any test that requires an authenticated user.
   *
   * @example
   * test("dashboard loads", async ({ authedPage }) => {
   *   await authedPage.goto("/dashboard");
   * });
   */
  authedPage: Page;
};

export const test = base.extend<Fixtures>({
  authedPage: async ({ page, context }, use) => {
    await injectAuthCookie(context);
    await use(page);
  },
});

export { expect };
