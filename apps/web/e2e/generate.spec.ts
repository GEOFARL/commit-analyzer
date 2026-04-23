import { expect, test } from "./fixtures";
import { MOCK_ACCESS_TOKEN, MOCK_PORT, MOCK_SEEDED_REPO_ID } from "./mock-server";

const MOCK_API_BASE = `http://127.0.0.1:${MOCK_PORT}`;

const SAMPLE_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
index e69de29..b6fc4c6 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -0,0 +1,3 @@
+export const signIn = async (email, password) => {
+  return await api.post("/auth/sign-in", { email, password });
+};
`;

// TTFT acceptance gate per the issue body and 10-testing.md §6. Measured from
// the moment the user clicks Generate to the first suggestion subject being
// painted in the DOM. The mock SSE handler flushes the first frame
// synchronously, so any regression here points at proxy buffering or the
// client parser, not test flake.
const TTFT_BUDGET_MS = 2_000;

const SUGGESTION_SUBJECTS = [
  "add email + password sign-in flow",
  "patch the long-running session refresh edge case",
  "tidy up auth module",
];

// Covers UC-C1 (basic streaming generation) and UC-C2 (policy-aware
// generation). The mock server stubs the SSE provider with a deterministic
// 3-suggestion stream so the assertions are stable; the live-provider
// counterpart lives in `generate.live.spec.ts` and is gated by E2E_REAL_LLM.
test.describe("generate — streaming, TTFT, copy, policy badges", () => {
  test("paste diff → first suggestion < 2 s, 3 cards with copy actions", async ({
    authedPage: page,
  }) => {
    await page.goto("/generate");

    await expect(
      page.getByRole("heading", { level: 1, name: /generate commit message/i }),
    ).toBeVisible();

    await page.getByLabel("Diff", { exact: true }).fill(SAMPLE_DIFF);

    const startedAt = Date.now();
    await page.getByRole("button", { name: /^Generate$/ }).click();

    // TTFT — the first suggestion subject must be visible inside the budget.
    // Use the subject text rather than `article` role since the streaming
    // placeholder also renders inside a card-like container.
    await expect(page.getByText(SUGGESTION_SUBJECTS[0]!)).toBeVisible({
      timeout: TTFT_BUDGET_MS,
    });
    const ttftMs = Date.now() - startedAt;
    expect(
      ttftMs,
      `TTFT was ${ttftMs}ms (budget ${TTFT_BUDGET_MS}ms)`,
    ).toBeLessThan(TTFT_BUDGET_MS);

    // Wait for the rest of the stream to flush.
    for (const subject of SUGGESTION_SUBJECTS.slice(1)) {
      await expect(page.getByText(subject)).toBeVisible();
    }

    // 3 suggestion cards, each with a Copy button. The header line lives in a
    // <pre> so the cards-as-articles count is exact.
    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(
        cards.nth(i).getByRole("button", { name: "Copy" }),
      ).toBeVisible();
    }

    // No-policy stream → every suggestion is marked Compliant, no per-rule
    // badges or destructive validation messages render.
    await expect(page.getByText("Compliant", { exact: true })).toHaveCount(3);
    await expect(page.getByText("Non-compliant")).toHaveCount(0);
  });

  test("with active policy → badges reflect validator results", async ({
    authedPage: page,
  }, testInfo) => {
    // Seed a strict policy via the mock API so we don't have to drive the
    // policy editor UI from the generate spec. Name is unique per
    // attempt — the mock server keeps state across retries inside one run, so
    // a static name would collide on the dropdown after a flaky retry.
    const policyName = `Strict E2E (generate ${testInfo.testId} #${testInfo.retry})`;
    const createRes = await page.request.post(
      `${MOCK_API_BASE}/repos/${MOCK_SEEDED_REPO_ID}/policies`,
      {
        headers: {
          authorization: `Bearer ${MOCK_ACCESS_TOKEN}`,
          "content-type": "application/json",
        },
        data: {
          name: policyName,
          rules: [
            { ruleType: "allowedTypes", ruleValue: ["feat"] },
            { ruleType: "maxSubjectLength", ruleValue: 30 },
          ],
        },
      },
    );
    expect(createRes.status()).toBe(201);
    const policy = (await createRes.json()) as { id: string };

    const activateRes = await page.request.post(
      `${MOCK_API_BASE}/repos/${MOCK_SEEDED_REPO_ID}/policies/${policy.id}/activate`,
      {
        headers: { authorization: `Bearer ${MOCK_ACCESS_TOKEN}` },
      },
    );
    expect(activateRes.status()).toBe(200);

    await page.goto("/generate");

    await page.getByLabel("Diff", { exact: true }).fill(SAMPLE_DIFF);

    // Select the seeded repo + freshly-created policy.
    await page.getByLabel(/^Repository/).click();
    await page
      .getByRole("option", { name: /acme\/seeded-repo/ })
      .click();

    await page.getByLabel(/^Policy/).click();
    await page.getByRole("option", { name: policyName }).click();

    await page.getByRole("button", { name: /^Generate$/ }).click();

    // First suggestion paints — confirms the request reached the proxy with
    // the policy id (otherwise validation field would be null and badges
    // wouldn't render below).
    await expect(page.getByText(SUGGESTION_SUBJECTS[0]!)).toBeVisible({
      timeout: TTFT_BUDGET_MS,
    });

    // Wait for all three to stream in.
    for (const subject of SUGGESTION_SUBJECTS.slice(1)) {
      await expect(page.getByText(subject)).toBeVisible();
    }

    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(3);

    // s0 "feat(auth): add email + password sign-in flow" — Type passes (feat
    // is allowed) but the subject is 33 chars, so Subject length fails.
    const card0 = cards.nth(0);
    await expect(card0.getByText("Non-compliant")).toBeVisible();
    await expect(card0.getByText(/Subject is 33 characters; max is 30/)).toBeVisible();

    // s1 "fix(auth): patch the long-running…" — both rules fail.
    const card1 = cards.nth(1);
    await expect(card1.getByText("Non-compliant")).toBeVisible();
    await expect(card1.getByText(/Type 'fix' is not in the allowed list/)).toBeVisible();

    // s2 "chore: tidy up auth module" — Type fails, Subject length passes
    // (19 chars). Asserts the per-rule badge granularity, not just the
    // aggregated compliant flag.
    const card2 = cards.nth(2);
    await expect(card2.getByText("Non-compliant")).toBeVisible();
    await expect(card2.getByText(/Type 'chore' is not in the allowed list/)).toBeVisible();
  });
});
