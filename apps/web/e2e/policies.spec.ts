import { expect, test } from "./fixtures";
import { MOCK_SEEDED_REPO_ID } from "./mock-server";

// Covers UC-D1 (CRUD), UC-D2 (activation atomic swap), UC-D3 (manual validation
// with per-rule pass/fail). The editor uses the seeded connected repo; the
// mock server persists policies in-memory for the duration of the test run.
test.describe("policies — create, activate, validate, deactivate", () => {
  test("end-to-end policy lifecycle with failing manual validation", async ({
    authedPage: page,
  }) => {
    await page.goto(`/repositories/${MOCK_SEEDED_REPO_ID}/policies`);

    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /acme\/seeded-repo policies/i,
      }),
    ).toBeVisible();

    // Empty state surfaces a "Create your first policy" CTA; the top-right
    // "New policy" button also works. Use the top-right one to stay stable
    // as the list grows during the test.
    await page
      .getByRole("button", { name: "New policy", exact: true })
      .click();

    const createDialog = page.getByRole("dialog");
    await createDialog.getByLabel("Policy name").fill("Strict E2E policy");
    await createDialog.getByRole("button", { name: "Create" }).click();

    // Create → redirect to the editor for the new policy.
    await page.waitForURL(
      new RegExp(
        `/repositories/${MOCK_SEEDED_REPO_ID}/policies/[0-9a-f-]{36}(?:\\?|$)`,
      ),
    );
    await expect(
      page.getByRole("heading", { level: 1, name: /Strict E2E policy/i }),
    ).toBeVisible();

    // Add two rules via the grid of Add-rule cards (aria-labels come from
    // messages.policies.editor.addRuleAria).
    await page
      .getByRole("button", { name: "Add Allowed types rule" })
      .click();
    await page.getByLabel("Types", { exact: true }).fill("feat, fix");

    await page
      .getByRole("button", { name: "Add Max subject length rule" })
      .click();
    await page.getByLabel("Characters", { exact: true }).fill("20");

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("All changes saved")).toBeVisible();

    // Activate — after save the button becomes enabled. Scope to the editor
    // header to avoid matching the manual-validate panel's surrounding UI.
    await page
      .getByRole("button", { name: "Activate", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { level: 1 }).getByText("Active policy"),
    ).toBeVisible();

    // Manual validation — paste a message that fails both saved rules.
    const failingMessage =
      "banana(auth): a very long invalid subject that surely exceeds twenty";
    await page.getByLabel("Commit message", { exact: true }).fill(failingMessage);

    // Debounced 400ms → request → aggregated banner announces failures.
    await expect(page.getByText(/2 rules? failed/i)).toBeVisible({
      timeout: 5_000,
    });

    // Per-rule pass/fail rows render the rule label + a "Failed" badge +
    // the server-provided message with the specific reason.
    const allowedTypesRow = page
      .getByRole("listitem")
      .filter({ hasText: "Allowed types" });
    await expect(allowedTypesRow.getByText("Failed")).toBeVisible();
    await expect(
      allowedTypesRow.getByText(/Type 'banana' is not in the allowed list/),
    ).toBeVisible();

    const maxLengthRow = page
      .getByRole("listitem")
      .filter({ hasText: "Max subject length" });
    await expect(maxLengthRow.getByText("Failed")).toBeVisible();
    await expect(
      maxLengthRow.getByText(/Subject is \d+ characters; max is 20/),
    ).toBeVisible();

    // Deactivate — the UI has no direct deactivate action. Per UC-D2 the
    // activation is an atomic swap, so deactivating the strict policy is
    // modeled as activating a different one on the same repo.
    await page.getByRole("link", { name: "Back to policies" }).click();
    await page.waitForURL(
      new RegExp(`/repositories/${MOCK_SEEDED_REPO_ID}/policies$`),
    );

    await page
      .getByRole("button", { name: "New policy", exact: true })
      .click();
    const secondDialog = page.getByRole("dialog");
    await secondDialog.getByLabel("Policy name").fill("Relaxed baseline");
    await secondDialog.getByRole("button", { name: "Create" }).click();

    await page.waitForURL(
      new RegExp(
        `/repositories/${MOCK_SEEDED_REPO_ID}/policies/[0-9a-f-]{36}(?:\\?|$)`,
      ),
    );
    await page.getByRole("link", { name: "Back to policies" }).click();
    await page.waitForURL(
      new RegExp(`/repositories/${MOCK_SEEDED_REPO_ID}/policies$`),
    );

    // Two policies now listed. Activate Relaxed baseline to swap — the
    // strict one becomes inactive.
    const relaxedItem = page
      .getByRole("listitem")
      .filter({ hasText: "Relaxed baseline" });
    await relaxedItem
      .getByRole("button", { name: "Activate", exact: true })
      .click();

    const strictItem = page
      .getByRole("listitem")
      .filter({ hasText: "Strict E2E policy" });
    await expect(strictItem.getByText("Inactive")).toBeVisible();
    await expect(relaxedItem.getByText("Active", { exact: true })).toBeVisible();
  });
});
