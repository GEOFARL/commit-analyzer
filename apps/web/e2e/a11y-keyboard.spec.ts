import { expect, test } from "./fixtures";

const REQUIRED_NAV_HREFS = [
  "/repositories",
  "/generate",
  "/history",
  "/policies",
  "/settings",
];

test.describe("keyboard navigation", () => {
  test("landing CTA is reachable by keyboard alone", async ({ page }) => {
    await page.goto("/");

    const main = page.getByRole("main");
    await main.focus();

    let cta: import("@playwright/test").Locator | null = null;
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      if (!(await focused.count())) continue;
      const accName = (
        await focused.evaluate((el) => (el as HTMLElement).innerText ?? "")
      ).trim();
      if (/continue with github/i.test(accName)) {
        cta = focused;
        break;
      }
    }
    expect(cta, "CTA reachable via Tab from main").not.toBeNull();
    await expect(cta!).toBeFocused();
    const inSubmitForm = await cta!.evaluate((el) => {
      const form = (el as HTMLElement).closest("form");
      return (
        form?.getAttribute("action") === "/auth/sign-in" &&
        form?.getAttribute("method")?.toLowerCase() === "post"
      );
    });
    expect(inSubmitForm, "CTA submits to /auth/sign-in").toBe(true);
  });

  test("dashboard primary nav anchors are reachable by keyboard", async ({
    authedPage,
  }) => {
    await authedPage.goto("/dashboard");
    await expect(
      authedPage.getByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();

    const reachableHrefs = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      await authedPage.keyboard.press("Tab");
      const href = await authedPage.evaluate(() => {
        const el = document.activeElement as HTMLAnchorElement | null;
        if (!el || el.tagName !== "A") return null;
        const raw = el.getAttribute("href");
        if (!raw) return null;
        const path = raw.replace(/^\/[a-z]{2}(?=\/|$)/u, "");
        return path || raw;
      });
      if (href) reachableHrefs.add(href);
    }

    const missing = REQUIRED_NAV_HREFS.filter(
      (h) => !Array.from(reachableHrefs).some((r) => r === h || r.startsWith(`${h}/`)),
    );
    expect(missing, `missing nav anchors: ${missing.join(", ")}`).toEqual([]);
  });
});
