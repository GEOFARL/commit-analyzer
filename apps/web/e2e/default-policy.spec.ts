import { expect, test } from "./fixtures";

// Covers UC-F2: set the user-level default policy template, then connect a
// new repository and observe that the policy was auto-created and activated
// for it. Also exercises the Save / Clear flow on the settings page.
test.describe("settings → default policy", () => {
  test("save template, connect a repo, see auto-created Default policy, then clear", async ({
    authedPage: page,
  }) => {
    // ── 1. Author the template via the settings page ────────────────────────
    await page.goto("/settings/default-policy");

    await expect(
      page.getByRole("heading", { level: 2, name: /default policy/i }),
    ).toBeVisible();

    // Enabled toggle is on by default; leave it. Add one rule via the
    // grid of Add-rule cards (aria-labels come from policies.editor.addRuleAria).
    await page
      .getByRole("button", { name: "Add Allowed types rule" })
      .click();
    await page.getByLabel("Types", { exact: true }).fill("feat, fix");

    await page.getByRole("button", { name: "Save template" }).click();
    await expect(page.getByText("All changes saved")).toBeVisible();

    // ── 2. Connect a new repository and verify auto-applied policy ──────────
    await page.goto("/repositories");
    const freshCard = page
      .locator("div.group")
      .filter({ hasText: "acme/auto-policy-repo" })
      .filter({ has: page.getByRole("button", { name: "Connect" }) })
      .first();
    await freshCard.getByRole("button", { name: "Connect" }).click();

    // Wait for the connected card; navigate to the analytics page to resolve
    // the persisted (non-optimistic) repo id from the URL. Optimistic UI
    // returns "optimistic:NNNN" until the connect mutation settles.
    const connectedCard = page
      .locator("div.group")
      .filter({ hasText: "acme/auto-policy-repo" })
      .filter({ has: page.getByRole("link", { name: "View analytics" }) })
      .first();
    await expect(connectedCard).toBeVisible({ timeout: 10_000 });
    await connectedCard.getByRole("link", { name: "View analytics" }).click();
    await page.waitForURL(/\/repositories\/[0-9a-f-]{36}$/, {
      timeout: 10_000,
    });
    const repoId = page.url().match(/\/repositories\/([0-9a-f-]{36})$/)?.[1];
    expect(repoId).toMatch(/^[0-9a-f-]{36}$/);

    await page.goto(`/repositories/${repoId}/policies`);
    await expect(
      page.getByRole("heading", { level: 2, name: /acme\/auto-policy-repo policies/i }),
    ).toBeVisible();
    // The auto-applied "Default" policy is present and active.
    const defaultRow = page
      .getByRole("listitem")
      .filter({ hasText: "Default" })
      .first();
    await expect(defaultRow).toBeVisible();
    await expect(defaultRow.getByText("Active", { exact: true })).toBeVisible();

    // ── 3. Clear the template via the settings page ─────────────────────────
    await page.goto("/settings/default-policy");
    await page.getByRole("button", { name: "Clear template" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Clear template" }).click();
    // Toast surfaces on success; the form reseeds to defaults (no rules,
    // enabled remains true) and the Clear button becomes disabled.
    await expect(page.getByText("Default policy cleared.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Clear template" }),
    ).toBeDisabled();
  });
});
