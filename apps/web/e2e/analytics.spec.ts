import { expect, test } from "./fixtures";
import { MOCK_SEEDED_REPO_ID } from "./mock-server";

const CHART_HEADINGS = [
  "Overview",
  "Commit timeline",
  "Quality trend",
  "Activity heatmap",
  "Quality distribution",
  "Top contributors",
  "Top files by churn",
] as const;

const SUMMARY_TILES = [
  "Total commits",
  "Contributors",
  "Avg quality",
  "CC compliance",
] as const;

test.describe("analytics dashboard", () => {
  test("renders all 7 charts with non-zero summary numbers", async ({
    authedPage: page,
  }) => {
    await page.goto(`/repositories/${MOCK_SEEDED_REPO_ID}`);

    await expect(
      page.getByRole("heading", { level: 1, name: "acme/seeded-repo" }),
    ).toBeVisible();

    for (const name of CHART_HEADINGS) {
      await expect(
        page.getByRole("heading", { level: 3, name }),
      ).toBeVisible();
    }

    // Each summary tile renders <p class="text-3xl">value</p><p>label</p>.
    // Walk from the label up to its sibling value, then assert it's non-zero
    // so an empty repo never silently passes this gate.
    for (const label of SUMMARY_TILES) {
      const valueText = await page
        .locator("p", { hasText: new RegExp(`^${label}$`) })
        .locator("xpath=preceding-sibling::p[contains(@class,'text-3xl')][1]")
        .first()
        .innerText();
      const numeric = Number(valueText.replace(/[^\d.-]/g, ""));
      expect(numeric, `${label} should be non-zero (got "${valueText}")`)
        .toBeGreaterThan(0);
    }
  });
});
