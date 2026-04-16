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

  test("CTA links to /login", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /continue with github/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/login");
  });
});
