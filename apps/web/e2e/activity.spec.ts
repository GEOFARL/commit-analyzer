import { expect, test } from "./fixtures";
import { REDACT_FIXTURE_TOKEN } from "./mock-server";

test.describe("settings → activity", () => {
  test("mint key, see apikey.created row, filter, paginate, redact payload", async ({
    authedPage: page,
  }) => {
    // ── Mint an API key via the settings UI ─────────────────────────────────
    await page.goto("/settings/api-keys");
    await page.getByRole("button", { name: "Create key" }).click();
    await page.getByLabel("Key name").fill("Activity smoke test key");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Done", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Done", exact: true }).click();

    // ── Navigate to Activity via the settings sub-nav ───────────────────────
    await page
      .getByRole("navigation", { name: "Settings sections" })
      .getByRole("link", { name: "Activity" })
      .click();
    await page.waitForURL("**/settings/activity");

    await expect(
      page.getByRole("heading", { level: 2, name: "Activity" }),
    ).toBeVisible();

    // The freshly-minted key recorded an apikey.created event.
    const createdRow = page
      .locator('[data-testid="audit-row"][data-event-type="apikey.created"]')
      .first();
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText(/Activity smoke test key/);

    // ── Filter round-trips through the API and back to All ──────────────────
    await page
      .getByRole("combobox", { name: "Filter activity by event type" })
      .click();
    await page.getByRole("option", { name: "API key created" }).click();

    await expect(page).toHaveURL(/eventType=apikey\.created/);
    const visibleRows = page.locator('[data-testid="audit-row"]');
    await expect(visibleRows.first()).toBeVisible();
    const types = await visibleRows.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-event-type")),
    );
    expect(types.length).toBeGreaterThan(0);
    expect(new Set(types)).toEqual(new Set(["apikey.created"]));

    // Reset the filter via the dropdown.
    await page
      .getByRole("combobox", { name: "Filter activity by event type" })
      .click();
    await page.getByRole("option", { name: "All events" }).click();
    await expect(page).not.toHaveURL(/eventType=/);

    // ── Cursor pagination loads the next page without duplicates ────────────
    const idsFirstPage = await visibleRows.evaluateAll((els) =>
      els.map(
        (el) => el.querySelector("time")?.getAttribute("datetime") ?? "",
      ),
    );
    expect(idsFirstPage.length).toBe(50);

    await page.getByRole("button", { name: "Load more" }).click();
    await expect
      .poll(async () => visibleRows.count(), { timeout: 5_000 })
      .toBeGreaterThan(50);

    const allTimes = await visibleRows.evaluateAll((els) =>
      els.map(
        (el) => el.querySelector("time")?.getAttribute("datetime") ?? "",
      ),
    );
    // The seed has unique createdAt values per row, so no duplicates.
    expect(new Set(allTimes).size).toBe(allTimes.length);

    // ── Defense check: payload panel redacts secret-looking strings ─────────
    await page
      .getByRole("combobox", { name: "Filter activity by event type" })
      .click();
    await page.getByRole("option", { name: "Signed in" }).click();

    const loginRowWithToken = page
      .locator('[data-testid="audit-row"][data-event-type="auth.login"]')
      .first();
    await loginRowWithToken
      .getByRole("button", { name: "Show payload" })
      .click();

    const payloadJson = loginRowWithToken.locator(
      '[data-testid="audit-payload-json"]',
    );
    await expect(payloadJson).toBeVisible();
    await expect(payloadJson).toContainText("[REDACTED]");
    await expect(payloadJson).not.toContainText(REDACT_FIXTURE_TOKEN);
    // The page DOM as a whole must not leak the raw token.
    expect(await page.content()).not.toContain(REDACT_FIXTURE_TOKEN);
  });
});
