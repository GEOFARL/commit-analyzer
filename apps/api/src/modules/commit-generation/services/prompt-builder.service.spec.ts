import type { PolicyRuleInput } from "@commit-analyzer/contracts";
import { parseAndStripDiff } from "@commit-analyzer/diff-parser";
import { describe, expect, it } from "vitest";

import { PROMPT_CHAR_BUDGET } from "./prompt-builder.constants.js";
import { PromptBuilderService } from "./prompt-builder.service.js";
import type { PromptPolicy } from "./prompt-builder.types.js";

const SAMPLE_DIFF = [
  "diff --git a/src/auth.ts b/src/auth.ts",
  "index 1..2 100644",
  "--- a/src/auth.ts",
  "+++ b/src/auth.ts",
  "@@ -1,3 +1,4 @@",
  " export function login(user: string) {",
  "-  return true;",
  "+  if (!user) throw new Error('user required');",
  "+  return true;",
  " }",
].join("\n");

const policy = (rules: PolicyRuleInput[]): PromptPolicy => ({ rules });

describe("PromptBuilderService", () => {
  const service = new PromptBuilderService();
  const parsed = parseAndStripDiff(SAMPLE_DIFF);

  it("produces default system prompt without a policy", () => {
    const { system } = service.build(parsed);
    expect(system).toMatchInlineSnapshot(`
      "You are an expert Git commit author. Produce 3 distinct commit
      messages for the diff below. Use the Conventional Commits format.
      Each message must:
      - match the header format \`<type>(<scope>)?: <subject>\` where subject ≤ 72 chars, imperative mood, no trailing period
      - include a body wrapped at 100 cols preceded by a blank line (optional unless required below)
      - include a footer with BREAKING CHANGE or issue references only when applicable
      - pick type from [feat,fix,docs,style,refactor,test,chore,build,ci,perf,revert]
      - pick scope from [<any>] (omit if N/A)

      Return suggestions as a JSON array of objects shaped like
      { "type": string, "scope"?: string, "subject": string, "body"?: string, "footer"?: string }
      with no surrounding prose."
    `);
  });

  it("embeds a full policy as explicit constraints", () => {
    const { system } = service.build(
      parsed,
      policy([
        { ruleType: "allowedTypes", ruleValue: ["feat", "fix", "chore"] },
        {
          ruleType: "allowedScopes",
          ruleValue: { kind: "list", values: ["auth", "api"] },
        },
        { ruleType: "maxSubjectLength", ruleValue: 50 },
        { ruleType: "bodyRequired", ruleValue: true },
        { ruleType: "footerRequired", ruleValue: true },
      ]),
    );
    expect(system).toMatchInlineSnapshot(`
      "You are an expert Git commit author. Produce 3 distinct commit
      messages for the diff below. Use the Conventional Commits format.
      Each message must:
      - match the header format \`<type>(<scope>)?: <subject>\` where subject ≤ 50 chars, imperative mood, no trailing period
      - include a body wrapped at 100 cols preceded by a blank line (optional unless required below)
      - include a footer with BREAKING CHANGE or issue references only when applicable
      - pick type from [feat,fix,chore]
      - pick scope from [auth,api] (omit if N/A)

      Additional policy constraints:
      - A non-empty body is required for every suggestion.
      - A footer with a BREAKING CHANGE note or issue reference is required.

      Return suggestions as a JSON array of objects shaped like
      { "type": string, "scope"?: string, "subject": string, "body"?: string, "footer"?: string }
      with no surrounding prose."
    `);
  });

  it("renders regex scopes inline", () => {
    const { system } = service.build(
      parsed,
      policy([
        {
          ruleType: "allowedScopes",
          ruleValue: { kind: "regex", pattern: "^[a-z]+$" },
        },
      ]),
    );
    expect(system).toContain("pick scope from [matching /^[a-z]+$/]");
  });

  it("skips extras when bodyRequired/footerRequired are false", () => {
    const { system } = service.build(
      parsed,
      policy([
        { ruleType: "bodyRequired", ruleValue: false },
        { ruleType: "footerRequired", ruleValue: false },
      ]),
    );
    expect(system).not.toContain("Additional policy constraints");
  });

  it("honours count option within allowed range", () => {
    expect(service.build(parsed, undefined, { count: 5 }).system).toContain(
      "Produce 5 distinct",
    );
    expect(service.build(parsed, undefined, { count: 99 }).system).toContain(
      "Produce 5 distinct",
    );
    expect(service.build(parsed, undefined, { count: 0 }).system).toContain(
      "Produce 1 distinct",
    );
  });

  it("includes parsed diff and file summary in the user prompt", () => {
    const { user } = service.build(parsed);
    expect(user).toMatchInlineSnapshot(`
      "Files touched:
      src/auth.ts

      Diff:
      diff --git a/src/auth.ts b/src/auth.ts
      index 1..2 100644
      --- a/src/auth.ts
      +++ b/src/auth.ts
      @@ -1,3 +1,4 @@
       export function login(user: string) {
      -  return true;
      +  if (!user) throw new Error('user required');
      +  return true;
       }"
    `);
  });

  it("notes truncation when the parser dropped content", () => {
    const { user } = service.build({ ...parsed, truncated: true });
    expect(user).toContain("Diff was truncated");
  });

  it("stays under the prompt char budget for a token-budgeted parsed diff", () => {
    const largeDiff = buildLargeDiff();
    const parsedLarge = parseAndStripDiff(largeDiff);
    expect(parsedLarge.truncated).toBe(true);
    const { system, user } = service.build(parsedLarge);
    expect(system.length + user.length).toBeLessThanOrEqual(PROMPT_CHAR_BUDGET);
  });

  it("throws if the resulting prompt exceeds the char budget", () => {
    const oversized = {
      files: [],
      summary: "x".repeat(PROMPT_CHAR_BUDGET + 1),
      truncated: false,
    };
    expect(() => service.build(oversized)).toThrow(/exceeds char budget/);
  });
});

function buildLargeDiff(): string {
  const hunks: string[] = [];
  for (let fileIdx = 0; fileIdx < 20; fileIdx += 1) {
    hunks.push(`diff --git a/src/f${fileIdx}.ts b/src/f${fileIdx}.ts`);
    hunks.push("index 1..2 100644");
    hunks.push(`--- a/src/f${fileIdx}.ts`);
    hunks.push(`+++ b/src/f${fileIdx}.ts`);
    for (let hunkIdx = 0; hunkIdx < 10; hunkIdx += 1) {
      const base = hunkIdx * 20;
      hunks.push(`@@ -${base + 1},10 +${base + 1},10 @@`);
      for (let line = 0; line < 20; line += 1) {
        hunks.push(
          line % 2 === 0
            ? `-old line ${fileIdx}-${hunkIdx}-${line}`
            : `+new line ${fileIdx}-${hunkIdx}-${line}`,
        );
      }
    }
  }
  return hunks.join("\n");
}
