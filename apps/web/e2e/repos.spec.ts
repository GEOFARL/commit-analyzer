import { expect, test } from "./fixtures";

test.describe("repositories — connect & sync", () => {
  test("connect a GitHub repo, then watch the sync banner reach completed", async ({
    authedPage: page,
  }) => {
    await page.goto("/repositories");

    await expect(
      page.getByRole("heading", { level: 1, name: "Repositories" }),
    ).toBeVisible();

    // The fresh GitHub repo card initially has a "Connect" button.
    const freshGithubCard = page
      .locator("div.group")
      .filter({ hasText: "acme/fresh-repo" })
      .filter({ has: page.getByRole("button", { name: "Connect" }) })
      .first();
    await freshGithubCard.getByRole("button", { name: "Connect" }).click();

    // The newly connected repo appears in the connected section with a
    // "View analytics" link — open it so the sync banner mounts and joins
    // the WebSocket room for this repo. The "Repository connected" toast
    // auto-dismisses, so asserting on the durable UI change instead.
    const connectedCard = page
      .locator("div.group")
      .filter({ hasText: "acme/fresh-repo" })
      .filter({ has: page.getByRole("link", { name: "View analytics" }) })
      .first();
    await expect(
      connectedCard.getByRole("link", { name: "View analytics" }),
    ).toBeVisible();
    await connectedCard.getByRole("link", { name: "View analytics" }).click();

    await expect(page).toHaveURL(/\/repositories\/[0-9a-f-]{36}$/);

    // Sync banner appears (progress bar visible) then completes (banner
    // unmounts on the "completed" event and a success toast surfaces).
    const progress = page.getByRole("progressbar", { name: "Sync progress" });
    await expect(progress).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("Sync completed")).toBeVisible({
      timeout: 15_000,
    });
    await expect(progress).toHaveCount(0, { timeout: 5_000 });
  });
});
