import { expect, test } from "./fixtures";

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
  test("callback with code lands on /dashboard", async ({ authedPage }) => {
    // Intercept the OAuth callback before it reaches the Next.js route handler
    // and redirect straight to /dashboard, bypassing the real PKCE exchange.
    // The mock Supabase server handles the subsequent GET /auth/v1/user call.
    const appPort = process.env.E2E_APP_PORT ?? "3000";
    await authedPage.route("**/auth/callback**", (route) =>
      route.fulfill({
        status: 302,
        headers: { Location: `http://localhost:${appPort}/dashboard` },
      }),
    );

    await authedPage.goto("/auth/callback?code=test-code&next=%2Fdashboard");

    await authedPage.waitForURL("**/dashboard");
    await expect(
      authedPage.getByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();
  });
});
