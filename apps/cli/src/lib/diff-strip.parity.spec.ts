import * as pkg from "@commit-analyzer/diff-parser";
import { describe, expect, it } from "vitest";

import * as cli from "./diff-strip.js";

const FIXTURES: Array<{ name: string; input: string }> = [
  { name: "empty", input: "" },
  {
    name: "single-file-single-hunk",
    input: [
      "diff --git a/src/foo.ts b/src/foo.ts",
      "index abc..def 100644",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1,3 +1,3 @@",
      "-old",
      "+new",
      " context",
    ].join("\n"),
  },
  {
    name: "secret-bearing",
    input: [
      "diff --git a/.env b/.env",
      "index 1..2 100644",
      "--- a/.env",
      "+++ b/.env",
      '@@ -1,2 +1,2 @@',
      '-API_KEY="abcdef0123456789ABCDEF"',
      '+API_KEY="zzzzzzzzzzzzzzzzzzzzzz"',
      " contact=alice@example.com",
    ].join("\n"),
  },
];

describe("cli diff-strip — parity with @commit-analyzer/diff-parser", () => {
  it("re-exports the same function references (no forked copy)", () => {
    expect(cli.parseAndStripDiff).toBe(pkg.parseAndStripDiff);
    expect(cli.renderParsedDiff).toBe(pkg.renderParsedDiff);
    expect(cli.DIFF_TOKEN_BUDGET).toBe(pkg.DIFF_TOKEN_BUDGET);
  });

  it.each(FIXTURES)(
    "produces byte-identical render + summary + truncated for $name",
    ({ input }) => {
      const fromCli = cli.parseAndStripDiff(input);
      const fromPkg = pkg.parseAndStripDiff(input);

      expect(cli.renderParsedDiff(fromCli)).toBe(
        pkg.renderParsedDiff(fromPkg),
      );
      expect(fromCli.summary).toBe(fromPkg.summary);
      expect(fromCli.truncated).toBe(fromPkg.truncated);
    },
  );
});
