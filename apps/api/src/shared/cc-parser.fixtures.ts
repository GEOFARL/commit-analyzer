import type { ConventionalCommit } from "./cc-parser.js";

export interface Fixture {
  message: string;
  expected: ConventionalCommit;
}

export const fixtures: Fixture[] = [
  // ── Valid: simple one-liners ─────────────────────────────────────────
  {
    message: "feat: add user authentication",
    expected: {
      type: "feat",
      subject: "add user authentication",
      breaking: false,
      valid: true,
    },
  },
  {
    message: "fix(auth): resolve token expiry bug",
    expected: {
      type: "fix",
      scope: "auth",
      subject: "resolve token expiry bug",
      breaking: false,
      valid: true,
    },
  },
  {
    message: "chore: update dependencies",
    expected: {
      type: "chore",
      subject: "update dependencies",
      breaking: false,
      valid: true,
    },
  },
  {
    message: "docs: improve README",
    expected: {
      type: "docs",
      subject: "improve README",
      breaking: false,
      valid: true,
    },
  },
  {
    message: "refactor(parser): simplify state machine",
    expected: {
      type: "refactor",
      scope: "parser",
      subject: "simplify state machine",
      breaking: false,
      valid: true,
    },
  },
  {
    message: "test(api): add integration tests for auth",
    expected: {
      type: "test",
      scope: "api",
      subject: "add integration tests for auth",
      breaking: false,
      valid: true,
    },
  },
  {
    message: "ci: configure github actions pipeline",
    expected: {
      type: "ci",
      subject: "configure github actions pipeline",
      breaking: false,
      valid: true,
    },
  },
  {
    message: "perf(db): add index on user_id column",
    expected: {
      type: "perf",
      scope: "db",
      subject: "add index on user_id column",
      breaking: false,
      valid: true,
    },
  },
  {
    message: "build(deps): upgrade typescript to 5.4",
    expected: {
      type: "build",
      scope: "deps",
      subject: "upgrade typescript to 5.4",
      breaking: false,
      valid: true,
    },
  },
  {
    message: "style: format codebase with prettier",
    expected: {
      type: "style",
      subject: "format codebase with prettier",
      breaking: false,
      valid: true,
    },
  },

  // ── Valid: breaking changes via ! ─────────────────────────────────────
  {
    message: "feat!: drop support for node 14",
    expected: {
      type: "feat",
      subject: "drop support for node 14",
      breaking: true,
      valid: true,
    },
  },
  {
    message: "feat(api)!: redesign authentication endpoints",
    expected: {
      type: "feat",
      scope: "api",
      subject: "redesign authentication endpoints",
      breaking: true,
      valid: true,
    },
  },
  {
    message: "fix(core)!: change default timeout from 30s to 10s",
    expected: {
      type: "fix",
      scope: "core",
      subject: "change default timeout from 30s to 10s",
      breaking: true,
      valid: true,
    },
  },

  // ── Valid: with body ──────────────────────────────────────────────────
  {
    message:
      "fix: handle null response\n\nPreviously the code crashed when the API returned null.\nNow it returns an empty array instead.",
    expected: {
      type: "fix",
      subject: "handle null response",
      body: "Previously the code crashed when the API returned null.\nNow it returns an empty array instead.",
      breaking: false,
      valid: true,
    },
  },
  {
    message: "refactor: extract payment service\n\nMoves payment logic out of the controller.\nNo behaviour change.",
    expected: {
      type: "refactor",
      subject: "extract payment service",
      body: "Moves payment logic out of the controller.\nNo behaviour change.",
      breaking: false,
      valid: true,
    },
  },

  // ── Valid: with body and footer ───────────────────────────────────────
  {
    message:
      "feat: add stripe payment integration\n\nAdds full Stripe checkout support.\n\nBREAKING CHANGE: old /pay endpoint removed",
    expected: {
      type: "feat",
      subject: "add stripe payment integration",
      body: "Adds full Stripe checkout support.",
      footer: "BREAKING CHANGE: old /pay endpoint removed",
      breaking: true,
      valid: true,
    },
  },
  {
    message:
      "fix(auth): clear session on logout\n\nEnsures all tokens are invalidated.\n\nCloses #42",
    expected: {
      type: "fix",
      scope: "auth",
      subject: "clear session on logout",
      body: "Ensures all tokens are invalidated.",
      footer: "Closes #42",
      breaking: false,
      valid: true,
    },
  },
  {
    message:
      "feat(billing)!: replace PayPal with Stripe\n\nFull migration to Stripe SDK v3.\n\nBREAKING-CHANGE: PayPal webhook URLs no longer work",
    expected: {
      type: "feat",
      scope: "billing",
      subject: "replace PayPal with Stripe",
      body: "Full migration to Stripe SDK v3.",
      footer: "BREAKING-CHANGE: PayPal webhook URLs no longer work",
      breaking: true,
      valid: true,
    },
  },

  // ── Valid: revert ─────────────────────────────────────────────────────
  {
    message:
      "revert: feat: add experimental dark mode\n\nThis reverts commit a1b2c3d.",
    expected: {
      type: "revert",
      subject: "feat: add experimental dark mode",
      body: "This reverts commit a1b2c3d.",
      breaking: false,
      valid: true,
    },
  },

  // ── Valid: multi-paragraph body ───────────────────────────────────────
  {
    message:
      "docs(api): document rate limiting\n\nAdds details about tier-based throttling.\n\nIncludes examples for each tier.\n\nRef: #99",
    expected: {
      type: "docs",
      scope: "api",
      subject: "document rate limiting",
      body: "Adds details about tier-based throttling.\n\nIncludes examples for each tier.",
      footer: "Ref: #99",
      breaking: false,
      valid: true,
    },
  },

  // ── Valid: hyphenated type ────────────────────────────────────────────
  {
    message: "build-system: switch to esbuild",
    expected: {
      type: "build-system",
      subject: "switch to esbuild",
      breaking: false,
      valid: true,
    },
  },

  // ── Valid: scope with hyphens ─────────────────────────────────────────
  {
    message: "feat(user-profile): add avatar upload",
    expected: {
      type: "feat",
      scope: "user-profile",
      subject: "add avatar upload",
      breaking: false,
      valid: true,
    },
  },

  // ── Valid: footer with hash token ─────────────────────────────────────
  {
    message: "fix: correct off-by-one in pagination\n\nFixes edge case at page boundary.\n\nFixes #101",
    expected: {
      type: "fix",
      subject: "correct off-by-one in pagination",
      body: "Fixes edge case at page boundary.",
      footer: "Fixes #101",
      breaking: false,
      valid: true,
    },
  },

  // ── Valid: multiple footer tokens ─────────────────────────────────────
  {
    message:
      "feat(oauth): add google sign-in\n\nIntegrates Google OAuth2 flow.\n\nCloses #55\nReviewed-by: alice",
    expected: {
      type: "feat",
      scope: "oauth",
      subject: "add google sign-in",
      body: "Integrates Google OAuth2 flow.",
      footer: "Closes #55\nReviewed-by: alice",
      breaking: false,
      valid: true,
    },
  },

  // ── Invalid: uppercase type ───────────────────────────────────────────
  {
    message: "Fix: resolve crash on startup",
    expected: { type: "", subject: "", breaking: false, valid: false },
  },

  // ── Invalid: missing space after colon ───────────────────────────────
  {
    message: "feat:add missing space",
    expected: { type: "", subject: "", breaking: false, valid: false },
  },

  // ── Invalid: empty message ────────────────────────────────────────────
  {
    message: "",
    expected: { type: "", subject: "", breaking: false, valid: false },
  },

  // ── Invalid: whitespace only ──────────────────────────────────────────
  {
    message: "   ",
    expected: { type: "", subject: "", breaking: false, valid: false },
  },

  // ── Invalid: plain text (no type) ────────────────────────────────────
  {
    message: "update the readme file",
    expected: { type: "", subject: "", breaking: false, valid: false },
  },

  // ── Invalid: merge commit ─────────────────────────────────────────────
  {
    message: "Merge pull request #42 from feature/foo",
    expected: { type: "", subject: "", breaking: false, valid: false },
  },

  // ── Invalid: empty scope ──────────────────────────────────────────────
  {
    message: "feat(): empty scope not allowed",
    expected: { type: "", subject: "", breaking: false, valid: false },
  },

  // ── Invalid: body not separated by blank line ─────────────────────────
  {
    message: "fix: correct typo\nThis line should be separated by a blank line",
    expected: { type: "", subject: "", breaking: false, valid: false },
  },

  // ── Invalid: numeric type ─────────────────────────────────────────────
  {
    message: "123: not a valid type",
    expected: { type: "", subject: "", breaking: false, valid: false },
  },
];
