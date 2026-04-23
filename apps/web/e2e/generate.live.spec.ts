import { expect, test } from "./fixtures";
import { SAMPLE_DIFF, TTFT_BUDGET_MS } from "./generate.constants";

// Optional smoke suite that exercises the same generate flow against a real
// staging LLM provider. Skipped by default — the mock SSE stub in the main
// `generate.spec.ts` covers PR-level CI. Enable for targeted runs by setting:
//
//   E2E_REAL_LLM=1                # opt-in
//   E2E_REAL_LLM_BASE_URL=https://staging.example.com   # web app under test
//
// The runner expects the targeted environment to already have a valid Anthropic
// or OpenAI key configured for the test user, and a connected repository so
// the page renders past the empty-state guards. Auth is whatever the targeted
// environment uses — this suite does not inject Supabase fixtures.
const RUN_LIVE = process.env.E2E_REAL_LLM === "1";
const LIVE_BASE_URL = process.env.E2E_REAL_LLM_BASE_URL ?? "";

test.describe("generate (live LLM)", () => {
  test.skip(!RUN_LIVE, "set E2E_REAL_LLM=1 to enable the live smoke suite");
  test.skip(
    RUN_LIVE && !LIVE_BASE_URL,
    "E2E_REAL_LLM=1 requires E2E_REAL_LLM_BASE_URL",
  );

  test("first suggestion streams within the TTFT budget", async ({ page }) => {
    await page.goto(`${LIVE_BASE_URL}/generate`);

    await expect(
      page.getByRole("heading", { level: 1, name: /generate commit message/i }),
    ).toBeVisible();

    await page.getByLabel("Diff", { exact: true }).fill(SAMPLE_DIFF);

    await page.getByRole("button", { name: /^Generate$/ }).click();

    // Don't lock the assertion to a specific subject string — real LLM output
    // is non-deterministic. Wait for the first suggestion card instead.
    // `toBeVisible({ timeout })` is the TTFT gate.
    await expect(page.getByRole("article").first()).toBeVisible({
      timeout: TTFT_BUDGET_MS,
    });

    // Stream is expected to settle within ~30 s; the per-suggestion count is
    // bounded by the contract (max 5).
    await expect
      .poll(async () => (await page.getByRole("article").count()), {
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(1);
  });
});
