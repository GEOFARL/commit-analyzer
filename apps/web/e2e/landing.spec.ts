import { expect, test } from "./fixtures";

test.describe("landing page — guest", () => {
  test("renders page content", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Ship better commits",
    );
    await expect(
      page.getByText("AI-assisted commit message generation"),
    ).toBeVisible();
  });

  test("CTA submits to /auth/sign-in", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("button", { name: /continue with github/i });
    await expect(cta).toBeVisible();
    const form = cta.locator("xpath=ancestor::form");
    await expect(form).toHaveAttribute("action", "/auth/sign-in");
    await expect(form).toHaveAttribute("method", "post");
  });
});
