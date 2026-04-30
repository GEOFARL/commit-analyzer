import { expect, test } from "./fixtures";

test.describe("keyboard navigation", () => {
  test("landing → login is reachable by keyboard alone", async ({ page }) => {
    await page.goto("/");

    let cta: import("@playwright/test").Locator | null = null;
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      if (await focused.count()) {
        const accName = await focused.evaluate(
          (el) => (el as HTMLElement).innerText ?? "",
        );
        if (/continue with github/i.test(accName)) {
          cta = focused;
          break;
        }
      }
    }
    expect(cta).not.toBeNull();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/login$/);

    await page.locator("body").press("Tab");
    const loginButton = page.locator(":focus");
    await expect(loginButton).toBeVisible();
  });

  test("dashboard primary nav is reachable by keyboard", async ({
    authedPage,
  }) => {
    await authedPage.goto("/dashboard");
    await expect(
      authedPage.getByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();

    const reachable = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      await authedPage.keyboard.press("Tab");
      const tag = await authedPage.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return "";
        return `${el.tagName}:${el.getAttribute("href") ?? el.getAttribute("name") ?? el.innerText?.slice(0, 40) ?? ""}`;
      });
      if (tag) reachable.add(tag);
    }
    expect(reachable.size).toBeGreaterThan(3);
  });
});
