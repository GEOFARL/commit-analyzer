import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { SAMPLE_DIFF, TTFT_BUDGET_MS } from "./generate.constants";
import { MOCK_ACCESS_TOKEN, MOCK_PORT, MOCK_SEEDED_REPO_ID } from "./mock-server";

const MOCK_API_BASE = `http://127.0.0.1:${MOCK_PORT}`;

const SUGGESTION_SUBJECTS = [
  "add email + password sign-in flow",
  "patch the long-running session refresh edge case",
  "tidy up auth module",
];

// Hydrates the generate form with a diff via the app's existing sessionStorage
// bridge (`QUICK_GENERATE_DIFF_STORAGE_KEY`, see `generate-view.tsx`). Used
// instead of Playwright's `fill()` because the editor is now a CodeMirror 6
// instance — `fill()` on its contenteditable goes through `execCommand` and
// doesn't flow into CodeMirror's state, so onChange never fires and the
// Generate button never enables.
//
// We navigate first so sessionStorage is scoped to the target origin, then
// reload — the generate-view mount effect reads and clears the key on every
// mount, so the reload is the handoff point.
const seedDiffAndOpen = async (page: Page, diff: string) => {
  await page.goto("/generate");
  await page.evaluate((value) => {
    window.sessionStorage.setItem("dashboard.quickGenerateDiff", value);
  }, diff);
  await page.reload();
};

// Covers UC-C1 (basic streaming generation) and UC-C2 (policy-aware
// generation). The mock server stubs the SSE provider with a deterministic
// 3-suggestion stream so the assertions are stable; the live-provider
// counterpart lives in `generate.live.spec.ts` and is gated by E2E_REAL_LLM.
test.describe("generate — streaming, TTFT, copy, policy badges", () => {
  test("paste diff → first suggestion < 2 s, 3 cards with copy actions", async ({
    authedPage: page,
  }) => {
    await seedDiffAndOpen(page, SAMPLE_DIFF);

    await expect(
      page.getByRole("heading", { level: 1, name: /generate commit message/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /^Generate$/ }).click();

    // TTFT — the first suggestion subject must be visible within the budget.
    // Playwright's `toBeVisible({ timeout })` is the single source of truth
    // here: it polls from the moment the click resolves and fails the test
    // if the locator isn't satisfied inside the budget.
    await expect(page.getByText(SUGGESTION_SUBJECTS[0]!)).toBeVisible({
      timeout: TTFT_BUDGET_MS,
    });

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
    // policy editor UI from the generate spec. Name is unique per attempt
    // because mock-server module state persists across in-run retries (by
    // design — see `policies` Map in mock-server.ts), so a static name would
    // collide on the dropdown after a flaky retry.
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

    await seedDiffAndOpen(page, SAMPLE_DIFF);

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

    // Validator-message assertions are scoped to the per-rule failure list
    // (the suggestion-card renders one <li> per failing rule with a
    // "<Label>: <message>" prefix). They check structure (length numbers,
    // forbidden type tokens) rather than verbatim wording: the mock and the
    // production rules currently phrase the same failure differently
    // (mock: "Type 'X' is not in the allowed list" vs.
    //  prod: 'type "X" is not allowed. Allowed: …'). Pinning to mock copy
    // would let prod-side phrasing drift ship UI regressions silently.

    // s0 "feat(auth): add email + password sign-in flow" — Type passes (feat
    // is allowed) but the subject is 33 chars, so Subject length fails.
    const card0 = cards.nth(0);
    await expect(card0.getByText("Non-compliant")).toBeVisible();
    const card0Failures = card0.getByRole("listitem");
    await expect(card0Failures).toHaveCount(1);
    await expect(
      card0Failures.filter({ hasText: /^Subject length:/ }),
    ).toContainText(/\b33\b.*\b30\b/);

    // s1 "fix(auth): patch the long-running…" — both rules fail; per-rule
    // failure list contains both Type and Subject length entries.
    const card1 = cards.nth(1);
    await expect(card1.getByText("Non-compliant")).toBeVisible();
    const card1Failures = card1.getByRole("listitem");
    await expect(card1Failures).toHaveCount(2);
    await expect(
      card1Failures.filter({ hasText: /^Type:/ }),
    ).toContainText(/['"]?fix['"]?/);

    // s2 "chore: tidy up auth module" — Type fails, Subject length passes
    // (19 chars). Asserts the per-rule badge granularity, not just the
    // aggregated compliant flag.
    const card2 = cards.nth(2);
    await expect(card2.getByText("Non-compliant")).toBeVisible();
    const card2Failures = card2.getByRole("listitem");
    await expect(card2Failures).toHaveCount(1);
    await expect(
      card2Failures.filter({ hasText: /^Type:/ }),
    ).toContainText(/['"]?chore['"]?/);
  });

  // T-6.10 — the CodeMirror editor runs a unified-diff validator; Generate
  // must stay disabled for prose input and re-enable once the buffer holds a
  // syntactically valid diff. Driven via the Quick-Generate sessionStorage
  // bridge because `fill()` on CodeMirror's contenteditable doesn't route
  // through the editor's state.
  test("submit is gated by unified-diff validation", async ({
    authedPage: page,
  }) => {
    await seedDiffAndOpen(
      page,
      "this is prose, not a unified diff — no hunks.",
    );

    const generateButton = page.getByRole("button", { name: /^Generate$/ });
    await expect(
      page.getByText(/not a valid unified diff/i),
    ).toBeVisible();
    await expect(generateButton).toBeDisabled();

    // Swap the buffer for a valid diff via the same bridge + reload. The
    // generate page clears the sessionStorage key on mount so we re-seed
    // between navigations.
    await page.evaluate((value) => {
      window.sessionStorage.setItem("dashboard.quickGenerateDiff", value);
    }, SAMPLE_DIFF);
    await page.reload();

    await expect(
      page.getByRole("status").filter({ hasText: /\+3\/-0/ }),
    ).toBeVisible();
    await expect(generateButton).toBeEnabled();
  });
});
