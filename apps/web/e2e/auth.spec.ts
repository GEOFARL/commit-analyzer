import { expect, test } from "@playwright/test";

import { MOCK_ACCESS_TOKEN } from "./mock-server";

// Mirror the session shape @supabase/auth-js stores in the SSR cookie.
const MOCK_SESSION = {
  access_token: MOCK_ACCESS_TOKEN,
  token_type: "bearer",
  expires_in: 3600,
  // Far-future expiry so the client never tries to refresh.
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
 * Encode a session object into the cookie value format used by @supabase/ssr:
 * "base64-" + base64url(JSON.stringify(session))
 */
function encodeSession(session: typeof MOCK_SESSION): string {
  return "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
}

test.describe("login page", () => {
  test("renders sign-in card", async ({ page }) => {
    await page.goto("/login");
    // CardTitle renders as <div>, not a heading — match by text.
    await expect(page.getByText("Sign in")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue with github/i }),
    ).toBeVisible();
  });
});

test.describe("stubbed OAuth flow", () => {
  test("callback with code lands on /dashboard", async ({ page, context }) => {
    // Inject the session cookie before any navigation so it is included in the
    // request headers when Next.js loads the dashboard layout.
    // Cookie name is derived by supabase-js as `sb-${hostname[0]}-auth-token`.
    // With NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 → "sb-127-auth-token".
    await context.addCookies([
      {
        name: "sb-127-auth-token",
        value: encodeSession(MOCK_SESSION),
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // Intercept the OAuth callback before it reaches the Next.js route handler
    // and redirect straight to /dashboard, bypassing the real PKCE exchange.
    // The mock Supabase server (started in globalSetup) handles the subsequent
    // GET /auth/v1/user call made by the dashboard layout.
    await page.route("**/auth/callback**", async (route) => {
      await route.fulfill({
        status: 302,
        headers: { Location: "http://localhost:3000/dashboard" },
      });
    });

    await page.goto("/auth/callback?code=test-code&next=%2Fdashboard");

    await page.waitForURL("**/dashboard");
    await expect(
      page.getByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();
  });
});
